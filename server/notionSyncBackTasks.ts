/**
 * Notion → MySQL Sync-Back for Task Completions and Validation Results
 *
 * Polls Notion for rows edited since the last sync checkpoint and upserts
 * them into MySQL. Uses a simple in-memory timestamp to track the last
 * successful sync time (resets to "1 hour ago" on server restart).
 *
 * Called by the cron scheduler every 5 minutes (offset from questionnaire sync).
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { requireDb } from "./db";
import { taskCompletion, validationResults } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  fetchChangedTaskCompletions,
  fetchChangedValidationResults,
  statusToTaskFlags,
  type NotionTaskRow,
  type NotionValidationRow,
} from "./notionTaskValidation";

// Notion client for marking "Last Updated From" after sync-back
let _notionClient: Client | null = null;
function getNotionClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  if (!_notionClient) _notionClient = new Client({ auth: ENV.notionApiKey });
  return _notionClient;
}

async function markLastUpdatedFrom(pageId: string): Promise<void> {
  const client = getNotionClient();
  if (!client) return;
  try {
    await client.pages.update({
      page_id: pageId,
      properties: {
        "Last Updated From": { rich_text: [{ text: { content: "Notion" } }] },
      },
    });
  } catch {
    // Non-fatal — don't block sync for a metadata update
  }
}

// ── Sync state ─────────────────────────────────────────────────────────────────

// Look back 7 days on startup to catch any edits missed during downtime.
// After the first successful sync, advances to "now" and stays current.
const STARTUP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let lastTaskSyncTime: string = new Date(Date.now() - STARTUP_LOOKBACK_MS).toISOString();
let lastValidationSyncTime: string = new Date(Date.now() - STARTUP_LOOKBACK_MS).toISOString();

export interface TaskValidationSyncResult {
  tasks: { fetched: number; upserted: number; failed: number; errors: string[] };
  validation: { fetched: number; upserted: number; failed: number; errors: string[] };
  durationMs: number;
}

// ── Upsert helpers ─────────────────────────────────────────────────────────────

async function upsertTaskCompletion(row: NotionTaskRow): Promise<void> {
  const db = await requireDb();
  const flags = statusToTaskFlags(row.status);

  const [existing] = await db
    .select()
    .from(taskCompletion)
    .where(
      and(
        eq(taskCompletion.organizationId, row.organizationId),
        eq(taskCompletion.taskId, row.taskKey)
      )
    )
    .limit(1);

  const payload = {
    sectionName: row.sectionName || existing?.sectionName || "",
    completed: flags.completed,
    inProgress: flags.inProgress,
    blocked: flags.blocked,
    notApplicable: flags.notApplicable,
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    completedBy: row.completedBy || null,
    targetDate: row.targetDate || null,
    notes: row.notes || null,
  };

  if (existing) {
    await db
      .update(taskCompletion)
      .set(payload)
      .where(eq(taskCompletion.id, existing.id));
  } else {
    await db.insert(taskCompletion).values({
      organizationId: row.organizationId,
      taskId: row.taskKey,
      ...payload,
    });
  }
}

async function upsertValidationResult(row: NotionValidationRow): Promise<void> {
  const db = await requireDb();

  const [existing] = await db
    .select()
    .from(validationResults)
    .where(
      and(
        eq(validationResults.organizationId, row.organizationId),
        eq(validationResults.testKey, row.testKey)
      )
    )
    .limit(1);

  const payload = {
    actual: row.actual || null,
    status: row.status as any,
    signOff: row.signOff || null,
    notes: row.notes || null,
    testedDate: row.testedDate || null,
    updatedBy: row.updatedBy || null,
  };

  if (existing) {
    await db
      .update(validationResults)
      .set(payload)
      .where(eq(validationResults.id, existing.id));
  } else {
    await db.insert(validationResults).values({
      organizationId: row.organizationId,
      testKey: row.testKey,
      ...payload,
    });
  }
}

// ── Main sync function ─────────────────────────────────────────────────────────

/**
 * Run the sync-back for task completions and validation results.
 * Called by the cron scheduler.
 */
export async function runTaskValidationSyncBack(): Promise<TaskValidationSyncResult> {
  const startTime = Date.now();
  const result: TaskValidationSyncResult = {
    tasks: { fetched: 0, upserted: 0, failed: 0, errors: [] },
    validation: { fetched: 0, upserted: 0, failed: 0, errors: [] },
    durationMs: 0,
  };

  // ── Task Completions ──────────────────────────────────────────────────────
  try {
    const allTaskRows = await fetchChangedTaskCompletions(lastTaskSyncTime);
    // Skip rows where "Last Updated From" = "Notion" — those are our own sync-back
    // writes that bumped last_edited_time. Only process rows edited by humans or Portal.
    const taskRows = allTaskRows.filter(row => row.lastUpdatedFrom !== "Notion");
    result.tasks.fetched = taskRows.length;

    for (const row of taskRows) {
      try {
        await upsertTaskCompletion(row);
        result.tasks.upserted++;
        // Mark source in Notion so staff know this was a Notion-initiated edit
        await markLastUpdatedFrom(row.pageId);
      } catch (err: any) {
        result.tasks.failed++;
        result.tasks.errors.push(`${row.taskKey}: ${err.message?.substring(0, 80)}`);
      }
    }

    // Advance checkpoint — advance even if all rows were filtered (they were processed)
    if (result.tasks.failed === 0 && allTaskRows.length > 0) {
      lastTaskSyncTime = new Date().toISOString();
    }
  } catch (err: any) {
    result.tasks.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
  }

  // ── Validation Results ────────────────────────────────────────────────────
  try {
    const allValRows = await fetchChangedValidationResults(lastValidationSyncTime);
    // Skip rows where "Last Updated From" = "Notion" — same feedback loop prevention
    const valRows = allValRows.filter(row => row.lastUpdatedFrom !== "Notion");
    result.validation.fetched = valRows.length;

    for (const row of valRows) {
      try {
        await upsertValidationResult(row);
        result.validation.upserted++;
        // Mark source in Notion so staff know this was a Notion-initiated edit
        await markLastUpdatedFrom(row.pageId);
      } catch (err: any) {
        result.validation.failed++;
        result.validation.errors.push(`${row.testKey}: ${err.message?.substring(0, 80)}`);
      }
    }

    // Advance checkpoint — advance even if all rows were filtered (they were processed)
    if (result.validation.failed === 0 && allValRows.length > 0) {
      lastValidationSyncTime = new Date().toISOString();
    }
  } catch (err: any) {
    result.validation.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
  }

  result.durationMs = Date.now() - startTime;

  const totalUpserted = result.tasks.upserted + result.validation.upserted;
  const totalFailed = result.tasks.failed + result.validation.failed;
  if (totalUpserted > 0 || totalFailed > 0) {
    console.log(
      `[cron] Task/Validation sync-back — tasks: ${result.tasks.upserted}/${result.tasks.fetched} upserted, ` +
      `validation: ${result.validation.upserted}/${result.validation.fetched} upserted, ` +
      `${totalFailed} failed (${result.durationMs}ms)`
    );
  }

  return result;
}
