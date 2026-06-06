/**
 * Cron Job Registry
 *
 * Registers all periodic jobs using node-cron.
 * Called once at server startup.
 *
 * Notion Sync Log strategy:
 *   - Hourly flush: only writes to Notion Sync Log on failure/partial (not success)
 *   - Reconciliation: writes to Notion Sync Log when out-of-sync rows are found
 *   - Daily summary: always writes once at midnight UTC (proof of life)
 *   - Purge: entries older than 7 days archived every 3 days
 */

import cron from "node-cron";
import { Client } from "@notionhq/client";
import { runNotionSyncBack } from "./notionSyncBack";
import { runContactsSystemsSync } from "./notionSyncContacts";
import { runTaskValidationSyncBack } from "./notionSyncBackTasks";
import { processRetryQueue } from "./notionRetryQueue";
import { runReconciliation } from "./notionReconciliation";
import { runDataQualityCheck, type DataQualityResult } from "./dataQualityCheck";
import { runStartupRecovery } from "./startupRecovery";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";

const SYNC_LOG_DATABASE_ID = ENV.notionSyncLogDataSourceId || "";
const PURGE_AGE_DAYS = 7;

// ── Last Synced Timestamps ─────────────────────────────────────────────────

export interface LastSyncedTimestamps {
  questionnaire: string | null;
  contactsSystems: string | null;
  taskValidation: string | null;
  lastFullSync: string | null;
}

const lastSynced: LastSyncedTimestamps = {
  questionnaire: null,
  contactsSystems: null,
  taskValidation: null,
  lastFullSync: null,
};

/** Get the last successful sync timestamps for all jobs. */
export function getLastSyncedTimestamps(): LastSyncedTimestamps {
  return { ...lastSynced };
}

// Track whether we already sent a staleness alert (avoid spamming)
let stalenessAlertSent = false;
const STALENESS_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/** Check if sync is stale and notify owner. Resets when sync recovers. */
function checkStalenessAndNotify(): void {
  const timestamps = [
    lastSynced.questionnaire,
    lastSynced.contactsSystems,
    lastSynced.taskValidation,
  ].filter(Boolean) as string[];

  // If no sync has ever completed, skip (server just started)
  if (timestamps.length === 0) return;

  const latest = Math.max(...timestamps.map(t => new Date(t).getTime()));
  const ageMs = Date.now() - latest;

  if (ageMs > STALENESS_THRESHOLD_MS && !stalenessAlertSent) {
    stalenessAlertSent = true;
    const minutesAgo = Math.floor(ageMs / 60000);
    notifyOwner({
      title: "\u26a0\ufe0f Sync Stale Alert",
      content: `Notion sync has not completed successfully in ${minutesAgo} minutes. ` +
        `Last successful sync: ${new Date(latest).toISOString()}. ` +
        `Portal data may be out of date. Check server logs for errors.`,
    }).catch(err => console.error("[cron] Failed to send staleness alert:", err));
    console.warn(`[cron] STALENESS ALERT: sync is ${minutesAgo} minutes stale`);
  } else if (ageMs <= STALENESS_THRESHOLD_MS && stalenessAlertSent) {
    // Sync recovered — reset alert flag
    stalenessAlertSent = false;
    console.log("[cron] Sync recovered from staleness");
  }
}

// ── Hourly aggregation accumulators ─────────────────────────────────────────

interface HourlyStats {
  runs: number;
  questionnaire: { fetched: number; updated: number; failed: number; skipped: number };
  contacts: { fetched: number; upserted: number; failed: number };
  systems: { fetched: number; upserted: number; failed: number };
  tasks: { fetched: number; upserted: number; failed: number };
  validation: { fetched: number; upserted: number; failed: number };
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
    tasks: { fetched: 0, upserted: 0, failed: 0 },
    validation: { fetched: 0, upserted: 0, failed: 0 },
    errors: [],
    totalDurationMs: 0,
  };
}

// ── Daily aggregation accumulators ──────────────────────────────────────────

interface DailyStats {
  totalRuns: number;
  totalFetched: number;
  totalUpdated: number;
  totalFailed: number;
  totalSkipped: number;
  totalDurationMs: number;
  hoursWithFailures: number;
  reconciliationIssues: number;
}

let dailyStats: DailyStats = resetDailyStats();

function resetDailyStats(): DailyStats {
  return {
    totalRuns: 0,
    totalFetched: 0,
    totalUpdated: 0,
    totalFailed: 0,
    totalSkipped: 0,
    totalDurationMs: 0,
    hoursWithFailures: 0,
    reconciliationIssues: 0,
  };
}

// ── Notion Sync Log writers ─────────────────────────────────────────────────

/**
 * Write an entry to the Notion Sync Log database.
 * Used for: hourly failure logs, reconciliation issues, and daily summaries.
 */
async function writeToNotionSyncLog(entry: {
  runLabel: string;
  status: "Success" | "Partial" | "Failed";
  rowsFetched: number;
  rowsUpdated: number;
  rowsFailed: number;
  rowsSkipped: number;
  durationMs: number;
  errorDetails: string;
}): Promise<void> {
  if (!ENV.notionApiKey || !SYNC_LOG_DATABASE_ID) return;

  const client = new Client({ auth: ENV.notionApiKey });
  const now = new Date().toISOString();

  try {
    await client.pages.create({
      parent: { database_id: SYNC_LOG_DATABASE_ID },
      properties: {
        "Run": { title: [{ text: { content: entry.runLabel } }] },
        "Timestamp": { date: { start: now } },
        "Status": { select: { name: entry.status } },
        "Rows Fetched": { number: entry.rowsFetched },
        "Rows Updated": { number: entry.rowsUpdated },
        "Rows Failed": { number: entry.rowsFailed },
        "Rows Skipped": { number: entry.rowsSkipped },
        "Duration Ms": { number: entry.durationMs },
        "Error Details": {
          rich_text: entry.errorDetails
            ? [{ text: { content: entry.errorDetails.substring(0, 2000) } }]
            : [],
        },
      },
    });
  } catch (error) {
    console.error("[cron] Failed to write to Notion Sync Log:", error);
  }
}

/**
 * Hourly flush: only writes to Notion Sync Log if there were failures or partial results.
 * Skips writing entirely when everything was successful (reduces noise).
 */
async function writeHourlySyncLog(stats: HourlyStats): Promise<void> {
  if (stats.runs === 0) return; // nothing ran this hour

  const totalFailed = stats.questionnaire.failed + stats.contacts.failed + stats.systems.failed + stats.tasks.failed + stats.validation.failed;
  const totalUpdated = stats.questionnaire.updated + stats.contacts.upserted + stats.systems.upserted + stats.tasks.upserted + stats.validation.upserted;
  const totalFetched = stats.questionnaire.fetched + stats.contacts.fetched + stats.systems.fetched + stats.tasks.fetched + stats.validation.fetched;

  const status: "Success" | "Partial" | "Failed" = totalFailed > 0 ? (totalUpdated > 0 ? "Partial" : "Failed") : "Success";

  // Accumulate into daily stats
  dailyStats.totalRuns += stats.runs;
  dailyStats.totalFetched += totalFetched;
  dailyStats.totalUpdated += totalUpdated;
  dailyStats.totalFailed += totalFailed;
  dailyStats.totalSkipped += stats.questionnaire.skipped;
  dailyStats.totalDurationMs += stats.totalDurationMs;
  if (totalFailed > 0) dailyStats.hoursWithFailures++;

  // Only write to Notion on failure/partial — skip success (reduces noise)
  if (status === "Success") {
    console.log(`[cron] Hourly stats: ${stats.runs} runs, ${totalUpdated} updated, 0 failed — skipping Notion log (success)`);
    return;
  }

  const now = new Date().toISOString();
  const hourLabel = now.slice(0, 13).replace("T", " ") + ":00";

  const details = [
    `Runs: ${stats.runs}`,
    `Questionnaire: ${stats.questionnaire.updated} updated, ${stats.questionnaire.failed} failed, ${stats.questionnaire.skipped} skipped`,
    `Contacts: ${stats.contacts.upserted} upserted, ${stats.contacts.failed} failed`,
    `Systems: ${stats.systems.upserted} upserted, ${stats.systems.failed} failed`,
    `Tasks: ${stats.tasks.upserted} upserted, ${stats.tasks.failed} failed`,
    `Validation: ${stats.validation.upserted} upserted, ${stats.validation.failed} failed`,
    ...(stats.errors.length > 0 ? [`Errors: ${stats.errors.slice(0, 5).join("; ")}`] : []),
  ].join("\n");

  await writeToNotionSyncLog({
    runLabel: `⚠️ Hourly ${hourLabel}`,
    status,
    rowsFetched: totalFetched,
    rowsUpdated: totalUpdated,
    rowsFailed: totalFailed,
    rowsSkipped: stats.questionnaire.skipped,
    durationMs: stats.totalDurationMs,
    errorDetails: details,
  });

  console.log(`[cron] Hourly sync log written — ${status} (${stats.runs} runs, ${totalUpdated} updated, ${totalFailed} failed)`);
}

/**
 * Write reconciliation results to Notion Sync Log when issues are found.
 */
async function writeReconciliationToNotionLog(result: { checked: number; outOfSync: number; details?: string }): Promise<void> {
  if (result.outOfSync === 0) return; // Only log when there are issues

  dailyStats.reconciliationIssues += result.outOfSync;

  await writeToNotionSyncLog({
    runLabel: `🔄 Reconciliation: ${result.outOfSync} out of sync`,
    status: "Failed",
    rowsFetched: result.checked,
    rowsUpdated: 0,
    rowsFailed: result.outOfSync,
    rowsSkipped: 0,
    durationMs: 0,
    errorDetails: result.details || `${result.outOfSync} rows have >10min drift between MySQL and Notion`,
  });

  console.log(`[cron] Reconciliation logged to Notion — ${result.outOfSync} out of sync`);
}

/**
 * Run the data-quality check and surface findings.
 * Writes to the Notion Sync Log + notifies the owner only when there are
 * FAIL/WARN findings (a clean run is logged to the console and nowhere else,
 * consistent with the rest of the sync-log noise-reduction strategy).
 */
async function runAndReportDataQuality(): Promise<DataQualityResult> {
  const result = await runDataQualityCheck();
  const issues = result.failed + result.warnings;

  if (issues === 0) {
    console.log(`[cron] Data-quality check clean — ${result.passed} checks passed (${result.durationMs}ms)`);
    return result;
  }

  const failFindings = result.findings.filter((f) => f.status === "FAIL");
  const warnFindings = result.findings.filter((f) => f.status === "WARN");
  const detailLines = [...failFindings, ...warnFindings]
    .slice(0, 15)
    .map((f) => `${f.status === "FAIL" ? "❌" : "⚠️"} ${f.test}${f.detail ? " — " + f.detail : ""}`);
  const details = [
    `Passed: ${result.passed}`,
    `Failed: ${result.failed}`,
    `Warnings: ${result.warnings}`,
    "",
    ...detailLines,
  ].join("\n");

  await writeToNotionSyncLog({
    runLabel: `🩺 Data Quality — ${result.failed} fail / ${result.warnings} warn`,
    status: result.failed > 0 ? "Failed" : "Partial",
    rowsFetched: result.passed + result.failed + result.warnings,
    rowsUpdated: 0,
    rowsFailed: result.failed,
    rowsSkipped: result.warnings,
    durationMs: result.durationMs,
    errorDetails: details,
  });

  // Only page the owner on hard FAILs (a constraint-backed invariant broke).
  // WARN-only runs are typically transient Notion-cache orphans during sync.
  if (result.failed > 0) {
    notifyOwner({
      title: "🩺 Data Quality Check — FAIL findings",
      content:
        `The daily data-quality check found ${result.failed} FAIL and ${result.warnings} WARN finding(s).\n\n` +
        details +
        `\n\nSee drizzle/manual/README.md for cleanup guidance.`,
    }).catch((err) => console.error("[cron] Failed to send data-quality alert:", err));
  }

  console.warn(`[cron] Data-quality check found issues — ${result.failed} fail, ${result.warnings} warn`);
  return result;
}

/**
 * Daily summary: always writes once at midnight UTC.
 * Proof of life — confirms the system ran all day even if everything was healthy.
 */
async function writeDailySummary(): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const status: "Success" | "Partial" | "Failed" =
    dailyStats.totalFailed > 0
      ? (dailyStats.totalUpdated > 0 ? "Partial" : "Failed")
      : "Success";

  const details = [
    `Total runs: ${dailyStats.totalRuns}`,
    `Total fetched: ${dailyStats.totalFetched}`,
    `Total updated: ${dailyStats.totalUpdated}`,
    `Total failed: ${dailyStats.totalFailed}`,
    `Total skipped: ${dailyStats.totalSkipped}`,
    `Hours with failures: ${dailyStats.hoursWithFailures}`,
    `Reconciliation issues: ${dailyStats.reconciliationIssues}`,
    `Total duration: ${Math.round(dailyStats.totalDurationMs / 1000)}s`,
  ].join("\n");

  await writeToNotionSyncLog({
    runLabel: `📊 Daily Summary ${yesterday}`,
    status,
    rowsFetched: dailyStats.totalFetched,
    rowsUpdated: dailyStats.totalUpdated,
    rowsFailed: dailyStats.totalFailed,
    rowsSkipped: dailyStats.totalSkipped,
    durationMs: dailyStats.totalDurationMs,
    errorDetails: details,
  });

  console.log(`[cron] Daily summary written for ${yesterday} — ${status}`);

  // Reset daily stats for the new day
  dailyStats = resetDailyStats();
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
// ── Cron registration ─────────────────────────────────────────────────────────

let cronJobsRegistered = false;

/**
 * Start all cron jobs. Call this once from the server entry point.
 * Guarded against double-registration (e.g. during tsx watch hot-reload).
 */
export function startCronJobs(): void {
  if (cronJobsRegistered) {
    console.warn("[cron] startCronJobs called again — skipping (already registered)");
    return;
  }
  cronJobsRegistered = true;

  // Run startup recovery first: catch up on any unconfirmed rows before cron jobs begin
  runStartupRecovery()
    .then((stats) => {
      if (stats.tasksRecovered > 0 || stats.validationRecovered > 0) {
        console.log(
          `[cron] Startup recovery complete: ${stats.tasksRecovered} tasks + ` +
          `${stats.validationRecovered} validation results recovered`
        );
      }
    })
    .catch((err) => {
      console.error("[cron] Startup recovery failed:", err);
    });

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
      lastSynced.questionnaire = new Date().toISOString();
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
      lastSynced.contactsSystems = new Date().toISOString();
      console.log(
        `[cron] Contacts/Systems sync — contacts: ${result.contacts.upserted} upserted / ${result.contacts.failed} failed, ` +
        `systems: ${result.systems.upserted} upserted / ${result.systems.failed} failed`
      );
    } catch (error: any) {
      hourlyStats.errors.push(`CS: ${error.message?.substring(0, 100)}`);
      console.error("[cron] Contacts/Systems sync failed:", error);
    }
  });

  // Task Completions & Validation Results Notion → MySQL sync: every 5 minutes (offset by 3 min)
  cron.schedule("3,8,13,18,23,28,33,38,43,48,53,58 * * * *", async () => {
    const start = Date.now();
    try {
      const result = await runTaskValidationSyncBack();
      hourlyStats.tasks.fetched += result.tasks.fetched;
      hourlyStats.tasks.upserted += result.tasks.upserted;
      hourlyStats.tasks.failed += result.tasks.failed;
      hourlyStats.validation.fetched += result.validation.fetched;
      hourlyStats.validation.upserted += result.validation.upserted;
      hourlyStats.validation.failed += result.validation.failed;
      hourlyStats.totalDurationMs += Date.now() - start;
      lastSynced.taskValidation = new Date().toISOString();
      if (result.tasks.errors.length > 0) {
        hourlyStats.errors.push(`T: ${result.tasks.errors[0].substring(0, 80)}`);
      }
      if (result.validation.errors.length > 0) {
        hourlyStats.errors.push(`V: ${result.validation.errors[0].substring(0, 80)}`);
      }
    } catch (error: any) {
      hourlyStats.errors.push(`TV: ${error.message?.substring(0, 100)}`);
      console.error("[cron] Task/Validation sync-back failed:", error);
    }
  });

  // Hourly flush: aggregate stats, write to Notion only on failure/partial
  cron.schedule("0 * * * *", async () => {
    try {
      const statsToFlush = { ...hourlyStats };
      hourlyStats = resetHourlyStats();
      await writeHourlySyncLog(statsToFlush);
    } catch (error) {
      console.error("[cron] Hourly sync log flush failed:", error);
    }
  });

  // Staleness check: every 5 minutes, check if sync is stale and notify owner
  cron.schedule("4,9,14,19,24,29,34,39,44,49,54,59 * * * *", () => {
    checkStalenessAndNotify();
  });

  // Retry queue: process failed dual-writes every 5 minutes (offset by 1 min)
  cron.schedule("1,6,11,16,21,26,31,36,41,46,51,56 * * * *", async () => {
    try {
      await processRetryQueue();
    } catch (error: any) {
      console.error("[cron] Retry queue processing failed:", error);
    }
  });

  // Hourly reconciliation: compare MySQL ↔ Notion timestamps, flag drift, notify owner
  // Also writes to Notion Sync Log when out-of-sync rows are found
  cron.schedule("30 * * * *", async () => {
    try {
      const result = await runReconciliation();
      console.log(`[cron] Reconciliation complete — checked: ${result.checked}, out of sync: ${result.outOfSync}`);

      // Write to Notion Sync Log if issues found
      if (result.outOfSync > 0) {
        await writeReconciliationToNotionLog(result);
      }
    } catch (error: any) {
      console.error("[cron] Reconciliation failed:", error);
    }
  });

  // Daily summary: always writes once at midnight UTC (proof of life)
  cron.schedule("0 0 * * *", async () => {
    try {
      await writeDailySummary();
    } catch (error) {
      console.error("[cron] Daily summary failed:", error);
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

  // Data-quality check: daily at 2:15 AM UTC (low-traffic window).
  // Detects residual orphan/duplicate rows the deployed constraints can't catch
  // (e.g. Notion-sourced contacts/systems caches). Notifies owner on FAIL.
  cron.schedule("15 2 * * *", async () => {
    try {
      await runAndReportDataQuality();
    } catch (error) {
      console.error("[cron] Data-quality check failed:", error);
    }
  });

  // Run once shortly after startup so the dashboard has a result without waiting
  // for the nightly run. Delayed 60s to let the DB pool warm up first.
  setTimeout(() => {
    runAndReportDataQuality().catch((err) => console.error("[cron] Initial data-quality check failed:", err));
  }, 60_000);

  console.log("[cron] Registered: Notion sync-back (every 5 minutes)");
  console.log("[cron] Registered: Contacts/Systems sync (every 5 minutes, offset +2)");
  console.log("[cron] Registered: Task/Validation sync-back (every 5 minutes, offset +3)");
  console.log("[cron] Registered: Hourly flush to Notion Sync Log (failures/partial only)");
  console.log("[cron] Registered: Staleness check (every 5 minutes, offset +4)");
  console.log("[cron] Registered: Retry queue (every 5 minutes, offset +1)");
  console.log("[cron] Registered: Hourly reconciliation (at :30 past each hour) → logs to Notion on issues");
  console.log("[cron] Registered: Daily summary (midnight UTC) → always writes to Notion");
  console.log("[cron] Registered: Sync log purge (every 3 days at 3:00 AM, entries > 7 days)");
  console.log("[cron] Registered: Data-quality check (daily at 2:15 AM UTC) → logs to Notion + notifies on FAIL");
}
