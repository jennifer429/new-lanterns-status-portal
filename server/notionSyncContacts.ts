/**
 * Notion → MySQL Sync-Back for Contacts & Systems
 *
 * Fetches all rows from the Notion Contacts v2 and Systems v2 databases,
 * then upserts them into the normalized MySQL tables.
 *
 * Strategy: Full-replace per org (delete-and-reinsert) is too risky.
 * Instead we upsert by notionPageId — if a page exists in MySQL, update it;
 * if not, insert it. Pages archived in Notion get isArchived=1 in MySQL.
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { contacts, systems, organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Notion property extractors (same as connectivity router) ─────────────────

function getStr(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":        return prop.title.map((t: any) => t.plain_text).join("");
    case "rich_text":    return prop.rich_text.map((t: any) => t.plain_text).join("");
    case "select":       return prop.select?.name ?? "";
    case "multi_select": return prop.multi_select.map((s: any) => s.name).join(", ");
    case "email":        return prop.email ?? "";
    case "phone_number": return prop.phone_number ?? "";
    default:             return "";
  }
}

function getMultiSelect(prop: any): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((s: any) => s.name);
}

// ── Org slug → ID cache ──────────────────────────────────────────────────────

let orgCache: Map<string, number> | null = null;

async function getOrgMap(): Promise<Map<string, number>> {
  if (orgCache) return orgCache;
  const db = await getDb();
  if (!db) return new Map();
  const orgs = await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations);
  orgCache = new Map(orgs.map(o => [o.slug, o.id]));
  return orgCache;
}

/** Clear the org cache (call at start of each sync run) */
function clearOrgCache() {
  orgCache = null;
}

// ── Contacts sync ────────────────────────────────────────────────────────────

export interface ContactsSyncResult {
  fetched: number;
  upserted: number;
  archived: number;
  failed: number;
  errors: string[];
}

export async function syncContactsFromNotion(): Promise<ContactsSyncResult> {
  const result: ContactsSyncResult = { fetched: 0, upserted: 0, archived: 0, failed: 0, errors: [] };

  const client = new Client({ auth: ENV.notionApiKey });
  const dsId = ENV.notionContactsDataSourceId;
  if (!ENV.notionApiKey || !dsId) {
    result.errors.push("Contacts Notion credentials not configured");
    return result;
  }

  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available");
    return result;
  }

  clearOrgCache();
  const orgMap = await getOrgMap();

  // Fetch all pages from Notion
  const pages: any[] = [];
  let cursor: string | undefined;
  try {
    do {
      const params: any = { data_source_id: dsId, page_size: 100 };
      if (cursor) params.start_cursor = cursor;
      const response: any = await (client as any).dataSources.query(params);
      pages.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (err: any) {
    result.errors.push(`Notion query failed: ${err.message}`);
    return result;
  }

  result.fetched = pages.length;

  // Track which Notion page IDs we've seen (to mark others as archived)
  const seenPageIds = new Set<string>();

  for (const page of pages) {
    try {
      const p = page.properties as Record<string, any>;
      const pageId = page.id;
      const isArchived = !!page.archived;
      seenPageIds.add(pageId);

      // Resolve org from Institution Group or Site
      const groups = getMultiSelect(p["Institution Group"]);
      const site = getStr(p["Site"]);
      const slug = groups[0] || site || "";
      const orgId = orgMap.get(slug);
      if (!orgId) {
        // Try to match by name normalization
        result.failed++;
        continue;
      }

      const name = getStr(p["Name"] || p["System Name"]);
      if (!name) { result.failed++; continue; }

      const role = getStr(p["Role"]);
      const email = getStr(p["Email"]);
      const phone = getStr(p["Phone"]);
      const notes = getStr(p["Notes"]);
      const partner = getStr(p["Partner"]);
      const updatedBy = getStr(p["Updated By"]) || "notion-sync@system";

      // Upsert by notionPageId
      const [existing] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.notionPageId, pageId))
        .limit(1);

      if (existing) {
        await db.update(contacts).set({
          organizationId: orgId,
          name,
          role: role || null,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          partner: partner || null,
          site: slug,
          updatedBy,
          isArchived: isArchived ? 1 : 0,
        }).where(eq(contacts.id, existing.id));
      } else {
        await db.insert(contacts).values({
          notionPageId: pageId,
          organizationId: orgId,
          name,
          role: role || null,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          partner: partner || null,
          site: slug,
          updatedBy,
          isArchived: isArchived ? 1 : 0,
        });
      }

      if (isArchived) result.archived++;
      else result.upserted++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(err.message?.substring(0, 100));
    }
  }

  return result;
}

// ── Systems sync ─────────────────────────────────────────────────────────────

export interface SystemsSyncResult {
  fetched: number;
  upserted: number;
  archived: number;
  failed: number;
  errors: string[];
}

export async function syncSystemsFromNotion(): Promise<SystemsSyncResult> {
  const result: SystemsSyncResult = { fetched: 0, upserted: 0, archived: 0, failed: 0, errors: [] };

  const client = new Client({ auth: ENV.notionApiKey });
  const dsId = ENV.notionSystemsDataSourceId;
  if (!ENV.notionApiKey || !dsId) {
    result.errors.push("Systems Notion credentials not configured");
    return result;
  }

  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available");
    return result;
  }

  clearOrgCache();
  const orgMap = await getOrgMap();

  // Fetch all pages from Notion
  const pages: any[] = [];
  let cursor: string | undefined;
  try {
    do {
      const params: any = { data_source_id: dsId, page_size: 100 };
      if (cursor) params.start_cursor = cursor;
      const response: any = await (client as any).dataSources.query(params);
      pages.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (err: any) {
    result.errors.push(`Notion query failed: ${err.message}`);
    return result;
  }

  result.fetched = pages.length;

  for (const page of pages) {
    try {
      const p = page.properties as Record<string, any>;
      const pageId = page.id;
      const isArchived = !!page.archived;

      // Resolve org
      const groups = getMultiSelect(p["Institution Group"]);
      const site = getStr(p["Site"]);
      const slug = groups[0] || site || "";
      const orgId = orgMap.get(slug);
      if (!orgId) { result.failed++; continue; }

      const systemName = getStr(p["System Name"]);
      if (!systemName) { result.failed++; continue; }

      const systemType = getStr(p["System Type"]);
      const vendor = getStr(p["Vendor"]);
      const version = getStr(p["Version"]);
      const notes = getStr(p["Notes"]);
      const partner = getStr(p["Partner"]);
      const updatedBy = getStr(p["Updated By"]) || "notion-sync@system";

      // Upsert by notionPageId
      const [existing] = await db
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.notionPageId, pageId))
        .limit(1);

      if (existing) {
        await db.update(systems).set({
          organizationId: orgId,
          systemName,
          systemType: systemType || null,
          vendor: vendor || null,
          version: version || null,
          notes: notes || null,
          partner: partner || null,
          site: slug,
          updatedBy,
          isArchived: isArchived ? 1 : 0,
        }).where(eq(systems.id, existing.id));
      } else {
        await db.insert(systems).values({
          notionPageId: pageId,
          organizationId: orgId,
          systemName,
          systemType: systemType || null,
          vendor: vendor || null,
          version: version || null,
          notes: notes || null,
          partner: partner || null,
          site: slug,
          updatedBy,
          isArchived: isArchived ? 1 : 0,
        });
      }

      if (isArchived) result.archived++;
      else result.upserted++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(err.message?.substring(0, 100));
    }
  }

  return result;
}

/**
 * Run both contacts and systems sync. Returns combined stats.
 * Logging is handled by the cron hourly aggregation — not per-run.
 */
export async function runContactsSystemsSync(): Promise<{
  contacts: ContactsSyncResult;
  systems: SystemsSyncResult;
}> {
  const [contactsResult, systemsResult] = await Promise.all([
    syncContactsFromNotion(),
    syncSystemsFromNotion(),
  ]);
  return { contacts: contactsResult, systems: systemsResult };
}
