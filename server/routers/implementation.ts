import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, taskCompletion } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const implementationRouter = router({
  /**
   * Get all stored task states for an organization.
   * Returns a map of taskId → {completed, completedAt, owner, notes}.
   */
  getTasks: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      const rows = await db
        .select()
        .from(taskCompletion)
        .where(eq(taskCompletion.organizationId, org.id));

      const taskMap: Record<string, { completed: boolean; completedAt: Date | null; owner: string | null; notes: string | null }> = {};
      for (const row of rows) {
        taskMap[row.taskId] = {
          completed: row.completed === 1,
          completedAt: row.completedAt ?? null,
          owner: row.completedBy ?? null,   // reuse completedBy column for free-form owner
          notes: row.notes ?? null,
        };
      }
      return taskMap;
    }),

  /**
   * Upsert a single task's state.
   */
  updateTask: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        taskId: z.string(),
        sectionName: z.string(),
        completed: z.boolean(),
        owner: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      const [existing] = await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            eq(taskCompletion.organizationId, org.id),
            eq(taskCompletion.taskId, input.taskId)
          )
        )
        .limit(1);

      const payload = {
        completed: input.completed ? 1 : 0,
        completedAt: input.completed ? new Date() : null,
        completedBy: input.owner ?? null,
        notes: input.notes ?? null,
        sectionName: input.sectionName,
      };

      if (existing) {
        await db
          .update(taskCompletion)
          .set(payload)
          .where(eq(taskCompletion.id, existing.id));
      } else {
        await db.insert(taskCompletion).values({
          organizationId: org.id,
          taskId: input.taskId,
          ...payload,
        });
      }

      return { success: true };
    }),
});
