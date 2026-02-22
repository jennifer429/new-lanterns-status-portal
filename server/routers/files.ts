import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations, clients } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Determine the Google Drive folder path based on who is uploading
 */
async function resolveFileKey(
  organizationId: number,
  fileName: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) throw new Error("Organization not found");

  const timestamp = Date.now();

  // NL Admin - no clientId, goes to shared New Lantern folder
  if (!org.clientId) {
    return `New Lantern/${timestamp}-${fileName}`;
  }

  // Get partner/client name
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, org.clientId))
    .limit(1);

  const partnerName = client?.name || `client-${org.clientId}`;

  // If org has its own name (customer), nest under partner
  if (org.name && org.name !== client?.name) {
    return `${partnerName}/${org.name}/${timestamp}-${fileName}`;
  }

  // Partner-level upload
  return `${partnerName}/${timestamp}-${fileName}`;
}

export const filesRouter = router({
  /**
   * Upload a file to Google Drive
   */
  upload: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
        taskName: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
        uploadedBy: z.string().optional(),
        linearIssueId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileSize = fileBuffer.length;

      // Resolve folder path based on org/role
      const fileKey = await resolveFileKey(input.organizationId, input.fileName);

      // Upload to Google Drive
      const { storagePut } = await import("../storage");
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

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

      // Optionally attach to Linear
      if (input.linearIssueId) {
        console.log(`[Linear] File uploaded for issue ${input.linearIssueId}: ${fileUrl}`);
        // Wire up Linear API here later if needed
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
   * Delete a file (removes from DB, keeps in Drive for audit trail)
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

      await db.delete(fileAttachments).where(eq(fileAttachments.id, input.fileId));

      return { success: true };
    }),
});
