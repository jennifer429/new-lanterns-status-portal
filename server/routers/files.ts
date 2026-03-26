import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut, storageGet } from "../storage";
import { ENV } from "../_core/env";
import { Readable } from "stream";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Upload file to Google Drive and return a shareable link.
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars.
 * Falls back to Forge storage proxy if Google credentials are not configured.
 */
export async function uploadToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  organizationName: string
): Promise<string> {
  // Try Google Drive API if credentials are configured
  if (ENV.googleServiceAccountEmail && ENV.googleServiceAccountPrivateKey) {
    const { google } = await import("googleapis");

    const privateKey = ENV.googleServiceAccountPrivateKey.replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: ENV.googleServiceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

    // Upload file to the configured folder
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [ENV.googleDriveFolderId],
      },
      media: {
        mimeType: "application/octet-stream",
        body: Readable.from(fileBuffer),
      },
      fields: "id,webViewLink",
    });

    const fileId = uploadRes.data.id;
    if (!fileId) throw new Error("Google Drive upload returned no file ID");

    // Make file readable by anyone with the link
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Fetch the shareable link
    const meta = await drive.files.get({
      fileId,
      fields: "webViewLink",
    });

    return meta.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  }

  // Fallback: use Forge storage proxy
  const sanitizedOrg = organizationName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const key = `uploads/${sanitizedOrg}/${fileName}`;
  await storagePut(key, fileBuffer);
  const { url } = await storageGet(key);
  return url;
}

/**
 * Attach file link to ClickUp task
 */
async function attachToClickUp(
  taskId: string,
  fileName: string,
  fileUrl: string
): Promise<void> {
  await execAsync(
    `manus-mcp-cli tool call clickup_create_task_comment --server clickup --input '${JSON.stringify({
      task_id: taskId,
      comment_text: `📎 File uploaded: [${fileName}](${fileUrl})`
    })}'`
  );
}

/**
 * Attach file link to Linear issue
 */
async function attachToLinear(
  issueId: string,
  fileName: string,
  fileUrl: string
): Promise<void> {
  await execAsync(
    `manus-mcp-cli tool call create_comment --server linear --input '${JSON.stringify({
      issueId,
      body: `📎 File uploaded: [${fileName}](${fileUrl})`
    })}'`
  );
}

/**
 * Files router - handles file uploads and attachments
 */
export const filesRouter = router({
  /**
   * Upload a file to Google Drive and attach links to ClickUp and Linear
   */
  upload: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
        taskName: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded file data
        mimeType: z.string(),
        clickupTaskId: z.string().optional(),
        linearIssueId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileSize = fileBuffer.length;

      // Get organization name
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!org) throw new Error("Organization not found");

      // Upload to Google Drive
      const fileKey = `${Date.now()}-${input.fileName}`;
      const fileUrl = await uploadToGoogleDrive(fileKey, fileBuffer, org.name);

      // Save metadata to database
      const [result] = await db.insert(fileAttachments).values({
        organizationId: input.organizationId,
        taskId: input.taskId,
        fileName: input.fileName,
        fileUrl,
        fileKey,
        fileSize,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.email || "unknown",
      });

      // Attach to ClickUp and Linear asynchronously
      if (input.clickupTaskId) {
        attachToClickUp(input.clickupTaskId, input.fileName, fileUrl).catch((error) => {
          console.error("[ClickUp] Failed to attach file:", error);
        });
      }

      if (input.linearIssueId) {
        attachToLinear(input.linearIssueId, input.fileName, fileUrl).catch((error) => {
          console.error("[Linear] Failed to attach file:", error);
        });
      }

      return {
        success: true,
        fileId: result.insertId,
        fileUrl,
      };
    }),

  /**
   * Get files for a specific task
   */
  getByTask: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const files = await db
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.organizationId, input.organizationId),
            eq(fileAttachments.taskId, input.taskId)
          )
        );

      return files;
    }),

  /**
   * Delete a file
   */
  delete: protectedProcedure
    .input(
      z.object({
        fileId: z.number(),
        organizationId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify file belongs to organization before deleting
      const [file] = await db
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.id, input.fileId),
            eq(fileAttachments.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!file) {
        throw new Error("File not found or access denied");
      }

      // Delete from database (Google Drive file remains for audit trail)
      await db.delete(fileAttachments).where(eq(fileAttachments.id, input.fileId));

      return { success: true };
    }),
});
