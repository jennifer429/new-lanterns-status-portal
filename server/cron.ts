/**
 * Cron Job Registry
 *
 * Registers all periodic jobs using node-cron.
 * Called once at server startup.
 *
 * Strategy:
 *   - Sync every 5 minutes (questionnaire + contacts/systems)
 *   - Log aggregated stats to Notion Sync Log hourly (not every run)
 *   - Purge Sync Log entries older than 7 days every 3 days
 */

import cron from "node-cron";
import { Client } from "@notionhq/client";
import { runNotionSyncBack } from "./notionSyncBack";
import { runContactsSystemsSync } from "./notionSyncContacts";
import { ENV } from "./_core/env";

const SYNC_LOG_DATABASE_ID = ENV.notionSyncLogDataSourceId || "";
const PURGE_AGE_DAYS = 7;

// ── Hourly aggregation accumulators ─────────────────────────────────────────

interface HourlyStats {
  runs: number;
  questionnaire: { fetched: number; updated: number; failed: number; skipped: number };
  contacts: { fetched: number; upserted: number; failed: number };
  systems: { fetched: number; upserted: number; failed: number };
  errors: string[];
  totalDurationMs: number;
}

let hourlyStats: HourlyStats = resetHourlyStats();

function resetHourlyStats(): HourlyStats {
  return {
    runs: 0,
    questionnaire: { fetched: 0, updated: 0, failed: 0, skipped: 0 },
    contacts: { fetched: 0, upserted: 0, failed: 0 },
    systems: { fetched: 0, upserted: 0, failed: 0 },
    errors: [],
    totalDurationMs: 0,
  };
}

// ── Sync Log writer ─────────────────────────────────────────────────────────

async function writeHourlySyncLog(stats: HourlyStats): Promise<void> {
  if (!ENV.notionApiKey || !SYNC_LOG_DATABASE_ID) return;
  if (stats.runs === 0) return; // nothing to log

  const client = new Client({ auth: ENV.notionApiKey });
  const now = new Date().toISOString();
  const hourLabel = now.slice(0, 13).replace("T", " ") + ":00"; // e.g. "2026-05-20 10:00"

  const totalFailed = stats.questionnaire.failed + stats.contacts.failed + stats.systems.failed;
  const totalUpdated = stats.questionnaire.updated + stats.contacts.upserted + stats.systems.upserted;
  const totalFetched = stats.questionnaire.fetched + stats.contacts.fetched + stats.systems.fetched;

  const status = totalFailed > 0 ? (totalUpdated > 0 ? "Partial" : "Failed") : "Success";

  const details = [
    `Runs: ${stats.runs}`,
    `Questionnaire: ${stats.questionnaire.updated} updated, ${stats.questionnaire.failed} failed, ${stats.questionnaire.skipped} skipped`,
    `Contacts: ${stats.contacts.upserted} upserted, ${stats.contacts.failed} failed`,
    `Systems: ${stats.systems.upserted} upserted, ${stats.systems.failed} failed`,
    ...(stats.errors.length > 0 ? [`Errors: ${stats.errors.slice(0, 5).join("; ")}`] : []),
  ].join("\n");

  try {
    await client.pages.create({
      parent: { database_id: SYNC_LOG_DATABASE_ID },
      properties: {
        "Run": { title: [{ text: { content: `Hourly Summary ${hourLabel}` } }] },
        "Timestamp": { date: { start: now } },
        "Status": { select: { name: status } },
        "Rows Fetched": { number: totalFetched },
        "Rows Updated": { number: totalUpdated },
        "Rows Failed": { number: totalFailed },
        "Rows Skipped": { number: stats.questionnaire.skipped },
        "Duration Ms": { number: stats.totalDurationMs },
        "Error Details": {
          rich_text: [{ text: { content: details.substring(0, 2000) } }],
        },
      },
    });
    console.log(`[cron] Hourly sync log written — ${status} (${stats.runs} runs, ${totalUpdated} updated, ${totalFailed} failed)`);
  } catch (error) {
    console.error("[cron] Failed to write hourly sync log:", error);
  }
}

// ── Purge old Sync Log entries ──────────────────────────────────────────────

async function purgeSyncLogEntries(): Promise<void> {
  if (!ENV.notionApiKey || !SYNC_LOG_DATABASE_ID) return;

  const client = new Client({ auth: ENV.notionApiKey });
  const cutoffDate = new Date(Date.now() - PURGE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let cursor: string | undefined;
  let archived = 0;

  try {
    do {
      const params: any = {
        data_source_id: SYNC_LOG_DATABASE_ID,
        filter: {
          property: "Timestamp",
          date: { before: cutoffDate },
        },
        page_size: 100,
      };
      if (cursor) params.start_cursor = cursor;

      const response: any = await (client as any).dataSources.query(params);

      for (const page of response.results) {
        try {
          await client.pages.update({ page_id: page.id, archived: true });
          archived++;
        } catch (e: any) {
          // Skip individual failures
        }
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    console.log(`[cron] Purged ${archived} sync log entries older than ${PURGE_AGE_DAYS} days`);
  } catch (error) {
    console.error("[cron] Sync log purge failed:", error);
  }
}

// ── Cron registration ───────────────────────────────────────────────────────

/**
 * Start all cron jobs. Call this once from the server entry point.
 */
export function startCronJobs(): void {
  // Questionnaire Notion → MySQL sync: every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    const start = Date.now();
    try {
      const result = await runNotionSyncBack();
      hourlyStats.runs++;
      hourlyStats.questionnaire.fetched += result.rowsFetched;
      hourlyStats.questionnaire.updated += result.rowsUpdated;
      hourlyStats.questionnaire.failed += result.rowsFailed;
      hourlyStats.questionnaire.skipped += result.rowsSkipped;
      hourlyStats.totalDurationMs += Date.now() - start;
      if (result.errorDetails) {
        hourlyStats.errors.push(`Q: ${result.errorDetails.substring(0, 100)}`);
      }
    } catch (error: any) {
      hourlyStats.errors.push(`Q: ${error.message?.substring(0, 100)}`);
      console.error("[cron] Notion questionnaire sync-back failed:", error);
    }
  });

  // Contacts & Systems Notion → MySQL sync: every 5 minutes (offset by 2 min)
  cron.schedule("2,7,12,17,22,27,32,37,42,47,52,57 * * * *", async () => {
    const start = Date.now();
    try {
      const result = await runContactsSystemsSync();
      hourlyStats.contacts.fetched += result.contacts.fetched;
      hourlyStats.contacts.upserted += result.contacts.upserted;
      hourlyStats.contacts.failed += result.contacts.failed;
      hourlyStats.systems.fetched += result.systems.fetched;
      hourlyStats.systems.upserted += result.systems.upserted;
      hourlyStats.systems.failed += result.systems.failed;
      hourlyStats.totalDurationMs += Date.now() - start;
      if (result.contacts.errors.length > 0) {
        hourlyStats.errors.push(`C: ${result.contacts.errors[0].substring(0, 80)}`);
      }
      if (result.systems.errors.length > 0) {
        hourlyStats.errors.push(`S: ${result.systems.errors[0].substring(0, 80)}`);
      }
      console.log(
        `[cron] Contacts/Systems sync — contacts: ${result.contacts.upserted} upserted / ${result.contacts.failed} failed, ` +
        `systems: ${result.systems.upserted} upserted / ${result.systems.failed} failed`
      );
    } catch (error: any) {
      hourlyStats.errors.push(`CS: ${error.message?.substring(0, 100)}`);
      console.error("[cron] Contacts/Systems sync failed:", error);
    }
  });

  // Hourly: flush aggregated stats to Notion Sync Log
  cron.schedule("0 * * * *", async () => {
    try {
      const statsToFlush = { ...hourlyStats };
      hourlyStats = resetHourlyStats();
      await writeHourlySyncLog(statsToFlush);
    } catch (error) {
      console.error("[cron] Hourly sync log flush failed:", error);
    }
  });

  // Purge old Sync Log entries: every 3 days at 3:00 AM
  cron.schedule("0 3 */3 * *", async () => {
    try {
      await purgeSyncLogEntries();
    } catch (error) {
      console.error("[cron] Sync log purge failed:", error);
    }
  });

  console.log("[cron] Registered: Notion sync-back (every 5 minutes)");
  console.log("[cron] Registered: Contacts/Systems sync (every 5 minutes, offset +2)");
  console.log("[cron] Registered: Hourly sync log flush");
  console.log("[cron] Registered: Sync log purge (every 3 days at 3:00 AM, entries > 7 days)");
}
