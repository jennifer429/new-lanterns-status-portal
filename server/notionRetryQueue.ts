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
  writeType:
    | "taskCompletion"
    | "validationResult"
    | "questionnaire"
    | "aiChatLog"
    | "activityFeed"
    | "orgNote"
    | "partnerDocument"
    | "onboardingFeedback"
    | "orgCustomTask"
    | "sectionProgress"
    | "vendorAudit"
    | "taskFile"
    | "intakeFile"
    | "partnerTemplate"
    | "partnerTaskTemplate"
    | "specification"
    | "systemVendor"
    | "question"
    | "questionOption"
    | "portalUser"
    | "client"
    | "organization"
    | "implementationOrg"
    | "partnerDocAudit";
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
        case "aiChatLog": {
          const { syncAiChatLog } = await import("./notionDualWrite");
          await syncAiChatLog(data as any);
          break;
        }
        case "activityFeed": {
          const { syncActivityFeed } = await import("./notionDualWrite");
          await syncActivityFeed(data as any);
          break;
        }
        case "orgNote": {
          const { syncOrgNote } = await import("./notionDualWrite");
          await syncOrgNote(data as any);
          break;
        }
        case "partnerDocument": {
          const { syncPartnerDocument } = await import("./notionDualWrite");
          await syncPartnerDocument(data as any);
          break;
        }
        case "onboardingFeedback": {
          const { syncOnboardingFeedback } = await import("./notionDualWrite");
          await syncOnboardingFeedback(data as any);
          break;
        }
        case "orgCustomTask": {
          const { syncOrgCustomTask } = await import("./notionDualWrite");
          await syncOrgCustomTask(data as any);
          break;
        }
        case "sectionProgress": {
          const { syncSectionProgress } = await import("./notionDualWrite");
          await syncSectionProgress(data as any);
          break;
        }
        case "vendorAudit": {
          const { syncVendorAudit } = await import("./notionDualWrite");
          await syncVendorAudit(data as any);
          break;
        }
        case "taskFile": {
          const { syncTaskFile } = await import("./notionDualWrite");
          await syncTaskFile(data as any);
          break;
        }
        case "intakeFile": {
          const { syncIntakeFile } = await import("./notionDualWrite");
          await syncIntakeFile(data as any);
          break;
        }
        case "partnerTemplate": {
          const { syncPartnerTemplate } = await import("./notionDualWrite");
          await syncPartnerTemplate(data as any);
          break;
        }
        case "partnerTaskTemplate": {
          const { syncPartnerTaskTemplate } = await import("./notionDualWrite");
          await syncPartnerTaskTemplate(data as any);
          break;
        }
        case "specification": {
          const { syncSpecification } = await import("./notionDualWrite");
          await syncSpecification(data as any);
          break;
        }
        case "systemVendor": {
          const { syncSystemVendor } = await import("./notionDualWrite");
          await syncSystemVendor(data as any);
          break;
        }
        case "question": {
          const { syncQuestion } = await import("./notionDualWrite");
          await syncQuestion(data as any);
          break;
        }
        case "questionOption": {
          const { syncQuestionOption } = await import("./notionDualWrite");
          await syncQuestionOption(data as any);
          break;
        }
        case "portalUser": {
          const { syncPortalUser } = await import("./notionDualWrite");
          await syncPortalUser(data as any);
          break;
        }
        case "client": {
          const { syncClient } = await import("./notionDualWrite");
          await syncClient(data as any);
          break;
        }
        case "organization": {
          const { syncOrganization } = await import("./notionDualWrite");
          await syncOrganization(data as any);
          break;
        }
        case "implementationOrg": {
          const { syncImplementationOrg } = await import("./notionDualWrite");
          await syncImplementationOrg(data as any);
          break;
        }
        case "partnerDocAudit": {
          const { syncPartnerDocAudit } = await import("./notionDualWrite");
          await syncPartnerDocAudit(data as any);
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
