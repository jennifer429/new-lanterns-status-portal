/**
 * Cron Job Registry
 *
 * Registers all periodic jobs using node-cron.
 * Called once at server startup.
 */

import cron from "node-cron";
import { runNotionSyncBack } from "./notionSyncBack";
import { runContactsSystemsSync } from "./notionSyncContacts";

/**
 * Start all cron jobs. Call this once from the server entry point.
 */
export function startCronJobs(): void {
  // Questionnaire Notion → MySQL sync: every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runNotionSyncBack();
    } catch (error) {
      console.error("[cron] Notion questionnaire sync-back failed:", error);
    }
  });

  // Contacts & Systems Notion → MySQL sync: every 5 minutes (offset by 2 min)
  cron.schedule("2,7,12,17,22,27,32,37,42,47,52,57 * * * *", async () => {
    try {
      const result = await runContactsSystemsSync();
      console.log(
        `[cron] Contacts/Systems sync — contacts: ${result.contacts.upserted} upserted / ${result.contacts.failed} failed, ` +
        `systems: ${result.systems.upserted} upserted / ${result.systems.failed} failed`
      );
    } catch (error) {
      console.error("[cron] Contacts/Systems sync failed:", error);
    }
  });

  console.log("[cron] Registered: Notion sync-back (every 5 minutes)");
  console.log("[cron] Registered: Contacts/Systems sync (every 5 minutes, offset +2)");
}
