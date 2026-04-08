/**
 * AI Chat Router
 *
 * Provides a role-aware chat endpoint for admin and partner admins.
 * The LLM can call tools to: list/create orgs & users, generate reports,
 * navigate the UI, and summarise pasted emails or uploaded documents.
 *
 * RBAC enforcement:
 *   - Platform admins (clientId=null) can see all data
 *   - Partner admins (clientId!=null) can ONLY see/modify their own partner's data
 *   - Every tool executor enforces ownership checks before returning data
 *   - No cross-partner data leakage is possible
 *
 * Audit logging:
 *   - Every chat interaction is logged (user prompt + AI response)
 *   - Every tool call is logged with arguments, result, status, and timing
 *   - RBAC denials are logged with status="denied"
 *   - All logs include actor, clientId, and target references for filtering
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import type { Message, Tool, ToolCall } from "../_core/llm";
import { getDb } from "../db";
import {
  organizations,
  users,
  clients,
  partnerTaskTemplates,
  aiAuditLogs,
  intakeResponses,
  intakeFileAttachments,
  taskCompletion,
  fileAttachments,
  validationResults,
  orgNotes,
  sectionProgress,
  activityFeed,
  questions,
} from "../../drizzle/schema";
import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { questionnaireSections } from "../../shared/questionnaireData";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "../../shared/taskDefs";
import { fetchConnectivityForOrg } from "../connectivityHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatAction =
  | { type: "navigate"; url: string }
  | { type: "refresh_orgs" }
  | { type: "refresh_users" };

type ToolResult = {
  callId: string;
  name: string;
  result: unknown;
  action?: ChatAction;
  /** Audit metadata populated by executors */
  audit?: {
    category: "read" | "write" | "navigate" | "extract";
    status: "success" | "error" | "denied";
    organizationSlug?: string;
    organizationId?: number;
    targetUserEmail?: string;
    targetUserId?: number;
    errorMessage?: string;
  };
};

type UserContext = {
  id?: number;
  clientId: number | null | undefined;
  email: string | null | undefined;
  role: string;
};

// ---------------------------------------------------------------------------
// Audit logging helper
// ---------------------------------------------------------------------------

/**
 * Writes a single audit log row. Fire-and-forget — errors are caught and logged
 * to console so they never break the main flow.
 */
async function writeAuditLog(entry: {
  action: string;
  category: "chat" | "read" | "write" | "navigate" | "extract";
  actorId?: number | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  clientId?: number | null;
  organizationId?: number | null;
  organizationSlug?: string | null;
  targetUserId?: number | null;
  targetUserEmail?: string | null;
  userPrompt?: string | null;
  aiResponse?: string | null;
  toolArgs?: string | null;
  toolResult?: string | null;
  status: "success" | "error" | "denied";
  errorMessage?: string | null;
  ipAddress?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Truncate large fields to prevent DB column overflow
    const truncate = (s: string | null | undefined, max: number) =>
      s && s.length > max ? s.slice(0, max) + "...[truncated]" : s ?? null;

    await db.insert(aiAuditLogs).values({
      action: entry.action,
      category: entry.category,
      actorId: entry.actorId ?? null,
      actorEmail: truncate(entry.actorEmail, 320),
      actorRole: truncate(entry.actorRole, 50),
      clientId: entry.clientId ?? null,
      organizationId: entry.organizationId ?? null,
      organizationSlug: truncate(entry.organizationSlug, 100),
      targetUserId: entry.targetUserId ?? null,
      targetUserEmail: truncate(entry.targetUserEmail, 320),
      userPrompt: truncate(entry.userPrompt, 10000),
      aiResponse: truncate(entry.aiResponse, 10000),
      toolArgs: truncate(entry.toolArgs, 5000),
      toolResult: truncate(entry.toolResult, 5000),
      status: entry.status,
      errorMessage: truncate(entry.errorMessage, 2000),
      ipAddress: truncate(entry.ipAddress, 45),
      durationMs: entry.durationMs ?? null,
    });
  } catch (err) {
    console.error("[AI Audit] Failed to write audit log:", err);
  }
}

// ---------------------------------------------------------------------------
// RBAC helpers
// ---------------------------------------------------------------------------

async function getAllowedOrgIds(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ctx: UserContext
): Promise<number[] | null> {
  if (!ctx.clientId) return null;
  const partnerOrgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clientId, ctx.clientId));
  return partnerOrgs.map((o) => o.id);
}

async function verifyOrgAccess(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ctx: UserContext,
  orgSlug: string
): Promise<{ id: number; clientId: number | null; name: string; slug: string } | null> {
  const [org] = await db
    .select({
      id: organizations.id,
      clientId: organizations.clientId,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;
  if (!ctx.clientId) return org;
  if (org.clientId !== ctx.clientId) return null;
  return org;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "navigate_to",
      description:
        "Send the user to a specific page in the admin portal. Use this when someone asks where something is or wants to jump to a section.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "URL path, e.g. /org/admin?tab=orgs or /org/hospital-slug/intake",
          },
          label: {
            type: "string",
            description: "Human-readable description of the destination",
          },
        },
        required: ["url", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_organizations",
      description:
        "Retrieve a list of organisations (customers). Use this to answer status or completion questions.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "completed", "paused"],
            description: "Filter by org status",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_users",
      description:
        "Retrieve a list of users. Supports filtering to find e.g. users who have never logged in.",
      parameters: {
        type: "object",
        properties: {
          never_logged_in: {
            type: "boolean",
            description: "If true, only return users who have never logged in",
          },
          organization_slug: {
            type: "string",
            description: "Filter to users in a specific org (by slug)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_organization",
      description:
        "Create a new customer organisation. Confirm the name and slug with the user before calling this.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full organisation name" },
          slug: {
            type: "string",
            description: "URL slug — lowercase letters, numbers, hyphens only",
          },
          contact_name: { type: "string", description: "Primary contact name" },
          contact_email: {
            type: "string",
            description: "Primary contact email",
          },
        },
        required: ["name", "slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_user",
      description:
        "Create a new user account for a customer organisation. Ask for the org if not specified.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "User email" },
          name: { type: "string", description: "Full name" },
          role: {
            type: "string",
            enum: ["user", "admin"],
            description: "Role — use 'user' for normal hospital staff",
          },
          organization_slug: {
            type: "string",
            description: "Slug of the organisation to add the user to",
          },
          password: {
            type: "string",
            description: "Initial password (default: Welcome1!)",
          },
        },
        required: ["email", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_completion_report",
      description:
        "Generate a completion/status summary report across all organisations or a specific filter.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "incomplete", "complete", "no_logins"],
            description:
              "'no_logins' = orgs where no user has ever logged in; 'incomplete' = less than 100% done",
          },
        },
        required: ["filter"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_from_text",
      description:
        "Parse pasted text (email threads, notes, meeting summaries) and extract structured data like contact info, org names, requirements, or questionnaire answers.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The raw text to parse",
          },
          extract_type: {
            type: "string",
            enum: ["contact_info", "org_details", "questionnaire_answers", "general"],
            description: "What kind of data to extract",
          },
        },
        required: ["text", "extract_type"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Org-scoped tools — only available when viewing a specific site dashboard
// ---------------------------------------------------------------------------
const ORG_SCOPED_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_org_profile",
      description:
        "Get the full profile and progress summary for the current organization. Includes contact info, dates, section progress, implementation task status, and activity feed.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_questionnaire_responses",
      description:
        "Get all intake questionnaire responses for the current organization. Returns question text, section, and the response value. Use this to answer questions about what the client has filled in.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description:
              "Optional section filter: org-info, connectivity, integration-workflows, config-files, hl7-dicom. Omit to get all.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description:
        "Get the implementation task checklist status for the current organization. Returns each task with its completion, in-progress, blocked, and N/A status, plus notes and target dates.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description:
              "Optional section filter: network, hl7, config, templates, training, testing, prod-validation. Omit to get all.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_files",
      description:
        "List all uploaded files for the current organization — includes both task file attachments and intake questionnaire file attachments, plus project notes/call notes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_connectivity",
      description:
        "Get the network connectivity table for the current organization from Notion. Shows VPN tunnels, DICOM endpoints, HL7 ports, IP addresses, AE titles, and test/prod environment status.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_validation_results",
      description:
        "Get the end-to-end validation test results for the current organization. Shows pass/fail/pending status for each test phase.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];
// ---------------------------------------------------------------------------
// Tool executorss — every executor enforces RBAC and returns audit metadata
// ---------------------------------------------------------------------------

async function executeTool(
  call: ToolCall,
  ctx: UserContext,
  orgSlug?: string | null
): Promise<ToolResult> {
  const db = await getDb();
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return {
      callId: call.id,
      name: call.function.name,
      result: { error: "Invalid arguments" },
      audit: { category: "read", status: "error", errorMessage: "Invalid JSON arguments" },
    };
  }

  switch (call.function.name) {
    // -----------------------------------------------------------------------
    case "navigate_to": {
      const url = String(args.url ?? "");
      const label = String(args.label ?? url);

      if (ctx.clientId && db) {
        const orgSlugMatch = url.match(/\/org\/([^/?#]+)/);
        if (orgSlugMatch) {
          const targetSlug = orgSlugMatch[1];
          const org = await verifyOrgAccess(db, ctx, targetSlug);
          if (!org) {
            return {
              callId: call.id,
              name: "navigate_to",
              result: { error: `Access denied: you do not have permission to view that organisation.` },
              audit: {
                category: "navigate",
                status: "denied",
                organizationSlug: targetSlug,
                errorMessage: `RBAC denied: partner admin attempted to navigate to org "${targetSlug}" outside their partner`,
              },
            };
          }
        }
      }

      return {
        callId: call.id,
        name: "navigate_to",
        result: { navigating_to: label, url },
        action: { type: "navigate", url },
        audit: { category: "navigate", status: "success" },
      };
    }

    // -----------------------------------------------------------------------
    case "list_organizations": {
      if (!db) return { callId: call.id, name: "list_organizations", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };

      const statusFilter = args.status as string | undefined;

      let rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: organizations.status,
          clientId: organizations.clientId,
          clientName: clients.name,
        })
        .from(organizations)
        .leftJoin(clients, eq(organizations.clientId, clients.id));

      if (ctx.clientId) {
        rows = rows.filter((r) => r.clientId === ctx.clientId);
      }

      if (statusFilter && statusFilter !== "all") {
        rows = rows.filter((r) => r.status === statusFilter);
      }

      return {
        callId: call.id,
        name: "list_organizations",
        result: {
          count: rows.length,
          organizations: rows.map((r) => ({
            name: r.name,
            slug: r.slug,
            status: r.status,
            ...(ctx.clientId ? {} : { partner: r.clientName }),
            admin_link: `/org/${r.slug}`,
          })),
        },
        audit: { category: "read", status: "success" },
      };
    }

    // -----------------------------------------------------------------------
    case "list_users": {
      if (!db) return { callId: call.id, name: "list_users", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };

      const neverLoggedIn = args.never_logged_in === true;
      const orgSlug = args.organization_slug as string | undefined;

      if (orgSlug && ctx.clientId) {
        const org = await verifyOrgAccess(db, ctx, orgSlug);
        if (!org) {
          return {
            callId: call.id,
            name: "list_users",
            result: { error: `Access denied: organisation "${orgSlug}" does not belong to your partner account.` },
            audit: {
              category: "read",
              status: "denied",
              organizationSlug: orgSlug,
              errorMessage: `RBAC denied: partner admin attempted to list users for org "${orgSlug}" outside their partner`,
            },
          };
        }
      }

      let orgId: number | undefined;
      if (orgSlug) {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, orgSlug))
          .limit(1);
        orgId = org?.id;
      }

      let allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          lastLoginAt: users.lastLoginAt,
          organizationId: users.organizationId,
          clientId: users.clientId,
        })
        .from(users);

      if (ctx.clientId) {
        const allowedOrgIds = await getAllowedOrgIds(db, ctx);
        if (allowedOrgIds) {
          allUsers = allUsers.filter(
            (u) => u.clientId === ctx.clientId || (u.organizationId && allowedOrgIds.includes(u.organizationId))
          );
        }
      }

      if (orgId) {
        allUsers = allUsers.filter((u) => u.organizationId === orgId);
      }

      if (neverLoggedIn) {
        allUsers = allUsers.filter((u) => !u.lastLoginAt);
      }

      return {
        callId: call.id,
        name: "list_users",
        result: {
          count: allUsers.length,
          users: allUsers.map((u) => ({
            name: u.name,
            email: u.email,
            role: u.role,
            last_login: u.lastLoginAt ?? "never",
          })),
        },
        audit: {
          category: "read",
          status: "success",
          organizationSlug: orgSlug,
          organizationId: orgId,
        },
      };
    }

    // -----------------------------------------------------------------------
    case "create_organization": {
      if (!db) return { callId: call.id, name: "create_organization", result: { error: "DB unavailable" }, audit: { category: "write", status: "error", errorMessage: "DB unavailable" } };

      const name = String(args.name ?? "").trim();
      const slug = String(args.slug ?? "").trim();
      if (!name || !slug) {
        return {
          callId: call.id,
          name: "create_organization",
          result: { error: "name and slug are required" },
          audit: { category: "write", status: "error", errorMessage: "Missing name or slug" },
        };
      }

      let clientId: number | undefined = ctx.clientId ?? undefined;
      if (!clientId) {
        return {
          callId: call.id,
          name: "create_organization",
          result: { error: "Platform admins must specify a partner. Please ask which partner this org belongs to, or use the admin UI." },
          audit: { category: "write", status: "error", errorMessage: "Platform admin must specify partner for org creation" },
        };
      }

      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (existing) {
        return {
          callId: call.id,
          name: "create_organization",
          result: { error: `Slug "${slug}" is already taken. Choose a different one.` },
          audit: { category: "write", status: "error", organizationSlug: slug, errorMessage: `Slug "${slug}" already exists` },
        };
      }

      await db.insert(organizations).values({
        name,
        slug,
        clientId,
        contactName: (args.contact_name as string) ?? undefined,
        contactEmail: (args.contact_email as string) ?? undefined,
        status: "active",
      });

      return {
        callId: call.id,
        name: "create_organization",
        result: {
          success: true,
          message: `Organisation "${name}" created with slug "${slug}".`,
          intake_url: `/org/${slug}/intake`,
          admin_url: `/org/${slug}`,
        },
        action: { type: "refresh_orgs" },
        audit: { category: "write", status: "success", organizationSlug: slug },
      };
    }

    // -----------------------------------------------------------------------
    case "create_user": {
      if (!db) return { callId: call.id, name: "create_user", result: { error: "DB unavailable" }, audit: { category: "write", status: "error", errorMessage: "DB unavailable" } };

      const email = String(args.email ?? "").trim().toLowerCase();
      const name = String(args.name ?? "").trim();
      const role = (args.role as "user" | "admin") ?? "user";
      const password = String(args.password ?? "Welcome1!");
      const orgSlug = args.organization_slug as string | undefined;

      if (!email || !name) {
        return {
          callId: call.id,
          name: "create_user",
          result: { error: "email and name required" },
          audit: { category: "write", status: "error", errorMessage: "Missing email or name" },
        };
      }

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingUser) {
        return {
          callId: call.id,
          name: "create_user",
          result: { error: `User ${email} already exists.` },
          audit: { category: "write", status: "error", targetUserEmail: email, errorMessage: `Duplicate email: ${email}` },
        };
      }

      let orgId: number | undefined;
      let clientId: number | undefined = ctx.clientId ?? undefined;

      if (orgSlug) {
        const org = await verifyOrgAccess(db, ctx, orgSlug);
        if (!org) {
          return {
            callId: call.id,
            name: "create_user",
            result: { error: `Access denied: organisation "${orgSlug}" does not belong to your partner account.` },
            audit: {
              category: "write",
              status: "denied",
              organizationSlug: orgSlug,
              targetUserEmail: email,
              errorMessage: `RBAC denied: partner admin attempted to create user in org "${orgSlug}" outside their partner`,
            },
          };
        }
        orgId = org.id;
        clientId = org.clientId ?? undefined;
      } else if (ctx.clientId) {
        clientId = ctx.clientId;
      }

      const hash = await bcrypt.hash(password, 10);
      const openId = `chat-created-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await db.insert(users).values({
        openId,
        email,
        name,
        role,
        passwordHash: hash,
        organizationId: orgId ?? null,
        clientId: clientId ?? null,
        isActive: 1,
      });

      return {
        callId: call.id,
        name: "create_user",
        result: {
          success: true,
          message: `User "${name}" (${email}) created${orgSlug ? ` for ${orgSlug}` : ""}. Initial password: ${password}`,
        },
        action: { type: "refresh_users" },
        audit: {
          category: "write",
          status: "success",
          organizationSlug: orgSlug,
          organizationId: orgId,
          targetUserEmail: email,
        },
      };
    }

    // -----------------------------------------------------------------------
    case "get_completion_report": {
      if (!db) return { callId: call.id, name: "get_completion_report", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };

      const filter = (args.filter as string) ?? "all";

      let allOrgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: organizations.status,
          clientId: organizations.clientId,
        })
        .from(organizations);

      if (ctx.clientId) {
        allOrgs = allOrgs.filter((o) => o.clientId === ctx.clientId);
      }

      const orgIds = allOrgs.map((o) => o.id);
      const allUsers = orgIds.length
        ? await db
            .select({ organizationId: users.organizationId, lastLoginAt: users.lastLoginAt })
            .from(users)
            .where(inArray(users.organizationId, orgIds))
        : [];

      const report = allOrgs.map((org) => {
        const orgUsers = allUsers.filter((u) => u.organizationId === org.id);
        const anyLogin = orgUsers.some((u) => u.lastLoginAt);
        return {
          name: org.name,
          slug: org.slug,
          status: org.status,
          users: orgUsers.length,
          any_login: anyLogin,
        };
      });

      const filtered =
        filter === "no_logins"
          ? report.filter((r) => !r.any_login)
          : filter === "complete"
          ? report.filter((r) => r.status === "completed")
          : filter === "incomplete"
          ? report.filter((r) => r.status !== "completed")
          : report;

      return {
        callId: call.id,
        name: "get_completion_report",
        result: {
          filter,
          count: filtered.length,
          organizations: filtered,
        },
        audit: { category: "read", status: "success" },
      };
    }

    // -----------------------------------------------------------------------
    case "extract_from_text": {
      const text = String(args.text ?? "");
      const extractType = String(args.extract_type ?? "general");

      if (!text.trim()) {
        return {
          callId: call.id,
          name: "extract_from_text",
          result: { error: "No text provided" },
          audit: { category: "extract", status: "error", errorMessage: "Empty text" },
        };
      }

      const extractResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a data extraction assistant. Extract ${extractType} data from the provided text and return it as clean JSON. Be concise.`,
          },
          {
            role: "user",
            content: `Extract ${extractType} from this text:\n\n${text.slice(0, 4000)}`,
          },
        ],
        responseFormat: { type: "json_object" },
      });

      const raw = extractResult.choices[0]?.message?.content;
      let extracted: unknown = {};
      try {
        extracted = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      } catch {
        extracted = { raw_text: raw };
      }

      return {
        callId: call.id,
        name: "extract_from_text",
        result: { extracted, extract_type: extractType },
        audit: { category: "extract", status: "success" },
      };
    }

    // -----------------------------------------------------------------------
    // ORG-SCOPED TOOLS — require orgSlug to be set
    // -----------------------------------------------------------------------
    case "get_org_profile": {
      if (!orgSlug) return { callId: call.id, name: "get_org_profile", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_org_profile", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const org = await verifyOrgAccess(db, ctx, orgSlug);
      if (!org) return { callId: call.id, name: "get_org_profile", result: { error: "Access denied or org not found" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      // Fetch full org record
      const [fullOrg] = await db.select().from(organizations).where(eq(organizations.id, org.id)).limit(1);

      // Section progress
      const sections = await db.select().from(sectionProgress).where(eq(sectionProgress.organizationId, org.id));

      // Task completion summary
      const tasks = await db.select().from(taskCompletion).where(eq(taskCompletion.organizationId, org.id));
      const taskSummary = {
        total: TASK_SECTION_DEFS.reduce((s, sec) => s + sec.tasks.length, 0),
        completed: tasks.filter(t => t.completed === 1).length,
        inProgress: tasks.filter(t => t.inProgress === 1).length,
        blocked: tasks.filter(t => t.blocked === 1).length,
        notApplicable: tasks.filter(t => t.notApplicable === 1).length,
      };

      // Recent activity
      const recentActivity = await db.select().from(activityFeed)
        .where(eq(activityFeed.organizationId, org.id))
        .orderBy(desc(activityFeed.createdAt))
        .limit(10);

      return {
        callId: call.id,
        name: "get_org_profile",
        result: {
          organization: {
            name: fullOrg?.name,
            slug: fullOrg?.slug,
            contactName: fullOrg?.contactName,
            contactEmail: fullOrg?.contactEmail,
            contactPhone: fullOrg?.contactPhone,
            startDate: fullOrg?.startDate,
            goalDate: fullOrg?.goalDate,
            status: fullOrg?.status,
          },
          sectionProgress: sections.map(s => ({
            section: s.sectionName,
            status: s.status,
            progress: s.progress,
            expectedEnd: s.expectedEnd,
          })),
          taskSummary,
          recentActivity: recentActivity.map(a => ({
            source: a.source,
            author: a.author,
            message: a.message,
            date: a.createdAt,
          })),
        },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: org.id },
      };
    }
    // -----------------------------------------------------------------------
    case "get_questionnaire_responses": {
      if (!orgSlug) return { callId: call.id, name: "get_questionnaire_responses", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_questionnaire_responses", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const qOrg = await verifyOrgAccess(db, ctx, orgSlug);
      if (!qOrg) return { callId: call.id, name: "get_questionnaire_responses", result: { error: "Access denied" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      const sectionFilter = args.section as string | undefined;

      // Get all responses
      const responses = await db.select({
        questionId: intakeResponses.questionId,
        section: intakeResponses.section,
        response: intakeResponses.response,
        fileUrl: intakeResponses.fileUrl,
        updatedBy: intakeResponses.updatedBy,
        updatedAt: intakeResponses.updatedAt,
      }).from(intakeResponses).where(eq(intakeResponses.organizationId, qOrg.id));

      // Build a question lookup from the questionnaire template
      const questionLookup: Record<string, { text: string; section: string }> = {};
      for (const sec of questionnaireSections) {
        if (sec.questions) {
          for (const q of sec.questions) {
            questionLookup[q.id] = { text: q.text, section: sec.title };
          }
        }
      }

      // Enrich responses with question text
      let enriched = responses.map(r => ({
        questionId: r.questionId,
        questionText: questionLookup[r.questionId]?.text ?? r.questionId,
        section: questionLookup[r.questionId]?.section ?? r.section,
        response: r.response,
        hasFile: !!r.fileUrl,
        updatedBy: r.updatedBy,
      }));

      // Apply section filter if provided
      if (sectionFilter) {
        const filterNorm = sectionFilter.toLowerCase();
        enriched = enriched.filter(r => {
          const secNorm = r.section.toLowerCase().replace(/[^a-z0-9]/g, "-");
          return secNorm.includes(filterNorm) || filterNorm.includes(secNorm);
        });
      }

      // Get file attachments for this org
      const intakeFiles = await db.select({
        questionId: intakeFileAttachments.questionId,
        fileName: intakeFileAttachments.fileName,
        fileUrl: intakeFileAttachments.fileUrl,
      }).from(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, qOrg.id));

      return {
        callId: call.id,
        name: "get_questionnaire_responses",
        result: {
          organizationName: qOrg.name,
          responseCount: enriched.length,
          responses: enriched.slice(0, 100), // Limit to avoid token overflow
          fileAttachments: intakeFiles.slice(0, 50),
        },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: qOrg.id },
      };
    }
    // -----------------------------------------------------------------------
    case "get_tasks": {
      if (!orgSlug) return { callId: call.id, name: "get_tasks", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_tasks", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const tOrg = await verifyOrgAccess(db, ctx, orgSlug);
      if (!tOrg) return { callId: call.id, name: "get_tasks", result: { error: "Access denied" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      const taskSectionFilter = args.section as string | undefined;
      const completionRows = await db.select().from(taskCompletion).where(eq(taskCompletion.organizationId, tOrg.id));
      const completionMap = new Map(completionRows.map(r => [r.taskId, r]));

      let sections = TASK_SECTION_DEFS;
      if (taskSectionFilter) {
        sections = sections.filter(s => s.id === taskSectionFilter);
      }

      const result = sections.map(sec => ({
        section: sec.title,
        sectionId: sec.id,
        duration: sec.duration,
        tasks: sec.tasks.map(t => {
          const c = completionMap.get(t.id);
          return {
            taskId: t.id,
            title: t.title,
            description: t.description,
            completed: c?.completed === 1,
            inProgress: c?.inProgress === 1,
            blocked: c?.blocked === 1,
            notApplicable: c?.notApplicable === 1,
            targetDate: c?.targetDate ?? null,
            notes: c?.notes ?? null,
          };
        }),
      }));

      return {
        callId: call.id,
        name: "get_tasks",
        result: { organizationName: tOrg.name, sections: result },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: tOrg.id },
      };
    }
    // -----------------------------------------------------------------------
    case "get_files": {
      if (!orgSlug) return { callId: call.id, name: "get_files", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_files", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const fOrg = await verifyOrgAccess(db, ctx, orgSlug);
      if (!fOrg) return { callId: call.id, name: "get_files", result: { error: "Access denied" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      // Task file attachments
      const taskFiles = await db.select({
        id: fileAttachments.id,
        taskId: fileAttachments.taskId,
        fileName: fileAttachments.fileName,
        fileUrl: fileAttachments.fileUrl,
        fileSize: fileAttachments.fileSize,
        mimeType: fileAttachments.mimeType,
        uploadedBy: fileAttachments.uploadedBy,
        createdAt: fileAttachments.createdAt,
      }).from(fileAttachments).where(eq(fileAttachments.organizationId, fOrg.id));

      // Intake file attachments
      const intakeFiles = await db.select({
        id: intakeFileAttachments.id,
        questionId: intakeFileAttachments.questionId,
        fileName: intakeFileAttachments.fileName,
        fileUrl: intakeFileAttachments.fileUrl,
        fileSize: intakeFileAttachments.fileSize,
        mimeType: intakeFileAttachments.mimeType,
        uploadedBy: intakeFileAttachments.uploadedBy,
        createdAt: intakeFileAttachments.createdAt,
      }).from(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, fOrg.id));

      // Project notes / call notes
      const notes = await db.select({
        id: orgNotes.id,
        label: orgNotes.label,
        fileName: orgNotes.fileName,
        fileUrl: orgNotes.fileUrl,
        fileSize: orgNotes.fileSize,
        mimeType: orgNotes.mimeType,
        uploadedBy: orgNotes.uploadedBy,
        createdAt: orgNotes.createdAt,
      }).from(orgNotes).where(eq(orgNotes.organizationId, fOrg.id));

      return {
        callId: call.id,
        name: "get_files",
        result: {
          organizationName: fOrg.name,
          taskFiles: taskFiles.map(f => ({ ...f, source: "task" })),
          intakeFiles: intakeFiles.map(f => ({ ...f, source: "intake" })),
          projectNotes: notes.map(n => ({ ...n, source: "notes" })),
          totalCount: taskFiles.length + intakeFiles.length + notes.length,
        },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: fOrg.id },
      };
    }
    // -----------------------------------------------------------------------
    case "get_connectivity": {
      if (!orgSlug) return { callId: call.id, name: "get_connectivity", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_connectivity", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const cOrg = await verifyOrgAccess(db, ctx, orgSlug);
      if (!cOrg) return { callId: call.id, name: "get_connectivity", result: { error: "Access denied" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      const connData = await fetchConnectivityForOrg(orgSlug, cOrg.name);

      return {
        callId: call.id,
        name: "get_connectivity",
        result: {
          organizationName: cOrg.name,
          configured: connData.configured,
          rowCount: connData.rows.length,
          rows: connData.rows.map(r => ({
            trafficType: r.trafficType,
            sourceSystem: r.sourceSystem,
            destinationSystem: r.destinationSystem,
            sourceIp: r.sourceIp,
            sourcePort: r.sourcePort,
            destIp: r.destIp,
            destPort: r.destPort,
            sourceAeTitle: r.sourceAeTitle,
            destAeTitle: r.destAeTitle,
            envTest: r.envTest,
            envProd: r.envProd,
            notes: r.notes,
            status: r.status,
          })),
          error: connData.error,
        },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: cOrg.id },
      };
    }
    // -----------------------------------------------------------------------
    case "get_validation_results": {
      if (!orgSlug) return { callId: call.id, name: "get_validation_results", result: { error: "No organization context" }, audit: { category: "read", status: "error", errorMessage: "No orgSlug" } };
      if (!db) return { callId: call.id, name: "get_validation_results", result: { error: "DB unavailable" }, audit: { category: "read", status: "error", errorMessage: "DB unavailable" } };
      const vOrg = await verifyOrgAccess(db, ctx, orgSlug);
      if (!vOrg) return { callId: call.id, name: "get_validation_results", result: { error: "Access denied" }, audit: { category: "read", status: "denied", organizationSlug: orgSlug, errorMessage: "RBAC denied" } };

      const valResults = await db.select().from(validationResults)
        .where(eq(validationResults.organizationId, vOrg.id));

      const summary = {
        total: valResults.length,
        pass: valResults.filter(r => r.status === "Pass").length,
        fail: valResults.filter(r => r.status === "Fail").length,
        pending: valResults.filter(r => r.status === "Pending").length,
        notTested: valResults.filter(r => r.status === "Not Tested").length,
        inProgress: valResults.filter(r => r.status === "In Progress").length,
        blocked: valResults.filter(r => r.status === "Blocked").length,
        na: valResults.filter(r => r.status === "N/A").length,
      };

      return {
        callId: call.id,
        name: "get_validation_results",
        result: {
          organizationName: vOrg.name,
          summary,
          results: valResults.map(r => ({
            testKey: r.testKey,
            status: r.status,
            actual: r.actual,
            notes: r.notes,
            signOff: r.signOff,
            testedDate: r.testedDate,
          })),
        },
        audit: { category: "read", status: "success", organizationSlug: orgSlug, organizationId: vOrg.id },
      };
    }
    // -----------------------------------------------------------------------
    default:
      return {
        callId: call.id,
        name: call.function.name,
        result: { error: `Unknown tool: ${call.function.name}` },
        audit: { category: "read", status: "error", errorMessage: `Unknown tool: ${call.function.name}` },
      };
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const aiRouter = router({
  /**
   * Main chat endpoint with full audit logging.
   */
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
          })
        ),
        fileData: z.string().optional(),
        fileType: z.string().optional(),
        fileName: z.string().optional(),
        orgSlug: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chatStartTime = Date.now();

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      const isPlatformAdmin = !ctx.user.clientId;

      // Get IP address for audit
      const ipAddress =
        (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        ctx.req.socket?.remoteAddress ??
        null;

      let partnerName = "New Lantern";
      if (!isPlatformAdmin && ctx.user.clientId && db) {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, ctx.user.clientId))
          .limit(1);
        partnerName = client?.name ?? "your partner";
      }

      // ---- System prompt ----
      const systemPrompt = isPlatformAdmin
        ? `You are an AI assistant built into the New Lantern Implementation Portal admin panel.

User: ${ctx.user.email ?? "admin"}
Role: Platform Admin (New Lantern staff — can see all partners and organisations)

You help admins manage the portal efficiently. You can:
- List organisations and users across all partners
- Create new organisations and users (must specify partner)
- Generate reports (e.g. who hasn't logged in)
- Navigate the user to specific pages
- Extract data from pasted email threads or meeting notes

Guidelines:
- Be concise and action-oriented
- When creating organisations or users, confirm the key details before proceeding unless clearly specified
- For creating an org, you CANNOT call create_organization directly (you must specify which partner). Tell them to navigate to the create org page or specify the partner.
- Always use the appropriate tool rather than just describing what to do
- If someone pastes an email or text, use extract_from_text to parse it
- Format lists as markdown tables or bullet points
- If you navigate somewhere, tell the user what you did`
        : `You are an AI assistant built into the New Lantern Implementation Portal for ${partnerName}.

User: ${ctx.user.email ?? "admin"}
Role: Partner Admin (${partnerName})

CRITICAL DATA BOUNDARY RULES:
- You can ONLY access data belonging to ${partnerName}
- You MUST NOT attempt to access, view, or modify data from any other partner
- All tool calls automatically enforce this boundary — if you try to access another partner's data, the request will be denied
- Never ask the user for information about other partners' organisations or users
- If a user asks about data outside ${partnerName}, politely explain you can only help with ${partnerName} data

You help ${partnerName} admins manage their portal efficiently. You can:
- List ${partnerName}'s organisations and users
- Create new organisations and users under ${partnerName}
- Generate reports for ${partnerName}'s organisations
- Navigate to ${partnerName}'s pages
- Extract data from pasted email threads or meeting notes

Guidelines:
- Be concise and action-oriented
- When creating organisations or users, confirm the key details before proceeding unless clearly specified
- Always use the appropriate tool rather than just describing what to do
- If someone pastes an email or text, use extract_from_text to parse it
- Format lists as markdown tables or bullet points
- If you navigate somewhere, tell the user what you did
- Never reveal information about other partners or their organisations`;

      // ---- Org-scoped system prompt (when viewing a specific site dashboard) ----
      const isOrgScoped = !!input.orgSlug;
      let orgScopedPrompt = "";
      if (isOrgScoped && db) {
        const [scopedOrg] = await db
          .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
          .from(organizations)
          .where(eq(organizations.slug, input.orgSlug!))
          .limit(1);
        if (scopedOrg) {
          orgScopedPrompt = `\n\nIMPORTANT CONTEXT: You are currently viewing the site dashboard for "${scopedOrg.name}" (slug: ${scopedOrg.slug}).
You ONLY have access to tools that fetch data for THIS organization. You cannot list other organizations, create users, or access any cross-org data.
When the user asks about questionnaire responses, project notes, tasks, files, connectivity, validation results, or any data — use the org-scoped tools (get_org_profile, get_questionnaire_responses, get_tasks, get_files, get_connectivity, get_validation_results) to look up the answer.
Do NOT say you cannot access data. Always try the appropriate tool first.
You are scoped ENTIRELY to this one site. You have NO visibility into other organizations whatsoever.
Be specific and cite actual data from the tool results in your answers.`;
        }
      }

      const finalSystemPrompt = systemPrompt + orgScopedPrompt;

      // Choose which tools to provide based on context
      const activeTools = isOrgScoped ? ORG_SCOPED_TOOLS : TOOLS;

      // ---- Build message list ----
      const llmMessages: Message[] = [
        { role: "system", content: finalSystemPrompt },
      ];

      if (input.fileData && input.fileType) {
        const isImage = input.fileType.startsWith("image/");
        const isPdf = input.fileType === "application/pdf";
        const dataUrl = `data:${input.fileType};base64,${input.fileData}`;

        llmMessages.push({
          role: "user",
          content: isImage
            ? [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: input.messages[input.messages.length - 1]?.content ?? "What's in this file?" },
              ]
            : isPdf
            ? [
                { type: "file_url", file_url: { url: dataUrl, mime_type: "application/pdf" } },
                { type: "text", text: input.messages[input.messages.length - 1]?.content ?? "What's in this document?" },
              ]
            : [{ type: "text", text: input.messages[input.messages.length - 1]?.content ?? "" }],
        });

        for (const msg of input.messages.slice(0, -1)) {
          llmMessages.push({ role: msg.role as Message["role"], content: msg.content });
        }
      } else {
        for (const msg of input.messages) {
          llmMessages.push({ role: msg.role as Message["role"], content: msg.content });
        }
      }

      // ---- Tool-calling loop ----
      let currentMessages = [...llmMessages];
      let finalMessage = "";
      let finalAction: ChatAction | undefined;

      const userCtx: UserContext = {
        id: ctx.user.id,
        clientId: ctx.user.clientId,
        email: ctx.user.email,
        role: ctx.user.role,
      };

      // Extract the last user prompt for audit logging
      const lastUserPrompt =
        input.messages.filter((m) => m.role === "user").pop()?.content ?? "";

      // Collect all tool audit entries to write after the loop
      const toolAuditEntries: Array<{
        action: string;
        category: "read" | "write" | "navigate" | "extract";
        toolArgs: string;
        toolResult: string;
        status: "success" | "error" | "denied";
        organizationSlug?: string;
        organizationId?: number;
        targetUserEmail?: string;
        targetUserId?: number;
        errorMessage?: string;
        durationMs: number;
      }> = [];

      for (let iteration = 0; iteration < 3; iteration++) {
        const result = await invokeLLM({
          messages: currentMessages,
          tools: activeTools,
          toolChoice: "auto",
        });

        const choice = result.choices[0];
        if (!choice) break;

        const toolCalls = choice.message.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          const content = choice.message.content;
          finalMessage = typeof content === "string" ? content : JSON.stringify(content);
          break;
        }

        // Execute all tool calls — each enforces RBAC
        const toolStartTime = Date.now();
        const toolResults = await Promise.all(
          toolCalls.map((tc) => executeTool(tc, userCtx, input.orgSlug))
        );
        const toolDuration = Date.now() - toolStartTime;

        // Collect audit data from each tool result
        for (let i = 0; i < toolResults.length; i++) {
          const tr = toolResults[i];
          const tc = toolCalls[i];
          if (tr.audit) {
            toolAuditEntries.push({
              action: tr.name,
              category: tr.audit.category,
              toolArgs: tc ? tc.function.arguments : "{}",
              toolResult: JSON.stringify(tr.result).slice(0, 5000),
              status: tr.audit.status,
              organizationSlug: tr.audit.organizationSlug,
              organizationId: tr.audit.organizationId,
              targetUserEmail: tr.audit.targetUserEmail,
              targetUserId: tr.audit.targetUserId,
              errorMessage: tr.audit.errorMessage,
              durationMs: Math.round(toolDuration / toolResults.length),
            });
          }
        }

        for (const tr of toolResults) {
          if (tr.action && !finalAction) {
            finalAction = tr.action;
          }
        }

        currentMessages.push({
          role: "assistant",
          content: "",
          // @ts-ignore
          tool_calls: toolCalls,
        } as Message);

        for (const tr of toolResults) {
          currentMessages.push({
            role: "tool",
            content: JSON.stringify(tr.result),
            tool_call_id: tr.callId,
            name: tr.name,
          } as Message);
        }
      }

      if (!finalMessage) {
        finalMessage = "I've completed the action. Let me know if you need anything else.";
      }

      const totalDuration = Date.now() - chatStartTime;

      // ---- Write audit logs (fire-and-forget) ----
      // 1. Log the overall chat interaction
      writeAuditLog({
        action: "chat",
        category: "chat",
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorRole: ctx.user.role,
        clientId: ctx.user.clientId ?? null,
        userPrompt: lastUserPrompt,
        aiResponse: finalMessage,
        status: "success",
        ipAddress,
        durationMs: totalDuration,
      });

      // 2. Log each tool call individually
      for (const entry of toolAuditEntries) {
        writeAuditLog({
          action: entry.action,
          category: entry.category,
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorRole: ctx.user.role,
          clientId: ctx.user.clientId ?? null,
          organizationId: entry.organizationId ?? null,
          organizationSlug: entry.organizationSlug ?? null,
          targetUserId: entry.targetUserId ?? null,
          targetUserEmail: entry.targetUserEmail ?? null,
          userPrompt: lastUserPrompt,
          toolArgs: entry.toolArgs,
          toolResult: entry.toolResult,
          status: entry.status,
          errorMessage: entry.errorMessage ?? null,
          ipAddress,
          durationMs: entry.durationMs,
        });
      }

      return {
        message: finalMessage,
        action: finalAction ?? null,
      };
    }),

  /**
   * Query audit logs. Platform admins see all; partner admins see only their own.
   */
  getAuditLogs: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        category: z.enum(["all", "chat", "read", "write", "navigate", "extract"]).default("all"),
        status: z.enum(["all", "success", "error", "denied"]).default("all"),
        actorEmail: z.string().optional(),
        organizationSlug: z.string().optional(),
        dateFrom: z.string().optional(), // ISO date string
        dateTo: z.string().optional(),   // ISO date string
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) return { logs: [], total: 0, page: input.page, pageSize: input.pageSize };

      // Build WHERE conditions
      const conditions: any[] = [];

      // RBAC: Partner admins can only see their own logs
      if (ctx.user.clientId) {
        conditions.push(eq(aiAuditLogs.clientId, ctx.user.clientId));
      }

      if (input.category !== "all") {
        conditions.push(eq(aiAuditLogs.category, input.category));
      }

      if (input.status !== "all") {
        conditions.push(eq(aiAuditLogs.status, input.status));
      }

      if (input.actorEmail) {
        conditions.push(eq(aiAuditLogs.actorEmail, input.actorEmail));
      }

      if (input.organizationSlug) {
        conditions.push(eq(aiAuditLogs.organizationSlug, input.organizationSlug));
      }

      if (input.dateFrom) {
        conditions.push(sql`${aiAuditLogs.createdAt} >= ${input.dateFrom}`);
      }

      if (input.dateTo) {
        conditions.push(sql`${aiAuditLogs.createdAt} <= ${input.dateTo}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiAuditLogs)
        .where(whereClause);
      const total = countResult?.count ?? 0;

      // Get paginated results
      const offset = (input.page - 1) * input.pageSize;
      const logs = await db
        .select()
        .from(aiAuditLogs)
        .where(whereClause)
        .orderBy(desc(aiAuditLogs.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return {
        logs,
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Get a single audit log entry by ID.
   */
  getAuditLogDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) return null;

      const [log] = await db
        .select()
        .from(aiAuditLogs)
        .where(eq(aiAuditLogs.id, input.id))
        .limit(1);

      if (!log) return null;

      // RBAC: Partner admins can only see their own logs
      if (ctx.user.clientId && log.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return log;
    }),

  /**
   * Get audit log summary statistics for the dashboard.
   */
  getAuditStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) return { totalLogs: 0, byCategory: [], byStatus: [], recentActors: [] };

    const clientCondition = ctx.user.clientId
      ? eq(aiAuditLogs.clientId, ctx.user.clientId)
      : undefined;

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiAuditLogs)
      .where(clientCondition);

    // By category
    const byCategory = await db
      .select({
        category: aiAuditLogs.category,
        count: sql<number>`count(*)`,
      })
      .from(aiAuditLogs)
      .where(clientCondition)
      .groupBy(aiAuditLogs.category);

    // By status
    const byStatus = await db
      .select({
        status: aiAuditLogs.status,
        count: sql<number>`count(*)`,
      })
      .from(aiAuditLogs)
      .where(clientCondition)
      .groupBy(aiAuditLogs.status);

    // Recent unique actors (last 10)
    const recentActors = await db
      .select({
        actorEmail: aiAuditLogs.actorEmail,
        lastAction: sql<Date>`max(${aiAuditLogs.createdAt})`,
        actionCount: sql<number>`count(*)`,
      })
      .from(aiAuditLogs)
      .where(clientCondition)
      .groupBy(aiAuditLogs.actorEmail)
      .orderBy(sql`max(${aiAuditLogs.createdAt}) desc`)
      .limit(10);

    return {
      totalLogs: totalResult?.count ?? 0,
      byCategory,
      byStatus,
      recentActors,
    };
  }),
});

// Re-export writeAuditLog for use in other modules if needed
export { writeAuditLog };
