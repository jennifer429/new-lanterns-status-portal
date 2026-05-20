/**
 * Cron Job Registry
 *
 * Registers all periodic jobs using node-cron.
 * Called once at server startup.
 */

import cron from "node-cron";
import { runNotionSyncBack } from "./notionSyncBack";

/**
 * Start all cron jobs. Call this once from the server entry point.
 */
export function startCronJobs(): void {
  // Notion → MySQL sync: every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runNotionSyncBack();
    } catch (error) {
      console.error("[cron] Notion sync-back failed unexpectedly:", error);
    }
  });

  console.log("[cron] Registered: Notion sync-back (every 5 minutes)");
}
