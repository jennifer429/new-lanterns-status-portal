import { ENV } from "./_core/env";

/**
 * File Activity Audit Log — writes to a Notion database.
 *
 * Logs every file upload, download, and delete action with:
 * - Timestamp (UTC)
 * - Action (upload / download / delete / view)
 * - User email
 * - User role
 * - Organization name
 * - File name
 * - File URL
 * - Additional notes
 *
 * The Notion database data source ID is stored in env as NOTION_FILE_AUDIT_DATASOURCE_ID.
 * If not configured, logs are written to console as a fallback.
 */

export type AuditAction = "upload" | "download" | "delete" | "view";

interface AuditEntry {
  action: AuditAction;
  userEmail: string;
  userRole: string;
  organizationName: string;
  fileName: string;
  fileUrl?: string;
  notes?: string;
}

const NOTION_FILE_AUDIT_DATASOURCE_ID = process.env.NOTION_FILE_AUDIT_DATASOURCE_ID || "";
const NOTION_API_KEY = process.env.NOTION_API_KEY || "";

/**
 * Log a file activity event to the Notion database.
 * Non-blocking — errors are caught and logged to console.
 */
export async function logFileActivity(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();

  if (!NOTION_FILE_AUDIT_DATASOURCE_ID || !NOTION_API_KEY) {
    // Fallback: log to console
    console.log(`[FileAudit] ${JSON.stringify({ ...entry, timestamp })}`);
    return;
  }

  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_FILE_AUDIT_DATASOURCE_ID },
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
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[FileAudit] Notion API error (${response.status}): ${errBody}`);
    }
  } catch (err: any) {
    console.error(`[FileAudit] Failed to log: ${err.message}`);
    // Don't throw — audit logging should never break the main flow
  }
}
