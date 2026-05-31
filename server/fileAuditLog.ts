/**
 * File Activity Audit Log — writes to a dedicated Notion database via the
 * dual-write/retry-queue pattern used by all other Notion integrations.
 *
 * Logs every file upload, download, view, and delete action with:
 * - Timestamp (UTC)
 * - Action (upload / download / delete / view)
 * - User email
 * - User role
 * - Organization name
 * - File name
 * - File URL
 * - Additional notes
 *
 * The Notion database "File Activity Audit" lives under the INTERFACES page.
 * DB ID: c983a5f2-46d0-4352-816c-d12ceaa0f0f9
 * DS ID: 1297368b-f85e-4812-b0bb-723a8a47d29e
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { enqueueFailedWrite } from "./notionRetryQueue";

export type AuditAction = "upload" | "download" | "delete" | "view";

export interface AuditEntry {
  action: AuditAction;
  userEmail: string;
  userRole: string;
  organizationName: string;
  fileName: string;
  fileUrl?: string;
  notes?: string;
}

const FILE_AUDIT_DB_ID = "c983a5f2-46d0-4352-816c-d12ceaa0f0f9";
const FILE_AUDIT_DS_ID = "1297368b-f85e-4812-b0bb-723a8a47d29e";

let notionClient: Client | null = null;
function getClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  if (!notionClient) {
    notionClient = new Client({ auth: ENV.notionApiKey });
  }
  return notionClient;
}

/**
 * Log a file activity event to the Notion "File Activity Audit" database.
 * Non-blocking — errors are caught and enqueued for retry.
 */
export async function logFileActivity(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();

  const client = getClient();
  if (!client) {
    // No Notion API key configured — log to console as fallback
    console.log(`[FileAudit] ${JSON.stringify({ ...entry, timestamp })}`);
    return;
  }

  try {
    await client.pages.create({
      parent: { database_id: FILE_AUDIT_DB_ID },
      properties: {
        "Activity": {
          title: [{ text: { content: `${entry.action}: ${entry.fileName}` } }],
        },
        "Action": {
          select: { name: entry.action },
        },
        "User Email": {
          rich_text: [{ text: { content: entry.userEmail || "" } }],
        },
        "User Role": {
          rich_text: [{ text: { content: entry.userRole || "" } }],
        },
        "Organization": {
          rich_text: [{ text: { content: entry.organizationName || "" } }],
        },
        "File Name": {
          rich_text: [{ text: { content: entry.fileName || "" } }],
        },
        "File URL": {
          url: entry.fileUrl || null,
        },
        "Notes": {
          rich_text: [{ text: { content: entry.notes || "" } }],
        },
        "Timestamp": {
          date: { start: timestamp },
        },
      },
    });
  } catch (err: any) {
    console.error(`[FileAudit] Failed to log to Notion: ${err.message}`);
    // Enqueue for retry instead of silently dropping
    try {
      await enqueueFailedWrite(
        { writeType: "fileAudit", data: { ...entry, timestamp } },
        err.message || "Unknown error"
      );
    } catch (retryErr: any) {
      // If even the retry queue fails, just log it
      console.error(`[FileAudit] Failed to enqueue retry: ${retryErr.message}`);
    }
  }
}

/**
 * Query the user's own file activity from Notion.
 * Returns the most recent entries for the given user email.
 */
export async function getUserFileActivity(
  userEmail: string,
  limit: number = 50
): Promise<Array<{
  action: string;
  fileName: string;
  organization: string;
  fileUrl: string | null;
  notes: string;
  timestamp: string;
}>> {
  const client = getClient();
  if (!client) return [];

  try {
    const response = await (client.databases as any).query({
      database_id: FILE_AUDIT_DB_ID,
      filter: {
        property: "User Email",
        rich_text: { equals: userEmail },
      },
      sorts: [{ property: "Timestamp", direction: "descending" }],
      page_size: Math.min(limit, 100),
    });

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        action: props["Action"]?.select?.name || "unknown",
        fileName: props["File Name"]?.rich_text?.[0]?.text?.content || "",
        organization: props["Organization"]?.rich_text?.[0]?.text?.content || "",
        fileUrl: props["File URL"]?.url || null,
        notes: props["Notes"]?.rich_text?.[0]?.text?.content || "",
        timestamp: props["Timestamp"]?.date?.start || page.created_time,
      };
    });
  } catch (err: any) {
    console.error(`[FileAudit] Failed to query user activity: ${err.message}`);
    return [];
  }
}
