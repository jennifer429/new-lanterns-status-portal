import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { activityFeed, organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { orgIdentifierMatches } from "../_core/orgLookup";

/**
 * Webhooks router - handles incoming webhooks from Zapier/Linear/ClickUp
 */
export const webhooksRouter = router({
  /**
   * Receive Linear comment webhook from Zapier
   * Zapier should send: { organizationSlug, issueId, author, comment }
   * Comment should contain @Client tag to be posted to client portal
   */
  linearComment: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        issueId: z.string(),
        issueTitle: z.string().optional(),
        author: z.string(),
        comment: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Check if comment contains @Client tag
      if (!input.comment.includes("@Client")) {
        return {
          success: false,
          message: "Comment does not contain @Client tag",
        };
      }

      // Find organization by slug
      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
        .limit(1);

      if (!org) {
        return {
          success: false,
          message: `Organization with slug "${input.organizationSlug}" not found`,
        };
      }

      // Remove @Client tag and clean up the message
      const cleanedMessage = input.comment
        .replace(/@Client/g, "")
        .trim();

      // Save to activity feed
      await db.insert(activityFeed).values({
        organizationId: org.id,
        source: "linear",
        sourceId: input.issueId,
        author: input.author,
        message: cleanedMessage,
      });

      return {
        success: true,
        message: "Activity posted to client portal",
      };
    }),

  /**
   * Receive ClickUp comment webhook from Zapier
   * Zapier should send: { organizationSlug, taskId, author, comment }
   */
  clickupComment: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        taskId: z.string(),
        taskName: z.string().optional(),
        author: z.string(),
        comment: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Check if comment contains @Client tag
      if (!input.comment.includes("@Client")) {
        return {
          success: false,
          message: "Comment does not contain @Client tag",
        };
      }

      // Find organization by slug
      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
        .limit(1);

      if (!org) {
        return {
          success: false,
          message: `Organization with slug "${input.organizationSlug}" not found`,
        };
      }

      // Remove @Client tag and clean up the message
      const cleanedMessage = input.comment
        .replace(/@Client/g, "")
        .trim();

      // Save to activity feed
      await db.insert(activityFeed).values({
        organizationId: org.id,
        source: "clickup",
        sourceId: input.taskId,
        author: input.author,
        message: cleanedMessage,
      });

      return {
        success: true,
        message: "Activity posted to client portal",
      };
    }),
});
