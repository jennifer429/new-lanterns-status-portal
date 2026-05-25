/**
 * Notion → MySQL Sync-Back for Task Completions and Validation Results
 *
 * Polls Notion for rows edited since the last sync checkpoint and upserts
 * them into MySQL. Checkpoints are persisted to the `syncCheckpoints` MySQL
 * table so they survive server restarts without depending on Notion page access.
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
      .set({ ...payload, updatedAt: new Date() })
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
      .set({ ...payload, updatedAt: new Date() })
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

  // Read checkpoints from MySQL (persisted across restarts)
  const lastTaskSyncTime = await readSyncCheckpoint(TASK_PIPELINE);
  const lastValidationSyncTime = await readSyncCheckpoint(VALIDATION_PIPELINE);

  // ── Task Completions ──────────────────────────────────────────────────────
  try {
    const allTaskRows = await fetchChangedTaskCompletions(lastTaskSyncTime);
    // Filter out rows where "Last Updated From" = "Notion" AND the row's last_edited_time
    // is within 2 minutes of when we last wrote (our own markLastUpdatedFrom echo).
    // But always process rows that are genuinely out of sync.
    const taskRows = allTaskRows.filter(row => row.lastUpdatedFrom !== "Notion");
    result.tasks.fetched = taskRows.length;

    for (const row of taskRows) {
      try {
        await upsertTaskCompletion(row);
        result.tasks.upserted++;
      } catch (err: any) {
        result.tasks.failed++;
        result.tasks.errors.push(`${row.taskKey}: ${err.message?.substring(0, 80)}`);
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
    } else if (result.tasks.failed === 0 && allTaskRows.length > 0 && taskRows.length === 0) {
      // All rows were filtered (already marked "Notion") — still advance checkpoint
      await writeSyncCheckpoint(TASK_PIPELINE, new Date().toISOString());
    } else if (result.tasks.failed > 0) {
      await incrementFailures(TASK_PIPELINE);
    }
  } catch (err: any) {
    result.tasks.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
    await incrementFailures(TASK_PIPELINE);
  }

  // ── Validation Results ────────────────────────────────────────────────────
  try {
    const allValRows = await fetchChangedValidationResults(lastValidationSyncTime);
    const valRows = allValRows.filter(row => row.lastUpdatedFrom !== "Notion");
    result.validation.fetched = valRows.length;

    for (const row of valRows) {
      try {
        await upsertValidationResult(row);
        result.validation.upserted++;
      } catch (err: any) {
        result.validation.failed++;
        result.validation.errors.push(`${row.testKey}: ${err.message?.substring(0, 80)}`);
      }
    }

    // Mark source AFTER all upserts succeed, then advance checkpoint past the marks
    if (result.validation.failed === 0 && valRows.length > 0) {
      for (const row of valRows) {
        await markLastUpdatedFrom(row.pageId);
      }
      // Checkpoint = NOW (after markLastUpdatedFrom bumped last_edited_time)
      await writeSyncCheckpoint(VALIDATION_PIPELINE, new Date().toISOString());
    } else if (result.validation.failed === 0 && allValRows.length > 0 && valRows.length === 0) {
      // All rows were filtered — still advance checkpoint
      await writeSyncCheckpoint(VALIDATION_PIPELINE, new Date().toISOString());
    } else if (result.validation.failed > 0) {
      await incrementFailures(VALIDATION_PIPELINE);
    }
  } catch (err: any) {
    result.validation.errors.push(`Fetch error: ${err.message?.substring(0, 100)}`);
    await incrementFailures(VALIDATION_PIPELINE);
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
