import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { questions, questionOptions, organizations, users, clients } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

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
  // ORGANIZATIONS CRUD
  // ============================================================================

  /**
   * Get all organizations
   */
  getAllOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }),

  /**
   * Create a new organization
   */
  createOrganization: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
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

      // Check if slug already exists
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Organization slug already exists" });
      }

      const [newOrg] = await db.insert(organizations).values(input);

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
});
