import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAttachments, organizations, clients } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function resolveFileKey(
  organizationId: number,
  fileName: string,
  userEmail: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) throw new Error("Organization not found");

  // Build timestamp YYYYMMDD-HHMM
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  // Build uploader name from authenticated user email
  const uploaderName = userEmail.split("@")[0] || "unknown";

  // Build filename: baseName_YYYYMMDD-HHMM_user.ext
  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const baseName = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;
  const formattedName = `${baseName}_${timestamp}_${uploaderName}${ext}`;

  // NL Admin - no clientId
  if (!org.clientId) {
    return `New Lantern/${formattedName}`;
  }

  // Get partner name
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, org.clientId))
    .limit(1);

  const partnerName = client?.name || `client-${org.clientId}`;

  // Customer upload - nest under partner/customer
  if (org.name && org.name !== client?.name) {
    return `${partnerName}/${org.name}/${formattedName}`;
  }

  // Partner upload
  return `${partnerName}/${formattedName}`;
}

export const filesRouter = router({
  upload: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        taskId: z.string(),
        taskName: z.string(),
        fileName: z.string(),
        fileData: z.string(),
        mimeType: z.string(),
        linearIssueId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileSize = fileBuffer.length;

      // Use authenticated user's email
      const userEmail = ctx.user.email || "unknown";

      const fileKey = await resolveFileKey(
        input.organizationId,
        input.fileName,
        userEmail
      );

      const { storagePut } = await import("../storage");
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      const [result] = await db.insert(fileAttachments).values({
        organizationId: input.organizationId,
        taskId: input.taskId,
        fileName: input.fileName,
        fileUrl,
        fileKey,
        fileSize,
        mimeType: input.mimeType,
        uploadedBy: userEmail,
      });

      if (input.linearIssueId) {
        console.log(`[Linear] File uploaded for issue ${input.linearIssueId}: ${fileUrl}`);
      }

      return {
        success: true,
        fileId: result.insertId,
        fileUrl,
      };
    }),

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

      return db
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.organizationId, input.organizationId),
            eq(fileAttachments.taskId, input.taskId)
          )
        );
    }),

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

      if (!file) throw new Error("File not found or access denied");

      await db.delete(fileAttachments).where(eq(fileAttachments.id, input.fileId));

      return { success: true };
    }),
});
