/**
 * Hourly Reconciliation: MySQL ↔ Notion
 *
 * NEW LOGIC (Option C — notionLastEdited version check):
 * - Only flags rows where `notionLastEdited IS NULL` AND `updatedAt` is older than 10 minutes.
 *   This means the portal wrote to MySQL (nulling notionLastEdited) but the dual-write to Notion
 *   hasn't been confirmed by a subsequent sync-back cycle yet.
 * - Rows with a non-null `notionLastEdited` are by definition in sync (sync-back set it).
 * - No more Notion API calls needed for reconciliation — it's purely a MySQL query now.
 *
 * Runs hourly via cron. Does NOT auto-fix — just reports discrepancies.
 */

import { requireDb } from "./db";
import { taskCompletion, validationResults, organizations, reconciliationLog } from "../drizzle/schema";
import { eq, desc, sql, isNull, and, lt } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface OutOfSyncRow {
  type: "taskCompletion" | "validationResult";
  orgSlug: string;
  key: string;
  mysqlUpdatedAt: string;
  staleMinutes: number;
}

/**
 * Find task completions where notionLastEdited is null and updatedAt is stale (>10 min).
 * These are rows the portal wrote but sync-back hasn't confirmed yet.
 */
async function findStaleTasks(): Promise<OutOfSyncRow[]> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleTasks = await db
    .select({
      id: taskCompletion.id,
      organizationId: taskCompletion.organizationId,
      taskId: taskCompletion.taskId,
      updatedAt: taskCompletion.updatedAt,
    })
    .from(taskCompletion)
    .where(
      and(
        isNull(taskCompletion.notionLastEdited),
        lt(taskCompletion.updatedAt, cutoff)
      )
    )
    .orderBy(desc(taskCompletion.updatedAt))
    .limit(50);

  if (staleTasks.length === 0) return [];

  // Get org slugs
  const orgIds = [...new Set(staleTasks.map(t => t.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations).where(sql`${organizations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o.slug]));

  return staleTasks.map(task => ({
    type: "taskCompletion" as const,
    orgSlug: orgMap.get(task.organizationId) || "unknown",
    key: task.taskId,
    mysqlUpdatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : "N/A",
    staleMinutes: task.updatedAt ? Math.round((Date.now() - new Date(task.updatedAt).getTime()) / 60000) : 0,
  }));
}

/**
 * Find validation results where notionLastEdited is null and updatedAt is stale (>10 min).
 */
async function findStaleValidationResults(): Promise<OutOfSyncRow[]> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleResults = await db
    .select({
      id: validationResults.id,
      organizationId: validationResults.organizationId,
      testKey: validationResults.testKey,
      updatedAt: validationResults.updatedAt,
    })
    .from(validationResults)
    .where(
      and(
        isNull(validationResults.notionLastEdited),
        lt(validationResults.updatedAt, cutoff)
      )
    )
    .orderBy(desc(validationResults.updatedAt))
    .limit(50);

  if (staleResults.length === 0) return [];

  // Get org slugs
  const orgIds = [...new Set(staleResults.map(r => r.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations).where(sql`${organizations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o.slug]));

  return staleResults.map(result => ({
    type: "validationResult" as const,
    orgSlug: orgMap.get(result.organizationId) || "unknown",
    key: result.testKey,
    mysqlUpdatedAt: result.updatedAt ? new Date(result.updatedAt).toISOString() : "N/A",
    staleMinutes: result.updatedAt ? Math.round((Date.now() - new Date(result.updatedAt).getTime()) / 60000) : 0,
  }));
}

/**
 * Main reconciliation entry point. Called by cron every hour.
 * Checks for rows where notionLastEdited is null and stale > 10 minutes.
 * These represent portal writes that haven't been confirmed by sync-back.
 * Persists results to reconciliationLog table for dashboard display.
 */
export async function runReconciliation(): Promise<{ checked: number; outOfSync: number; details?: string }> {
  const startTime = Date.now();

  console.log("[reconciliation] Starting hourly reconciliation check (notionLastEdited version)...");

  try {
    const taskIssues = await findStaleTasks();
    const validationIssues = await findStaleValidationResults();
    const allIssues = [...taskIssues, ...validationIssues];
    const durationMs = Date.now() - startTime;
    const stats = { checked: allIssues.length > 0 ? allIssues.length : 0, outOfSync: allIssues.length };

    // Persist to reconciliationLog
    const db = await requireDb();
    await db.insert(reconciliationLog).values({
      rowsChecked: stats.checked,
      outOfSync: allIssues.length,
      issues: allIssues.length > 0 ? JSON.stringify(allIssues) : null,
      durationMs,
      status: allIssues.length > 0 ? "issues_found" : "healthy",
    });

    if (allIssues.length > 0) {
      console.warn(`[reconciliation] Found ${allIssues.length} rows with stale notionLastEdited=null`);
      const issueList = allIssues
        .map(i => `• ${i.type} | ${i.orgSlug}/${i.key} | Stale: ${i.staleMinutes}min | MySQL updatedAt: ${i.mysqlUpdatedAt}`)
        .join("\n");

      const cleanupPlan = allIssues.length <= 3
        ? "\n\nCleanup plan: These rows were written by the portal but sync-back hasn't confirmed them yet. Check if the Notion dual-write failed and retry, or trigger a full sync."
        : `\n\nCleanup plan: ${allIssues.length} rows have pending Notion confirmation. Check the retry queue and Notion API access. Trigger a full sync if the issue persists.`;

      await notifyOwner({
        title: `⚠️ Sync Reconciliation: ${allIssues.length} row(s) pending Notion confirmation`,
        content: `Hourly reconciliation found rows where the portal wrote to MySQL but sync-back hasn't confirmed the Notion write (notionLastEdited is null for >10 minutes):\n\n${issueList}${cleanupPlan}`,
      }).catch(err => console.error("[reconciliation] Failed to notify owner:", err));
    } else {
      console.log("[reconciliation] All rows have confirmed notionLastEdited ✓");
    }

    const details = allIssues.length > 0
      ? allIssues.map(i => `${i.type} | ${i.orgSlug}/${i.key} | Stale: ${i.staleMinutes}min`).join("\n")
      : undefined;

    return { ...stats, details };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    // Persist error to log
    const db = await requireDb();
    await db.insert(reconciliationLog).values({
      rowsChecked: 0,
      outOfSync: 0,
      durationMs,
      status: "error",
      errorMessage: err?.message || String(err),
    }).catch(() => {});
    console.error("[reconciliation] Error:", err);
    return { checked: 0, outOfSync: 0 };
  }
}


/**
 * Get recent reconciliation log entries for the sync dashboard.
 */
export async function getReconciliationHistory(limit = 24): Promise<Array<{
  id: number;
  rowsChecked: number;
  outOfSync: number;
  issues: string | null;
  durationMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}>> {
  const db = await requireDb();
  return db
    .select()
    .from(reconciliationLog)
    .orderBy(desc(reconciliationLog.createdAt))
    .limit(limit);
}
