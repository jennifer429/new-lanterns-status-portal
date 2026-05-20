/**
 * Systems Router — Dual-write pattern
 *
 * Reads: MySQL (fast, cached by cron sync-back)
 * Writes: Notion (source of truth) + MySQL (immediate cache update)
 *
 * Notion Systems v2 schema:
 *   System Name (title), System Type (select), Institution Group (multi_select),
 *   Partner (select), Site (select), Vendor (select), Version (rich_text),
 *   Notes (rich_text), Updated By (rich_text)
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getConnectivityNotionClient } from "../notion";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { systems, organizations, clients } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Notion helpers ───────────────────────────────────────────────────────────

function getSystemsDbId(): string {
  return ENV.notionSystemsDbId || "";
}

function getSystemsDataSourceId(): string {
  return ENV.notionSystemsDataSourceId || "";
}

/** Sanitize select values (no commas allowed in Notion selects) */
function sanitizeSelect(val: string): string {
  return val.replace(/,/g, ";").trim();
}

function buildNotionProperties(row: {
  systemName: string;
  systemType: string;
  vendor: string;
  version: string;
  notes: string;
  orgSlug: string;
  partner: string;
  updatedBy: string;
}) {
  const props: Record<string, any> = {
    "System Name": { title: [{ text: { content: row.systemName.substring(0, 200) } }] },
    "Institution Group": { multi_select: [{ name: row.orgSlug }] },
    Site: { select: { name: row.orgSlug } },
    "Updated By": { rich_text: [{ text: { content: row.updatedBy || "" } }] },
  };

  if (row.systemType) {
    props["System Type"] = { select: { name: sanitizeSelect(row.systemType).substring(0, 100) } };
  }
  if (row.partner) {
    props.Partner = { select: { name: row.partner } };
  }
  if (row.vendor) {
    props.Vendor = { select: { name: sanitizeSelect(row.vendor).substring(0, 100) } };
  }
  if (row.version) {
    props.Version = { rich_text: [{ text: { content: row.version.substring(0, 200) } }] };
  }
  if (row.notes) {
    props.Notes = { rich_text: [{ text: { content: row.notes.substring(0, 2000) } }] };
  }

  return props;
}

// ── Input schemas ────────────────────────────────────────────────────────────

const SystemInput = z.object({
  systemName: z.string().min(1),
  systemType: z.string().default(""),
  vendor: z.string().default(""),
  version: z.string().default(""),
  notes: z.string().default(""),
});

// ── Router ───────────────────────────────────────────────────────────────────

export const systemsRouter = router({
  /**
   * Get all systems for an organization — reads from MySQL for performance.
   */
  getForOrg: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], configured: false };

      // Resolve org ID from slug
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) return { rows: [], configured: true };

      const rows = await db
        .select()
        .from(systems)
        .where(
          and(
            eq(systems.organizationId, org.id),
            eq(systems.isArchived, 0)
          )
        );

      return { rows, configured: true };
    }),

  /**
   * Create a new system — writes to Notion + MySQL.
   */
  createRow: protectedProcedure
    .input(z.object({
      organizationSlug: z.string(),
      system: SystemInput,
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Resolve org
      const [org] = await db
        .select({ id: organizations.id, name: organizations.name, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);
      if (!org) throw new Error("Organization not found");

      // Resolve partner name
      let partnerName = "";
      if (org.clientId) {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, org.clientId))
          .limit(1);
        if (client) partnerName = client.name;
      }

      const updatedBy = ctx.user?.email || ctx.user?.name || "portal";

      // 1. Write to Notion
      let notionPageId: string | null = null;
      const notionClient = getConnectivityNotionClient();
      const dbId = getSystemsDbId();
      if (notionClient && dbId) {
        try {
          const properties = buildNotionProperties({
            systemName: input.system.systemName,
            systemType: input.system.systemType,
            vendor: input.system.vendor,
            version: input.system.version,
            notes: input.system.notes,
            orgSlug: input.organizationSlug,
            partner: partnerName,
            updatedBy,
          });
          const page = await notionClient.pages.create({
            parent: { database_id: dbId },
            properties,
          });
          notionPageId = page.id;
        } catch (err: any) {
          console.error("[systems] Notion create failed:", err?.message);
        }
      }

      // 2. Write to MySQL (immediate cache)
      const [result] = await db.insert(systems).values({
        notionPageId,
        organizationId: org.id,
        systemName: input.system.systemName,
        systemType: input.system.systemType || null,
        vendor: input.system.vendor || null,
        version: input.system.version || null,
        notes: input.system.notes || null,
        partner: partnerName || null,
        site: input.organizationSlug,
        updatedBy,
        isArchived: 0,
      });

      return { id: result.insertId, notionPageId };
    }),

  /**
   * Update an existing system — writes to Notion + MySQL.
   */
  updateRow: protectedProcedure
    .input(z.object({
      id: z.number(),
      organizationSlug: z.string(),
      system: SystemInput,
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updatedBy = ctx.user?.email || ctx.user?.name || "portal";

      // Get existing row
      const [existing] = await db
        .select()
        .from(systems)
        .where(eq(systems.id, input.id))
        .limit(1);
      if (!existing) throw new Error("System not found");

      // Resolve partner
      const [org] = await db
        .select({ id: organizations.id, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);
      let partnerName = existing.partner || "";
      if (org?.clientId) {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, org.clientId))
          .limit(1);
        if (client) partnerName = client.name;
      }

      // 1. Update Notion
      const notionClient = getConnectivityNotionClient();
      if (notionClient && existing.notionPageId) {
        try {
          const properties = buildNotionProperties({
            systemName: input.system.systemName,
            systemType: input.system.systemType,
            vendor: input.system.vendor,
            version: input.system.version,
            notes: input.system.notes,
            orgSlug: input.organizationSlug,
            partner: partnerName,
            updatedBy,
          });
          await notionClient.pages.update({
            page_id: existing.notionPageId,
            properties,
          });
        } catch (err: any) {
          console.error("[systems] Notion update failed:", err?.message);
        }
      }

      // 2. Update MySQL
      await db
        .update(systems)
        .set({
          systemName: input.system.systemName,
          systemType: input.system.systemType || null,
          vendor: input.system.vendor || null,
          version: input.system.version || null,
          notes: input.system.notes || null,
          partner: partnerName || null,
          updatedBy,
        })
        .where(eq(systems.id, input.id));

      return { ok: true };
    }),

  /**
   * Archive (soft-delete) a system — archives in Notion + MySQL.
   */
  archiveRow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(systems)
        .where(eq(systems.id, input.id))
        .limit(1);
      if (!existing) throw new Error("System not found");

      // 1. Archive in Notion
      const notionClient = getConnectivityNotionClient();
      if (notionClient && existing.notionPageId) {
        try {
          await notionClient.pages.update({
            page_id: existing.notionPageId,
            archived: true,
          });
        } catch (err: any) {
          console.error("[systems] Notion archive failed:", err?.message);
        }
      }

      // 2. Soft-delete in MySQL
      await db
        .update(systems)
        .set({ isArchived: 1 })
        .where(eq(systems.id, input.id));

      return { ok: true };
    }),
});
