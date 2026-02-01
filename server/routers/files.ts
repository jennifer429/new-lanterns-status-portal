import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { createFileUploadTask } from "../clickup";
import { nanoid } from "nanoid";

/**
 * Files router - handles file uploads and attachments
 */
export const filesRouter = router({
  /**
   * Upload a file to S3 and save metadata to database
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
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileSize = fileBuffer.length;

      // Generate unique file key
      const fileExtension = input.fileName.split(".").pop() || "";
      const uniqueId = nanoid(10);
      const fileKey = `org-${input.organizationId}/task-${input.taskId}/${uniqueId}-${input.fileName}`;

      // Upload to S3
      const { url: fileUrl } = await storagePut(
        fileKey,
        fileBuffer,
        input.mimeType
      );

      // Save metadata to database
      const [result] = await db.insert(fileAttachments).values({
        organizationId: input.organizationId,
        taskId: input.taskId,
        fileName: input.fileName,
        fileUrl,
        fileKey,
        fileSize,
        mimeType: input.mimeType,
        uploadedBy: input.uploadedBy,
      });

      // Get organization name for ClickUp task
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (org) {
        // Trigger ClickUp task creation asynchronously
        createFileUploadTask(
          org.name,
          input.fileName,
          input.taskName,
          fileUrl
        ).catch((error) => {
          console.error("[ClickUp] Failed to create file upload task:", error);
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

      // Delete from database (S3 file remains for audit trail)
      await db.delete(fileAttachments).where(eq(fileAttachments.id, input.fileId));

      return { success: true };
    }),
});
