import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import {
  organizations,
  implementationOrgs,
  taskOrgAssignment,
  intakeResponses,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Default org types seeded when a PM first opens the swimlane view.
 * sortOrder follows the layout rules:
 *   - Hospital/vendors on the left
 *   - Silverback in the middle
 *   - New Lantern on the right
 */
const DEFAULT_ORG_TYPES = [
  { name: "Hospital IT", orgType: "hospital", sortOrder: 1 },
  { name: "EHR Vendor", orgType: "ehr_vendor", sortOrder: 2 },
  { name: "RIS Vendor", orgType: "ris_vendor", sortOrder: 3 },
  { name: "PACS/VNA Vendor", orgType: "pacs_vendor", sortOrder: 4 },
  { name: "Rad Group", orgType: "rad_group", sortOrder: 5 },
  { name: "Silverback (Data First)", orgType: "silverback", sortOrder: 6 },
  { name: "Scipio", orgType: "scipio", sortOrder: 7 },
  { name: "New Lantern", orgType: "new_lantern", sortOrder: 8 },
];

/** Resolve an org slug to its numeric ID, or throw NOT_FOUND. */
async function resolveOrgId(db: ReturnType<typeof requireDb> extends Promise<infer T> ? T : never, slug: string) {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  return org.id;
}

export const swimlaneRouter = router({
  // ── Implementation Orgs ─────────────────────────────────────────────────────

  /**
   * Get all implementation orgs for a site.
   * Auto-seeds defaults if none exist yet.
   */
  getOrgs: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      let rows = await db
        .select()
        .from(implementationOrgs)
        .where(eq(implementationOrgs.organizationId, orgId));

      // Auto-seed defaults on first access
      if (rows.length === 0) {
        for (const def of DEFAULT_ORG_TYPES) {
          await db.insert(implementationOrgs).values({
            organizationId: orgId,
            name: def.name,
            orgType: def.orgType,
            sortOrder: def.sortOrder,
          });
        }
        rows = await db
          .select()
          .from(implementationOrgs)
          .where(eq(implementationOrgs.organizationId, orgId));
      }

      return rows
        .filter((r) => r.isActive === 1)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }),

  /** Add a new implementation org to a site's swimlane. */
  addOrg: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        name: z.string().min(1),
        orgType: z.string().min(1),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      // Default sortOrder: max + 1
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const existing = await db
          .select({ sortOrder: implementationOrgs.sortOrder })
          .from(implementationOrgs)
          .where(eq(implementationOrgs.organizationId, orgId));
        sortOrder = Math.max(0, ...existing.map((r) => r.sortOrder)) + 1;
      }

      const [result] = await db.insert(implementationOrgs).values({
        organizationId: orgId,
        name: input.name,
        orgType: input.orgType,
        color: input.color ?? null,
        sortOrder,
      });

      return { id: result.insertId };
    }),

  /** Update an implementation org (rename, recolor, reorder). */
  updateOrg: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const set: Record<string, unknown> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.color !== undefined) set.color = input.color;
      if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;

      if (Object.keys(set).length > 0) {
        await db
          .update(implementationOrgs)
          .set(set)
          .where(eq(implementationOrgs.id, input.id));
      }
      return { success: true };
    }),

  /** Soft-delete an implementation org. */
  removeOrg: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(implementationOrgs)
        .set({ isActive: 0 })
        .where(eq(implementationOrgs.id, input.id));
      return { success: true };
    }),

  // ── Task ↔ Org Assignments ──────────────────────────────────────────────────

  /**
   * Get all task→org assignments for a site.
   * Returns a map of taskId → implOrgId.
   */
  getAssignments: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      const rows = await db
        .select()
        .from(taskOrgAssignment)
        .where(eq(taskOrgAssignment.organizationId, orgId));

      const map: Record<string, number> = {};
      for (const row of rows) {
        map[row.taskId] = row.implOrgId;
      }
      return map;
    }),

  /** Assign (or reassign) a task to an implementation org. */
  assignTask: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        taskId: z.string(),
        implOrgId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      // Upsert: delete existing then insert
      await db
        .delete(taskOrgAssignment)
        .where(
          and(
            eq(taskOrgAssignment.organizationId, orgId),
            eq(taskOrgAssignment.taskId, input.taskId)
          )
        );

      await db.insert(taskOrgAssignment).values({
        organizationId: orgId,
        taskId: input.taskId,
        implOrgId: input.implOrgId,
      });

      return { success: true };
    }),

  /** Bulk assign multiple tasks to an implementation org. */
  bulkAssignTasks: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        taskIds: z.array(z.string()),
        implOrgId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      for (const taskId of input.taskIds) {
        await db
          .delete(taskOrgAssignment)
          .where(
            and(
              eq(taskOrgAssignment.organizationId, orgId),
              eq(taskOrgAssignment.taskId, taskId)
            )
          );

        await db.insert(taskOrgAssignment).values({
          organizationId: orgId,
          taskId,
          implOrgId: input.implOrgId,
        });
      }

      return { success: true };
    }),

  /**
   * Get vendor display names from the ARCH.systems questionnaire response.
   * Parses the JSON array of systems and extracts names by type.
   * Also pulls the organization name for the Hospital IT row.
   * Returns a map of partyId → display name.
   */
  getVendorNames: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      // Get the org name for the Hospital IT row
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const result: Record<string, string> = {};
      if (org) result.hospital = org.name;

      // Try ARCH.systems first (new format: JSON array of {name, type, ...})
      const [archSystems] = await db
        .select({ response: intakeResponses.response })
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.organizationId, orgId),
            eq(intakeResponses.questionId, "ARCH.systems")
          )
        )
        .limit(1);

      if (archSystems?.response) {
        try {
          const systems: Array<{ name: string; type: string }> = JSON.parse(archSystems.response);
          // Map system types to our party IDs
          const typeMap: Record<string, string> = {
            EHR: "ehr",
            RIS: "ris",
            PACS: "pacs",
          };
          for (const sys of systems) {
            const partyId = typeMap[sys.type];
            if (partyId && sys.name && !result[partyId]) {
              result[partyId] = sys.name;
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Fallback: try legacy ARCH.1 (PACS), ARCH.2 (RIS), ARCH.3 (EHR)
      const legacyMap: Record<string, string> = {
        "ARCH.1": "pacs",
        "ARCH.2": "ris",
        "ARCH.3": "ehr",
      };
      for (const [qId, partyId] of Object.entries(legacyMap)) {
        if (result[partyId]) continue; // already have from ARCH.systems
        const [row] = await db
          .select({ response: intakeResponses.response })
          .from(intakeResponses)
          .where(
            and(
              eq(intakeResponses.organizationId, orgId),
              eq(intakeResponses.questionId, qId)
            )
          )
          .limit(1);
        if (row?.response) {
          // Extract just the vendor name (before any dash or parenthetical)
          const cleaned = row.response.split("\\'").join("'").split(" — ")[0].split(" – ")[0].trim();
          if (cleaned) result[partyId] = cleaned;
        }
      }

      return result;
    }),

  /** Unassign a task (remove from swimlane). */
  unassignTask: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        taskId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const orgId = await resolveOrgId(db, input.organizationSlug);

      await db
        .delete(taskOrgAssignment)
        .where(
          and(
            eq(taskOrgAssignment.organizationId, orgId),
            eq(taskOrgAssignment.taskId, input.taskId)
          )
        );

      return { success: true };
    }),
});
