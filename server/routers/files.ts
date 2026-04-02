import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { uploadFileToDrive } from "../googleDrive";
import { logFileActivity } from "../fileAuditLog";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Legacy wrapper — kept for backward compatibility with other routers that call uploadToGoogleDrive.
 */
export async function uploadToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  organizationName: string,
  orgDriveFolderId?: string | null
): Promise<string> {
  const { fileUrl } = await uploadFileToDrive(
    fileName,
    fileBuffer,
    orgDriveFolderId,
    organizationName
  );
  return fileUrl;
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
      comment_text: `📎 File uploaded: [${fileName}](${fileUrl})`,
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
      body: `📎 File uploaded: [${fileName}](${fileUrl})`,
    })}'`
  );
}

/**
 * Check if user has access to an organization's files.
 * - admin: access all
 * - user with clientId (partner): access orgs belonging to their client
 * - user with organizationId (customer): access only their own org
 */
async function checkFileAccess(
  db: any,
  userId: number,
  userRole: string,
  userClientId: number | null,
  userOrgId: number | null,
  targetOrgId: number
): Promise<boolean> {
  // Admins see everything
  if (userRole === "admin") return true;

  // Customer: only their own org
  if (userOrgId && userOrgId === targetOrgId) return true;

  // Partner: orgs belonging to their client
  if (userClientId) {
    const [org] = await db
      .select({ clientId: organizations.clientId })
      .from(organizations)
      .where(eq(organizations.id, targetOrgId))
      .limit(1);
    if (org && org.clientId === userClientId) return true;
  }

  return false;
}

/**
 * Files router - handles file uploads and attachments
 */
export const filesRouter = router({
  /**
   * Upload a file to Google Drive (per-customer folder) and attach links to ClickUp and Linear
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

      // Access control
      const hasAccess = await checkFileAccess(
        db,
        ctx.user.id,
        ctx.user.role,
        ctx.user.clientId ?? null,
        ctx.user.organizationId ?? null,
        input.organizationId
      );
      if (!hasAccess) throw new Error("Access denied to this organization's files");

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileSize = fileBuffer.length;

      // Get organization name and Drive folder ID
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!org) throw new Error("Organization not found");

      // Upload to Google Drive (per-customer folder)
      const fileKey = `${Date.now()}-${input.fileName}`;
      const { fileUrl, driveFileId } = await uploadFileToDrive(
        fileKey,
        fileBuffer,
        org.googleDriveFolderId,
        org.name
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
        uploadedBy: ctx.user.email || "unknown",
      });

      // Audit log
      logFileActivity({
        action: "upload",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: org.name,
        fileName: input.fileName,
        fileUrl,
        notes: `Task: ${input.taskName}`,
      }).catch(() => {}); // fire-and-forget

      // Attach to ClickUp and Linear asynchronously
      if (input.clickupTaskId) {
        attachToClickUp(input.clickupTaskId, input.fileName, fileUrl).catch(
          (error) => {
            console.error("[ClickUp] Failed to attach file:", error);
          }
        );
      }

      if (input.linearIssueId) {
        attachToLinear(input.linearIssueId, input.fileName, fileUrl).catch(
          (error) => {
            console.error("[Linear] Failed to attach file:", error);
          }
        );
      }

      return {
        success: true,
        fileId: result.insertId,
        fileUrl,
      };
    }),

  /**
   * Get files for a specific task (with access control)
   */
  getByTask: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Access control
      const hasAccess = await checkFileAccess(
        db,
        ctx.user.id,
        ctx.user.role,
        ctx.user.clientId ?? null,
        ctx.user.organizationId ?? null,
        input.organizationId
      );
      if (!hasAccess) throw new Error("Access denied to this organization's files");

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
   * Delete a file (with access control)
   */
  delete: protectedProcedure
    .input(
      z.object({
        fileId: z.number(),
        organizationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Access control
      const hasAccess = await checkFileAccess(
        db,
        ctx.user.id,
        ctx.user.role,
        ctx.user.clientId ?? null,
        ctx.user.organizationId ?? null,
        input.organizationId
      );
      if (!hasAccess) throw new Error("Access denied to this organization's files");

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

      // Get org name for audit log
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      // Delete from database (Google Drive file remains for audit trail)
      await db
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, input.fileId));

      // Audit log
      logFileActivity({
        action: "delete",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: org?.name || "Unknown",
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        notes: "File deleted from portal (Drive copy retained)",
      }).catch(() => {});

      return { success: true };
    }),
});
