import { ENV } from "./_core/env";

/**
 * File Activity Audit Log — writes to a Google Sheet.
 *
 * Logs every file upload, download, and delete action with:
 * - Timestamp (UTC)
 * - Action (upload / download / delete)
 * - User email
 * - User role
 * - Organization name
 * - File name
 * - File URL
 * - Additional notes
 *
 * The Google Sheet ID is stored in env as GOOGLE_AUDIT_SHEET_ID.
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

let sheetsClient: any = null;

async function getSheets() {
  if (sheetsClient) return sheetsClient;

  if (!ENV.googleServiceAccountEmail || !ENV.googleServiceAccountPrivateKey) {
    return null;
  }

  const { google } = await import("googleapis");
  const privateKey = ENV.googleServiceAccountPrivateKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: ENV.googleServiceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/**
 * Create the audit Google Sheet if it doesn't exist yet.
 * Returns the spreadsheet ID.
 */
export async function ensureAuditSheet(): Promise<string | null> {
  const sheetId = process.env.GOOGLE_AUDIT_SHEET_ID;
  if (sheetId) return sheetId;

  // If no sheet ID is configured, we can't create one without Drive scope
  // The admin should create it manually or we create it via Drive API
  if (!ENV.googleServiceAccountEmail || !ENV.googleServiceAccountPrivateKey) {
    return null;
  }

  const { google } = await import("googleapis");
  const privateKey = ENV.googleServiceAccountPrivateKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: ENV.googleServiceAccountEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Create a new spreadsheet
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: "NL Status Portal - File Audit Log",
      },
      sheets: [
        {
          properties: {
            title: "Audit Log",
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Timestamp (UTC)" } },
                    { userEnteredValue: { stringValue: "Action" } },
                    { userEnteredValue: { stringValue: "User Email" } },
                    { userEnteredValue: { stringValue: "User Role" } },
                    { userEnteredValue: { stringValue: "Organization" } },
                    { userEnteredValue: { stringValue: "File Name" } },
                    { userEnteredValue: { stringValue: "File URL" } },
                    { userEnteredValue: { stringValue: "Notes" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const newSheetId = res.data.spreadsheetId;

  // Move to the root Drive folder so it's accessible
  if (newSheetId && ENV.googleDriveFolderId) {
    const drive = google.drive({ version: "v3", auth });
    await drive.files.update({
      fileId: newSheetId,
      addParents: ENV.googleDriveFolderId,
      fields: "id, parents",
    });

    // Make it readable by anyone with the link
    await drive.permissions.create({
      fileId: newSheetId,
      requestBody: { role: "reader", type: "anyone" },
    });
  }

  console.log(`[Audit] Created audit sheet: ${newSheetId}`);
  // Store it for future use (in-memory cache)
  process.env.GOOGLE_AUDIT_SHEET_ID = newSheetId || "";
  return newSheetId || null;
}

/**
 * Log a file activity event to the Google Sheet.
 * Non-blocking — errors are caught and logged to console.
 */
export async function logFileActivity(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    entry.action,
    entry.userEmail,
    entry.userRole,
    entry.organizationName,
    entry.fileName,
    entry.fileUrl || "",
    entry.notes || "",
  ];

  try {
    const sheetId = await ensureAuditSheet();
    if (!sheetId) {
      // Fallback: log to console
      console.log(`[FileAudit] ${JSON.stringify(entry)}`);
      return;
    }

    const sheets = await getSheets();
    if (!sheets) {
      console.log(`[FileAudit] ${JSON.stringify(entry)}`);
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Audit Log!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });
  } catch (err: any) {
    console.error(`[FileAudit] Failed to log: ${err.message}`);
    // Don't throw — audit logging should never break the main flow
  }
}
