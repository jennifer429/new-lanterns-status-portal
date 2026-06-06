import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { organizations, taskCompletion } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { syncTaskCompletionToNotion } from "../notionTaskValidation";
import { assertOrgAccess } from "../_core/orgAccess";

export const implementationRouter = router({
  /**
   * Get all stored task states for an organization.
   * Returns a map of taskId → {completed, completedAt, owner, notes}.
   */
  getTasks: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      assertOrgAccess(ctx.user, org);

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
  updateTask: protectedProcedure
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
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      assertOrgAccess(ctx.user, org);

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

      // Race-safe upsert keyed on the (organizationId, taskId) unique index
      // (uq_taskcompletion_org_task). notionLastEdited is reset to null so the
      // sync-back version check knows the portal wrote last.
      await db
        .insert(taskCompletion)
        .values({
          organizationId: org.id,
          taskId: input.taskId,
          ...payload,
          notionLastEdited: null,
        })
        .onDuplicateKeyUpdate({
          set: { ...payload, notionLastEdited: null },
        });

      // Fire-and-forget dual-write to Notion
      syncTaskCompletionToNotion({
        organizationId: org.id,
        orgSlug: input.organizationSlug,
        orgName: org.name,
        taskId: input.taskId,
        sectionName: payload.sectionName,
        completed: payload.completed,
        inProgress: payload.inProgress,
        blocked: payload.blocked,
        notApplicable: payload.notApplicable,
        completedAt: payload.completedAt,
        completedBy: payload.completedBy,
        targetDate: payload.targetDate,
        notes: payload.notes,
      }).catch((err) => console.error("[notion-task] dual-write error:", err));

      return { success: true };
    }),
});
