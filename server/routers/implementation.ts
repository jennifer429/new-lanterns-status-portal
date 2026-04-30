import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { organizations, taskCompletion } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { orgIdentifierMatches } from "../_core/orgLookup";

export const implementationRouter = router({
  /**
   * Get all stored task states for an organization.
   * Returns a map of taskId → {completed, completedAt, owner, notes}.
   */
  getTasks: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      const rows = await db
        .select()
        .from(taskCompletion)
        .where(eq(taskCompletion.organizationId, org.id));

      const taskMap: Record<string, { completed: boolean; notApplicable: boolean; inProgress: boolean; blocked: boolean; completedAt: Date | null; owner: string | null; targetDate: string | null; notes: string | null }> = {};
      for (const row of rows) {
        taskMap[row.taskId] = {
          completed: row.completed === 1,
          notApplicable: row.notApplicable === 1,
          inProgress: row.inProgress === 1,
          blocked: row.blocked === 1,
          completedAt: row.completedAt ?? null,
          owner: row.completedBy ?? null,
          targetDate: row.targetDate ?? null,
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
        notApplicable: z.boolean().optional(),
        inProgress: z.boolean().optional(),
        blocked: z.boolean().optional(),
        owner: z.string().optional(),
        targetDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
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
        notApplicable: input.notApplicable ? 1 : 0,
        inProgress: input.inProgress ? 1 : 0,
        blocked: input.blocked ? 1 : 0,
        completedAt: (input.completed || input.notApplicable) ? new Date() : null,
        completedBy: input.owner ?? null,
        targetDate: input.targetDate ?? null,
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
