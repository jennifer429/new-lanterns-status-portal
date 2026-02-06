import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

/**
 * Upload file to Google Drive and get shareable link
 */
async function uploadToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  organizationName: string
): Promise<string> {
  // Create temp file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `${nanoid()}-${fileName}`);
  
  try {
    await writeFile(tempFilePath, fileBuffer);
    
    // Create organization folder in Google Drive if it doesn't exist
    const folderPath = `manus_google_drive:Implementation Files/${organizationName}`;
    
    // Upload file to Google Drive
    await execAsync(
      `rclone copy "${tempFilePath}" "${folderPath}" --config /home/ubuntu/.gdrive-rclone.ini`
    );
    
    // Wait for file to sync (Google Drive needs time to process)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get shareable link with retry logic
    const remotePath = `${folderPath}/${fileName}`;
    let shareableLink = '';
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const { stdout } = await execAsync(
          `rclone link "${remotePath}" --config /home/ubuntu/.gdrive-rclone.ini`
        );
        shareableLink = stdout.trim();
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to create shareable link after ${maxAttempts} attempts: ${error}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    // Clean up temp file
    await unlink(tempFilePath);
    
    return shareableLink;
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempFilePath);
    } catch {}
    throw error;
  }
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
  upload: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
        taskName: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded file data
        mimeType: z.string(),
        uploadedBy: z.string().optional(),
        clickupTaskId: z.string().optional(),
        linearIssueId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
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

      // Upload to Google Drive and get shareable link
      const fileUrl = await uploadToGoogleDrive(
        input.fileName,
        fileBuffer,
        org.name
      );

      // Save metadata to database
      const [result] = await db.insert(fileAttachments).values({
        organizationId: input.organizationId,
        taskId: input.taskId,
        fileName: input.fileName,
        fileUrl,
        fileKey: `gdrive://${org.name}/${input.fileName}`,
        fileSize,
        mimeType: input.mimeType,
        uploadedBy: input.uploadedBy,
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
  getByTask: publicProcedure
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
  delete: publicProcedure
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
