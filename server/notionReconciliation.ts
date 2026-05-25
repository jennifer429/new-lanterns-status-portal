/**
 * Hourly Reconciliation: MySQL ↔ Notion
 *
 * Compares updatedAt timestamps between MySQL and Notion for task completions
 * and validation results. Flags rows that are out of sync (>10 min drift)
 * and notifies the owner with a cleanup plan.
 *
 * Runs hourly via cron. Does NOT auto-fix — just reports discrepancies.
 */

import { getDb } from "./db";
import { taskCompletion, validationResults, organizations } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";

const DRIFT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface OutOfSyncRow {
  type: "taskCompletion" | "validationResult";
  orgSlug: string;
  key: string;
  mysqlUpdatedAt: string;
  notionUpdatedAt: string;
  driftMinutes: number;
}

function getNotionClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  return new Client({ auth: ENV.notionApiKey });
}

/**
 * Run reconciliation check for task completions.
 * Samples recently-updated MySQL rows and compares with Notion.
 */
async function reconcileTaskCompletions(client: Client): Promise<OutOfSyncRow[]> {
  const dsId = ENV.notionTaskCompletionDataSourceId;
  if (!dsId) return [];

  const db = await getDb();
  const outOfSync: OutOfSyncRow[] = [];

  // Get the 50 most recently updated task completions from MySQL
  const recentTasks = await db
    .select({
      id: taskCompletion.id,
      organizationId: taskCompletion.organizationId,
      taskId: taskCompletion.taskId,
      updatedAt: taskCompletion.updatedAt,
    })
    .from(taskCompletion)
    .orderBy(desc(taskCompletion.updatedAt))
    .limit(50);

  // Get org slugs for these tasks
  const orgIds = [...new Set(recentTasks.map(t => t.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations).where(sql`${organizations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o.slug]));

  // Check a sample of 10 against Notion
  const sample = recentTasks.slice(0, 10);
  for (const task of sample) {
    const orgSlug = orgMap.get(task.organizationId) || "unknown";
    try {
      const result: any = await (client as any).dataSources.query({
        data_source_id: dsId,
        filter: {
          and: [
            { property: "Organization ID", number: { equals: task.organizationId } },
            { property: "Task Key", rich_text: { equals: task.taskId } },
          ],
        },
        page_size: 1,
      });

      const notionPage = result.results?.[0];
      if (!notionPage) continue; // Not in Notion yet — not a sync issue

      const notionUpdatedAt = new Date(notionPage.last_edited_time).getTime();
      const mysqlUpdatedAt = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
      const drift = Math.abs(notionUpdatedAt - mysqlUpdatedAt);

      if (drift > DRIFT_THRESHOLD_MS) {
        outOfSync.push({
          type: "taskCompletion",
          orgSlug,
          key: task.taskId,
          mysqlUpdatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : "N/A",
          notionUpdatedAt: new Date(notionUpdatedAt).toISOString(),
          driftMinutes: Math.round(drift / 60000),
        });
      }
    } catch (err) {
      // Skip — don't block reconciliation for individual lookup failures
      continue;
    }
  }

  return outOfSync;
}

/**
 * Run reconciliation check for validation results.
 */
async function reconcileValidationResults(client: Client): Promise<OutOfSyncRow[]> {
  const dsId = ENV.notionValidationResultsDataSourceId;
  if (!dsId) return [];

  const db = await getDb();
  const outOfSync: OutOfSyncRow[] = [];

  // Get the 50 most recently updated validation results from MySQL
  const recentResults = await db
    .select({
      id: validationResults.id,
      organizationId: validationResults.organizationId,
      testKey: validationResults.testKey,
      updatedAt: validationResults.updatedAt,
    })
    .from(validationResults)
    .orderBy(desc(validationResults.updatedAt))
    .limit(50);

  const orgIds = [...new Set(recentResults.map(r => r.organizationId))];
  const orgs = orgIds.length > 0
    ? await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations).where(sql`${organizations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o.slug]));

  // Check a sample of 10 against Notion
  const sample = recentResults.slice(0, 10);
  for (const result of sample) {
    const orgSlug = orgMap.get(result.organizationId) || "unknown";
    try {
      const notionResult: any = await (client as any).dataSources.query({
        data_source_id: dsId,
        filter: {
          and: [
            { property: "Organization ID", number: { equals: result.organizationId } },
            { property: "Test Key", rich_text: { equals: result.testKey } },
          ],
        },
        page_size: 1,
      });

      const notionPage = notionResult.results?.[0];
      if (!notionPage) continue;

      const notionUpdatedAt = new Date(notionPage.last_edited_time).getTime();
      const mysqlUpdatedAt = result.updatedAt ? new Date(result.updatedAt).getTime() : 0;
      const drift = Math.abs(notionUpdatedAt - mysqlUpdatedAt);

      if (drift > DRIFT_THRESHOLD_MS) {
        outOfSync.push({
          type: "validationResult",
          orgSlug,
          key: result.testKey,
          mysqlUpdatedAt: result.updatedAt ? new Date(result.updatedAt).toISOString() : "N/A",
          notionUpdatedAt: new Date(notionUpdatedAt).toISOString(),
          driftMinutes: Math.round(drift / 60000),
        });
      }
    } catch (err) {
      continue;
    }
  }

  return outOfSync;
}

/**
 * Main reconciliation entry point. Called by cron every hour.
 * Checks both task completions and validation results, notifies owner if any are out of sync.
 */
export async function runReconciliation(): Promise<{ checked: number; outOfSync: number }> {
  const client = getNotionClient();
  if (!client) {
    console.log("[reconciliation] No Notion client configured — skipping");
    return { checked: 0, outOfSync: 0 };
  }

  console.log("[reconciliation] Starting hourly reconciliation check...");

  const taskIssues = await reconcileTaskCompletions(client);
  const validationIssues = await reconcileValidationResults(client);
  const allIssues = [...taskIssues, ...validationIssues];

  const stats = { checked: 20, outOfSync: allIssues.length };

  if (allIssues.length > 0) {
    console.warn(`[reconciliation] Found ${allIssues.length} out-of-sync rows`);

    // Build notification content
    const issueList = allIssues
      .map(i => `• ${i.type} | ${i.orgSlug}/${i.key} | Drift: ${i.driftMinutes}min | MySQL: ${i.mysqlUpdatedAt} | Notion: ${i.notionUpdatedAt}`)
      .join("\n");

    const cleanupPlan = allIssues.length <= 3
      ? "\n\nCleanup plan: Trigger a full sync from the admin panel to reconcile these rows."
      : `\n\nCleanup plan: ${allIssues.length} rows are out of sync. Trigger a full sync from the admin panel. If the issue persists after sync, check Notion API access and the retry queue for stuck items.`;

    await notifyOwner({
      title: `⚠️ Sync Reconciliation: ${allIssues.length} row(s) out of sync`,
      content: `Hourly reconciliation found rows where MySQL and Notion timestamps differ by more than 10 minutes:\n\n${issueList}${cleanupPlan}`,
    }).catch(err => console.error("[reconciliation] Failed to notify owner:", err));
  } else {
    console.log("[reconciliation] All sampled rows are in sync ✓");
  }

  return stats;
}
