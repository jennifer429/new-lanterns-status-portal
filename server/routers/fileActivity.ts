/**
 * File Activity Router — lets users view their own file activity audit trail.
 * Reads from the Notion "File Activity Audit" database, filtered by the user's email.
 * Users can ONLY see their own activity — enforced server-side.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserFileActivity } from "../fileAuditLog";

export const fileActivityRouter = router({
  /**
   * Get the current user's file activity log.
   * Returns their uploads, downloads, views, and deletes from Notion.
   */
  myActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userEmail = ctx.user.email;
      if (!userEmail) {
        return { activities: [] };
      }

      const limit = input?.limit ?? 50;
      const activities = await getUserFileActivity(userEmail, limit);

      return { activities };
    }),
});
