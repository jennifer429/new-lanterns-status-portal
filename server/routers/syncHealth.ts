/**
 * Sync Health Router
 *
 * Provides tRPC endpoints to check sync status, manually trigger syncs,
 * and power the Sync Dashboard page.
 */

import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getSyncHealth, runNotionSyncBack } from "../notionSyncBack";
import { runContactsSystemsSync } from "../notionSyncContacts";
import { runTaskValidationSyncBack } from "../notionSyncBackTasks";
import { getLastSyncedTimestamps } from "../cron";
import { getQueueStats } from "../notionRetryQueue";
import { getReconciliationHistory } from "../notionReconciliation";
import { z } from "zod";

export const syncHealthRouter = router({
  /**
   * GET sync health status — public so monitoring tools can hit it.
   */
  status: publicProcedure.query(async () => {
    const health = await getSyncHealth();
    const lastSynced = getLastSyncedTimestamps();
    return { ...health, lastSynced };
  }),

  /**
   * Full sync dashboard data — admin only.
   * Returns queue stats, reconciliation history, and per-DB health in one call.
   */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can view sync dashboard");
    }

    const [health, lastSynced, queueStats, reconciliationHistory] = await Promise.all([
      getSyncHealth(),
      Promise.resolve(getLastSyncedTimestamps()),
      getQueueStats(),
      getReconciliationHistory(24),
    ]);

    return {
      health,
      lastSynced,
      retryQueue: queueStats,
      reconciliation: reconciliationHistory,
    };
  }),

  /**
   * Manually trigger a questionnaire sync run — admin only.
   */
  triggerSync: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can trigger manual sync");
    }
    const result = await runNotionSyncBack();
    return result;
  }),

  /**
   * Manually trigger contacts & systems sync — admin only.
   */
  triggerContactsSystemsSync: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can trigger manual sync");
    }
    const result = await runContactsSystemsSync();
    return {
      contacts: result.contacts,
      systems: result.systems,
    };
  }),

  /**
   * Trigger ALL syncs at once — admin "refresh everything" button.
   */
  triggerFullSync: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can trigger manual sync");
    }

    const startTime = Date.now();

    // Run all syncs in parallel
    const [questionnaireResult, contactsSystemsResult, taskValidationResult] = await Promise.all([
      runNotionSyncBack(),
      runContactsSystemsSync(),
      runTaskValidationSyncBack(),
    ]);

    return {
      durationMs: Date.now() - startTime,
      questionnaire: questionnaireResult,
      contacts: contactsSystemsResult.contacts,
      systems: contactsSystemsResult.systems,
      tasks: taskValidationResult.tasks,
      validation: taskValidationResult.validation,
    };
  }),
});
