import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import {
  partnerDocuments,
  partnerDocAudit,
  organizations,
  clients,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { uploadToGoogleDrive } from "./files";
import { storageGet } from "../storage";

/**
 * Document Library router — partner-scoped document management.
 *
 * See CLAUDE.md "Business Rules & Permissions > Document Library" for the full
 * permissions matrix. Summary:
 *   - Platform admins: full access across all partners
 *   - Partner admins: upload/delete/audit for own partner only
 *   - Org users (customers): view + download only, no upload/delete/audit
 *
 * All documents are stored in Google Drive; metadata + audit trail live in the database.
 */

/** Resolve the clientId the current user has access to */
function resolveClientId(user: { role: string; clientId: number | null; organizationId: number | null }, explicitClientId?: number): number | null {
  // Platform admin can access any partner if specified
  if (user.role === "admin" && !user.clientId && explicitClientId) {
    return explicitClientId;
  }
  // Partner admin — scoped to their own clientId
  if (user.clientId) {
    return user.clientId;
  }
  return null;
}

export const proceduralLibraryRouter = router({
  // ============================================================================
  // DOCUMENTS — list, upload, delete
  // ============================================================================

  /** List documents. Platform admins see all docs; partner admins see their own; org users see their partner's. */
  listDocuments: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await requireDb();

      const isPlatformAdmin = ctx.user.role === "admin" && !ctx.user.clientId;

      // Platform admin with no filter → return ALL documents across all partners
      if (isPlatformAdmin && !input?.clientId) {
        const docs = await db.select()
          .from(partnerDocuments)
          .orderBy(desc(partnerDocuments.createdAt));

        // Fetch all clients to map names
        const allClients = await db.select().from(clients);
        const clientMap = new Map(allClients.map(c => [c.id, c.name]));

        return docs.map(doc => ({
          ...doc,
          partnerName: clientMap.get(doc.clientId) ?? "Unknown",
        }));
      }

      // Platform admin with filter, or partner admin, or org user
      let targetClientId: number | null = null;

      if (ctx.user.clientId) {
        targetClientId = ctx.user.clientId;
      } else if (isPlatformAdmin && input?.clientId) {
        targetClientId = input.clientId;
      } else if (ctx.user.organizationId) {
        const [org] = await db.select({ clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.id, ctx.user.organizationId));
        targetClientId = org?.clientId ?? null;
      }

      if (!targetClientId) {
        return [];
      }

      const docs = await db.select()
        .from(partnerDocuments)
        .where(eq(partnerDocuments.clientId, targetClientId))
        .orderBy(desc(partnerDocuments.createdAt));

      // Get partner name
      const [client] = await db.select().from(clients).where(eq(clients.id, targetClientId));
      const partnerName = client?.name ?? "Unknown";

      return docs.map(doc => ({
        ...doc,
        partnerName,
      }));
    }),

  /** Upload a document to Google Drive and save metadata */
  uploadDocument: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      fileName: z.string(),
      fileData: z.string(), // base64
      mimeType: z.string(),
      clientId: z.number().optional(), // required for platform admins
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const targetClientId = resolveClientId(ctx.user, input.clientId);
      if (!targetClientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A partner must be selected" });
      }
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can upload documents" });
      }

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const timestamp = Date.now();
      const fileExt = input.fileName.split('.').pop() || "bin";
      const driveFileName = `procedural-library_${targetClientId}_${timestamp}.${fileExt}`;

      // Upload to Google Drive
      const fileUrl = await uploadToGoogleDrive(driveFileName, fileBuffer, "");

      // Insert metadata
      const [inserted] = await db.insert(partnerDocuments).values({
        clientId: targetClientId,
        categoryId: null,
        title: input.title,
        description: null,
        filename: input.fileName,
        driveFileId: driveFileName,
        url: fileUrl,
        mimeType: input.mimeType,
        size: fileBuffer.length,
        uploadedById: ctx.user.id,
        uploadedByName: ctx.user.name || ctx.user.email || "Unknown",
      });

      // Log audit event
      await db.insert(partnerDocAudit).values({
        documentId: inserted.insertId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        userEmail: ctx.user.email || "unknown",
        action: "upload",
      });

      return { success: true, fileUrl };
    }),

  /** Delete a document (admin only) */
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, input.id));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Partner admin can only delete their own partner's documents
      if (ctx.user.clientId && doc.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your document" });
      }
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete documents" });
      }

      // Delete audit entries first, then the document
      await db.delete(partnerDocAudit).where(eq(partnerDocAudit.documentId, input.id));
      await db.delete(partnerDocuments).where(eq(partnerDocuments.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // AUDIT — log view/download events, get trail
  // ============================================================================

  /** Log a view or download event */
  logAudit: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      action: z.enum(["view", "download"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      await db.insert(partnerDocAudit).values({
        documentId: input.documentId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        userEmail: ctx.user.email || "unknown",
        action: input.action,
      });

      return { success: true };
    }),

  /**
   * Get a fresh download URL for a document.
   * Google Drive webViewLinks are permanent and returned as-is.
   * Forge/S3 pre-signed URLs expire — we regenerate them on demand so customers
   * never hit a stale link regardless of when the file was uploaded.
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();

      const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Verify the user can access documents for this partner
      let targetClientId: number | null = null;
      if (ctx.user.clientId) {
        targetClientId = ctx.user.clientId;
      } else if (ctx.user.organizationId) {
        const [org] = await db.select({ clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.id, ctx.user.organizationId));
        targetClientId = org?.clientId ?? null;
      } else if (ctx.user.role === "admin" && !ctx.user.clientId) {
        // Platform admin can access any document
        targetClientId = doc.clientId;
      }

      if (targetClientId !== doc.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this document" });
      }

      // Google Drive URLs are permanent — return as stored
      if (doc.url.startsWith("https://drive.google.com")) {
        return { url: doc.url };
      }

      // Forge/S3 storage — regenerate a fresh pre-signed URL from the stored key
      const storageKey = doc.driveFileId
        ? `uploads/unknown/${doc.driveFileId}`
        : null;

      if (!storageKey) {
        return { url: doc.url }; // fallback: return whatever we have
      }

      try {
        const { url } = await storageGet(storageKey);
        return { url };
      } catch {
        // If key lookup fails, fall back to the stored URL
        return { url: doc.url };
      }
    }),

  /** Get audit trail for a specific document (admin only) */
  getAuditTrail: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();

      // Only admins can view audit trails
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can view audit trails" });
      }

      const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Partner admins can only see audit trails for their own partner's documents
      if (ctx.user.clientId && doc.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this document" });
      }

      return db.select()
        .from(partnerDocAudit)
        .where(eq(partnerDocAudit.documentId, input.documentId))
        .orderBy(desc(partnerDocAudit.createdAt));
    }),
});
