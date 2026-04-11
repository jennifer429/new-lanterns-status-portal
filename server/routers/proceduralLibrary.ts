import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  partnerDocuments,
  partnerDocCategories,
  partnerDocAudit,
  organizations,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { uploadToGoogleDrive } from "./files";

/**
 * Procedural Library router — partner-scoped document management.
 *
 * Partners (admins with clientId) can upload, edit metadata, and delete documents.
 * Platform admins can do everything for any partner.
 * Org users (regular users with organizationId) can view and download their partner's documents.
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
  // CATEGORIES — CRUD for partner admins
  // ============================================================================

  /** List categories for a partner */
  listCategories: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let targetClientId: number | null = null;

      if (ctx.user.clientId) {
        targetClientId = ctx.user.clientId;
      } else if (ctx.user.role === "admin" && input?.clientId) {
        targetClientId = input.clientId;
      } else if (ctx.user.organizationId) {
        // Org user — look up their org's clientId
        const [org] = await db.select({ clientId: organizations.clientId })
          .from(organizations)
          .where(eq(organizations.id, ctx.user.organizationId));
        targetClientId = org?.clientId ?? null;
      }

      if (!targetClientId) {
        return [];
      }

      return db.select()
        .from(partnerDocCategories)
        .where(eq(partnerDocCategories.clientId, targetClientId))
        .orderBy(partnerDocCategories.name);
    }),

  /** Create a category */
  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const targetClientId = resolveClientId(ctx.user, input.clientId);
      if (!targetClientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No partner access" });
      }
      // Only admins can create categories
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can manage categories" });
      }

      await db.insert(partnerDocCategories).values({
        clientId: targetClientId,
        name: input.name,
      });
      return { success: true };
    }),

  /** Rename a category */
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [cat] = await db.select().from(partnerDocCategories).where(eq(partnerDocCategories.id, input.id));
      if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });

      // Partner admin can only edit their own categories
      if (ctx.user.clientId && cat.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your category" });
      }
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can manage categories" });
      }

      await db.update(partnerDocCategories)
        .set({ name: input.name })
        .where(eq(partnerDocCategories.id, input.id));
      return { success: true };
    }),

  /** Delete a category (sets documents in that category to uncategorized) */
  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [cat] = await db.select().from(partnerDocCategories).where(eq(partnerDocCategories.id, input.id));
      if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });

      if (ctx.user.clientId && cat.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your category" });
      }
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can manage categories" });
      }

      // Unlink documents from this category
      await db.update(partnerDocuments)
        .set({ categoryId: null })
        .where(eq(partnerDocuments.categoryId, input.id));

      await db.delete(partnerDocCategories).where(eq(partnerDocCategories.id, input.id));
      return { success: true };
    }),

  // ============================================================================
  // DOCUMENTS — list, upload, delete
  // ============================================================================

  /** List documents for a partner (with category info and audit counts) */
  listDocuments: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let targetClientId: number | null = null;

      if (ctx.user.clientId) {
        targetClientId = ctx.user.clientId;
      } else if (ctx.user.role === "admin" && input?.clientId) {
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

      // Fetch documents
      const docs = await db.select()
        .from(partnerDocuments)
        .where(eq(partnerDocuments.clientId, targetClientId))
        .orderBy(desc(partnerDocuments.createdAt));

      // Fetch categories for this partner (to join client-side)
      const categories = await db.select()
        .from(partnerDocCategories)
        .where(eq(partnerDocCategories.clientId, targetClientId));

      const catMap = new Map(categories.map(c => [c.id, c.name]));

      return docs.map(doc => ({
        ...doc,
        categoryName: doc.categoryId ? catMap.get(doc.categoryId) ?? "Uncategorized" : "Uncategorized",
      }));
    }),

  /** Upload a document to Google Drive and save metadata */
  uploadDocument: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(2000).optional(),
      categoryId: z.number().nullable().optional(),
      fileName: z.string(),
      fileData: z.string(), // base64
      mimeType: z.string(),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const targetClientId = resolveClientId(ctx.user, input.clientId);
      if (!targetClientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No partner access" });
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
        categoryId: input.categoryId ?? null,
        title: input.title,
        description: input.description ?? null,
        filename: input.fileName,
        driveFileId: driveFileName, // Store the drive filename as reference
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.insert(partnerDocAudit).values({
        documentId: input.documentId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        userEmail: ctx.user.email || "unknown",
        action: input.action,
      });

      return { success: true };
    }),

  /** Get audit trail for a specific document */
  getAuditTrail: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify user has access to this document's partner
      const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      if (ctx.user.clientId && doc.clientId !== ctx.user.clientId) {
        // Check if org user belongs to this partner
        if (ctx.user.organizationId) {
          const [org] = await db.select({ clientId: organizations.clientId })
            .from(organizations)
            .where(eq(organizations.id, ctx.user.organizationId));
          if (!org || org.clientId !== doc.clientId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "No access to this document" });
          }
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "No access to this document" });
        }
      }

      return db.select()
        .from(partnerDocAudit)
        .where(eq(partnerDocAudit.documentId, input.documentId))
        .orderBy(desc(partnerDocAudit.createdAt));
    }),
});
