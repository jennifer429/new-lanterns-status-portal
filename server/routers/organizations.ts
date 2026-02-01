import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, sectionProgress, taskCompletion } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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

      return { success: true };
    }),

  /**
   * List all organizations (for admin/ops view)
   */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const orgs = await db.select().from(organizations);
    return orgs;
  }),
});
