import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { questions, questionOptions, organizations, users, clients, intakeFileAttachments, partnerTemplates, specifications } from "../../drizzle/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export const adminRouter = router({
  // ============================================================================
  // QUESTIONS CRUD
  // ============================================================================

  getAllQuestions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const allQuestions = await db.select().from(questions).orderBy(questions.sectionId, questions.questionNumber);
    const allOptions = await db.select().from(questionOptions).orderBy(questionOptions.displayOrder);

    const optionsByQuestion = allOptions.reduce((acc, option) => {
      if (!acc[option.questionId]) acc[option.questionId] = [];
      acc[option.questionId].push(option);
      return acc;
    }, {} as Record<number, typeof allOptions>);

    return allQuestions.map(q => ({ ...q, options: optionsByQuestion[q.id] || [] }));
  }),

  createQuestion: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const existing = await db.select().from(questions).where(eq(questions.questionId, input.questionId)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Question ID already exists" });

      const [newQuestion] = await db.insert(questions).values(input);
      return { success: true, questionId: newQuestion.insertId };
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { id, ...updates } = input;
      await db.update(questions).set(updates).where(eq(questions.id, id));
      return { success: true };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(questionOptions).where(eq(questionOptions.questionId, input.id));
      await db.delete(questions).where(eq(questions.id, input.id));
      return { success: true };
    }),

  // ============================================================================
  // QUESTION OPTIONS CRUD
  // ============================================================================

  getQuestionOptions: protectedProcedure
    .input(z.object({ questionId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return await db.select().from(questionOptions).where(eq(questionOptions.questionId, input.questionId)).orderBy(questionOptions.displayOrder);
    }),

  createQuestionOption: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      optionValue: z.string(),
      optionLabel: z.string(),
      displayOrder: z.number().default(0),
      isActive: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [newOption] = await db.insert(questionOptions).values(input);
      return { success: true, optionId: newOption.insertId };
    }),

  updateQuestionOption: protectedProcedure
    .input(z.object({
      id: z.number(),
      optionValue: z.string().optional(),
      optionLabel: z.string().optional(),
      displayOrder: z.number().optional(),
      isActive: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { id, ...updates } = input;
      await db.update(questionOptions).set(updates).where(eq(questionOptions.id, id));
      return { success: true };
    }),

  deleteQuestionOption: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(questionOptions).where(eq(questionOptions.id, input.id));
      return { success: true };
    }),

  reorderQuestionOptions: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      optionIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      for (let i = 0; i < input.optionIds.length; i++) {
        await db.update(questionOptions).set({ displayOrder: i + 1 }).where(eq(questionOptions.id, input.optionIds[i]));
      }
      return { success: true };
    }),

  // ============================================================================
  // CLIENTS CRUD
  // ============================================================================

  getAllClients: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    if (ctx.user.clientId) {
      return await db.select().from(clients).where(eq(clients.id, ctx.user.clientId));
    }
    return await db.select().from(clients).orderBy(clients.name);
  }),

  createClient: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Name is required"),
      slug: z.string().min(1, "Slug is required"),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const existing = await db.select().from(clients).where(eq(clients.slug, input.slug)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "A partner with this slug already exists" });
      await db.insert(clients).values({ name: input.name, slug: input.slug, description: input.description || null, status: "active" });
      return { success: true };
    }),

  updateClient: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1, "Name is required"),
      slug: z.string().min(1, "Slug is required"),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      const slugConflict = await db.select().from(clients).where(and(eq(clients.slug, input.slug), sql`${clients.id} != ${input.id}`)).limit(1);
      if (slugConflict.length > 0) throw new TRPCError({ code: "CONFLICT", message: "A partner with this slug already exists" });
      await db.update(clients).set({ name: input.name, slug: input.slug, description: input.description || null }).where(eq(clients.id, input.id));
      return { success: true };
    }),

  deactivateClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      await db.update(clients).set({ status: "inactive" }).where(eq(clients.id, input.id));
      return { success: true };
    }),

  reactivateClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      await db.update(clients).set({ status: "active" }).where(eq(clients.id, input.id));
      return { success: true };
    }),

  // ============================================================================
  // ORGANIZATIONS CRUD
  // ============================================================================

  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  getAllOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    console.log('[getAllOrganizations] User:', ctx.user.email, 'clientId:', ctx.user.clientId, 'role:', ctx.user.role);
    if (ctx.user.clientId) {
      return await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId)).orderBy(desc(organizations.createdAt));
    }
    return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }),

  createOrganization: protectedProcedure
    .input(z.object({
      clientId: z.number().optional(),
      name: z.string(),
      slug: z.string(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      status: z.enum(["active", "completed", "paused"]).default("active"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let clientId = input.clientId;
      if (ctx.user.clientId !== null && ctx.user.clientId !== undefined) {
        clientId = ctx.user.clientId;
      } else if (!clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Platform admins must specify clientId when creating organizations" });
      }

      const existing = await db.select().from(organizations).where(eq(organizations.slug, input.slug)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Organization slug already exists" });

      const [newOrg] = await db.insert(organizations).values({ ...input, clientId });
      return { success: true, organizationId: newOrg.insertId };
    }),

  updateOrganization: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      status: z.enum(["active", "completed", "paused"]).optional(),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { id, ...updates } = input;
      await db.update(organizations).set(updates).where(eq(organizations.id, id));
      return { success: true };
    }),

  deleteOrganization: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(organizations).where(eq(organizations.id, input.id));
      return { success: true };
    }),

  deactivateOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate other partner's organizations" });
      await db.update(organizations).set({ status: "inactive" }).where(eq(organizations.id, input.organizationId));
      return { success: true };
    }),

  reactivateOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reactivate other partner's organizations" });
      await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, input.organizationId));
      return { success: true };
    }),

  markOrganizationComplete: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot mark other partner's organizations as complete" });
      await db.update(organizations).set({ status: "completed" }).where(eq(organizations.id, input.organizationId));
      return { success: true };
    }),

  reopenOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reopen other partner's organizations" });
      await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, input.organizationId));
      return { success: true };
    }),

  // ============================================================================
  // FILES MANAGEMENT
  // ============================================================================

  getAllFiles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

    if (ctx.user.clientId) {
      const userOrgs = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
      const orgIds = userOrgs.map(o => o.id);
      return files.filter(f => f.organizationId && orgIds.includes(f.organizationId));
    }

    return files;
  }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [file] = await db
        .select({ id: intakeFileAttachments.id, organizationId: intakeFileAttachments.organizationId })
        .from(intakeFileAttachments)
        .where(eq(intakeFileAttachments.id, input.id))
        .limit(1);

      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });

      if (ctx.user.clientId && file.organizationId) {
        const [org] = await db.select({ clientId: organizations.clientId }).from(organizations).where(eq(organizations.id, file.organizationId)).limit(1);
        if (org && org.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Delete from database (Drive file kept for audit trail)
      await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.id, input.id));
      return { success: true };
    }),

  getAdminSummary: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    let orgs;
    if (ctx.user.clientId) {
      orgs = await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      orgs = await db.select().from(organizations);
    }

    const metrics = await Promise.all(
      orgs.map(async (org) => {
        const orgUsers = await db.select().from(users).where(eq(users.organizationId, org.id));
        const userCount = orgUsers.length;

        const { calculateProgress } = await import("../../shared/progressCalculation");
        const { questionnaireSections } = await import("../../shared/questionnaireData");
        const { intakeResponses } = await import("../../drizzle/schema");

        const orgResponses = await db
          .select({
            id: intakeResponses.id,
            organizationId: intakeResponses.organizationId,
            questionId: intakeResponses.questionId,
            response: intakeResponses.response,
            fileUrl: intakeResponses.fileUrl,
            createdAt: intakeResponses.createdAt,
            updatedAt: intakeResponses.updatedAt,
          })
          .from(intakeResponses)
          .where(eq(intakeResponses.organizationId, org.id));

        const orgFiles = await db.select().from(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, org.id));

        const allQuestions = questionnaireSections.flatMap(section => {
          if (section.questions) {
            return section.questions.map(q => ({ id: q.id, sectionTitle: section.title, isWorkflow: false, type: q.type }));
          } else if (section.type === 'workflow') {
            return [{ id: `${section.id}_config`, sectionTitle: section.title, isWorkflow: true }];
          }
          return [];
        });

        const progress = calculateProgress(allQuestions, orgResponses, orgFiles);
        const completionPercent = progress.completionPercentage;

        const sectionProgress: Record<string, { completed: number; total: number }> = {};
        Object.entries(progress.sectionProgress).forEach(([title, stats]) => {
          sectionProgress[title] = stats;
        });

        const sectionsComplete = Object.values(sectionProgress).filter(stats => stats.completed === stats.total && stats.total > 0).length;

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
          files: files.map(f => ({ id: f.id, fileName: f.fileName, fileUrl: f.fileUrl, uploadedAt: f.createdAt })),
        };
      })
    );

    return metrics;
  }),

  // ============================================================================
  // USERS CRUD
  // ============================================================================

  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    if (ctx.user.clientId) {
      const partnerOrgs = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
      const orgIds = partnerOrgs.map(org => org.id);
      return await db.select().from(users).where(
        or(
          orgIds.length > 0 ? inArray(users.organizationId, orgIds) : sql`1=0`,
          and(eq(users.clientId, ctx.user.clientId), eq(users.role, 'admin'))
        )
      );
    }
    return await db.select().from(users);
  }),

  createUser: protectedProcedure
    .input(z.object({
      email: z.string().min(1, "Email is required").refine(
        (email) => {
          if (email.endsWith('@newlantern.ai')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          return email.includes('@');
        },
        { message: "Invalid email format" }
      ),
      name: z.string(),
      organizationId: z.number().optional(),
      role: z.enum(["user", "admin"]),
      clientId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot create users for other partners" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const existingUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existingUser.length > 0) throw new TRPCError({ code: "CONFLICT", message: "User with this email already exists" });

      if (input.role === "user" && !input.organizationId) throw new TRPCError({ code: "BAD_REQUEST", message: "Organization is required for non-admin users" });

      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await db.insert(users).values({
        email: input.email,
        name: input.name,
        organizationId: input.organizationId || null,
        role: input.role,
        clientId: input.clientId,
        passwordHash,
        loginMethod: "email",
        openId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      console.log(`[createUser] Created user ${input.email}`);
      return { success: true, tempPassword };
    }),

  deactivateUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate other partner's users" });
      if (targetUser.id === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate yourself" });
      await db.update(users).set({ isActive: 0 }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  reactivateUser: protectedProcedure
    .input(z.object({ userId: z.number(), organizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (ctx.user.clientId && targetUser.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reactivate other partner's users" });
      await db.update(users).set({ isActive: 1, organizationId: input.organizationId }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ============================================================================
  // PARTNER TEMPLATES CRUD
  // ============================================================================

  getTemplates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    if (ctx.user.clientId) {
      return await db.select().from(partnerTemplates).where(and(eq(partnerTemplates.clientId, ctx.user.clientId), eq(partnerTemplates.isActive, 1))).orderBy(desc(partnerTemplates.updatedAt));
    }
    return await db.select().from(partnerTemplates).where(eq(partnerTemplates.isActive, 1)).orderBy(desc(partnerTemplates.updatedAt));
  }),

  getInactiveTemplates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    if (ctx.user.clientId) {
      return await db.select().from(partnerTemplates).where(and(eq(partnerTemplates.clientId, ctx.user.clientId), eq(partnerTemplates.isActive, 0))).orderBy(desc(partnerTemplates.deactivatedAt));
    }
    return await db.select().from(partnerTemplates).where(eq(partnerTemplates.isActive, 0)).orderBy(desc(partnerTemplates.deactivatedAt));
  }),

  getTemplatesByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return await db.select().from(partnerTemplates).where(and(eq(partnerTemplates.clientId, input.clientId), eq(partnerTemplates.isActive, 1))).orderBy(partnerTemplates.questionId);
    }),

  uploadTemplate: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      questionId: z.string(),
      label: z.string(),
      fileName: z.string(),
      fileData: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      if (ctx.user.clientId && input.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot upload templates for other partners" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, input.clientId), eq(partnerTemplates.questionId, input.questionId), eq(partnerTemplates.isActive, 1)))
        .limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A template already exists for this question. Use 'Replace' to update it." });

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const { storagePut } = await import("../storage");
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const uploaderName = ctx.user.email?.split("@")[0] || "unknown";
      const ext = input.fileName.includes(".") ? `.${input.fileName.split(".").pop()}` : "";
      const baseName = input.fileName.includes(".") ? input.fileName.slice(0, input.fileName.lastIndexOf(".")) : input.fileName;
      const formattedName = `${baseName}_${timestamp}_${uploaderName}${ext}`;

      const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
      const partnerName = client?.name || `client-${input.clientId}`;
      const s3Key = `${partnerName}/templates/${formattedName}`;
      const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

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

  replaceTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string(),
      fileName: z.string(),
      fileData: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db.select().from(partnerTemplates).where(and(eq(partnerTemplates.id, input.id), eq(partnerTemplates.isActive, 1))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      if (ctx.user.clientId && existing.clientId !== ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot replace other partner's templates" });

      await db.update(partnerTemplates).set({
        isActive: 0,
        deactivatedBy: ctx.user.email || "unknown",
        deactivatedAt: new Date(),
      }).where(eq(partnerTemplates.id, input.id));

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const { storagePut } = await import("../storage");
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const uploaderName = ctx.user.email?.split("@")[0] || "unknown";
      const ext = input.fileName.includes(".") ? `.${input.fileName.split(".").pop()}` : "";
      const baseName = input.fileName.includes(".") ? input.fileName.slice(0, input.fileName.lastIndexOf(".")) : input.fileName;
      const formattedName = `${baseName}_${timestamp}_${uploaderName}${ext}`;

      const [client] = await db.select().from(clients).where(eq(clients.id, existing.clientId)).limit(1);
      const partnerName = client?.name || `client-${existing.clientId}`;
      const s3Key = `${partnerName}/templates/${formattedName}`;
      const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

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

  getSpecifications: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    return await db.select().from(specifications).where(eq(specifications.isActive, 1)).orderBy(desc(specifications.createdAt));
  }),

  uploadSpecification: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      fileName: z.string(),
      fileData: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const { storagePut } = await import("../storage");
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const uploaderName = ctx.user.email?.split("@")[0] || "unknown";
      const ext = input.fileName.includes(".") ? `.${input.fileName.split(".").pop()}` : "";
      const baseName = input.fileName.includes(".") ? input.fileName.slice(0, input.fileName.lastIndexOf(".")) : input.fileName;
      const formattedName = `${baseName}_${timestamp}_${uploaderName}${ext}`;

      const s3Key = `New Lantern/${formattedName}`;
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

  updateSpecification: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(specifications).set({ title: input.title, description: input.description || null, category: input.category || null }).where(eq(specifications.id, input.id));
      return { success: true };
    }),

  deactivateSpecification: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" || ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(specifications).set({ isActive: 0 }).where(eq(specifications.id, input.id));
      return { success: true };
    }),
});
