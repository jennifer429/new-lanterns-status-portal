import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { organizations, validationResults } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { orgIdentifierMatches } from "../_core/orgLookup";

export const validationRouter = router({
  /**
   * Get all stored validation results for an organization.
   * Returns a map of testKey → {actual, status, signOff}.
   */
  getResults: publicProcedure
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
        .from(validationResults)
        .where(eq(validationResults.organizationId, org.id));

      // Return as a plain object keyed by testKey for easy lookup on the client
      const resultMap: Record<string, { actual: string | null; status: string; signOff: string | null; notes: string | null; testedDate: string | null; updatedBy: string | null; updatedAt: Date }> = {};
      for (const row of rows) {
        resultMap[row.testKey] = {
          actual: row.actual,
          status: row.status,
          signOff: row.signOff,
          notes: row.notes,
          testedDate: row.testedDate,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
        };
      }
      return resultMap;
    }),

  /**
   * Upsert a single test result.
   */
  updateResult: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        testKey: z.string(),
        actual: z.string().optional(),
        status: z.enum(["Pass", "Fail", "Not Tested", "Pending", "N/A", "In Progress", "Blocked"]),
        signOff: z.string().optional(),
        notes: z.string().optional(),
        testedDate: z.string().optional(),
        updatedBy: z.string().optional(),
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
        .from(validationResults)
        .where(
          and(
            eq(validationResults.organizationId, org.id),
            eq(validationResults.testKey, input.testKey)
          )
        )
        .limit(1);

      const payload = {
        actual: input.actual ?? null,
        status: input.status,
        signOff: input.signOff ?? null,
        notes: input.notes ?? null,
        testedDate: input.testedDate ?? null,
        updatedBy: input.updatedBy ?? null,
      };

      if (existing) {
        await db
          .update(validationResults)
          .set(payload)
          .where(eq(validationResults.id, existing.id));
      } else {
        await db.insert(validationResults).values({
          organizationId: org.id,
          testKey: input.testKey,
          ...payload,
        });
      }

      return { success: true };
    }),
});
