/**
 * AI Chat Router
 *
 * Provides a role-aware chat endpoint for admin and partner admins.
 * The LLM can call tools to: list/create orgs & users, generate reports,
 * navigate the UI, and summarise pasted emails or uploaded documents.
 *
 * Tool-calling loop (max 3 iterations):
 *   1. Send messages + tools to LLM
 *   2. If LLM returns tool_calls, execute each tool and append results
 *   3. Call LLM again with the tool results so it can form a final answer
 *   4. Return { message, action? } to the frontend
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
} from "../../drizzle/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

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
};

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
// Tool executors
// ---------------------------------------------------------------------------

async function executeTool(
  call: ToolCall,
  ctx: { user: { clientId: number | null | undefined; email: string | null | undefined; role: string } }
): Promise<ToolResult> {
  const db = await getDb();
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return { callId: call.id, name: call.function.name, result: { error: "Invalid arguments" } };
  }

  switch (call.function.name) {
    // -----------------------------------------------------------------------
    case "navigate_to": {
      const url = String(args.url ?? "");
      const label = String(args.label ?? url);
      return {
        callId: call.id,
        name: "navigate_to",
        result: { navigating_to: label, url },
        action: { type: "navigate", url },
      };
    }

    // -----------------------------------------------------------------------
    case "list_organizations": {
      if (!db) return { callId: call.id, name: "list_organizations", result: { error: "DB unavailable" } };

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

      // Partner admins only see their own orgs
      if (ctx.user.clientId) {
        rows = rows.filter((r) => r.clientId === ctx.user.clientId);
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
            partner: r.clientName,
            admin_link: `/org/${r.slug}`,
          })),
        },
      };
    }

    // -----------------------------------------------------------------------
    case "list_users": {
      if (!db) return { callId: call.id, name: "list_users", result: { error: "DB unavailable" } };

      const neverLoggedIn = args.never_logged_in === true;
      const orgSlug = args.organization_slug as string | undefined;

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

      // Partner admin isolation
      if (ctx.user.clientId) {
        const partnerOrgs = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.clientId, ctx.user.clientId));
        const orgIds = partnerOrgs.map((o) => o.id);
        allUsers = allUsers.filter(
          (u) => u.clientId === ctx.user.clientId || (u.organizationId && orgIds.includes(u.organizationId))
        );
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
      };
    }

    // -----------------------------------------------------------------------
    case "create_organization": {
      if (!db) return { callId: call.id, name: "create_organization", result: { error: "DB unavailable" } };

      const name = String(args.name ?? "").trim();
      const slug = String(args.slug ?? "").trim();
      if (!name || !slug) {
        return { callId: call.id, name: "create_organization", result: { error: "name and slug are required" } };
      }

      // Determine clientId
      let clientId: number | undefined = ctx.user.clientId ?? undefined;
      if (!clientId) {
        return {
          callId: call.id,
          name: "create_organization",
          result: { error: "Platform admins must specify a partner. Please ask which partner this org belongs to." },
        };
      }

      // Check slug uniqueness
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
      };
    }

    // -----------------------------------------------------------------------
    case "create_user": {
      if (!db) return { callId: call.id, name: "create_user", result: { error: "DB unavailable" } };

      const email = String(args.email ?? "").trim().toLowerCase();
      const name = String(args.name ?? "").trim();
      const role = (args.role as "user" | "admin") ?? "user";
      const password = String(args.password ?? "Welcome1!");
      const orgSlug = args.organization_slug as string | undefined;

      if (!email || !name) {
        return { callId: call.id, name: "create_user", result: { error: "email and name required" } };
      }

      // Check duplicate
      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingUser) {
        return { callId: call.id, name: "create_user", result: { error: `User ${email} already exists.` } };
      }

      let orgId: number | undefined;
      let clientId: number | undefined = ctx.user.clientId ?? undefined;

      if (orgSlug) {
        const [org] = await db
          .select({ id: organizations.id, clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.slug, orgSlug))
          .limit(1);
        if (!org) {
          return { callId: call.id, name: "create_user", result: { error: `Org "${orgSlug}" not found.` } };
        }
        orgId = org.id;
        clientId = org.clientId ?? undefined;
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
      };
    }

    // -----------------------------------------------------------------------
    case "get_completion_report": {
      if (!db) return { callId: call.id, name: "get_completion_report", result: { error: "DB unavailable" } };

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

      if (ctx.user.clientId) {
        allOrgs = allOrgs.filter((o) => o.clientId === ctx.user.clientId);
      }

      // Get users per org to check login status
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
      };
    }

    // -----------------------------------------------------------------------
    case "extract_from_text": {
      const text = String(args.text ?? "");
      const extractType = String(args.extract_type ?? "general");

      if (!text.trim()) {
        return { callId: call.id, name: "extract_from_text", result: { error: "No text provided" } };
      }

      // Use LLM to extract structured data from the text
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
      };
    }

    // -----------------------------------------------------------------------
    default:
      return {
        callId: call.id,
        name: call.function.name,
        result: { error: `Unknown tool: ${call.function.name}` },
      };
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const aiRouter = router({
  /**
   * Main chat endpoint. Accepts a message history and optional file content
   * (base64 + mimeType for document parsing).
   * Returns the assistant reply and an optional UI action.
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
        // Optional file upload (base64 encoded)
        fileData: z.string().optional(),
        fileType: z.string().optional(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      const isPlatformAdmin = !ctx.user.clientId;

      // ---- Build context about the user's environment ----
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
      const systemPrompt = `You are an AI assistant built into the New Lantern Implementation Portal admin panel.

User: ${ctx.user.email ?? "admin"}
Role: ${isPlatformAdmin ? "Platform Admin (New Lantern staff — can see all partners and organisations)" : `Partner Admin (${partnerName} — can only see ${partnerName} organisations and users)`}

You help admins manage the portal efficiently. You can:
- List organisations and users
- Create new organisations and users
- Generate reports (e.g. who hasn't logged in)
- Navigate the user to specific pages
- Extract data from pasted email threads or meeting notes

Guidelines:
- Be concise and action-oriented
- When creating organisations or users, confirm the key details before proceeding unless clearly specified
- For platform admins creating an org, you CANNOT call create_organization (they must specify which partner — ask them to use the admin UI or tell you the partner). Simply tell them to navigate to the create org page.
- Always use the appropriate tool rather than just describing what to do
- If someone pastes an email or text, use extract_from_text to parse it
- Format lists as markdown tables or bullet points
- If you navigate somewhere, tell the user what you did`;

      // ---- Build message list ----
      const llmMessages: Message[] = [
        { role: "system", content: systemPrompt },
      ];

      // Attach file if provided
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

        // Skip adding the last user message again
        for (const msg of input.messages.slice(0, -1)) {
          llmMessages.push({ role: msg.role as Message["role"], content: msg.content });
        }
      } else {
        for (const msg of input.messages) {
          llmMessages.push({ role: msg.role as Message["role"], content: msg.content });
        }
      }

      // ---- Tool-calling loop (max 3 iterations) ----
      let currentMessages = [...llmMessages];
      let finalMessage = "";
      let finalAction: ChatAction | undefined;

      for (let iteration = 0; iteration < 3; iteration++) {
        const result = await invokeLLM({
          messages: currentMessages,
          tools: TOOLS,
          toolChoice: "auto",
        });

        const choice = result.choices[0];
        if (!choice) break;

        const toolCalls = choice.message.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          // No tool call — this is the final answer
          const content = choice.message.content;
          finalMessage = typeof content === "string" ? content : JSON.stringify(content);
          break;
        }

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          toolCalls.map((tc) => executeTool(tc, ctx))
        );

        // Capture the first action (e.g. navigate)
        for (const tr of toolResults) {
          if (tr.action && !finalAction) {
            finalAction = tr.action;
          }
        }

        // Append assistant message + tool results to the conversation
        currentMessages.push({
          role: "assistant",
          content: "",
          // @ts-ignore — tool_calls field not in our Message type but supported by the API
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

      return {
        message: finalMessage,
        action: finalAction ?? null,
      };
    }),
});
