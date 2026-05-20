/**
 * Sync Health Router
 *
 * Provides a tRPC endpoint to check the Notion→MySQL sync status.
 * Reads from the Sync Config page in Notion.
 */

import { publicProcedure, router } from "../_core/trpc";
import { getSyncHealth } from "../notionSyncBack";
import { runNotionSyncBack } from "../notionSyncBack";
import { protectedProcedure } from "../_core/trpc";

export const syncHealthRouter = router({
  /**
   * GET sync health status — public so monitoring tools can hit it.
   */
  status: publicProcedure.query(async () => {
    const health = await getSyncHealth();
    return health;
  }),

  /**
   * Manually trigger a sync run — admin only.
   */
  triggerSync: protectedProcedure.mutation(async ({ ctx }) => {
    // Only allow admin/owner to trigger manual sync
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can trigger manual sync");
    }

    const result = await runNotionSyncBack();
    return result;
  }),
});
