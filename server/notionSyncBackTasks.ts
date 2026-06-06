/**
 * Notion → MySQL Sync-Back for Task Completions and Validation Results
 *
 * Uses `notionLastEdited` column as a version check:
 * - If the incoming Notion `last_edited_time` matches what's stored → skip (already processed)
 * - If different → compare data, write if changed, store new `notionLastEdited`
 * - New rows → insert with `notionLastEdited` set
 *
 * This eliminates echo loops: the sync only writes when Notion has a genuinely new version.
 *
 * Pipeline identifiers:
 *   - "task-completions"
 *   - "validation-results"
 *
 * Called by the cron scheduler every 5 minutes (offset from questionnaire sync).
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { requireDb } from "./db";
import { taskCompletion, validationResults, syncCheckpoints } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  fetchChangedTaskCompletions,
  fetchChangedValidationResults,
  statusToTaskFlags,
  type NotionTaskRow,
  type NotionValidationRow,
} from "./notionTaskValidation";
import { coerceNotionDate, coerceValidationStatus } from "./syncBoundary";

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

// ── Sync state (persisted to MySQL) ──────────────────────────────────────────

// Pipeline identifiers
const TASK_PIPELINE = "task-completions";
const VALIDATION_PIPELINE = "validation-results";

// Fallback: look back 7 days if no checkpoint exists yet
const FALLBACK_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read the last successful sync timestamp from MySQL.
 */
async function readSyncCheckpoint(pipeline: string): Promise<string> {
  try {
    const db = await requireDb();
    const [row] = await db
      .select()
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.pipeline, pipeline))
      .limit(1);
    if (row?.lastSuccessfulSync) {
      return row.lastSuccessfulSync.toISOString();
    }
  } catch (err: any) {
    console.warn(`[task-val-sync] Failed to read checkpoint for ${pipeline}:`, err.message);
  }
  return new Date(Date.now() - FALLBACK_LOOKBACK_MS).toISOString();
}

/**
 * Write the last successful sync timestamp to MySQL.
 */
async function writeSyncCheckpoint(pipeline: string, timestamp: string): Promise<void> {
  try {
    const db = await requireDb();
    await db
      .insert(syncCheckpoints)
      .values({
        pipeline,
        lastSuccessfulSync: new Date(timestamp),
        consecutiveFailures: 0,
      })
      .onDuplicateKeyUpdate({
        set: {
          lastSuccessfulSync: new Date(timestamp),
          consecutiveFailures: 0,
        },
      });
  } catch (err: any) {
    console.warn(`[task-val-sync] Failed to write checkpoint for ${pipeline}:`, err.message);
  }
}

/**
 * Reset the consecutive failures counter to 0 (called on successful fetch, even with 0 results).
 */
async function resetFailures(pipeline: string): Promise<void> {
  try {
    const db = await requireDb();
    const [row] = await db
      .select()
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.pipeline, pipeline))
      .limit(1);
    if (row && row.consecutiveFailures > 0) {
      await db
        .update(syncCheckpoints)
        .set({ consecutiveFailures: 0 })
        .where(eq(syncCheckpoints.pipeline, pipeline));
    }
  } catch (err: any) {
    console.warn(`[task-val-sync] Failed to reset failures for ${pipeline}:`, err.message);
  }
}

/**
 * Increment the consecutive failures counter in MySQL.
 */
async function incrementFailures(pipeline: string): Promise<void> {
  try {
    const db = await requireDb();
    const [row] = await db
      .select()
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.pipeline, pipeline))
      .limit(1);
    const current = row?.consecutiveFailures || 0;
    await db
      .insert(syncCheckpoints)
      .values({
        pipeline,
        lastSuccessfulSync: new Date(Date.now() - FALLBACK_LOOKBACK_MS),
        consecutiveFailures: current + 1,
      })
      .onDuplicateKeyUpdate({
        set: { consecutiveFailures: current + 1 },
      });
  } catch (err: any) {
    console.warn(`[task-val-sync] Failed to increment failures for ${pipeline}:`, err.message);
  }
}

export interface TaskValidationSyncResult {
  tasks: { fetched: number; upserted: number; skipped: number; failed: number; errors: string[] };
  validation: { fetched: number; upserted: number; skipped: number; failed: number; errors: string[] };
  durationMs: number;
}

// ── Upsert helpers ─────────────────────────────────────────────────────────────

/**
 * Version-check upsert for task completions.
 * Skip if notionLastEdited already matches the incoming last_edited_time.
 */
async function upsertTaskCompletion(row: NotionTaskRow): Promise<"inserted" | "updated" | "skipped"> {
  const db = await requireDb();
  const flags = statusToTaskFlags(row.status);
  const notionTimestamp = coerceNotionDate(row.lastEdited, "task lastEdited");
  const completedAt = coerceNotionDate(row.completedAt, "task completedAt");

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

  if (existing) {
    // Version check: if notionLastEdited matches, we already processed this version
    if (
      existing.notionLastEdited &&
      notionTimestamp &&
      existing.notionLastEdited.getTime() === notionTimestamp.getTime()
    ) {
      return "skipped";
    }

    const payload = {
      sectionName: row.sectionName || existing.sectionName || "",
      completed: flags.completed,
      inProgress: flags.inProgress,
      blocked: flags.blocked,
      notApplicable: flags.notApplicable,
      completedAt,
      completedBy: row.completedBy || null,
      targetDate: row.targetDate || null,
      notes: row.notes || null,
      notionLastEdited: notionTimestamp,
    };

    await db
      .update(taskCompletion)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(taskCompletion.id, existing.id));
    return "updated";
  } else {
    // New row — always insert
    await db.insert(taskCompletion).values({
      organizationId: row.organizationId,
      taskId: row.taskKey,
      sectionName: row.sectionName || "",
      completed: flags.completed,
      inProgress: flags.inProgress,
      blocked: flags.blocked,
      notApplicable: flags.notApplicable,
      completedAt,
      completedBy: row.completedBy || null,
      targetDate: row.targetDate || null,
      notes: row.notes || null,
      notionLastEdited: notionTimestamp,
    });
    return "inserted";
  }
}

/**
 * Version-check upsert for validation results.
 * Skip if notionLastEdited already matches the incoming last_edited_time.
 */
async function upsertValidationResult(row: NotionValidationRow): Promise<"inserted" | "updated" | "skipped"> {
  const db = await requireDb();
  const notionTimestamp = coerceNotionDate(row.lastEdited, "validation lastEdited");
  const status = coerceValidationStatus(row.status);

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

  if (existing) {
    // Version check: if notionLastEdited matches, we already processed this version
    if (
      existing.notionLastEdited &&
      notionTimestamp &&
      existing.notionLastEdited.getTime() === notionTimestamp.getTime()
    ) {
      return "skipped";
    }

    const payload = {
      actual: row.actual || null,
      status,
      signOff: row.signOff || null,
      notes: row.notes || null,
      testedDate: row.testedDate || null,
      updatedBy: row.updatedBy || null,
      notionLastEdited: notionTimestamp,
    };

    await db
      .update(validationResults)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(validationResults.id, existing.id));
    return "updated";
  } else {
    // New row — always insert
    await db.insert(validationResults).values({
      organizationId: row.organizationId,
      testKey: row.testKey,
      actual: row.actual || null,
      status,
      signOff: row.signOff || null,
      notes: row.notes || null,
      testedDate: row.testedDate || null,
      updatedBy: row.updatedBy || null,
      notionLastEdited: notionTimestamp,
    });
    return "inserted";
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
    tasks: { fetched: 0, upserted: 0, skipped: 0, failed: 0, errors: [] },
    validation: { fetched: 0, upserted: 0, skipped: 0, failed: 0, errors: [] },
    durationMs: 0,
  };

  // Read checkpoints from MySQL (persisted across restarts)
  const lastTaskSyncTime = await readSyncCheckpoint(TASK_PIPELINE);
  const lastValidationSyncTime = await readSyncCheckpoint(VALIDATION_PIPELINE);

  // ── Task Completions ──────────────────────────────────────────────────────
  try {
    const taskRows = await fetchChangedTaskCompletions(lastTaskSyncTime);
    result.tasks.fetched = taskRows.length;

    for (const row of taskRows) {
      try {
        const action = await upsertTaskCompletion(row);
        if (action === "skipped") {
          result.tasks.skipped++;
        } else {
          result.tasks.upserted++;
        }
      } catch (err: any) {
        result.tasks.failed++;
        result.tasks.errors.push(`${row.taskKey}: ${err.message?.substring(0, 80)}`);
        console.error(`[task-val-sync] Task upsert failed for ${row.taskKey} (org ${row.organizationId}):`, err.message);
      }
    }

    // Mark source AFTER all upserts succeed, then advance checkpoint past the marks
    if (result.tasks.failed === 0 && taskRows.length > 0) {
      for (const row of taskRows) {
        await markLastUpdatedFrom(row.pageId);
      }
      // Checkpoint = NOW (after markLastUpdatedFrom bumped last_edited_time)
      // This ensures the checkpoint is AFTER the mark writes, preventing re-fetch
      await writeSyncCheckpoint(TASK_PIPELINE, new Date().toISOString());
    } else if (result.tasks.failed > 0) {
      await incrementFailures(TASK_PIPELINE);
    } else {
      // Fetch succeeded with 0 results — reset failure counter if it was elevated
      await resetFailures(TASK_PIPELINE);
    }
  } catch (err: any) {
    result.tasks.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
    console.error(`[task-val-sync] Task completions fetch/sync error:`, err.message, err.stack?.substring(0, 200));
    await incrementFailures(TASK_PIPELINE);
  }

  // ── Validation Results ────────────────────────────────────────────────────
  try {
    const valRows = await fetchChangedValidationResults(lastValidationSyncTime);
    result.validation.fetched = valRows.length;

    for (const row of valRows) {
      try {
        const action = await upsertValidationResult(row);
        if (action === "skipped") {
          result.validation.skipped++;
        } else {
          result.validation.upserted++;
        }
      } catch (err: any) {
        result.validation.failed++;
        result.validation.errors.push(`${row.testKey}: ${err.message?.substring(0, 80)}`);
        console.error(`[task-val-sync] Validation upsert failed for ${row.testKey} (org ${row.organizationId}):`, err.message);
      }
    }

    // Mark source AFTER all upserts succeed, then advance checkpoint past the marks
    if (result.validation.failed === 0 && valRows.length > 0) {
      for (const row of valRows) {
        await markLastUpdatedFrom(row.pageId);
      }
      // Checkpoint = NOW (after markLastUpdatedFrom bumped last_edited_time)
      await writeSyncCheckpoint(VALIDATION_PIPELINE, new Date().toISOString());
    } else if (result.validation.failed > 0) {
      await incrementFailures(VALIDATION_PIPELINE);
    } else {
      // Fetch succeeded with 0 results — reset failure counter if it was elevated
      await resetFailures(VALIDATION_PIPELINE);
    }
  } catch (err: any) {
    result.validation.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
    console.error(`[task-val-sync] Validation results fetch/sync error:`, err.message, err.stack?.substring(0, 200));
    await incrementFailures(VALIDATION_PIPELINE);
  }

  result.durationMs = Date.now() - startTime;

  const totalUpserted = result.tasks.upserted + result.validation.upserted;
  const totalSkipped = result.tasks.skipped + result.validation.skipped;
  const totalFailed = result.tasks.failed + result.validation.failed;
  if (totalUpserted > 0 || totalFailed > 0 || totalSkipped > 0) {
    console.log(
      `[cron] Task/Validation sync-back — tasks: ${result.tasks.upserted} written/${result.tasks.skipped} skipped/${result.tasks.fetched} fetched, ` +
      `validation: ${result.validation.upserted} written/${result.validation.skipped} skipped/${result.validation.fetched} fetched, ` +
      `${totalFailed} failed (${result.durationMs}ms)`
    );
  } else {
    console.log(`[cron] Task/Validation sync-back — 0 changes found (${result.durationMs}ms)`);
  }

  return result;
}
