import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, sectionProgress, taskCompletion, activityFeed, users, intakeResponses, questions, responses } from "../../drizzle/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
// ClickUp and Linear integrations removed for simplification

/**
 * Organizations router - handles organization CRUD and data access
 */
export const organizationsRouter = router({
  /**
   * Create a new organization (for PM/Ops during sales handoff)
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/), // URL-safe slug
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        startDate: z.string().optional(),
        goalDate: z.string().optional(),
        linearIssueId: z.string().optional(),
        clickupListId: z.string().optional(),
        googleDriveFolderId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [org] = await db.insert(organizations).values(input);
      return { success: true, organizationId: org.insertId, slug: input.slug };
    }),

  /**
   * Get organization by slug (for portal access)
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);
      
      if (!org) {
        throw new Error("Organization not found");
      }

      return org;
    }),

  /**
   * Get organization progress data
   */
  getProgress: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const progress = await db
        .select()
        .from(sectionProgress)
        .where(eq(sectionProgress.organizationId, input.organizationId));

      const tasks = await db
        .select()
        .from(taskCompletion)
        .where(eq(taskCompletion.organizationId, input.organizationId));

      return { progress, tasks };
    }),

  /**
   * Update section progress
   */
  updateSectionProgress: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        sectionName: z.string(),
        status: z.enum(["pending", "in-progress", "complete"]),
        progress: z.number().min(0).max(100),
        expectedEnd: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if section progress exists
      const [existing] = await db
        .select()
        .from(sectionProgress)
        .where(
          and(
            eq(sectionProgress.organizationId, input.organizationId),
            eq(sectionProgress.sectionName, input.sectionName)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(sectionProgress)
          .set({
            status: input.status,
            progress: input.progress,
            expectedEnd: input.expectedEnd,
          })
          .where(eq(sectionProgress.id, existing.id));
      } else {
        // Insert new
        await db.insert(sectionProgress).values(input);
      }

      return { success: true };
    }),

  /**
   * Mark task as complete
   */
  completeTask: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        sectionName: z.string(),
        taskId: z.string(),
        completed: z.boolean(),
        completedBy: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if task completion exists
      const [existing] = await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            eq(taskCompletion.organizationId, input.organizationId),
            eq(taskCompletion.taskId, input.taskId)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(taskCompletion)
          .set({
            completed: input.completed ? 1 : 0,
            completedAt: input.completed ? new Date() : null,
            completedBy: input.completedBy,
            notes: input.notes,
          })
          .where(eq(taskCompletion.id, existing.id));
      } else {
        // Insert new
        await db.insert(taskCompletion).values({
          organizationId: input.organizationId,
          sectionName: input.sectionName,
          taskId: input.taskId,
          completed: input.completed ? 1 : 0,
          completedAt: input.completed ? new Date() : null,
          completedBy: input.completedBy,
          notes: input.notes,
        });
      }

      // Check if section is now complete and trigger ClickUp webhook
      if (input.completed) {
        // Get all tasks for this section
        const sectionTasks = await db
          .select()
          .from(taskCompletion)
          .where(
            and(
              eq(taskCompletion.organizationId, input.organizationId),
              eq(taskCompletion.sectionName, input.sectionName)
            )
          );

        const completedCount = sectionTasks.filter(t => t.completed === 1).length;
        const totalCount = sectionTasks.length;

        // If all tasks in section are complete, create ClickUp task
        if (completedCount === totalCount && totalCount > 0) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, input.organizationId))
            .limit(1);

          // ClickUp integration removed - section completion tracking simplified
        }
      }

      return { success: true };
    }),

  /**
   * List all organizations (for admin/ops view)
   * Filters by user's clientId for access control
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Filter by user's clientId for access control
    if (ctx.user?.clientId) {
      return await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      // Super admin or no clientId - show all
      return await db.select().from(organizations);
    }
  }),

  /**
   * Get activity feed for an organization
   */
  getActivityFeed: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const activities = await db
        .select()
        .from(activityFeed)
        .where(eq(activityFeed.organizationId, input.organizationId))
        .orderBy(desc(activityFeed.createdAt));
      return activities;
    }),

  /**
   * Get metrics for all organizations (for admin dashboard)
   * Filters by user's clientId for access control
   */
  getMetrics: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Filter organizations by user's clientId
    // If user has no clientId (super admin), show all organizations
    let orgs;
    if (ctx.user?.clientId) {
      orgs = await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      // Super admin or no clientId - show all
      orgs = await db.select().from(organizations);
    }
    
    const metrics = await Promise.all(
      orgs.map(async (org) => {
        // Note: User management is separate from organizations in this system
        const userCount = 0;
        const lastLoginAt = null;

        // Calculate intake completion percentage using new schema
        // Get total questions from database
        const [totalQuestionsResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(questions);
        const totalQuestions = totalQuestionsResult?.count || 0;

        // Count completed responses (non-empty)
        const [completedQuestionsResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(responses)
          .where(
            and(
              eq(responses.organizationId, org.id),
              sql`${responses.response} IS NOT NULL AND ${responses.response} != ''`
            )
          );
        const completedQuestions = completedQuestionsResult?.count || 0;

        const completionPercentage = totalQuestions > 0
          ? Math.round((completedQuestions / totalQuestions) * 100)
          : 0;

        // Get section-by-section progress using new schema
        const allQuestions = await db.select().from(questions);
        const allResponses = await db
          .select()
          .from(responses)
          .where(eq(responses.organizationId, org.id));

        // Build response map for quick lookup
        const responseMap = new Map();
        allResponses.forEach(r => responseMap.set(r.questionId, r));

        // Group by section
        const sectionStats: Record<string, { total: number; completed: number }> = {};
        
        allQuestions.forEach(q => {
          if (!sectionStats[q.sectionTitle]) {
            sectionStats[q.sectionTitle] = { total: 0, completed: 0 };
          }
          
          sectionStats[q.sectionTitle].total++;
          
          const resp = responseMap.get(q.id);
          if (resp && resp.response && resp.response !== '') {
            sectionStats[q.sectionTitle].completed++;
          }
        });

        // Get file uploads
        const filesWithUrls = allResponses.filter(r => r.fileUrl).map(r => ({
          questionId: r.questionId,
          fileName: r.fileUrl?.split('/').pop() || 'Unknown',
          url: r.fileUrl
        }));

        return {
          ...org,
          userCount,
          lastLoginAt,
          completionPercentage,
          sectionProgress: sectionStats,
          fileCount: filesWithUrls.length,
          files: filesWithUrls,
        };
      })
    );

    return metrics;
  }),

  /**
   * Post a reply from hospital to Linear issue
   */
  postReply: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        message: z.string().min(1),
        authorName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get organization with Linear issue ID
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!org) {
        throw new Error("Organization not found");
      }

      if (!org.linearIssueId) {
        throw new Error("No Linear issue configured for this organization");
      }

      // Linear integration removed - save directly to activity feed
      const author = input.authorName || org.contactName || "Hospital Team";
      
      await db.insert(activityFeed).values({
        organizationId: input.organizationId,
        source: "manual",
        author: author,
        message: input.message,
      });

      return { success: true };
    }),
});
