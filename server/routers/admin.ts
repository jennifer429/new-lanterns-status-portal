import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminDbProcedure, protectedProcedure, router } from "../_core/trpc";
import { questions, questionOptions, organizations, users, clients, intakeFileAttachments, partnerTemplates, specifications, intakeResponses, systemVendorOptions, vendorAuditLog, taskCompletion, validationResults, partnerTaskTemplates, orgCustomTasks, orgNotes } from "../../drizzle/schema";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "@shared/taskDefs";
import { eq, and, or, desc, inArray, sql, like } from "drizzle-orm";
import { getAllTestKeys } from "@shared/validationDefs";
import { computeNextUpSections, computeNextUpTests, computeNextUpTasks } from "@shared/nextUp";
import { uploadToGoogleDrive } from "./files";
import { dispatch } from "../notionSyncDispatcher";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { sendEmail } from "../email/send";
import { inviteTemplate } from "../email/templates";
import { ENV } from "../_core/env";
import { fileUploadInput } from "../_core/fileValidation";
import { logFileActivity } from "../fileAuditLog";

/**
 * Flatten the questionnaire section definitions into the flat question list
 * consumed by the shared progress calculation. Shared between the admin
 * summary metrics and the go-live auto-N/A logic so the two never drift.
 */
function buildAllQuestions(questionnaireSections: any[]) {
  return questionnaireSections.flatMap((section: any) => {
    if (section.type === "connectivity-table" && section.questions) {
      const stdQuestions = section.questions
        .filter((q: any) => !q.inactive)
        .map((q: any) => ({
          id: q.id,
          sectionTitle: section.title,
          isWorkflow: false,
          type: q.type,
          conditionalOn: q.conditionalOn || null,
        }));
      stdQuestions.push({
        id: "CONN.endpoints",
        sectionTitle: section.title,
        isWorkflow: false,
        type: "textarea",
        conditionalOn: null,
      });
      return stdQuestions;
    } else if (section.type === "integration-workflows" && section.questions) {
      return section.questions
        .filter((q: any) => !q.inactive)
        .map((q: any) => ({
          id: q.id,
          sectionTitle: section.title,
          isWorkflow: false,
          type: q.type,
          conditionalOn: q.conditionalOn || null,
        }));
    } else if (section.questions) {
      return section.questions
        .filter((q: any) => !q.inactive)
        .map((q: any) => ({
          id: q.id,
          sectionTitle: section.title,
          isWorkflow: false,
          type: q.type,
          conditionalOn: q.conditionalOn || null,
        }));
    } else if (section.type === "workflow") {
      return [{
        id: `${section.id}_config`,
        sectionTitle: section.title,
        isWorkflow: true,
      }];
    }
    return [];
  });
}

/**
 * Admin router for managing questions, options, organizations, and users
 * All endpoints require authentication and admin role
 */
export const adminRouter = router({
  // ============================================================================
  // QUESTIONS CRUD
  // ============================================================================

  /**
   * Get all questions with their options
   */
  getAllQuestions: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const allQuestions = await db
      .select()
      .from(questions)
      .orderBy(questions.sectionId, questions.questionNumber);

    // Get all options
    const allOptions = await db
      .select()
      .from(questionOptions)
      .orderBy(questionOptions.displayOrder);

    // Group options by questionId
    const optionsByQuestion = allOptions.reduce((acc, option) => {
      if (!acc[option.questionId]) {
        acc[option.questionId] = [];
      }
      acc[option.questionId].push(option);
      return acc;
    }, {} as Record<number, typeof allOptions>);

    // Attach options to questions
    return allQuestions.map(q => ({
      ...q,
      options: optionsByQuestion[q.id] || [],
    }));
  }),

  /**
   * Create a new question
   */
  createQuestion: adminDbProcedure
    .input(
      z.object({
        questionId: z.string(),
        sectionId: z.string(),
        sectionTitle: z.string(),
        questionNumber: z.number(),
        shortTitle: z.string(),
        questionText: z.string(),
        questionType: z.string(),
        placeholder: z.string().optional(),
        notes: z.string().optional(),
        required: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if questionId already exists
      const existing = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, input.questionId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Question ID already exists" });
      }

      const [newQuestion] = await db.insert(questions).values(input);
      dispatch.question({
        mysqlId: newQuestion.insertId || 0,
        key: input.questionId,
        section: input.sectionId,
        type: input.questionType || "text",
        required: !!input.required,
        active: true,
        sortOrder: input.questionNumber || 0,
        fullText: input.questionText || "",
        createdAt: new Date(),
      });
      return { success: true, questionId: newQuestion.insertId };;
    }),

  /**
   * Update a question
   */
  updateQuestion: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        questionId: z.string().optional(),
        sectionId: z.string().optional(),
        sectionTitle: z.string().optional(),
        questionNumber: z.number().optional(),
        shortTitle: z.string().optional(),
        questionText: z.string().optional(),
        questionType: z.string().optional(),
        placeholder: z.string().optional(),
        notes: z.string().optional(),
        required: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const { id, ...updates } = input;

      await db.update(questions).set(updates).where(eq(questions.id, id));

      return { success: true };
    }),

  /**
   * Delete a question
   */
  deleteQuestion: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Delete associated options first
      await db.delete(questionOptions).where(eq(questionOptions.questionId, input.id));

      // Delete the question
      await db.delete(questions).where(eq(questions.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // QUESTION OPTIONS CRUD
  // ============================================================================

  /**
   * Get options for a specific question
   */
  getQuestionOptions: adminDbProcedure
    .input(z.object({ questionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      return await db
        .select()
        .from(questionOptions)
        .where(eq(questionOptions.questionId, input.questionId))
        .orderBy(questionOptions.displayOrder);
    }),

  /**
   * Create a new question option
   */
  createQuestionOption: adminDbProcedure
    .input(
      z.object({
        questionId: z.number(),
        optionValue: z.string(),
        optionLabel: z.string(),
        displayOrder: z.number().default(0),
        isActive: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

       const [newOption] = await db.insert(questionOptions).values(input);
      dispatch.questionOption({
        mysqlId: newOption.insertId || 0,
        questionId: input.questionId,
        questionKey: String(input.questionId),
        label: input.optionLabel || "",
        value: input.optionValue || "",
        sortOrder: input.displayOrder || 0,
        createdAt: new Date(),
      });
      return { success: true, optionId: newOption.insertId };
    }),

  /**
   * Update a question option
   */
  updateQuestionOption: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        optionValue: z.string().optional(),
        optionLabel: z.string().optional(),
        displayOrder: z.number().optional(),
        isActive: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const { id, ...updates } = input;

      await db.update(questionOptions).set(updates).where(eq(questionOptions.id, id));

      return { success: true };
    }),

  /**
   * Delete a question option
   */
  deleteQuestionOption: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.delete(questionOptions).where(eq(questionOptions.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder question options
   */
  reorderQuestionOptions: adminDbProcedure
    .input(
      z.object({
        questionId: z.number(),
        optionIds: z.array(z.number()), // Array of option IDs in new order
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Update display order for each option
      for (let i = 0; i < input.optionIds.length; i++) {
        await db
          .update(questionOptions)
          .set({ displayOrder: i + 1 })
          .where(eq(questionOptions.id, input.optionIds[i]));
      }

      return { success: true };
    }),

  // ============================================================================
  // CLIENTS CRUD
  // ============================================================================

  /**
   * Get clients (partners) - Platform admins see all, partner admins see only their own
   */
  getAllClients: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Platform admins see all clients, partner admins see only their own
    if (ctx.user.clientId) {
      return await db.select().from(clients).where(eq(clients.id, ctx.user.clientId));
    } else {
      return await db.select().from(clients).orderBy(clients.name);
    }
  }),

  /**
   * Create a new client (partner)
   * Platform admins only
   */
  createClient: adminDbProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z.string().min(1, "Slug is required"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      // Check if slug already exists
      const existing = await db.select().from(clients).where(eq(clients.slug, input.slug)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "A partner with this slug already exists" });
      }

      const [newClient] = await db.insert(clients).values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        status: "active",
      });
      dispatch.client({
        mysqlId: (newClient as any).insertId || 0,
        name: input.name,
        slug: input.slug,
        contactName: null,
        contactEmail: null,
        active: true,
        orgCount: 0,
        createdAt: new Date(),
      });
      return { success: true };;
    }),

  /**
   * Update an existing client (partner)
   * Platform admins only
   */
  updateClient: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "Name is required"),
        slug: z.string().min(1, "Slug is required"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      // Check the client exists
      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      }

      // Check slug uniqueness (excluding self)
      const slugConflict = await db.select().from(clients)
        .where(and(eq(clients.slug, input.slug), sql`${clients.id} != ${input.id}`))
        .limit(1);
      if (slugConflict.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "A partner with this slug already exists" });
      }

      await db.update(clients).set({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
      }).where(eq(clients.id, input.id));

      return { success: true };
    }),

  /**
   * Deactivate a client (partner) - soft delete
   * Platform admins only
   */
  deactivateClient: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      }

      await db.update(clients).set({ status: "inactive" }).where(eq(clients.id, input.id));

      return { success: true };
    }),

  /**
   * Reactivate a client (partner)
   * Platform admins only
   */
  reactivateClient: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      }

      await db.update(clients).set({ status: "active" }).where(eq(clients.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // ORGANIZATIONS CRUD
  // ============================================================================

  /**
   * Get all organizations (filtered by user's clientId)
   */
  /**
   * Debug: Get current user's full data
   */
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  getAllOrganizations: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Debug logging

    // Filter by user's clientId for access control
    if (ctx.user.clientId) {
      return await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId)).orderBy(desc(organizations.createdAt));
    } else {
      // Super admin or no clientId - show all
      return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    }
  }),

  /**
   * Get all intake responses for all orgs the caller can access.
   * Used by the Production Connectivity Matrix.
   * Access control mirrors getAllOrganizations:
   *   - Platform admin (no clientId) → all orgs
   *   - Partner admin (clientId set) → only their partner's orgs
   */
  getAllOrgResponses: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    let accessibleOrgs;
    if (ctx.user.clientId) {
      accessibleOrgs = await db.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      accessibleOrgs = await db.select({ id: organizations.id }).from(organizations);
    }

    const orgIds = accessibleOrgs.map(o => o.id);
    if (orgIds.length === 0) return [];

    return await db.select({
      organizationId: intakeResponses.organizationId,
      questionId: intakeResponses.questionId,
      response: intakeResponses.response,
      updatedBy: intakeResponses.updatedBy,
      updatedAt: intakeResponses.updatedAt,
      createdAt: intakeResponses.createdAt,
    })
      .from(intakeResponses)
      .where(inArray(intakeResponses.organizationId, orgIds));
  }),

  /**
   * Save a single response for any accessible org (admin use — powers matrix inline editing).
   * Access control: partner admin can only write to orgs they own.
   */
  saveOrgResponse: adminDbProcedure
    .input(z.object({
      organizationId: z.number(),
      questionId: z.string(),
      response: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify caller can access this org
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      const [existing] = await db.select().from(intakeResponses).where(
        and(
          eq(intakeResponses.organizationId, input.organizationId),
          eq(intakeResponses.questionId, input.questionId)
        )
      ).limit(1);

      if (existing) {
        await db.update(intakeResponses)
          .set({ response: input.response, updatedBy: ctx.user.email ?? "admin" })
          .where(eq(intakeResponses.id, existing.id));
      } else {
        await db.insert(intakeResponses).values({
          organizationId: input.organizationId,
          questionId: input.questionId,
          response: input.response,
          section: "admin",
          updatedBy: ctx.user.email ?? "admin",
        });
      }

      return { success: true };
    }),

  /**
   * Bulk-upsert responses from a CSV import.
   * Same access control as saveOrgResponse.
   */
  bulkSaveOrgResponses: adminDbProcedure
    .input(z.object({
      rows: z.array(z.object({
        organizationId: z.number(),
        questionId: z.string(),
        response: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify all org IDs are accessible
      const uniqueOrgIds = Array.from(new Set(input.rows.map(r => r.organizationId)));
      const accessibleOrgs = ctx.user.clientId
        ? await db.select({ id: organizations.id }).from(organizations)
            .where(and(inArray(organizations.id, uniqueOrgIds), eq(organizations.clientId, ctx.user.clientId)))
        : await db.select({ id: organizations.id }).from(organizations)
            .where(inArray(organizations.id, uniqueOrgIds));

      const allowedIds = new Set(accessibleOrgs.map(o => o.id));
      const denied = uniqueOrgIds.filter(id => !allowedIds.has(id));
      if (denied.length > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Access denied to org IDs: ${denied.join(", ")}` });
      }

      const editor = ctx.user.email ?? "admin";
      let saved = 0;

      for (const row of input.rows) {
        if (!row.response.trim()) continue; // skip blank cells
        const [existing] = await db.select({ id: intakeResponses.id })
          .from(intakeResponses)
          .where(and(
            eq(intakeResponses.organizationId, row.organizationId),
            eq(intakeResponses.questionId, row.questionId),
          )).limit(1);

        if (existing) {
          await db.update(intakeResponses)
            .set({ response: row.response, updatedBy: editor })
            .where(eq(intakeResponses.id, existing.id));
        } else {
          await db.insert(intakeResponses).values({
            organizationId: row.organizationId,
            questionId: row.questionId,
            response: row.response,
            section: "admin",
            updatedBy: editor,
          });
        }
        saved++;
      }

      return { saved };
    }),

  /**
   * Create a new organization
   */
  createOrganization: adminDbProcedure
    .input(
      z.object({
        clientId: z.number().optional(), // Optional - will be auto-assigned for partner admins
        name: z.string(),
        slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").min(3, "Slug must be at least 3 characters").max(100, "Slug must be at most 100 characters"),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        status: z.enum(["active", "completed", "paused"]).default("active"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Partner admins can only create orgs for their own partner
      // Platform admins must specify clientId
      let clientId = input.clientId;
      
      if (ctx.user.clientId !== null && ctx.user.clientId !== undefined) {
        // Partner admin - force their clientId, ignore input
        clientId = ctx.user.clientId;
      } else if (!clientId) {
        // Platform admin without clientId specified
        throw new TRPCError({ code: "BAD_REQUEST", message: "Platform admins must specify clientId when creating organizations" });
      }

      // Check if slug already exists
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Organization slug already exists" });
      }

      const [newOrg] = await db.insert(organizations).values({
        ...input,
        clientId, // Use auto-assigned or provided clientId
      });
      dispatch.organization({
        mysqlId: newOrg.insertId || 0,
        name: input.name,
        slug: input.slug,
        clientId: clientId || 0,
        partnerName: "",
        contactName: input.contactName || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        status: "active",
        startDate: null,
        goalDate: null,
        driveFolderId: null,
        createdAt: new Date(),
      });
      return { success: true, organizationId: newOrg.insertId };;
    }),

  /**
   * Update an organization.
   *
   * Slug is intentionally not editable — it's the stable URL identifier
   * for an org and changing it after data exists would (a) break every
   * bookmark and inbound link, and (b) leave responses keyed by the old
   * URL stranded if anything in the system still resolved by slug.
   * Names can change freely; slugs cannot.
   */
  updateOrganization: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        status: z.enum(["active", "completed", "paused"]).optional(),
        clientId: z.number().optional(),
        targetGoLiveDate: z.string().nullable().optional(),
        liveDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const { id, ...updates } = input;

      await db.update(organizations).set(updates).where(eq(organizations.id, id));

      return { success: true };
    }),

  /**
   * Delete an organization (cascades to users and responses)
   */
  deleteOrganization: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Note: In production, you might want to soft-delete or archive instead
      // This will cascade delete users and responses associated with this org

      await db.delete(organizations).where(eq(organizations.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // FILES MANAGEMENT
  // ============================================================================

  /**
   * Get all uploaded files across all organizations (filtered by user's clientId)
   */
  getAllFiles: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Join files with organizations to filter by clientId
    const files = await db
      .select({
        id: intakeFileAttachments.id,
        fileName: intakeFileAttachments.fileName,
        fileUrl: intakeFileAttachments.fileUrl,
        fileSize: intakeFileAttachments.fileSize,
        questionId: intakeFileAttachments.questionId,
        createdAt: intakeFileAttachments.createdAt,
        organizationId: intakeFileAttachments.organizationId,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
      })
      .from(intakeFileAttachments)
      .leftJoin(organizations, eq(intakeFileAttachments.organizationId, organizations.id))
      .orderBy(desc(intakeFileAttachments.createdAt));

    // Filter by clientId if user has one
    if (ctx.user.clientId) {
      const userOrgs = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clientId, ctx.user.clientId));
      
      const orgIds = userOrgs.map(o => o.id);
      return files.filter(f => f.organizationId && orgIds.includes(f.organizationId));
    }

    return files;
  }),

  /**
   * Delete a file
   */
  deleteFile: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get file details first to check access
      const [file] = await db
        .select({
          id: intakeFileAttachments.id,
          organizationId: intakeFileAttachments.organizationId,
        })
        .from(intakeFileAttachments)
        .where(eq(intakeFileAttachments.id, input.id))
        .limit(1);

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }

      // Check clientId access
      if (ctx.user.clientId && file.organizationId) {
        const [org] = await db
          .select({ clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.id, file.organizationId))
          .limit(1);

        if (org && org.clientId !== ctx.user.clientId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      // Delete from database (S3 file remains for now)
      await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.id, input.id));

      return { success: true };
    }),

  /**
   * Get admin summary - unified metrics for all admin dashboards
   * Returns consistent summary data: organizations with user count, completion %, and files
   * Filters by clientId for partner admins, shows all for platform admins
   */
  getAdminSummary: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Get all organizations (filtered by clientId if applicable)
    let orgs;
    if (ctx.user.clientId) {
      orgs = await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      orgs = await db.select().from(organizations);
    }

    // For each organization, get metrics
    const metrics = await Promise.all(
      orgs.map(async (org) => {
        // Get user count
        const orgUsers = await db.select().from(users).where(eq(users.organizationId, org.id));
        const userCount = orgUsers.length;

        // Use shared progress calculation function (same as frontend)
        const { calculateProgress } = await import("../../shared/progressCalculation");
        const { questionnaireSections } = await import("../../shared/questionnaireData");
        
        // Get responses from intakeResponses table (where saveResponse writes)
        const { intakeResponses } = await import("../../drizzle/schema");
        const orgResponses = await db
          .select({
            id: intakeResponses.id,
            organizationId: intakeResponses.organizationId,
            questionId: intakeResponses.questionId, // Already a string (e.g., "H.1", "A.2")
            response: intakeResponses.response,
            fileUrl: intakeResponses.fileUrl,
            createdAt: intakeResponses.createdAt,
            updatedAt: intakeResponses.updatedAt
          })
          .from(intakeResponses)
          .where(eq(intakeResponses.organizationId, org.id));
        const orgFiles = await db
          .select()
          .from(intakeFileAttachments)
          .where(eq(intakeFileAttachments.organizationId, org.id));

        // Build question list (include workflow sections)
        const allQuestions = buildAllQuestions(questionnaireSections);

        // Calculate progress using shared utility
        const progress = calculateProgress(allQuestions, orgResponses, orgFiles);
        const completionPercent = progress.completionPercentage;

        // Convert section progress from shared utility format to percentage format
        const sectionTitleToId: Record<string, string> = {
          "Organization Info": "organizationInfo",
          "Architecture": "architecture",
          "Integration Workflows": "integrationWorkflows",
          "Connectivity": "connectivity",
          "Config Files": "configFiles",
          "HL7 & DICOM Data": "hl7DicomData",
        };
        
        const sectionProgress: Record<string, {completed: number, total: number}> = {};
        Object.entries(progress.sectionProgress).forEach(([title, stats]) => {
          // Use title as key (not sectionId) to match frontend expectations
          sectionProgress[title] = stats;
        });
        
        const sectionsComplete = Object.values(sectionProgress).filter(stats => stats.completed === stats.total && stats.total > 0).length;

        // Get files
        const files = await db
          .select()
          .from(intakeFileAttachments)
          .where(eq(intakeFileAttachments.organizationId, org.id))
          .orderBy(desc(intakeFileAttachments.createdAt));

        // Site files = labeled documents & notes (orgNotes), distinct from
        // questionnaire-attached files (intakeFileAttachments / `files`).
        const siteNoteRows = await db
          .select({ id: orgNotes.id })
          .from(orgNotes)
          .where(eq(orgNotes.organizationId, org.id));
        const siteFileCount = siteNoteRows.length;

        // Count N/A questions (stored as __question_na:{questionId} = 'true')
        const naQuestionCount = orgResponses.filter(r => 
          r.questionId.startsWith('__question_na:') && (r.response === 'true' || r.response === true as any)
        ).length;

        // Task stats
        const taskRows = await db
          .select()
          .from(taskCompletion)
          .where(eq(taskCompletion.organizationId, org.id));
        const taskMap: Record<string, typeof taskRows[number]> = {};
        for (const row of taskRows) { taskMap[row.taskId] = row; }
        const allTaskDefs = TASK_SECTION_DEFS.flatMap(s => s.tasks);
        const taskStats = {
          total: allTaskDefs.length,
          completed: allTaskDefs.filter(t => taskMap[t.id]?.completed === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          inProgress: allTaskDefs.filter(t => taskMap[t.id]?.inProgress === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          blocked: allTaskDefs.filter(t => taskMap[t.id]?.blocked === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          notApplicable: allTaskDefs.filter(t => taskMap[t.id]?.notApplicable === 1).length,
        };

        // Validation / testing stats (total = 28 tests across 4 phases)
        const TOTAL_TESTS = 28;
        const valRows = await db
          .select()
          .from(validationResults)
          .where(eq(validationResults.organizationId, org.id));
        const valPass = valRows.filter(r => r.status === "Pass").length;
        const valFail = valRows.filter(r => r.status === "Fail").length;
        const valNA = valRows.filter(r => r.status === "N/A").length;
        const valInProgress = valRows.filter(r => r.status === "In Progress").length;
        const valBlocked = valRows.filter(r => r.status === "Blocked").length;
        const valNotTested = TOTAL_TESTS - valPass - valFail - valNA - valInProgress - valBlocked;
        const validationStats = {
          total: TOTAL_TESTS,
          pass: valPass,
          fail: valFail,
          notTested: Math.max(0, valNotTested),
          na: valNA,
          inProgress: valInProgress,
          blocked: valBlocked,
        };

        // ── "Next up" lists — shared with the site dashboard via
        // shared/nextUp.ts so admin and site can never drift. ──
        const valByKey: Record<string, { status: string }> = {};
        for (const row of valRows) { valByKey[row.testKey] = { status: row.status }; }
        const nextUpSections = computeNextUpSections(progress.sectionProgress);
        const nextUpTests = computeNextUpTests(valByKey);
        const nextUpTasks = computeNextUpTasks(allTaskDefs, taskMap);

        return {
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          status: org.status,
          userCount,
          completionPercent,
          sectionsComplete,
          sectionProgress,
          taskStats,
          validationStats,
          naQuestionCount,
          // Questionnaire files (attached to intake answers).
          questionnaireFileCount: files.length,
          // Site files (labeled documents & notes, not tied to the questionnaire).
          siteFileCount,
          // "Next up" lists shared with the site dashboard phase cards.
          nextUpSections,
          nextUpTests,
          nextUpTasks,
          files: files.map(f => ({
            id: f.id,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            uploadedAt: f.createdAt,
          })),
        };
      })
    );

    return metrics;
  }),

  /**
   * Get all users - filtered by clientId for partner admins
   */
  getAllUsers: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Platform admins see all users, partner admins see only their partner's users
    let allUsers;
    if (ctx.user.clientId) {
      // Partner admin: show users from their partner's orgs + other partner admins with same clientId
      const partnerOrgs = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clientId, ctx.user.clientId));
      
      const orgIds = partnerOrgs.map(org => org.id);
      
      allUsers = await db
        .select()
        .from(users)
        .where(
          or(
            // Users assigned to partner's organizations
            orgIds.length > 0 ? inArray(users.organizationId, orgIds) : sql`1=0`,
            // Partner admin users with same clientId (no org assignment)
            and(
              eq(users.clientId, ctx.user.clientId),
              eq(users.role, 'admin')
            )
          )
        );
    } else {
      // Platform admin: see all users
      allUsers = await db.select().from(users);
    }

    return allUsers;
  }),

  /**
   * Create a new user
   */
  createUser: adminDbProcedure
    .input(
      z.object({
        email: z.string().min(1, "Email is required").refine(
          (email) => {
            // Only validate @newlantern.ai emails strictly
            if (email.endsWith('@newlantern.ai')) {
              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            }
            // For other emails, just check that @ exists
            return email.includes('@');
          },
          { message: "Invalid email format" }
        ),
        name: z.string(),
        organizationId: z.number().optional(), // Optional for partner admins who don't belong to a specific org
        role: z.enum(["user", "admin"]),
        clientId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Partner admins can only create users for their own partner
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot create users for other partners" });
      }

      const { db } = ctx;

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "User with this email already exists" });
      }

      // Generate a temporary password (in production, send email with reset link)
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Validate: regular users must have an organizationId
      if (input.role === "user" && !input.organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization is required for non-admin users" });
      }

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          organizationId: input.organizationId || null,
          role: input.role,
          clientId: input.clientId,
          passwordHash,
          loginMethod: "email",
          openId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
      dispatch.portalUser({
        mysqlId: (newUser as any).insertId || 0,
        name: input.name,
        email: input.email,
        role: input.role,
        clientId: input.clientId,
        partnerName: null,
        organizationId: input.organizationId || null,
        orgName: null,
        active: true,
        lastLogin: null,
        createdAt: new Date(),
      });

      // Collect partner-admin CC list so they are notified of the new user's
      // initial invite. Only active admins on the same partner; never the
      // newly-created user themselves.
      let ccEmails: string[] = [];
      if (input.clientId) {
        const partnerAdmins = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              eq(users.clientId, input.clientId),
              eq(users.role, "admin"),
              eq(users.isActive, 1),
            )
          );
        ccEmails = partnerAdmins
          .map((a) => a.email)
          .filter((e): e is string => !!e && e !== input.email);
      }

      // Generate invite token and send email directly
      const inviteToken = randomBytes(32).toString("hex");
      const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.update(users)
        .set({ inviteToken, inviteTokenExpiresAt })
        .where(eq(users.id, newUser.insertId));

      // Build URLs
      const setPasswordUrl = `${ENV.siteBaseUrl}/set-password?token=${inviteToken}`;
      let dashboardUrl = `${ENV.siteBaseUrl}/login`;
      let orgName: string | null = null;
      if (input.organizationId) {
        const [org] = await db.select({ slug: organizations.slug, name: organizations.name })
          .from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
        if (org) {
          dashboardUrl = `${ENV.siteBaseUrl}/org/${org.slug}`;
          orgName = org.name;
        }
      } else if (input.clientId) {
        const [client] = await db.select({ slug: clients.slug, name: clients.name })
          .from(clients).where(eq(clients.id, input.clientId)).limit(1);
        if (client) {
          dashboardUrl = `${ENV.siteBaseUrl}/org/${client.slug}/admin`;
          orgName = client.name;
        }
      }

      const { subject, html, text } = inviteTemplate({
        displayName: input.name || input.email,
        orgName,
        setPasswordUrl,
        dashboardUrl,
      });

      const emailSent = await sendEmail({
        to: input.email,
        cc: ccEmails,
        subject, html, text,
        type: "invite",
        organizationId: input.organizationId ?? null,
        triggeredBy: ctx.user?.email ?? undefined,
      });

      if (emailSent) {
        await db.update(users)
          .set({ invitedAt: new Date() })
          .where(eq(users.id, newUser.insertId));
      }

      return { success: true, tempPassword, emailSent };
    }),

  /**
   * Resend invite for a user — regenerates invite token, resets invitedAt,
   * so the user shows up in /api/external/invites/pending again.
   */
  resendInvite: adminDbProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify the user exists
      const [targetUser] = await db
        .select({ id: users.id, email: users.email, name: users.name, isActive: users.isActive, clientId: users.clientId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (targetUser.isActive === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot resend invite to an inactive user" });
      }

      if (!targetUser.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot resend invite to a user without an email address" });
      }

      // Partner admins can only resend for their own partner's users
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot resend invite for users from other partners" });
      }

      // Generate fresh invite token
      const inviteToken = randomBytes(32).toString("hex");
      const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.update(users)
        .set({ invitedAt: null, inviteToken, inviteTokenExpiresAt })
        .where(eq(users.id, input.userId));

      // Look up org/client for email template
      const setPasswordUrl = `${ENV.siteBaseUrl}/set-password?token=${inviteToken}`;
      let dashboardUrl = `${ENV.siteBaseUrl}/login`;
      let orgName: string | null = null;

      // Re-fetch full user to get organizationId
      const [fullUser] = await db.select({ organizationId: users.organizationId, clientId: users.clientId })
        .from(users).where(eq(users.id, input.userId)).limit(1);

      if (fullUser?.organizationId) {
        const [org] = await db.select({ slug: organizations.slug, name: organizations.name })
          .from(organizations).where(eq(organizations.id, fullUser.organizationId)).limit(1);
        if (org) {
          dashboardUrl = `${ENV.siteBaseUrl}/org/${org.slug}`;
          orgName = org.name;
        }
      } else if (targetUser.clientId) {
        const [client] = await db.select({ slug: clients.slug, name: clients.name })
          .from(clients).where(eq(clients.id, targetUser.clientId)).limit(1);
        if (client) {
          dashboardUrl = `${ENV.siteBaseUrl}/org/${client.slug}/admin`;
          orgName = client.name;
        }
      }

      const { subject, html, text } = inviteTemplate({
        displayName: targetUser.name || targetUser.email,
        orgName,
        setPasswordUrl,
        dashboardUrl,
      });

      const emailSent = await sendEmail({
        to: targetUser.email,
        subject, html, text,
        type: "invite",
        organizationId: fullUser?.organizationId ?? null,
        triggeredBy: ctx.user?.email ?? undefined,
      });

      if (emailSent) {
        await db.update(users)
          .set({ invitedAt: new Date() })
          .where(eq(users.id, input.userId));
      }

      return { success: true, email: targetUser.email, emailSent };
    }),

  /**
   * Deactivate an organization (soft delete)
   */
  deactivateOrganization: adminDbProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only deactivate their own partner's organizations
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate other partner's organizations" });
      }

      // Update status to inactive
      await db
        .update(organizations)
        .set({ status: "inactive" })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Reactivate an organization
   */
  reactivateOrganization: adminDbProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only reactivate their own partner's organizations
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reactivate other partner's organizations" });
      }

      // Update status to active
      await db
        .update(organizations)
        .set({ status: "active" })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Mark an organization as complete
   */
  markOrganizationComplete: adminDbProcedure
    .input(z.object({
      organizationId: z.number(),
      // Actual go-live date (YYYY-MM-DD). Defaults to today when omitted.
      liveDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only mark their own partner's organizations as complete
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot mark other partner's organizations as complete" });
      }

      // When a site goes live, every still-open item is marked N/A (dated
      // today) so all three progress tracks read 100%. We snapshot the prior
      // state of each item we touch so Reopen can revert exactly these changes.
      const today = input.liveDate || new Date().toISOString().slice(0, 10);
      const now = new Date();
      const actor = ctx.user.email ?? "go-live";

      const snapshot: {
        tasks: { taskId: string; sectionName: string; prior: null | { completed: number; notApplicable: number; inProgress: number; blocked: number; completedAt: string | null; completedBy: string | null; targetDate: string | null } }[];
        tests: { testKey: string; prior: null | { status: string; testedDate: string | null } }[];
        questions: { qId: string; prior: string | null }[];
      } = { tasks: [], tests: [], questions: [] };

      // ── Tasks: any task that isn't done and isn't already N/A → N/A ──
      const taskRows = await db.select().from(taskCompletion).where(eq(taskCompletion.organizationId, org.id));
      const taskMap = new Map(taskRows.map(r => [r.taskId, r]));
      const allTaskDefs = TASK_SECTION_DEFS.flatMap(s => s.tasks.map(t => ({ id: t.id, sectionName: s.title })));
      for (const t of allTaskDefs) {
        const row = taskMap.get(t.id);
        const isDone = row?.completed === 1 && row?.notApplicable !== 1;
        const isNA = row?.notApplicable === 1;
        if (isDone || isNA) continue;
        snapshot.tasks.push({
          taskId: t.id,
          sectionName: t.sectionName,
          prior: row ? {
            completed: row.completed, notApplicable: row.notApplicable, inProgress: row.inProgress, blocked: row.blocked,
            completedAt: row.completedAt ? row.completedAt.toISOString() : null, completedBy: row.completedBy, targetDate: row.targetDate,
          } : null,
        });
        if (row) {
          await db.update(taskCompletion)
            .set({ completed: 0, notApplicable: 1, inProgress: 0, blocked: 0, completedAt: now, completedBy: actor, targetDate: row.targetDate ?? today, notionLastEdited: null })
            .where(eq(taskCompletion.id, row.id));
        } else {
          await db.insert(taskCompletion)
            .values({ organizationId: org.id, taskId: t.id, sectionName: t.sectionName, completed: 0, notApplicable: 1, inProgress: 0, blocked: 0, completedAt: now, completedBy: actor, targetDate: today, notionLastEdited: null });
        }
      }

      // ── Tests: any test that isn't Pass and isn't already N/A → N/A ──
      const valRows = await db.select().from(validationResults).where(eq(validationResults.organizationId, org.id));
      const valMap = new Map(valRows.map(r => [r.testKey, r]));
      for (const testKey of getAllTestKeys()) {
        const row = valMap.get(testKey);
        if (row?.status === "Pass" || row?.status === "N/A") continue;
        snapshot.tests.push({ testKey, prior: row ? { status: row.status, testedDate: row.testedDate } : null });
        if (row) {
          await db.update(validationResults)
            .set({ status: "N/A", testedDate: today, notionLastEdited: null })
            .where(eq(validationResults.id, row.id));
        } else {
          await db.insert(validationResults)
            .values({ organizationId: org.id, testKey, status: "N/A", testedDate: today, notionLastEdited: null });
        }
      }

      // ── Questionnaire: any visible, unanswered, not-already-N/A question → N/A ──
      const { getIncompleteVisibleQuestionIds } = await import("../../shared/progressCalculation");
      const { questionnaireSections } = await import("../../shared/questionnaireData");
      const respRows = await db
        .select({ questionId: intakeResponses.questionId, response: intakeResponses.response })
        .from(intakeResponses).where(eq(intakeResponses.organizationId, org.id));
      const fileRows = await db
        .select({ questionId: intakeFileAttachments.questionId })
        .from(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, org.id));
      const incompleteIds = getIncompleteVisibleQuestionIds(buildAllQuestions(questionnaireSections), respRows as any, fileRows as any);
      const markerRows = await db.select().from(intakeResponses)
        .where(and(eq(intakeResponses.organizationId, org.id), like(intakeResponses.questionId, "__question_na:%")));
      const markerMap = new Map(markerRows.map(r => [r.questionId, r]));
      for (const qId of incompleteIds) {
        const key = `__question_na:${qId}`;
        const existing = markerMap.get(key);
        snapshot.questions.push({ qId: String(qId), prior: existing ? (existing.response ?? null) : null });
        if (existing) {
          await db.update(intakeResponses).set({ response: "true", updatedBy: actor }).where(eq(intakeResponses.id, existing.id));
        } else {
          await db.insert(intakeResponses).values({ organizationId: org.id, questionId: key, section: "__na", response: "true", status: "complete", updatedBy: actor });
        }
      }

      // Flip to completed, record go-live date, and store the revert snapshot.
      await db
        .update(organizations)
        .set({ status: "completed", liveDate: today, goLiveAutoNa: JSON.stringify(snapshot) })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Reopen a completed organization (set back to active)
   */
  reopenOrganization: adminDbProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only reopen their own partner's organizations
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reopen other partner's organizations" });
      }

      // Revert exactly the items that go-live auto-marked N/A, restoring their
      // prior state. Items the user touched manually after go-live aren't in
      // the snapshot, so they're left alone.
      let snapshot: any = null;
      try { snapshot = org.goLiveAutoNa ? JSON.parse(org.goLiveAutoNa) : null; } catch { snapshot = null; }

      if (snapshot) {
        for (const t of snapshot.tasks ?? []) {
          const [row] = await db.select().from(taskCompletion)
            .where(and(eq(taskCompletion.organizationId, org.id), eq(taskCompletion.taskId, t.taskId)));
          if (!row) continue;
          if (t.prior === null) {
            await db.delete(taskCompletion).where(eq(taskCompletion.id, row.id));
          } else {
            await db.update(taskCompletion).set({
              completed: t.prior.completed, notApplicable: t.prior.notApplicable, inProgress: t.prior.inProgress, blocked: t.prior.blocked,
              completedAt: t.prior.completedAt ? new Date(t.prior.completedAt) : null, completedBy: t.prior.completedBy, targetDate: t.prior.targetDate, notionLastEdited: null,
            }).where(eq(taskCompletion.id, row.id));
          }
        }
        for (const t of snapshot.tests ?? []) {
          const [row] = await db.select().from(validationResults)
            .where(and(eq(validationResults.organizationId, org.id), eq(validationResults.testKey, t.testKey)));
          if (!row) continue;
          if (t.prior === null) {
            await db.delete(validationResults).where(eq(validationResults.id, row.id));
          } else {
            await db.update(validationResults)
              .set({ status: t.prior.status as any, testedDate: t.prior.testedDate, notionLastEdited: null })
              .where(eq(validationResults.id, row.id));
          }
        }
        for (const q of snapshot.questions ?? []) {
          const key = `__question_na:${q.qId}`;
          const [row] = await db.select().from(intakeResponses)
            .where(and(eq(intakeResponses.organizationId, org.id), eq(intakeResponses.questionId, key)));
          if (!row) continue;
          if (q.prior === null) {
            await db.delete(intakeResponses).where(eq(intakeResponses.id, row.id));
          } else {
            await db.update(intakeResponses).set({ response: q.prior }).where(eq(intakeResponses.id, row.id));
          }
        }
      }

      // Update status to active, clear go-live date and the revert snapshot.
      await db
        .update(organizations)
        .set({ status: "active", liveDate: null, goLiveAutoNa: null })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Deactivate a user
   */
  deactivateUser: adminDbProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the user to check permissions
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Partner admins can only deactivate users from their own partner
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate other partner's users" });
      }

      // Prevent self-deactivation
      if (targetUser.id === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate yourself" });
      }

      // Mark as inactive using isActive field
      await db
        .update(users)
        .set({ isActive: 0 })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Reactivate a user
   */
  reactivateUser: adminDbProcedure
    .input(z.object({ userId: z.number(), organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the user to check permissions
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Partner admins can only reactivate users from their own partner
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reactivate other partner's users" });
      }

       // Restore user by setting isActive to 1 and optionally updating organizationId
      await db
        .update(users)
        .set({ isActive: 1, organizationId: input.organizationId })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ============================================================================
  // PARTNER TEMPLATES CRUD
  // ============================================================================

  /**
   * Get all partner templates (filtered by clientId for partner admins)
   */
  getTemplates: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    if (ctx.user.clientId) {
      // Partner admin: only see their own active templates
      return await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, ctx.user.clientId), eq(partnerTemplates.isActive, 1)))
        .orderBy(desc(partnerTemplates.updatedAt));
    } else {
      // Platform admin: see all active templates
      return await db.select().from(partnerTemplates)
        .where(eq(partnerTemplates.isActive, 1))
        .orderBy(desc(partnerTemplates.updatedAt));
    }
  }),

  /**
   * Get inactive (soft-deleted) partner templates for the history/audit view
   */
  getInactiveTemplates: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    if (ctx.user.clientId) {
      return await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, ctx.user.clientId), eq(partnerTemplates.isActive, 0)))
        .orderBy(desc(partnerTemplates.deactivatedAt));
    } else {
      return await db.select().from(partnerTemplates)
        .where(eq(partnerTemplates.isActive, 0))
        .orderBy(desc(partnerTemplates.deactivatedAt));
    }
  }),

  /**
   * Get templates for a specific client (used by intake page)
   */
  getTemplatesByClient: adminDbProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      return await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, input.clientId), eq(partnerTemplates.isActive, 1)))
        .orderBy(partnerTemplates.questionId);
    }),

  /**
   * Upload a new partner template
   */
  uploadTemplate: adminDbProcedure
    .input(
      z.object({
        clientId: z.number(),
        questionId: z.string().max(100),
        label: z.string().max(255),
        ...fileUploadInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Partner admins can only upload templates for their own partner
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot upload templates for other partners" });
      }

      const { db } = ctx;

      // Check if an active template already exists for this question+client
      const [existing] = await db.select().from(partnerTemplates)
        .where(and(
          eq(partnerTemplates.clientId, input.clientId),
          eq(partnerTemplates.questionId, input.questionId),
          eq(partnerTemplates.isActive, 1)
        )).limit(1);

      if (existing) {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: `A template already exists for this question. Use 'Replace' to update it.` 
        });
      }

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");

      // Upload to Google Drive
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop();
      const driveFileName = `partner-templates_${input.clientId}_${input.questionId}_${timestamp}.${fileExt}`;
      const { driveUrl, s3Url, s3Key } = await uploadToGoogleDrive(driveFileName, fileBuffer, `client-${input.clientId}`);
      const fileUrl = driveUrl ?? s3Url;

      // Insert into database
      const [ptRes] = await db.insert(partnerTemplates).values({
        clientId: input.clientId,
        questionId: input.questionId,
        label: input.label,
        fileName: input.fileName,
        fileUrl,
        s3Key,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.email || "unknown",
      });
      dispatch.partnerTemplate({
        mysqlId: (ptRes as any).insertId || 0,
        clientId: input.clientId,
        partnerName: "",
        questionId: input.questionId,
        title: input.label,
        fileName: input.fileName,
        fileUrl,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
        active: true,
        uploadedBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      // Audit log — non-blocking
      logFileActivity({
        action: "upload",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: `Partner Template (Client ${input.clientId})`,
        fileName: input.fileName,
        fileUrl,
        notes: `Template for question ${input.questionId}: ${input.label}`,
      });

      return { success: true, fileUrl };
    }),

  /**
   * Replace a partner template — soft-deletes the old one and creates a new active one
   */
  replaceTemplate: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().max(255),
        ...fileUploadInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get existing template
      const [existing] = await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.id, input.id), eq(partnerTemplates.isActive, 1))).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Partner admins can only replace their own templates
      if (ctx.user.clientId && existing.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot replace other partner's templates" });
      }

      // Soft-delete the old template with audit trail
      await db.update(partnerTemplates).set({ 
        isActive: 0, 
        deactivatedBy: ctx.user.email || "unknown",
        deactivatedAt: new Date(),
      }).where(eq(partnerTemplates.id, input.id));

      // Upload new file to Google Drive
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop();
      const driveFileName = `partner-templates_${existing.clientId}_${existing.questionId}_${timestamp}.${fileExt}`;
      const { driveUrl, s3Url, s3Key } = await uploadToGoogleDrive(driveFileName, fileBuffer, `client-${existing.clientId}`);
      const fileUrl = driveUrl ?? s3Url;

      // Insert new active template
      const [ptReplaceRes] = await db.insert(partnerTemplates).values({
        clientId: existing.clientId,
        questionId: existing.questionId,
        label: input.label,
        fileName: input.fileName,
        fileUrl,
        s3Key,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.email || "unknown",
      });
      dispatch.partnerTemplate({
        mysqlId: (ptReplaceRes as any).insertId || 0,
        clientId: existing.clientId,
        partnerName: "",
        questionId: existing.questionId,
        title: input.label,
        fileName: input.fileName,
        fileUrl,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
        active: true,
        uploadedBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      // Audit log — non-blocking
      logFileActivity({
        action: "upload",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: `Partner Template (Client ${existing.clientId})`,
        fileName: input.fileName,
        fileUrl,
        notes: `Replaced template for question ${existing.questionId}: ${input.label}`,
      });

      return { success: true, fileUrl };
    }),

  // ============================================================================
  // SPECIFICATIONS CRUD
  // ============================================================================

  /**
   * Get all active specifications (available to all authenticated users)
   */
  getSpecifications: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    return await db.select().from(specifications)
      .where(eq(specifications.isActive, 1))
      .orderBy(desc(specifications.createdAt));
  }),

  /**
   * Upload a new specification document (platform admin only)
   */
  uploadSpecification: adminDbProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        category: z.string().max(100).optional(),
        ...fileUploadInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      const fileBuffer = Buffer.from(input.fileData, "base64");

      // Upload to Google Drive
      const timestamp = Date.now();
      const driveFileName = `specifications_${timestamp}_${input.fileName}`;
      const { driveUrl, s3Url, s3Key } = await uploadToGoogleDrive(driveFileName, fileBuffer, "specifications");
      const fileUrl = driveUrl ?? s3Url;

      const [specRes] = await db.insert(specifications).values({
        title: input.title,
        description: input.description || null,
        category: input.category || null,
        fileName: input.fileName,
        fileUrl,
        s3Key,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.email || "unknown",
      });
      dispatch.specification({
        mysqlId: (specRes as any).insertId || 0,
        title: input.title,
        key: input.title.toLowerCase().replace(/\s+/g, "-"),
        description: input.description || null,
        category: input.category || null,
        active: true,
        createdAt: new Date(),
      });

      // Audit log — non-blocking
      logFileActivity({
        action: "upload",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: "Platform Specification",
        fileName: input.fileName,
        fileUrl,
        notes: `Specification: ${input.title}${input.category ? ` [${input.category}]` : ""}`,
      });

      return { success: true, fileUrl };
    }),

  /**
   * Update specification metadata (platform admin only)
   */
  updateSpecification: adminDbProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      await db.update(specifications)
        .set({
          title: input.title,
          description: input.description || null,
          category: input.category || null,
        })
        .where(eq(specifications.id, input.id));

      return { success: true };
    }),

  /**
   * Deactivate (soft-delete) a specification (platform admin only)
   */
  deactivateSpecification: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const { db } = ctx;

      await db.update(specifications)
        .set({ isActive: 0 })
        .where(eq(specifications.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // SYSTEM VENDOR OPTIONS (Picklist Management)
  // Both partner admins and platform admins can manage these
  // ============================================================================

  /**
   * Get all active system vendor options grouped by system type
   */
  getSystemVendorOptions: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const allOptions = await db.select().from(systemVendorOptions)
      .orderBy(systemVendorOptions.systemType, systemVendorOptions.vendorName);

    return allOptions;
  }),

  /**
   * Get active vendor options for the intake form (public for authenticated users)
   */
  getActiveVendorOptions: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const activeOptions = await db.select().from(systemVendorOptions)
      .where(eq(systemVendorOptions.isActive, 1))
      .orderBy(systemVendorOptions.systemType, systemVendorOptions.vendorName);

    // Group by systemType (alphabetized, with "Other" always last)
    const grouped: Record<string, string[]> = {};
    for (const opt of activeOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt.vendorName);
    }
    // Ensure "Other" is always last in each group
    for (const key of Object.keys(grouped)) {
      const list = grouped[key];
      const otherIdx = list.indexOf('Other');
      if (otherIdx > -1) {
        list.splice(otherIdx, 1);
        list.push('Other');
      }
    }
    return grouped;
  }),

  /**
   * Add a vendor option to a system type
   */
  addVendorOption: adminDbProcedure
    .input(z.object({
      systemType: z.string().min(1),
      vendorName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const systemType = input.systemType.trim();
      const vendorName = input.vendorName.trim().replace(/\s+/g, " ");
      if (!systemType || !vendorName) {
        throw new Error("System type and vendor name are required.");
      }

      const existing = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.systemType, systemType))
        .orderBy(desc(systemVendorOptions.displayOrder));

      const dup = existing.find(v => v.vendorName.toLowerCase() === vendorName.toLowerCase());
      if (dup) {
        throw new Error(`"${dup.vendorName}" already exists under ${systemType}${dup.isActive ? "" : " (currently hidden — re-enable it instead)"}.`);
      }

      const maxOrder = existing.length > 0 ? existing[0].displayOrder : 0;

      const [adminVendorRes] = await db.insert(systemVendorOptions).values({
        systemType,
        vendorName,
        displayOrder: maxOrder + 1,
        createdBy: ctx.user.email || "unknown",
      });
      dispatch.systemVendor({
        mysqlId: (adminVendorRes as any).insertId || 0,
        systemType,
        vendorName,
        productName: vendorName,
        active: true,
        createdAt: new Date(),
      });

      // Audit log
      const [adminAuditRes] = await db.insert(vendorAuditLog).values({
        action: 'add',
        systemType,
        vendorName,
        newValue: vendorName,
        performedBy: ctx.user.email || "unknown",
      });
      dispatch.vendorAudit({
        mysqlId: (adminAuditRes as any).insertId || 0,
        vendorId: (adminVendorRes as any).insertId || 0,
        action: 'add',
        field: systemType,
        oldValue: null,
        newValue: vendorName,
        performedBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      return { success: true };
    }),

  /**
   * Update a vendor option (rename)
   */
  updateVendorOption: adminDbProcedure
    .input(z.object({
      id: z.number(),
      vendorName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const vendorName = input.vendorName.trim().replace(/\s+/g, " ");
      if (!vendorName) {
        throw new Error("Vendor name is required.");
      }

      const [current] = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.id, input.id)).limit(1);
      if (!current) {
        throw new Error("Vendor not found.");
      }

      const siblings = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.systemType, current.systemType));
      const dup = siblings.find(v => v.id !== input.id && v.vendorName.toLowerCase() === vendorName.toLowerCase());
      if (dup) {
        throw new Error(`"${dup.vendorName}" already exists under ${current.systemType}.`);
      }

      await db.update(systemVendorOptions)
        .set({ vendorName })
        .where(eq(systemVendorOptions.id, input.id));

      const [updateAuditRes] = await db.insert(vendorAuditLog).values({
        action: 'update',
        systemType: current.systemType,
        vendorName,
        previousValue: current.vendorName,
        newValue: vendorName,
        performedBy: ctx.user.email || "unknown",
      });
      dispatch.vendorAudit({
        mysqlId: (updateAuditRes as any).insertId || 0,
        vendorId: input.id,
        action: 'update',
        field: current.systemType,
        oldValue: current.vendorName,
        newValue: vendorName,
        performedBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      return { success: true };
    }),

  /**
   * Toggle active/inactive for a vendor option
   */
  toggleVendorOption: adminDbProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.number().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get current value for audit log
      const [currentToggle] = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.id, input.id)).limit(1);

      await db.update(systemVendorOptions)
        .set({ isActive: input.isActive })
        .where(eq(systemVendorOptions.id, input.id));

      // Audit log
      if (currentToggle) {
        const [toggleRes] = await db.insert(vendorAuditLog).values({
          action: 'toggle',
          systemType: currentToggle.systemType,
          vendorName: currentToggle.vendorName,
          previousValue: currentToggle.isActive === 1 ? 'active' : 'inactive',
          newValue: input.isActive === 1 ? 'active' : 'inactive',
          performedBy: ctx.user.email || "unknown",
        });
        dispatch.vendorAudit({
          mysqlId: (toggleRes as any).insertId || 0,
          vendorId: input.id,
          action: 'toggle',
          field: currentToggle.systemType,
          oldValue: currentToggle.isActive === 1 ? 'active' : 'inactive',
          newValue: input.isActive === 1 ? 'active' : 'inactive',
          performedBy: ctx.user.email || "unknown",
          createdAt: new Date(),
        });
      }

      return { success: true };
    }),

  /**
   * Delete a vendor option permanently
   */
  deleteVendorOption: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get current value for audit log
      const [currentDel] = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.id, input.id)).limit(1);

      await db.delete(systemVendorOptions)
        .where(eq(systemVendorOptions.id, input.id));

      // Audit log
      if (currentDel) {
        const [delRes] = await db.insert(vendorAuditLog).values({
          action: 'delete',
          systemType: currentDel.systemType,
          vendorName: currentDel.vendorName,
          previousValue: currentDel.vendorName,
          performedBy: ctx.user.email || "unknown",
        });
        dispatch.vendorAudit({
          mysqlId: (delRes as any).insertId || 0,
          vendorId: input.id,
          action: 'delete',
          field: currentDel.systemType,
          oldValue: currentDel.vendorName,
          newValue: null,
          performedBy: ctx.user.email || "unknown",
          createdAt: new Date(),
        });
      }

      return { success: true };
    }),

  /**
   * Add a new system type with its vendor options (bulk)
   */
  addSystemType: adminDbProcedure
    .input(z.object({
      systemType: z.string().min(1),
      vendors: z.array(z.string().min(1)),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const systemType = input.systemType.trim();
      if (!systemType) throw new Error("System type name is required.");

      // Trim, collapse whitespace, dedupe case-insensitively, alphabetize, ensure "Other" is last.
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const raw of input.vendors) {
        const v = raw.trim().replace(/\s+/g, " ");
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(v);
      }
      cleaned.sort((a, b) => {
        if (a.toLowerCase() === "other") return 1;
        if (b.toLowerCase() === "other") return -1;
        return a.localeCompare(b);
      });
      if (cleaned.length === 0) throw new Error("Please enter at least one vendor.");

      // Skip vendors already present under this system type (case-insensitive).
      const existing = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.systemType, systemType));
      const existingKeys = new Set(existing.map(e => e.vendorName.toLowerCase()));
      const baseOrder = existing.reduce((m, e) => Math.max(m, e.displayOrder), 0);

      const toInsert = cleaned
        .filter(v => !existingKeys.has(v.toLowerCase()))
        .map((v, i) => ({
          systemType,
          vendorName: v,
          displayOrder: baseOrder + i + 1,
          createdBy: ctx.user.email || "unknown",
        }));

      if (toInsert.length > 0) {
        await db.insert(systemVendorOptions).values(toInsert);
      }

      const [sysTypeAuditRes] = await db.insert(vendorAuditLog).values({
        action: 'add_system_type',
        systemType,
        vendorName: null,
        newValue: JSON.stringify(toInsert.map(t => t.vendorName)),
        performedBy: ctx.user.email || "unknown",
      });
      dispatch.vendorAudit({
        mysqlId: (sysTypeAuditRes as any).insertId || 0,
        vendorId: 0,
        action: 'add_system_type',
        field: systemType,
        oldValue: null,
        newValue: JSON.stringify(toInsert.map(t => t.vendorName)),
        performedBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      const skipped = cleaned.length - toInsert.length;
      return { success: true, added: toInsert.length, skipped };
    }),

  /**
   * Seed default vendor options (only if table is empty)
   */
  seedDefaultVendorOptions: adminDbProcedure
    .mutation(async ({ ctx }) => {
      const { db } = ctx;

      // Check if already seeded
      const existing = await db.select().from(systemVendorOptions);
      if (existing.length > 0) {
        return { success: true, message: "Already seeded", count: existing.length };
      }

      const defaults: Record<string, string[]> = {
        'PACS': ['Agfa', 'Carestream', 'Cerner', 'Fujifilm Synapse', 'GE Centricity', 'Horos', 'Infinitt', 'McKesson', 'Merge', 'Sectra', 'Siemens syngo.plaza', 'Visage', 'Other'],
        'VNA': ['Agfa', 'Dell/EMC', 'Fujifilm', 'GE', 'Hyland', 'IBM', 'Merge', 'Mach7', 'Novarad', 'Philips', 'Other'],
        'Router': ['DCM4J proxy', 'Laurel Bridge', 'Mercure', 'Merge', 'Silverback', 'Other'],
        'EHR': ['AllScripts', 'Athena', 'Cerner', 'eClinicalWorks', 'Epic', 'Meditech', 'NextGen', 'Other'],
        'RIS': ['Abbadox', 'Agfa', 'Cerner', 'Epic', 'Fujifilm', 'Meditech', 'Sectra', 'Other'],
        'Integration Engine': ['Cloverleaf', 'MetInformatics', 'Mirth Connect', 'Rhapsody', 'Other'],
        'AI': ['Aidoc', 'Arterys', 'Bayer (Calantic)', 'CADstream', 'Enlitic', 'HeartFlow', 'iCAD', 'Koios', 'Lunit', 'Nuance', 'Qure.ai', 'RapidAI', 'Viz.AI', 'Zebra Medical', 'Other'],
        'Reporting': ['Fluency', 'mModal', 'Nuance PowerScribe', 'PowerScribe 360', 'RadReport', 'Speechnotes', 'Other'],
        'Modality': ['Canon', 'Fujifilm', 'GE', 'Hologic', 'Philips', 'Siemens', 'Other'],
      };

      const values: { systemType: string; vendorName: string; displayOrder: number; createdBy: string }[] = [];
      for (const [type, vendors] of Object.entries(defaults)) {
        vendors.forEach((v, i) => {
          values.push({
            systemType: type,
            vendorName: v,
            displayOrder: i + 1,
            createdBy: ctx.user.email || "system",
          });
        });
      }

      await db.insert(systemVendorOptions).values(values);

      // Audit log
      const [seedAuditRes] = await db.insert(vendorAuditLog).values({
        action: 'seed_defaults',
        systemType: 'ALL',
        vendorName: null,
        newValue: JSON.stringify(Object.keys(defaults)),
        performedBy: ctx.user.email || "system",
      });
      dispatch.vendorAudit({
        mysqlId: (seedAuditRes as any).insertId || 0,
        vendorId: 0,
        action: 'seed_defaults',
        field: 'ALL',
        oldValue: null,
        newValue: JSON.stringify(Object.keys(defaults)),
        performedBy: ctx.user.email || "system",
        createdAt: new Date(),
      });

      return { success: true, message: "Seeded defaults", count: values.length };
    }),

  /**
   * Get vendor audit log entries
   */
  getVendorAuditLog: adminDbProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const limit = input?.limit ?? 50;
      const logs = await db.select().from(vendorAuditLog)
        .orderBy(desc(vendorAuditLog.performedAt))
        .limit(limit);

      return logs;
    }),

  // ============================================================================
  // PARTNER TASK TEMPLATES CRUD
  // ============================================================================

  getTaskTemplates: adminDbProcedure
    .query(async ({ ctx }) => {
      const { db } = ctx;

      const whereClause = ctx.user.clientId
        ? and(eq(partnerTaskTemplates.clientId, ctx.user.clientId), eq(partnerTaskTemplates.isActive, 1))
        : eq(partnerTaskTemplates.isActive, 1);

      return db.select({
        id: partnerTaskTemplates.id,
        clientId: partnerTaskTemplates.clientId,
        title: partnerTaskTemplates.title,
        description: partnerTaskTemplates.description,
        type: partnerTaskTemplates.type,
        section: partnerTaskTemplates.section,
        sortOrder: partnerTaskTemplates.sortOrder,
        createdBy: partnerTaskTemplates.createdBy,
        updatedBy: partnerTaskTemplates.updatedBy,
        createdAt: partnerTaskTemplates.createdAt,
        updatedAt: partnerTaskTemplates.updatedAt,
        clientName: clients.name,
      })
        .from(partnerTaskTemplates)
        .leftJoin(clients, eq(partnerTaskTemplates.clientId, clients.id))
        .where(whereClause)
        .orderBy(partnerTaskTemplates.clientId, partnerTaskTemplates.sortOrder, partnerTaskTemplates.id);
    }),

  createTaskTemplate: adminDbProcedure
    .input(z.object({
      clientId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["upload", "schedule", "form", "review"]),
      section: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      if (ctx.user.clientId && ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot create tasks for a different partner" });
      }

      const [pttRes] = await db.insert(partnerTaskTemplates).values({
        clientId: input.clientId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        section: input.section ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdBy: ctx.user.email ?? undefined,
        updatedBy: ctx.user.email ?? undefined,
      });
      dispatch.partnerTaskTemplate({
        mysqlId: (pttRes as any).insertId || 0,
        clientId: input.clientId,
        partnerName: "",
        title: input.title,
        taskId: `ptt-${input.clientId}-${Date.now()}`,
        section: input.section ?? null,
        description: input.description ?? null,
        owner: ctx.user.email || "unknown",
        active: true,
        createdBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      return { success: true };
    }),

  updateTaskTemplate: adminDbProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      type: z.enum(["upload", "schedule", "form", "review"]).optional(),
      section: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const [existing] = await db.select().from(partnerTaskTemplates).where(eq(partnerTaskTemplates.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task template not found" });
      if (ctx.user.clientId && ctx.user.clientId !== existing.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot update tasks for a different partner" });
      }

      const updateData: Record<string, unknown> = { updatedBy: ctx.user.email ?? null };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.section !== undefined) updateData.section = input.section;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

      await db.update(partnerTaskTemplates).set(updateData).where(eq(partnerTaskTemplates.id, input.id));
      return { success: true };
    }),

  deleteTaskTemplate: adminDbProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const [existing] = await db.select().from(partnerTaskTemplates).where(eq(partnerTaskTemplates.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task template not found" });
      if (ctx.user.clientId && ctx.user.clientId !== existing.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete tasks for a different partner" });
      }

      await db.update(partnerTaskTemplates).set({ isActive: 0, updatedBy: ctx.user.email ?? null }).where(eq(partnerTaskTemplates.id, input.id));
      return { success: true };
    }),

  /**
   * List all org-added custom tasks across orgs belonging to this partner.
   * Platform admins see all; partner admins see only their own orgs.
   */
  getOrgCustomTasksForPartner: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Resolve which org IDs are in scope
    let orgFilter = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, clientId: organizations.clientId }).from(organizations);
    if (ctx.user.clientId) {
      orgFilter = orgFilter.filter((o) => o.clientId === ctx.user.clientId);
    }

    if (orgFilter.length === 0) return [];

    const orgIds = orgFilter.map((o) => o.id);
    const orgMap = Object.fromEntries(orgFilter.map((o) => [o.id, o]));

    const tasks = await db
      .select()
      .from(orgCustomTasks)
      .where(inArray(orgCustomTasks.organizationId, orgIds))
      .orderBy(orgCustomTasks.organizationId, orgCustomTasks.createdAt);

    return tasks.map((t) => ({
      ...t,
      orgName: orgMap[t.organizationId]?.name ?? "Unknown",
      orgSlug: orgMap[t.organizationId]?.slug ?? "",
    }));
  }),

  /**
   * Promote an org custom task into the partner's task template,
   * making it visible to all active orgs under this partner.
   */
  promoteCustomTaskToTemplate: adminDbProcedure
    .input(z.object({ orgCustomTaskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx;

      // Load the custom task
      const [customTask] = await db
        .select()
        .from(orgCustomTasks)
        .where(eq(orgCustomTasks.id, input.orgCustomTaskId))
        .limit(1);

      if (!customTask) throw new TRPCError({ code: "NOT_FOUND", message: "Custom task not found" });

      // Verify partner admin can only promote tasks from their orgs
      if (ctx.user.clientId) {
        const [org] = await db
          .select({ clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.id, customTask.organizationId))
          .limit(1);
        if (!org || org.clientId !== ctx.user.clientId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot promote tasks from other partners' orgs" });
        }
      }

      // Determine which clientId the template should belong to
      const [org] = await db
        .select({ clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.id, customTask.organizationId))
        .limit(1);

      if (!org?.clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Org is not associated with a partner" });
      }

      // Get the next sort order
      const existing = await db
        .select({ sortOrder: partnerTaskTemplates.sortOrder })
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.clientId, org.clientId));
      const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);

      const [result] = await db.insert(partnerTaskTemplates).values({
        clientId: org.clientId,
        title: customTask.title,
        description: customTask.description ?? null,
        type: customTask.type,
        section: customTask.section ?? null,
        sortOrder: maxSort + 10,
        isActive: 1,
        createdBy: ctx.user.email ?? null,
      });
      dispatch.partnerTaskTemplate({
        mysqlId: result.insertId || 0,
        clientId: org.clientId,
        partnerName: "",
        title: customTask.title,
        taskId: `ptt-promoted-${customTask.id}`,
        section: customTask.section ?? null,
        description: customTask.description ?? null,
        owner: ctx.user.email || "unknown",
        active: true,
        createdBy: ctx.user.email || "unknown",
        createdAt: new Date(),
      });

      return { success: true, templateId: result.insertId };
    }),
});
