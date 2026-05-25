/**
 * Notion Retry Queue
 *
 * When a dual-write to Notion fails, the payload is enqueued here.
 * A cron job processes the queue every 5 minutes, retrying failed writes.
 * After 3 consecutive failures for a single item, the owner is notified.
 */

import { getDb } from "./db";
import { notionRetryQueue } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// NOTE: syncTaskCompletionToNotion, syncValidationResultToNotion, syncAnswerToNotion
// are imported dynamically inside processRetryQueue() to avoid circular dependency
// (notion.ts -> notionRetryQueue.ts -> notion.ts)

const MAX_RETRIES = 3;

export interface RetryPayload {
  writeType: "taskCompletion" | "validationResult" | "questionnaire";
  data: Record<string, any>;
}

/**
 * Enqueue a failed dual-write for later retry.
 */
export async function enqueueFailedWrite(payload: RetryPayload, error: string): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(notionRetryQueue).values({
      writeType: payload.writeType,
      payload: JSON.stringify(payload.data),
      lastError: error.substring(0, 500),
      retryCount: 0,
      status: "pending",
      ownerNotified: 0,
    });
    console.log(`[retry-queue] Enqueued failed ${payload.writeType} write`);
  } catch (err: any) {
    console.error("[retry-queue] Failed to enqueue:", err.message);
  }
}

/**
 * Process all pending items in the retry queue.
 * Called by cron every 5 minutes.
 */
export async function processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number; notified: number }> {
  const stats = { processed: 0, succeeded: 0, failed: 0, notified: 0 };

  const db = await getDb();
  const pendingItems = await db
    .select()
    .from(notionRetryQueue)
    .where(eq(notionRetryQueue.status, "pending"))
    .limit(20); // Process max 20 per cycle to avoid rate limits

  for (const item of pendingItems) {
    stats.processed++;
    let data: Record<string, any>;
    try {
      data = JSON.parse(item.payload);
    } catch {
      // Invalid JSON — mark as permanently failed
      await db.update(notionRetryQueue)
        .set({ status: "failed_permanent", lastError: "Invalid JSON payload" })
        .where(eq(notionRetryQueue.id, item.id));
      stats.failed++;
      continue;
    }

    try {
      // Retry the write based on type (dynamic imports to avoid circular deps)
      switch (item.writeType) {
        case "taskCompletion": {
          const { syncTaskCompletionToNotion } = await import("./notionTaskValidation");
          await syncTaskCompletionToNotion(data as any);
          break;
        }
        case "validationResult": {
          const { syncValidationResultToNotion } = await import("./notionTaskValidation");
          await syncValidationResultToNotion(data as any);
          break;
        }
        case "questionnaire": {
          const { syncAnswerToNotion } = await import("./notion");
          await syncAnswerToNotion(data.slug, data.questionId, data.answer, data.updatedBy);
          break;
        }
        default:
          throw new Error(`Unknown writeType: ${item.writeType}`);
      }

      // Success — mark as succeeded
      await db.update(notionRetryQueue)
        .set({ status: "succeeded" })
        .where(eq(notionRetryQueue.id, item.id));
      stats.succeeded++;
    } catch (err: any) {
      const newRetryCount = item.retryCount + 1;
      const errorMsg = err.message?.substring(0, 500) || "Unknown error";

      if (newRetryCount >= MAX_RETRIES) {
        // Permanently failed — notify owner if not already notified
        await db.update(notionRetryQueue)
          .set({
            status: "failed_permanent",
            retryCount: newRetryCount,
            lastError: errorMsg,
          })
          .where(eq(notionRetryQueue.id, item.id));

        if (!item.ownerNotified) {
          await notifyOwner({
            title: "❌ Notion Dual-Write Permanently Failed",
            content: `A ${item.writeType} write has failed ${newRetryCount} times and will not be retried.\n\n` +
              `Error: ${errorMsg}\n\n` +
              `Payload (truncated): ${item.payload.substring(0, 200)}...\n\n` +
              `Action needed: Check Notion API access and manually reconcile if necessary.`,
          }).catch(e => console.error("[retry-queue] Failed to notify owner:", e));

          await db.update(notionRetryQueue)
            .set({ ownerNotified: 1 })
            .where(eq(notionRetryQueue.id, item.id));
          stats.notified++;
        }
        stats.failed++;
      } else {
        // Increment retry count, keep as pending
        await db.update(notionRetryQueue)
          .set({ retryCount: newRetryCount, lastError: errorMsg })
          .where(eq(notionRetryQueue.id, item.id));
        stats.failed++;
      }
    }
  }

  if (stats.processed > 0) {
    console.log(`[retry-queue] Processed ${stats.processed}: ${stats.succeeded} succeeded, ${stats.failed} failed, ${stats.notified} notified`);
  }

  return stats;
}

/**
 * Get retry queue statistics and recent items for the sync dashboard.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  succeeded: number;
  failedPermanent: number;
  recentItems: Array<{
    id: number;
    writeType: string;
    retryCount: number;
    lastError: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}> {
  const db = await getDb();
  const allItems = await db
    .select()
    .from(notionRetryQueue)
    .limit(200);

  const pending = allItems.filter(i => i.status === "pending").length;
  const succeeded = allItems.filter(i => i.status === "succeeded").length;
  const failedPermanent = allItems.filter(i => i.status === "failed_permanent").length;

  // Get 20 most recent items for display
  const recentItems = allItems
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20)
    .map(i => ({
      id: i.id,
      writeType: i.writeType,
      retryCount: i.retryCount,
      lastError: i.lastError,
      status: i.status,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));

  return { pending, succeeded, failedPermanent, recentItems };
}
