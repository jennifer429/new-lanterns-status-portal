import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { questions, questionOptions, organizations, users, clients, intakeFileAttachments } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
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
   * Get all clients (partners) - New Lantern staff only
   */
  getAllClients: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" || !ctx.user.email?.endsWith("@newlantern.ai")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only New Lantern staff can view all clients" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    return await db.select().from(clients).orderBy(clients.name);
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

      // Auto-assign clientId based on user's email domain if not provided
      let clientId = input.clientId;
      if (!clientId) {
        // Determine clientId from user's email domain
        if (ctx.user.email?.endsWith("@srv.com")) {
          clientId = 2; // SRV
        } else if (ctx.user.email?.endsWith("@radone.com")) {
          clientId = 1; // RadOne
        } else if (ctx.user.email?.endsWith("@newlantern.ai")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "New Lantern staff must specify clientId" });
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot determine partner for this user" });
        }
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
        // Get users for this organization
        const orgUsers = await db.select().from(users).where(eq(users.organizationId, org.id));
        const userCount = orgUsers.length;

        // Get partner name if applicable
        let partnerName = null;
        if (org.clientId) {
          const [partner] = await db.select().from(clients).where(eq(clients.id, org.clientId));
          partnerName = partner?.name || null;
        }

        // Get completion percentage (from intake responses)
        // Count total questions vs answered questions
        const allQuestions = await db.select().from(questions);
        const totalQuestions = allQuestions.length;

        // Get intake responses for this org (using correct responses table, not deprecated intakeResponses)
        const { responses: responsesTable } = await import("../../drizzle/schema");
        const orgResponses = await db
          .select()
          .from(responsesTable)
          .where(eq(responsesTable.organizationId, org.id));

        const answeredQuestions = orgResponses.filter(r => r.response && r.response !== "").length;
        const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

        // Get files
        const files = await db
          .select()
          .from(intakeFileAttachments)
          .where(eq(intakeFileAttachments.organizationId, org.id))
          .orderBy(desc(intakeFileAttachments.createdAt));

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          partnerName,
          userCount,
          completionPercent,
          users: orgUsers.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            organizationId: u.organizationId,
            lastLoginAt: u.lastLoginAt,
          })),
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
    const allUsers = await db
      .select()
      .from(users)
      .where(ctx.user.clientId ? eq(users.clientId, ctx.user.clientId) : undefined);

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
        organizationId: z.number(),
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

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          organizationId: input.organizationId,
          role: input.role,
          clientId: input.clientId,
          passwordHash,
          loginMethod: "email",
          openId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });

      // TODO: Send email with temporary password or reset link
      console.log(`[createUser] Created user ${input.email} with temp password: ${tempPassword}`);

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
   * Update a user
   */
  updateUser: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        email: z.string().optional(),
        name: z.string().optional(),
        organizationId: z.number().optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the user to check permissions
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.id));
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Partner admins can only update users from their own partner
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot update other partner's users" });
      }

      const { id, ...updates } = input;

      // Update user
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id));

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

      // Mark as inactive by setting a flag (we'll add an 'active' field to schema)
      // For now, we can set organizationId to null as a soft delete
      await db
        .update(users)
        .set({ organizationId: null })
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

      // Restore user by setting organizationId
      await db
        .update(users)
        .set({ organizationId: input.organizationId })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
