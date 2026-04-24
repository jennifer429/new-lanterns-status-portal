import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { organizations, workflowPathways } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const WORKFLOW_TYPES = ["orders", "images", "priors", "reports"] as const;
const workflowTypeSchema = z.enum(WORKFLOW_TYPES);

async function resolveOrgId(
  db: Awaited<ReturnType<typeof requireDb>>,
  slug: string,
) {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  return org.id;
}

export const workflowPathwaysRouter = router({
  /** All pathways for an org, optionally filtered to a single workflow type. */
  list: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        workflowType: workflowTypeSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);
      const where = input.workflowType
        ? and(
            eq(workflowPathways.organizationId, orgId),
            eq(workflowPathways.workflowType, input.workflowType),
          )
        : eq(workflowPathways.organizationId, orgId);
      return db.select().from(workflowPathways).where(where);
    }),

  /** Upsert a single pathway row (by org+workflowType+pathId). */
  upsert: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        workflowType: workflowTypeSchema,
        pathId: z.string().min(1).max(100),
        enabled: z.boolean().optional(),
        sourceSystem: z.string().max(255).nullable().optional(),
        middlewareSystem: z.string().max(255).nullable().optional(),
        destinationSystem: z.string().max(255).nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      const [existing] = await db
        .select()
        .from(workflowPathways)
        .where(
          and(
            eq(workflowPathways.organizationId, orgId),
            eq(workflowPathways.workflowType, input.workflowType),
            eq(workflowPathways.pathId, input.pathId),
          ),
        )
        .limit(1);

      const patch: Record<string, unknown> = {};
      if (input.enabled !== undefined) patch.enabled = input.enabled ? 1 : 0;
      if (input.sourceSystem !== undefined) patch.sourceSystem = input.sourceSystem;
      if (input.middlewareSystem !== undefined) patch.middlewareSystem = input.middlewareSystem;
      if (input.destinationSystem !== undefined) patch.destinationSystem = input.destinationSystem;
      if (input.notes !== undefined) patch.notes = input.notes;

      if (existing) {
        if (Object.keys(patch).length === 0) return existing;
        await db.update(workflowPathways).set(patch).where(eq(workflowPathways.id, existing.id));
        return { ...existing, ...patch };
      }

      await db.insert(workflowPathways).values({
        organizationId: orgId,
        workflowType: input.workflowType,
        pathId: input.pathId,
        enabled: input.enabled ? 1 : 0,
        sourceSystem: input.sourceSystem ?? null,
        middlewareSystem: input.middlewareSystem ?? null,
        destinationSystem: input.destinationSystem ?? null,
        notes: input.notes ?? null,
      });
      const [inserted] = await db
        .select()
        .from(workflowPathways)
        .where(
          and(
            eq(workflowPathways.organizationId, orgId),
            eq(workflowPathways.workflowType, input.workflowType),
            eq(workflowPathways.pathId, input.pathId),
          ),
        )
        .limit(1);
      return inserted;
    }),
});
