import { Express } from "express";
import { getDb } from "./db";
import { activityFeed, organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Register webhook endpoints for external integrations
 */
export function registerWebhooks(app: Express) {
  /**
   * Zapier webhook: Linear comments with @Client tag
   * 
   * Expected payload from Zapier:
   * {
   *   organizationSlug: string,  // Hospital slug to match organization
   *   author: string,             // Comment author name
   *   message: string,            // Comment body text
   *   issueId: string,            // Linear issue ID
   *   issueTitle: string          // Linear issue title
   * }
   */
  app.post("/api/zapier/linear-feedback", async (req, res) => {
    try {
      const { organizationSlug, author, message, issueId, issueTitle } = req.body;

      // Validate required fields
      if (!organizationSlug || !message) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: organizationSlug and message are required"
        });
      }

      const db = await getDb();
      if (!db) {
        return res.status(500).json({
          success: false,
          error: "Database not available"
        });
      }

      // Find organization by slug
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1);

      if (!org) {
        return res.status(404).json({
          success: false,
          error: `Organization not found: ${organizationSlug}`
        });
      }

      // Insert activity feed entry
      await db.insert(activityFeed).values({
        organizationId: org.id,
        source: "linear",
        sourceId: issueId || null,
        author: author || "New Lantern Team",
        message: message,
      });

      console.log(`[Zapier Webhook] Linear feedback saved for ${org.name}: ${message.substring(0, 50)}...`);

      return res.json({
        success: true,
        organizationId: org.id,
        organizationName: org.name
      });

    } catch (error) {
      console.error("[Zapier Webhook] Error processing Linear feedback:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Test endpoint to manually create activity feed entries
   * Useful for testing the ActivityFeed component
   */
  app.post("/api/webhooks/test-activity", async (req, res) => {
    try {
      const { organizationSlug, author, message, source } = req.body;

      const db = await getDb();
      if (!db) {
        return res.status(500).json({ success: false, error: "Database not available" });
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1);

      if (!org) {
        return res.status(404).json({ success: false, error: "Organization not found" });
      }

      await db.insert(activityFeed).values({
        organizationId: org.id,
        source: source || "manual",
        author: author || "Test User",
        message: message || "Test message",
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("[Test Webhook] Error:", error);
      return res.status(500).json({ success: false, error: String(error) });
    }
  });
}
