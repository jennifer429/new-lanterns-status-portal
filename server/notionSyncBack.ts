/**
 * Notion → MySQL Periodic Sync-Back Job
 *
 * Runs every 5 minutes. Queries Notion for questionnaire rows edited since
 * the last successful sync, and upserts their answers into MySQL.
 *
 * State is tracked entirely in Notion:
 *   - Sync Config page: last successful sync timestamp, consecutive failures, enabled flag
 *   - Sync Log database: one row per run with status, counts, errors, duration
 *
 * Safeguards:
 *   - Skips rows where Notion answer is empty but MySQL answer is non-empty (prevents blanking)
 *   - Sets updatedBy = "notion-sync@system" so edits are auditable
 *   - Notifies owner after 3+ consecutive failures
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { intakeResponses, organizations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { generateAnswerSummary } from "./notionSummary";

const QUESTIONNAIRE_DATA_SOURCE_ID = ENV.notionDataSourceId || "";
const SYNC_LOG_DATABASE_ID = ENV.notionSyncLogDataSourceId || "";
// Sync Config uses pages.retrieve/update (page_id), no data_source needed
const SYNC_CONFIG_PAGE_ID = ENV.notionSyncConfigPageId || "";

const MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT = 3;

interface SyncResult {
  status: "Success" | "Partial" | "Failed" | "Skipped";
  rowsFetched: number;
  rowsUpdated: number;
  rowsFailed: number;
  rowsSkipped: number;
  durationMs: number;
  errorDetails: string;
}

/**
 * Get the Notion client for sync operations.
 */
function getSyncClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  return new Client({ auth: ENV.notionApiKey });
}

/**
 * Read the sync config from Notion.
 */
async function readSyncConfig(client: Client): Promise<{
  lastSuccessfulSync: string | null;
  consecutiveFailures: number;
  enabled: boolean;
}> {
  if (!SYNC_CONFIG_PAGE_ID) {
    return { lastSuccessfulSync: null, consecutiveFailures: 0, enabled: false };
  }

  try {
    const page = await client.pages.retrieve({ page_id: SYNC_CONFIG_PAGE_ID }) as any;
    const props = page.properties;

    const lastSync = props?.["Last Successful Sync"]?.date?.start || null;
    const failures = props?.["Consecutive Failures"]?.number || 0;
    const enabled = props?.["Enabled"]?.checkbox ?? false;

    return { lastSuccessfulSync: lastSync, consecutiveFailures: failures, enabled };
  } catch (error) {
    console.error("[notion-sync] Failed to read sync config:", error);
    return { lastSuccessfulSync: null, consecutiveFailures: 0, enabled: false };
  }
}

/**
 * Update the sync config page in Notion.
 */
async function updateSyncConfig(
  client: Client,
  updates: {
    lastSuccessfulSync?: string;
    consecutiveFailures?: number;
  }
): Promise<void> {
  if (!SYNC_CONFIG_PAGE_ID) return;

  const properties: any = {};

  if (updates.lastSuccessfulSync !== undefined) {
    properties["Last Successful Sync"] = {
      date: { start: updates.lastSuccessfulSync },
    };
  }

  if (updates.consecutiveFailures !== undefined) {
    properties["Consecutive Failures"] = {
      number: updates.consecutiveFailures,
    };
  }

  try {
    await client.pages.update({ page_id: SYNC_CONFIG_PAGE_ID, properties });
  } catch (error) {
    console.error("[notion-sync] Failed to update sync config:", error);
  }
}

/**
 * Write a log entry to the Sync Log database.
 */
async function writeSyncLog(client: Client, result: SyncResult): Promise<void> {
  if (!SYNC_LOG_DATABASE_ID) return;

  try {
    const now = new Date().toISOString();
    const runLabel = `Sync ${now.slice(0, 16).replace("T", " ")}`;

    await client.pages.create({
      parent: { database_id: SYNC_LOG_DATABASE_ID },
      properties: {
        "Run": { title: [{ text: { content: runLabel } }] },
        "Timestamp": { date: { start: now } },
        "Status": { select: { name: result.status } },
        "Rows Fetched": { number: result.rowsFetched },
        "Rows Updated": { number: result.rowsUpdated },
        "Rows Failed": { number: result.rowsFailed },
        "Rows Skipped": { number: result.rowsSkipped },
        "Duration Ms": { number: result.durationMs },
        "Error Details": {
          rich_text: result.errorDetails
            ? [{ text: { content: result.errorDetails.substring(0, 2000) } }]
            : [],
        },
      },
    });
  } catch (error) {
    console.error("[notion-sync] Failed to write sync log:", error);
  }
}

/**
 * Query Notion for questionnaire rows edited since a given timestamp.
 * Uses the dataSources.query API with a last_edited_time filter.
 */
async function fetchChangedRows(
  client: Client,
  since: string
): Promise<Array<{ pageId: string; slug: string; questionId: string; answer: string; lastEdited: string }>> {
  if (!QUESTIONNAIRE_DATA_SOURCE_ID) return [];

  const results: Array<{ pageId: string; slug: string; questionId: string; answer: string; lastEdited: string }> = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const queryParams: any = {
        data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: { after: since },
        },
        page_size: 100,
      };
      if (cursor) queryParams.start_cursor = cursor;
      const response: any = await (client as any).dataSources.query(queryParams);

      for (const page of response.results) {
        const props = page.properties;
        const slug = props?.["Slug"]?.rich_text?.[0]?.plain_text || 
                     props?.["Institution Group"]?.select?.name || "";
        const questionId = props?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
        const answer = props?.["Answer"]?.rich_text?.[0]?.plain_text || "";
        const lastEdited = page.last_edited_time || "";

        if (slug && questionId) {
          results.push({ pageId: page.id, slug, questionId, answer, lastEdited });
        }
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[notion-sync] Error fetching changed rows:", error);
    throw error;
  }

  return results;
}

/**
 * Look up the organization ID from a slug.
 */
async function getOrgIdBySlug(slug: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org?.id ?? null;
}

/**
 * Get the current MySQL answer for an org+question.
 */
async function getMySqlAnswer(orgId: number, questionId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ response: intakeResponses.response })
    .from(intakeResponses)
    .where(
      and(
        eq(intakeResponses.organizationId, orgId),
        eq(intakeResponses.questionId, questionId)
      )
    )
    .limit(1);
  return row?.response ?? null;
}

/**
 * Upsert an answer into MySQL from Notion.
 */
async function upsertAnswer(orgId: number, questionId: string, answer: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  const [existing] = await db
    .select({ id: intakeResponses.id })
    .from(intakeResponses)
    .where(
      and(
        eq(intakeResponses.organizationId, orgId),
        eq(intakeResponses.questionId, questionId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(intakeResponses)
      .set({
        response: answer,
        updatedAt: now,
        updatedBy: "notion-sync@system",
      })
      .where(eq(intakeResponses.id, existing.id));
  } else {
    await db.insert(intakeResponses).values({
      organizationId: orgId,
      questionId,
      section: "synced",
      response: answer,
      status: "complete",
      updatedBy: "notion-sync@system",
    });
  }
}

/**
 * Main sync-back function. Called by the cron scheduler.
 */
export async function runNotionSyncBack(): Promise<SyncResult> {
  const startTime = Date.now();
  const client = getSyncClient();

  if (!client || !QUESTIONNAIRE_DATA_SOURCE_ID) {
    const result: SyncResult = {
      status: "Skipped",
      rowsFetched: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      rowsSkipped: 0,
      durationMs: Date.now() - startTime,
      errorDetails: "Notion credentials or database ID not configured",
    };
    console.log("[notion-sync] Skipped — not configured");
    return result;
  }

  // Read config
  const config = await readSyncConfig(client);
  if (!config.enabled) {
    const result: SyncResult = {
      status: "Skipped",
      rowsFetched: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      rowsSkipped: 0,
      durationMs: Date.now() - startTime,
      errorDetails: "Sync is disabled in config",
    };
    console.log("[notion-sync] Skipped — disabled in config");
    return result;
  }

  // Default to 10 minutes ago if no last sync
  const since = config.lastSuccessfulSync || new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let rowsFetched = 0;
  let rowsUpdated = 0;
  let rowsFailed = 0;
  let rowsSkipped = 0;
  const errors: string[] = [];

  try {
    // Fetch changed rows from Notion
    const changedRows = await fetchChangedRows(client, since);
    rowsFetched = changedRows.length;

    if (rowsFetched === 0) {
      const result: SyncResult = {
        status: "Success",
        rowsFetched: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        rowsSkipped: 0,
        durationMs: Date.now() - startTime,
        errorDetails: "",
      };

      // Update last sync time even if no changes
      await updateSyncConfig(client, {
        lastSuccessfulSync: new Date().toISOString(),
        consecutiveFailures: 0,
      });
      await writeSyncLog(client, result);
      console.log("[notion-sync] Success — 0 changes found");
      return result;
    }

    // Process each changed row
    for (const row of changedRows) {
      try {
        const orgId = await getOrgIdBySlug(row.slug);
        if (!orgId) {
          errors.push(`Org not found for slug: ${row.slug}`);
          rowsFailed++;
          continue;
        }

        // SAFEGUARD: Don't overwrite non-empty MySQL answers with empty Notion answers
        if (!row.answer || row.answer.trim() === "") {
          const currentAnswer = await getMySqlAnswer(orgId, row.questionId);
          if (currentAnswer && currentAnswer.trim() !== "") {
            rowsSkipped++;
            continue;
          }
        }

        await upsertAnswer(orgId, row.questionId, row.answer);
        rowsUpdated++;

        // Regenerate Summary column in Notion for JSON answers
        const summary = generateAnswerSummary(row.answer);
        if (summary) {
          try {
            await client.pages.update({
              page_id: row.pageId,
              properties: {
                "Summary": { rich_text: [{ text: { content: summary.substring(0, 2000) } }] },
              },
            });
          } catch (summaryErr: any) {
            // Non-fatal: log but don't fail the sync
            console.warn(`[notion-sync] Failed to update Summary for ${row.slug}/${row.questionId}:`, summaryErr.message);
          }
        }
      } catch (error: any) {
        errors.push(`${row.slug}/${row.questionId}: ${error.message}`);
        rowsFailed++;
      }
    }

    // Determine status
    let status: SyncResult["status"] = "Success";
    if (rowsFailed > 0 && rowsUpdated === 0) {
      status = "Failed";
    } else if (rowsFailed > 0) {
      status = "Partial";
    }

    const result: SyncResult = {
      status,
      rowsFetched,
      rowsUpdated,
      rowsFailed,
      rowsSkipped,
      durationMs: Date.now() - startTime,
      errorDetails: errors.join("\n"),
    };

    // Update config
    if (status === "Failed") {
      const newFailures = config.consecutiveFailures + 1;
      await updateSyncConfig(client, { consecutiveFailures: newFailures });

      // Alert owner if too many failures
      if (newFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT) {
        await notifyOwner({
          title: "⚠️ Notion Sync Failing",
          content: `The Notion→MySQL sync has failed ${newFailures} consecutive times.\n\nLatest errors:\n${errors.slice(0, 5).join("\n")}`,
        });
      }
    } else {
      await updateSyncConfig(client, {
        lastSuccessfulSync: new Date().toISOString(),
        consecutiveFailures: 0,
      });
    }

    await writeSyncLog(client, result);
    console.log(
      `[notion-sync] ${status} — fetched: ${rowsFetched}, updated: ${rowsUpdated}, failed: ${rowsFailed}, skipped: ${rowsSkipped}`
    );
    return result;
  } catch (error: any) {
    const newFailures = config.consecutiveFailures + 1;
    const result: SyncResult = {
      status: "Failed",
      rowsFetched,
      rowsUpdated,
      rowsFailed: rowsFailed + 1,
      rowsSkipped,
      durationMs: Date.now() - startTime,
      errorDetails: error.message || String(error),
    };

    try {
      await updateSyncConfig(client, { consecutiveFailures: newFailures });
      await writeSyncLog(client, result);

      if (newFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT) {
        await notifyOwner({
          title: "⚠️ Notion Sync Failing",
          content: `The Notion→MySQL sync has failed ${newFailures} consecutive times.\n\nError: ${error.message}`,
        });
      }
    } catch (logError) {
      console.error("[notion-sync] Failed to write failure log:", logError);
    }

    console.error("[notion-sync] Failed:", error.message);
    return result;
  }
}

/**
 * Get current sync health status (for the health check endpoint).
 */
export async function getSyncHealth(): Promise<{
  enabled: boolean;
  lastSuccessfulSync: string | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}> {
  const client = getSyncClient();
  if (!client) {
    return { enabled: false, lastSuccessfulSync: null, consecutiveFailures: 0, isHealthy: false };
  }

  const config = await readSyncConfig(client);
  const isHealthy = config.enabled && config.consecutiveFailures < MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT;

  return {
    enabled: config.enabled,
    lastSuccessfulSync: config.lastSuccessfulSync,
    consecutiveFailures: config.consecutiveFailures,
    isHealthy,
  };
}
