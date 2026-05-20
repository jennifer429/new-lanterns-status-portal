/**
 * Contacts Router — Dual-write pattern
 *
 * Reads: MySQL (fast, cached by cron sync-back)
 * Writes: Notion (source of truth) + MySQL (immediate cache update)
 *
 * Notion Contacts v2 schema:
 *   Name (title), Role (select), Institution Group (multi_select),
 *   Partner (select), Site (select), Email (email), Phone (rich_text),
 *   Notes (rich_text), Updated By (rich_text)
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getConnectivityNotionClient } from "../notion";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { contacts, organizations, clients } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Notion helpers ───────────────────────────────────────────────────────────

function getContactsDbId(): string {
  return ENV.notionContactsDbId || "";
}

function getContactsDataSourceId(): string {
  return ENV.notionContactsDataSourceId || "";
}

/** Sanitize select values (no commas allowed in Notion selects) */
function sanitizeSelect(val: string): string {
  return val.replace(/,/g, ";").trim();
}

function buildNotionProperties(row: {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  orgSlug: string;
  partner: string;
  updatedBy: string;
}) {
  const props: Record<string, any> = {
    Name: { title: [{ text: { content: row.name.substring(0, 200) } }] },
    "Institution Group": { multi_select: [{ name: row.orgSlug }] },
    Site: { select: { name: row.orgSlug } },
    "Updated By": { rich_text: [{ text: { content: row.updatedBy || "" } }] },
  };

  if (row.role) {
    props.Role = { select: { name: sanitizeSelect(row.role).substring(0, 100) } };
  }
  if (row.partner) {
    props.Partner = { select: { name: row.partner } };
  }
  if (row.email) {
    props.Email = { email: row.email.substring(0, 100) };
  }
  if (row.phone) {
    props.Phone = { rich_text: [{ text: { content: row.phone.substring(0, 50) } }] };
  }
  if (row.notes) {
    props.Notes = { rich_text: [{ text: { content: row.notes.substring(0, 2000) } }] };
  }

  return props;
}

// ── Input schemas ────────────────────────────────────────────────────────────

const ContactInput = z.object({
  name: z.string().min(1),
  role: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  notes: z.string().default(""),
});

// ── Router ───────────────────────────────────────────────────────────────────

export const contactsRouter = router({
  /**
   * Get all contacts for an organization — reads from MySQL for performance.
   */
  getForOrg: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], configured: false };

      // Resolve org ID from slug
      const [org] = await db
        .select({ id: organizations.id, name: organizations.name, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) return { rows: [], configured: true };

      const rows = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, org.id),
            eq(contacts.isArchived, 0)
          )
        );

      return { rows, configured: true };
    }),

  /**
   * Create a new contact — writes to Notion + MySQL.
   */
  createRow: protectedProcedure
    .input(z.object({
      organizationSlug: z.string(),
      contact: ContactInput,
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
      const dbId = getContactsDbId();
      if (notionClient && dbId) {
        try {
          const properties = buildNotionProperties({
            name: input.contact.name,
            role: input.contact.role,
            email: input.contact.email,
            phone: input.contact.phone,
            notes: input.contact.notes,
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
          console.error("[contacts] Notion create failed:", err?.message);
          // Continue — MySQL write still happens
        }
      }

      // 2. Write to MySQL (immediate cache)
      const [result] = await db.insert(contacts).values({
        notionPageId,
        organizationId: org.id,
        name: input.contact.name,
        role: input.contact.role || null,
        email: input.contact.email || null,
        phone: input.contact.phone || null,
        notes: input.contact.notes || null,
        partner: partnerName || null,
        site: input.organizationSlug,
        updatedBy,
        isArchived: 0,
      });

      return { id: result.insertId, notionPageId };
    }),

  /**
   * Update an existing contact — writes to Notion + MySQL.
   */
  updateRow: protectedProcedure
    .input(z.object({
      id: z.number(),
      organizationSlug: z.string(),
      contact: ContactInput,
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updatedBy = ctx.user?.email || ctx.user?.name || "portal";

      // Get existing row to find notionPageId
      const [existing] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, input.id))
        .limit(1);
      if (!existing) throw new Error("Contact not found");

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
            name: input.contact.name,
            role: input.contact.role,
            email: input.contact.email,
            phone: input.contact.phone,
            notes: input.contact.notes,
            orgSlug: input.organizationSlug,
            partner: partnerName,
            updatedBy,
          });
          await notionClient.pages.update({
            page_id: existing.notionPageId,
            properties,
          });
        } catch (err: any) {
          console.error("[contacts] Notion update failed:", err?.message);
        }
      }

      // 2. Update MySQL
      await db
        .update(contacts)
        .set({
          name: input.contact.name,
          role: input.contact.role || null,
          email: input.contact.email || null,
          phone: input.contact.phone || null,
          notes: input.contact.notes || null,
          partner: partnerName || null,
          updatedBy,
        })
        .where(eq(contacts.id, input.id));

      return { ok: true };
    }),

  /**
   * Archive (soft-delete) a contact — archives in Notion + MySQL.
   */
  archiveRow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, input.id))
        .limit(1);
      if (!existing) throw new Error("Contact not found");

      // 1. Archive in Notion
      const notionClient = getConnectivityNotionClient();
      if (notionClient && existing.notionPageId) {
        try {
          await notionClient.pages.update({
            page_id: existing.notionPageId,
            archived: true,
          });
        } catch (err: any) {
          console.error("[contacts] Notion archive failed:", err?.message);
        }
      }

      // 2. Soft-delete in MySQL
      await db
        .update(contacts)
        .set({ isArchived: 1 })
        .where(eq(contacts.id, input.id));

      return { ok: true };
    }),
});
