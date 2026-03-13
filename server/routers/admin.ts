import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { questions, questionOptions, organizations, users, clients, intakeFileAttachments, partnerTemplates, specifications, intakeResponses, systemVendorOptions } from "../../drizzle/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

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
  getAllQuestions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  createQuestion: protectedProcedure
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
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      return { success: true, questionId: newQuestion.insertId };
    }),

  /**
   * Update a question
   */
  updateQuestion: protectedProcedure
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
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { id, ...updates } = input;

      await db.update(questions).set(updates).where(eq(questions.id, id));

      return { success: true };
    }),

  /**
   * Delete a question
   */
  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getQuestionOptions: protectedProcedure
    .input(z.object({ questionId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      return await db
        .select()
        .from(questionOptions)
        .where(eq(questionOptions.questionId, input.questionId))
        .orderBy(questionOptions.displayOrder);
    }),

  /**
   * Create a new question option
   */
  createQuestionOption: protectedProcedure
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
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [newOption] = await db.insert(questionOptions).values(input);

      return { success: true, optionId: newOption.insertId };
    }),

  /**
   * Update a question option
   */
  updateQuestionOption: protectedProcedure
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
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { id, ...updates } = input;

      await db.update(questionOptions).set(updates).where(eq(questionOptions.id, id));

      return { success: true };
    }),

  /**
   * Delete a question option
   */
  deleteQuestionOption: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(questionOptions).where(eq(questionOptions.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder question options
   */
  reorderQuestionOptions: protectedProcedure
    .input(
      z.object({
        questionId: z.number(),
        optionIds: z.array(z.number()), // Array of option IDs in new order
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getAllClients: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  createClient: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z.string().min(1, "Slug is required"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check if slug already exists
      const existing = await db.select().from(clients).where(eq(clients.slug, input.slug)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "A partner with this slug already exists" });
      }

      await db.insert(clients).values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        status: "active",
      });

      return { success: true };
    }),

  /**
   * Update an existing client (partner)
   * Platform admins only
   */
  updateClient: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "Name is required"),
        slug: z.string().min(1, "Slug is required"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  deactivateClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  reactivateClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

  getAllOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Debug logging
    console.log('[getAllOrganizations] User:', ctx.user.email, 'clientId:', ctx.user.clientId, 'role:', ctx.user.role);

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
  getAllOrgResponses: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  saveOrgResponse: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      questionId: z.string(),
      response: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  bulkSaveOrgResponses: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        organizationId: z.number(),
        questionId: z.string(),
        response: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  createOrganization: protectedProcedure
    .input(
      z.object({
        clientId: z.number().optional(), // Optional - will be auto-assigned for partner admins
        name: z.string(),
        slug: z.string(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        status: z.enum(["active", "completed", "paused"]).default("active"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      return { success: true, organizationId: newOrg.insertId };
    }),

  /**
   * Update an organization
   */
  updateOrganization: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        slug: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        status: z.enum(["active", "completed", "paused"]).optional(),
        clientId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { id, ...updates } = input;

      await db.update(organizations).set(updates).where(eq(organizations.id, id));

      return { success: true };
    }),

  /**
   * Delete an organization (cascades to users and responses)
   */
  deleteOrganization: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getAllFiles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  deleteFile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getAdminSummary: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
        const allQuestions = questionnaireSections.flatMap(section => {
          if (section.type === 'connectivity-table' && section.questions) {
            // Connectivity table: include standard questions + a virtual CONN.endpoints question
            const stdQuestions = section.questions
              .filter(q => !q.inactive)
              .map(q => ({
                id: q.id,
                sectionTitle: section.title,
                isWorkflow: false,
                type: q.type,
                conditionalOn: q.conditionalOn || null,
              }));
            // Add virtual question for the endpoints table
            stdQuestions.push({
              id: 'CONN.endpoints',
              sectionTitle: section.title,
              isWorkflow: false,
              type: 'textarea', // treated as text response (JSON)
              conditionalOn: null,
            });
            return stdQuestions;
          } else if (section.type === 'integration-workflows' && section.questions) {
            // Integration workflows: include IW.* questions
            return section.questions
              .filter(q => !q.inactive)
              .map(q => ({
                id: q.id,
                sectionTitle: section.title,
                isWorkflow: false,
                type: q.type,
                conditionalOn: q.conditionalOn || null,
              }));
          } else if (section.questions) {
            // Regular question sections — filter inactive questions and pass conditionalOn
            return section.questions
              .filter(q => !q.inactive)
              .map(q => ({
                id: q.id,
                sectionTitle: section.title,
                isWorkflow: false,
                type: q.type,
                conditionalOn: q.conditionalOn || null,
              }));
          } else if (section.type === 'workflow') {
            return [{
              id: `${section.id}_config`,
              sectionTitle: section.title,
              isWorkflow: true,
            }];
          }
          return [];
        });

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

        return {
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          status: org.status,
          userCount,
          completionPercent,
          sectionsComplete,
          sectionProgress,
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
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  createUser: protectedProcedure
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
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      // Partner admins can only create users for their own partner
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot create users for other partners" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // TODO: Send email with temporary password or reset link
      console.log(`[createUser] Created user ${input.email} (temp password generated, not logged for security)`);

      return { success: true, tempPassword };
    }),

  /**
   * Deactivate an organization (soft delete)
   */
  deactivateOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  reactivateOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  markOrganizationComplete: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only mark their own partner's organizations as complete
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot mark other partner's organizations as complete" });
      }

      // Update status to completed
      await db
        .update(organizations)
        .set({ status: "completed" })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Reopen a completed organization (set back to active)
   */
  reopenOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the organization to check permissions
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Partner admins can only reopen their own partner's organizations
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reopen other partner's organizations" });
      }

      // Update status to active
      await db
        .update(organizations)
        .set({ status: "active" })
        .where(eq(organizations.id, input.organizationId));

      return { success: true };
    }),

  /**
   * Deactivate a user
   */
  deactivateUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  reactivateUser: protectedProcedure
    .input(z.object({ userId: z.number(), organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getTemplates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getInactiveTemplates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getTemplatesByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      return await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, input.clientId), eq(partnerTemplates.isActive, 1)))
        .orderBy(partnerTemplates.questionId);
    }),

  /**
   * Upload a new partner template
   */
  uploadTemplate: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        questionId: z.string(),
        label: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      // Partner admins can only upload templates for their own partner
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot upload templates for other partners" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Upload to S3
      const { storagePut } = await import("../storage");
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop();
      const s3Key = `partner-templates/${input.clientId}/${input.questionId}_${timestamp}.${fileExt}`;
      const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

      // Insert into database
      await db.insert(partnerTemplates).values({
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

      return { success: true, fileUrl };
    }),

  /**
   * Replace a partner template — soft-deletes the old one and creates a new active one
   */
  replaceTemplate: protectedProcedure
    .input(
      z.object({
        id: z.number(), // ID of the template being replaced
        label: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Upload new file to S3
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const { storagePut } = await import("../storage");
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop();
      const s3Key = `partner-templates/${existing.clientId}/${existing.questionId}_${timestamp}.${fileExt}`;
      const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

      // Insert new active template
      await db.insert(partnerTemplates).values({
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

      return { success: true, fileUrl };
    }),

  // ============================================================================
  // SPECIFICATIONS CRUD
  // ============================================================================

  /**
   * Get all active specifications (available to all authenticated users)
   */
  getSpecifications: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    return await db.select().from(specifications)
      .where(eq(specifications.isActive, 1))
      .orderBy(desc(specifications.createdAt));
  }),

  /**
   * Upload a new specification document (platform admin only)
   */
  uploadSpecification: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const fileBuffer = Buffer.from(input.fileData, "base64");

      // Upload to S3
      const { storagePut } = await import("../storage");
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop();
      const s3Key = `specifications/${timestamp}_${input.fileName}`;
      const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

      await db.insert(specifications).values({
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

      return { success: true, fileUrl };
    }),

  /**
   * Update specification metadata (platform admin only)
   */
  updateSpecification: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  deactivateSpecification: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
  getSystemVendorOptions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const allOptions = await db.select().from(systemVendorOptions)
      .orderBy(systemVendorOptions.systemType, systemVendorOptions.displayOrder);

    return allOptions;
  }),

  /**
   * Get active vendor options for the intake form (public for authenticated users)
   */
  getActiveVendorOptions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const activeOptions = await db.select().from(systemVendorOptions)
      .where(eq(systemVendorOptions.isActive, 1))
      .orderBy(systemVendorOptions.systemType, systemVendorOptions.displayOrder);

    // Group by systemType
    const grouped: Record<string, string[]> = {};
    for (const opt of activeOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt.vendorName);
    }
    return grouped;
  }),

  /**
   * Add a vendor option to a system type
   */
  addVendorOption: protectedProcedure
    .input(z.object({
      systemType: z.string().min(1),
      vendorName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get max displayOrder for this system type
      const existing = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.systemType, input.systemType))
        .orderBy(desc(systemVendorOptions.displayOrder));
      const maxOrder = existing.length > 0 ? existing[0].displayOrder : 0;

      await db.insert(systemVendorOptions).values({
        systemType: input.systemType,
        vendorName: input.vendorName,
        displayOrder: maxOrder + 1,
        createdBy: ctx.user.email || "unknown",
      });

      return { success: true };
    }),

  /**
   * Update a vendor option (rename)
   */
  updateVendorOption: protectedProcedure
    .input(z.object({
      id: z.number(),
      vendorName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.update(systemVendorOptions)
        .set({ vendorName: input.vendorName })
        .where(eq(systemVendorOptions.id, input.id));

      return { success: true };
    }),

  /**
   * Toggle active/inactive for a vendor option
   */
  toggleVendorOption: protectedProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.number().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.update(systemVendorOptions)
        .set({ isActive: input.isActive })
        .where(eq(systemVendorOptions.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a vendor option permanently
   */
  deleteVendorOption: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(systemVendorOptions)
        .where(eq(systemVendorOptions.id, input.id));

      return { success: true };
    }),

  /**
   * Add a new system type with its vendor options (bulk)
   */
  addSystemType: protectedProcedure
    .input(z.object({
      systemType: z.string().min(1),
      vendors: z.array(z.string().min(1)),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const values = input.vendors.map((v, i) => ({
        systemType: input.systemType,
        vendorName: v,
        displayOrder: i + 1,
        createdBy: ctx.user.email || "unknown",
      }));

      if (values.length > 0) {
        await db.insert(systemVendorOptions).values(values);
      }

      return { success: true };
    }),

  /**
   * Seed default vendor options (only if table is empty)
   */
  seedDefaultVendorOptions: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      return { success: true, message: "Seeded defaults", count: values.length };
    }),
});
