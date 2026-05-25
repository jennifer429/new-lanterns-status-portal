/**
 * Notion Dual-Write for Task Completions and Validation Results
 *
 * Syncs task completion and validation result changes to Notion databases.
 * Each row in Notion is keyed by orgSlug + taskId/testKey (stored in "Name" title).
 *
 * Pattern: fire-and-forget after MySQL write succeeds. Failures are logged
 * but don't block the portal response.
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { enqueueFailedWrite } from "./notionRetryQueue";

const TASK_COMPLETION_DS_ID = ENV.notionTaskCompletionDataSourceId;
const VALIDATION_RESULTS_DS_ID = ENV.notionValidationResultsDataSourceId;

let notionClient: Client | null = null;

function getClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  if (!notionClient) {
    notionClient = new Client({ auth: ENV.notionApiKey });
  }
  return notionClient;
}

// ─── Status Mapping ────────────────────────────────────────────────────────────

/**
 * Derive the Notion select status from MySQL task completion flags.
 */
function deriveTaskStatus(flags: {
  completed: number;
  inProgress: number;
  blocked: number;
  notApplicable: number;
}): string {
  if (flags.completed) return "Complete";
  if (flags.blocked) return "Blocked";
  if (flags.notApplicable) return "N/A";
  if (flags.inProgress) return "In Progress";
  return "Not Started";
}

// ─── Page Lookup ───────────────────────────────────────────────────────────────

/**
 * Find a Notion page by Organization ID + Task Key / Test Key.
 * Uses the number filter on "Organization ID" and text filter on the key column.
 */
async function findTaskPage(
  client: Client,
  orgId: number,
  taskId: string
): Promise<string | null> {
  if (!TASK_COMPLETION_DS_ID) return null;
  try {
    const result: any = await (client as any).dataSources.query({
      data_source_id: TASK_COMPLETION_DS_ID,
      filter: {
        and: [
          { property: "Organization ID", number: { equals: orgId } },
          { property: "Task Key", rich_text: { equals: taskId } },
        ],
      },
      page_size: 1,
    });
    return result.results?.[0]?.id || null;
  } catch (err) {
    console.error(`[notion-task] Error finding page for org=${orgId} task=${taskId}:`, err);
    return null;
  }
}

async function findValidationPage(
  client: Client,
  orgId: number,
  testKey: string
): Promise<string | null> {
  if (!VALIDATION_RESULTS_DS_ID) return null;
  try {
    const result: any = await (client as any).dataSources.query({
      data_source_id: VALIDATION_RESULTS_DS_ID,
      filter: {
        and: [
          { property: "Organization ID", number: { equals: orgId } },
          { property: "Test Key", rich_text: { equals: testKey } },
        ],
      },
      page_size: 1,
    });
    return result.results?.[0]?.id || null;
  } catch (err) {
    console.error(`[notion-validation] Error finding page for org=${orgId} test=${testKey}:`, err);
    return null;
  }
}

// ─── Public Dual-Write Functions ───────────────────────────────────────────────

export interface TaskCompletionPayload {
  organizationId: number;
  orgSlug: string;
  orgName: string;
  taskId: string;
  sectionName: string;
  completed: number;
  inProgress: number;
  blocked: number;
  notApplicable: number;
  completedAt: Date | null;
  completedBy: string | null;
  targetDate: string | null;
  notes: string | null;
}

/**
 * Sync a task completion record to Notion (upsert).
 * Call this after MySQL write succeeds.
 */
export async function syncTaskCompletionToNotion(payload: TaskCompletionPayload): Promise<boolean> {
  const client = getClient();
  if (!client || !TASK_COMPLETION_DS_ID) return false;

  try {
    const status = deriveTaskStatus(payload);
    const pageId = await findTaskPage(client, payload.organizationId, payload.taskId);

    const properties: any = {
      "Status": { select: { name: status } },
      "Section Name": { rich_text: [{ text: { content: payload.sectionName || "" } }] },
      "Notes": { rich_text: [{ text: { content: (payload.notes || "").substring(0, 2000) } }] },
      "Completed By": { rich_text: [{ text: { content: payload.completedBy || "" } }] },
      "Target Date": { rich_text: [{ text: { content: payload.targetDate || "" } }] },
      "Completed At": { rich_text: [{ text: { content: payload.completedAt ? payload.completedAt.toISOString() : "" } }] },
      "Site": { rich_text: [{ text: { content: payload.orgName || payload.orgSlug } }] },
      "Last Updated From": { rich_text: [{ text: { content: "Portal" } }] },
    };

    if (pageId) {
      // Update existing
      await client.pages.update({ page_id: pageId, properties });
    } else {
      // Create new page
      await (client as any).dataSources.createPages({
        data_source_id: TASK_COMPLETION_DS_ID,
        pages: [{
          properties: {
            "Name": { title: [{ text: { content: `${payload.orgSlug}/${payload.taskId}` } }] },
            "Organization ID": { number: payload.organizationId },
            "Task Key": { rich_text: [{ text: { content: payload.taskId } }] },
            ...properties,
          },
        }],
      });
    }

    return true;
  } catch (error: any) {
    console.error(`[notion-task] Sync failed for ${payload.orgSlug}/${payload.taskId}:`, error);
    // Enqueue for retry instead of silently failing
    enqueueFailedWrite(
      { writeType: "taskCompletion", data: payload as any },
      error.message || "Unknown error"
    ).catch(() => {});
    return false;
  }
}

export interface ValidationResultPayload {
  organizationId: number;
  orgSlug: string;
  orgName: string;
  testKey: string;
  actual: string | null;
  status: string;
  signOff: string | null;
  notes: string | null;
  testedDate: string | null;
  updatedBy: string | null;
}

/**
 * Sync a validation result to Notion (upsert).
 * Call this after MySQL write succeeds.
 */
export async function syncValidationResultToNotion(payload: ValidationResultPayload): Promise<boolean> {
  const client = getClient();
  if (!client || !VALIDATION_RESULTS_DS_ID) return false;

  try {
    const pageId = await findValidationPage(client, payload.organizationId, payload.testKey);

    const properties: any = {
      "Status": { select: { name: payload.status } },
      "Actual": { rich_text: [{ text: { content: (payload.actual || "").substring(0, 2000) } }] },
      "Sign Off": { rich_text: [{ text: { content: payload.signOff || "" } }] },
      "Notes": { rich_text: [{ text: { content: (payload.notes || "").substring(0, 2000) } }] },
      "Tested Date": { rich_text: [{ text: { content: payload.testedDate || "" } }] },
      "Updated By": { rich_text: [{ text: { content: payload.updatedBy || "" } }] },
      "Site": { rich_text: [{ text: { content: payload.orgName || payload.orgSlug } }] },
      "Last Updated From": { rich_text: [{ text: { content: "Portal" } }] },
    };

    if (pageId) {
      // Update existing
      await client.pages.update({ page_id: pageId, properties });
    } else {
      // Create new page
      await (client as any).dataSources.createPages({
        data_source_id: VALIDATION_RESULTS_DS_ID,
        pages: [{
          properties: {
            "Name": { title: [{ text: { content: `${payload.orgSlug}/${payload.testKey}` } }] },
            "Organization ID": { number: payload.organizationId },
            "Test Key": { rich_text: [{ text: { content: payload.testKey } }] },
            ...properties,
          },
        }],
      });
    }

    return true;
  } catch (error: any) {
    console.error(`[notion-validation] Sync failed for ${payload.orgSlug}/${payload.testKey}:`, error);
    // Enqueue for retry instead of silently failing
    enqueueFailedWrite(
      { writeType: "validationResult", data: payload as any },
      error.message || "Unknown error"
    ).catch(() => {});
    return false;
  }
}

// ─── Sync-Back: Notion → MySQL ─────────────────────────────────────────────────

export interface NotionTaskRow {
  pageId: string;
  organizationId: number;
  taskKey: string;
  sectionName: string;
  status: string;
  completedBy: string;
  targetDate: string;
  notes: string;
  completedAt: string;
  lastEdited: string;
  lastUpdatedFrom: string;
}

export interface NotionValidationRow {
  pageId: string;
  organizationId: number;
  testKey: string;
  status: string;
  actual: string;
  signOff: string;
  notes: string;
  testedDate: string;
  updatedBy: string;
  lastEdited: string;
  lastUpdatedFrom: string;
}

/**
 * Fetch task completion rows changed since `since` (ISO timestamp).
 */
export async function fetchChangedTaskCompletions(since: string): Promise<NotionTaskRow[]> {
  const client = getClient();
  if (!client || !TASK_COMPLETION_DS_ID) return [];

  const results: NotionTaskRow[] = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const queryParams: any = {
        data_source_id: TASK_COMPLETION_DS_ID,
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: { after: since },
        },
        page_size: 100,
      };
      if (cursor) queryParams.start_cursor = cursor;
      const response: any = await (client as any).dataSources.query(queryParams);

      for (const page of response.results) {
        const props = page.properties;
        const orgId = props?.["Organization ID"]?.number;
        const taskKey = props?.["Task Key"]?.rich_text?.[0]?.plain_text || "";

        if (orgId && taskKey) {
          const lastUpdatedFrom = props?.["Last Updated From"]?.rich_text?.[0]?.plain_text || "";
          results.push({
            pageId: page.id,
            organizationId: orgId,
            taskKey,
            sectionName: props?.["Section Name"]?.rich_text?.[0]?.plain_text || "",
            status: props?.["Status"]?.select?.name || "Not Started",
            completedBy: props?.["Completed By"]?.rich_text?.[0]?.plain_text || "",
            targetDate: props?.["Target Date"]?.rich_text?.[0]?.plain_text || "",
            notes: props?.["Notes"]?.rich_text?.[0]?.plain_text || "",
            completedAt: props?.["Completed At"]?.rich_text?.[0]?.plain_text || "",
            lastEdited: page.last_edited_time || "",
            lastUpdatedFrom,
          });
        }
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[notion-task-sync] Error fetching changed rows:", error);
    throw error;
  }

  return results;
}

/**
 * Fetch validation result rows changed since `since` (ISO timestamp).
 */
export async function fetchChangedValidationResults(since: string): Promise<NotionValidationRow[]> {
  const client = getClient();
  if (!client || !VALIDATION_RESULTS_DS_ID) return [];

  const results: NotionValidationRow[] = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const queryParams: any = {
        data_source_id: VALIDATION_RESULTS_DS_ID,
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: { after: since },
        },
        page_size: 100,
      };
      if (cursor) queryParams.start_cursor = cursor;
      const response: any = await (client as any).dataSources.query(queryParams);

      for (const page of response.results) {
        const props = page.properties;
        const orgId = props?.["Organization ID"]?.number;
        const testKey = props?.["Test Key"]?.rich_text?.[0]?.plain_text || "";

        if (orgId && testKey) {
          const lastUpdatedFrom = props?.["Last Updated From"]?.rich_text?.[0]?.plain_text || "";
          results.push({
            pageId: page.id,
            organizationId: orgId,
            testKey,
            status: props?.["Status"]?.select?.name || "Not Tested",
            actual: props?.["Actual"]?.rich_text?.[0]?.plain_text || "",
            signOff: props?.["Sign Off"]?.rich_text?.[0]?.plain_text || "",
            notes: props?.["Notes"]?.rich_text?.[0]?.plain_text || "",
            testedDate: props?.["Tested Date"]?.rich_text?.[0]?.plain_text || "",
            updatedBy: props?.["Updated By"]?.rich_text?.[0]?.plain_text || "",
            lastEdited: page.last_edited_time || "",
            lastUpdatedFrom,
          });
        }
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[notion-validation-sync] Error fetching changed rows:", error);
    throw error;
  }

  return results;
}

/**
 * Convert a Notion status string back to MySQL task completion flags.
 */
export function statusToTaskFlags(status: string): {
  completed: number;
  inProgress: number;
  blocked: number;
  notApplicable: number;
} {
  switch (status) {
    case "Complete":
      return { completed: 1, inProgress: 0, blocked: 0, notApplicable: 0 };
    case "In Progress":
      return { completed: 0, inProgress: 1, blocked: 0, notApplicable: 0 };
    case "Blocked":
      return { completed: 0, inProgress: 0, blocked: 1, notApplicable: 0 };
    case "N/A":
      return { completed: 0, inProgress: 0, blocked: 0, notApplicable: 1 };
    default: // "Not Started"
      return { completed: 0, inProgress: 0, blocked: 0, notApplicable: 0 };
  }
}
