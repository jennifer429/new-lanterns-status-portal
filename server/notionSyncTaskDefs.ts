/**
 * Notion → MySQL Sync for Task Definitions
 *
 * Pulls every page from the Notion "Task Definitions" database and upserts it
 * into the `taskDefinitions` table keyed by Task ID. Tasks that have disappeared
 * from Notion are soft-inactivated (isActive = 0) so historic taskCompletion
 * rows referencing them are not orphaned.
 *
 * Pipeline identifier: "task-definitions"
 * Schedule: every 5 minutes (offset by 4 from the questionnaire sync).
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { taskDefinitions } from "../drizzle/schema";
import { eq, and, notInArray } from "drizzle-orm";

// ── Notion property extractors ───────────────────────────────────────────────

function getStr(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":     return prop.title.map((t: any) => t.plain_text).join("").trim();
    case "rich_text": return prop.rich_text.map((t: any) => t.plain_text).join("").trim();
    case "select":    return prop.select?.name ?? "";
    case "url":       return prop.url ?? "";
    default:          return "";
  }
}

function getMultiSelect(prop: any): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((s: any) => s.name).filter(Boolean);
}

function getNumber(prop: any): number {
  if (!prop || prop.type !== "number") return 0;
  return typeof prop.number === "number" ? prop.number : 0;
}

function getCheckbox(prop: any, defaultVal = true): boolean {
  if (!prop || prop.type !== "checkbox") return defaultVal;
  return !!prop.checkbox;
}

/** Parse "hl7:orm, network:vpn" into ["hl7:orm","network:vpn"]. */
function parseDependsOn(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ── Result shape ─────────────────────────────────────────────────────────────

export interface TaskDefsSyncResult {
  fetched: number;
  upserted: number;
  inactivated: number;
  failed: number;
  errors: string[];
}

// ── Main sync ────────────────────────────────────────────────────────────────

export async function runTaskDefsSync(): Promise<TaskDefsSyncResult> {
  const result: TaskDefsSyncResult = { fetched: 0, upserted: 0, inactivated: 0, failed: 0, errors: [] };

  if (!ENV.notionApiKey || !ENV.notionTaskDefinitionsDataSourceId) {
    result.errors.push("Task Definitions Notion credentials not configured");
    return result;
  }

  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available");
    return result;
  }

  const client = new Client({ auth: ENV.notionApiKey });
  const dsId = ENV.notionTaskDefinitionsDataSourceId;

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
  const seenTaskIds: string[] = [];

  for (const page of pages) {
    try {
      const p = page.properties as Record<string, any>;

      const taskId = getStr(p["Key"]) || getStr(p["Task ID"]);
      if (!taskId) {
        result.failed++;
        result.errors.push(`Page ${page.id} skipped: missing Key or Task ID`);
        continue;
      }
      seenTaskIds.push(taskId);

      const active = getCheckbox(p["Active"], true);
      const isArchivedInNotion = !!page.archived;

      const row = {
        taskId,
        title: getStr(p["Title"]) || taskId,
        description: getStr(p["Description"]) || null,
        sectionId: getStr(p["Section"]) || null,
        sectionTitle: getStr(p["Section Title"]) || null,
        sectionDuration: getStr(p["Section Duration"]) || null,
        swimLanes: getMultiSelect(p["Swim Lanes"]).map(s => s.toLowerCase()),
        dependsOn: parseDependsOn(getStr(p["Depends On"])),
        sortOrder: getNumber(p["Sort Order"]),
        intakeLink: getStr(p["Intake Link"]) || null,
        intakeLinkLabel: getStr(p["Intake Link Label"]) || null,
        specLink: getStr(p["Spec Link"]) || null,
        specLinkLabel: getStr(p["Spec Link Label"]) || null,
        isActive: active && !isArchivedInNotion ? 1 : 0,
        notionPageId: page.id,
        notionLastEdited: page.last_edited_time ? new Date(page.last_edited_time) : null,
        syncedAt: new Date(),
      };

      const [existing] = await db
        .select({ id: taskDefinitions.id })
        .from(taskDefinitions)
        .where(eq(taskDefinitions.taskId, taskId))
        .limit(1);

      if (existing) {
        await db.update(taskDefinitions).set(row).where(eq(taskDefinitions.id, existing.id));
      } else {
        await db.insert(taskDefinitions).values(row);
      }
      result.upserted++;
    } catch (err: any) {
      result.failed++;
      result.errors.push((err.message || String(err)).substring(0, 120));
    }
  }

  // Soft-inactivate any row in MySQL whose taskId wasn't in this Notion fetch
  // (and that isn't already inactive). This preserves taskCompletion history.
  if (seenTaskIds.length > 0) {
    try {
      const stale = await db
        .select({ id: taskDefinitions.id, taskId: taskDefinitions.taskId })
        .from(taskDefinitions)
        .where(
          and(
            eq(taskDefinitions.isActive, 1),
            notInArray(taskDefinitions.taskId, seenTaskIds),
          ),
        );
      for (const s of stale) {
        await db
          .update(taskDefinitions)
          .set({ isActive: 0, syncedAt: new Date() })
          .where(eq(taskDefinitions.id, s.id));
        result.inactivated++;
      }
    } catch (err: any) {
      result.errors.push(`Inactivation pass failed: ${err.message?.substring(0, 100)}`);
    }
  }

  return result;
}
