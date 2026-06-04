/**
 * Startup Recovery Routine
 *
 * On server startup, catches up on any rows that were written to MySQL
 * but never confirmed synced to Notion (notionLastEdited = NULL).
 *
 * Strategy:
 * 1. Read last successful sync checkpoint for each pipeline
 * 2. Find all rows updated since checkpoint with notionLastEdited IS NULL
 * 3. Re-sync each to Notion
 * 4. Update checkpoint to current time
 *
 * This ensures graceful recovery after server restarts, cold starts, or crashes.
 */

import { requireDb } from "./db";
import { taskCompletion, validationResults, syncCheckpoints, organizations } from "../drizzle/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { syncTaskCompletionToNotion, syncValidationResultToNotion } from "./notionTaskValidation";

const TASK_PIPELINE = "task-completions";
const VALIDATION_PIPELINE = "validation-results";

interface RecoveryStats {
  tasksRecovered: number;
  validationRecovered: number;
  tasksFailed: number;
  validationFailed: number;
  durationMs: number;
}

/**
 * Run startup recovery: sync any unconfirmed rows to Notion.
 * Called once at server startup, before cron jobs begin.
 */
export async function runStartupRecovery(): Promise<RecoveryStats> {
  const startTime = Date.now();
  const stats: RecoveryStats = {
    tasksRecovered: 0,
    validationRecovered: 0,
    tasksFailed: 0,
    validationFailed: 0,
    durationMs: 0,
  };

  try {
    const db = await requireDb();

    // ── Recover Task Completions ──────────────────────────────────────────
    try {
      // Find ALL unconfirmed task rows (notionLastEdited IS NULL)
      // This catches rows that fell through gaps during missed cron executions
      const unconfirmedTasks = await db
        .select({
          id: taskCompletion.id,
          organizationId: taskCompletion.organizationId,
          sectionName: taskCompletion.sectionName,
          taskId: taskCompletion.taskId,
          completed: taskCompletion.completed as any,
          notApplicable: taskCompletion.notApplicable as any,
          inProgress: taskCompletion.inProgress as any,
          blocked: taskCompletion.blocked as any,
          completedAt: taskCompletion.completedAt,
          completedBy: taskCompletion.completedBy,
          targetDate: taskCompletion.targetDate,
          notes: taskCompletion.notes,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(taskCompletion)
        .leftJoin(organizations, eq(taskCompletion.organizationId, organizations.id))
        .where(isNull(taskCompletion.notionLastEdited));

      console.log(`[startup-recovery] Found ${unconfirmedTasks.length} unconfirmed task completions to recover`);

      for (const row of unconfirmedTasks) {
        try {
          const success = await syncTaskCompletionToNotion({
            organizationId: row.organizationId,
            sectionName: row.sectionName,
            taskId: row.taskId,
            completed: (row.completed as any) ? 1 : 0,
            notApplicable: (row.notApplicable as any) ? 1 : 0,
            inProgress: (row.inProgress as any) ? 1 : 0,
            blocked: (row.blocked as any) ? 1 : 0,
            completedAt: row.completedAt,
            completedBy: row.completedBy || "",
            targetDate: row.targetDate || "",
            notes: row.notes || "",
            orgName: row.orgName || "",
            orgSlug: row.orgSlug || "",
          });

          if (success) {
            stats.tasksRecovered++;
          } else {
            stats.tasksFailed++;
          }
        } catch (err: any) {
          console.error(`[startup-recovery] Failed to recover task ${row.orgSlug}/${row.taskId}:`, err.message);
          stats.tasksFailed++;
        }
      }

      // Update checkpoint after recovery
      if (stats.tasksRecovered > 0 || stats.tasksFailed === 0) {
        await db
          .insert(syncCheckpoints)
          .values({
            pipeline: TASK_PIPELINE,
            lastSuccessfulSync: new Date(),
            consecutiveFailures: 0,
          })
          .onDuplicateKeyUpdate({
            set: {
              lastSuccessfulSync: new Date(),
              consecutiveFailures: stats.tasksFailed > 0 ? 1 : 0,
            },
          });
      }
    } catch (err: any) {
      console.error("[startup-recovery] Task completions recovery failed:", err.message);
    }

    // ── Recover Validation Results ────────────────────────────────────────
    try {
      // Find ALL unconfirmed validation rows (notionLastEdited IS NULL)
      // This catches rows that fell through gaps during missed cron executions
      const unconfirmedValidation = await db
        .select({
          id: validationResults.id,
          organizationId: validationResults.organizationId,
          testKey: validationResults.testKey,
          actual: validationResults.actual,
          status: validationResults.status,
          signOff: validationResults.signOff,
          notes: validationResults.notes,
          testedDate: validationResults.testedDate,
          updatedBy: validationResults.updatedBy,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(validationResults)
        .leftJoin(organizations, eq(validationResults.organizationId, organizations.id))
        .where(isNull(validationResults.notionLastEdited));

      console.log(`[startup-recovery] Found ${unconfirmedValidation.length} unconfirmed validation results to recover`);

      for (const row of unconfirmedValidation) {
        try {
          const success = await syncValidationResultToNotion({
            organizationId: row.organizationId,
            testKey: row.testKey,
            actual: row.actual || "",
            status: row.status,
            signOff: row.signOff || "",
            notes: row.notes || "",
            testedDate: row.testedDate || "",
            updatedBy: row.updatedBy || "",
            orgName: row.orgName || "",
            orgSlug: row.orgSlug || "",
          });

          if (success) {
            stats.validationRecovered++;
          } else {
            stats.validationFailed++;
          }
        } catch (err: any) {
          console.error(`[startup-recovery] Failed to recover validation ${row.orgSlug}/${row.testKey}:`, err.message);
          stats.validationFailed++;
        }
      }

      // Update checkpoint after recovery
      if (stats.validationRecovered > 0 || stats.validationFailed === 0) {
        await db
          .insert(syncCheckpoints)
          .values({
            pipeline: VALIDATION_PIPELINE,
            lastSuccessfulSync: new Date(),
            consecutiveFailures: 0,
          })
          .onDuplicateKeyUpdate({
            set: {
              lastSuccessfulSync: new Date(),
              consecutiveFailures: stats.validationFailed > 0 ? 1 : 0,
            },
          });
      }
    } catch (err: any) {
      console.error("[startup-recovery] Validation results recovery failed:", err.message);
    }

    stats.durationMs = Date.now() - startTime;

    if (stats.tasksRecovered > 0 || stats.validationRecovered > 0) {
      console.log(
        `[startup-recovery] Complete — tasks: ${stats.tasksRecovered} recovered / ${stats.tasksFailed} failed, ` +
        `validation: ${stats.validationRecovered} recovered / ${stats.validationFailed} failed (${stats.durationMs}ms)`
      );
    } else {
      console.log(`[startup-recovery] No unconfirmed rows found — all synced (${stats.durationMs}ms)`);
    }

    return stats;
  } catch (err: any) {
    console.error("[startup-recovery] Fatal error:", err);
    stats.durationMs = Date.now() - startTime;
    return stats;
  }
}
