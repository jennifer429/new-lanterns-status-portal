import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { orgNotes, organizations } from "../../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { orgIdentifierMatches } from "../_core/orgLookup";
import { uploadToGoogleDrive } from "./files";
import { logFileActivity } from "../fileAuditLog";
import { TRPCError } from "@trpc/server";

/**
 * Notes router — labeled file uploads for org and partner dashboards.
 * Org users upload notes scoped to their organization (organizationId set).
 * Partner admins upload notes scoped to their client (clientId set, organizationId null).
 */
export const notesRouter = router({
  /**
   * Upload a labeled file from an org dashboard.
   */
  uploadForOrg: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        label: z.string().min(1).max(100),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      // Enforce partner-scoped access
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const timestamp = Date.now();
      const ext = input.fileName.split(".").pop();
      const sanitizedLabel = input.label.replace(/[^a-zA-Z0-9-]/g, "_");
      const sanitizedOrg = org.name.replace(/[^a-zA-Z0-9-]/g, "_");
      const driveFileId = `${sanitizedOrg}_${sanitizedLabel}_${timestamp}.${ext}`;

      const fileUrl = await uploadToGoogleDrive(driveFileId, fileBuffer, org.name, org.googleDriveFolderId);

      await db.insert(orgNotes).values({
        organizationId: org.id,
        clientId: org.clientId,
        label: input.label,
        fileName: input.fileName,
        fileUrl,
        driveFileId,
        fileSize: fileBuffer.length,
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
        notes: `Note label: ${input.label}`,
      }).catch(() => {});

      return { success: true, fileUrl };
    }),

  /**
   * Upload a labeled file from a partner dashboard (scoped to clientId only).
   */
  uploadForClient: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        label: z.string().min(1).max(100),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Partner users can only upload to their own clientId; platform admins can upload to any
      if (ctx.user.clientId && ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const timestamp = Date.now();
      const ext = input.fileName.split(".").pop();
      const sanitizedLabel = input.label.replace(/[^a-zA-Z0-9-]/g, "_");
      const driveFileId = `partner_${input.clientId}_${sanitizedLabel}_${timestamp}.${ext}`;

      const fileUrl = await uploadToGoogleDrive(driveFileId, fileBuffer, `partner_${input.clientId}`);

      await db.insert(orgNotes).values({
        organizationId: null,
        clientId: input.clientId,
        label: input.label,
        fileName: input.fileName,
        fileUrl,
        driveFileId,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.email || "unknown",
      });

      // Audit log
      logFileActivity({
        action: "upload",
        userEmail: ctx.user.email || "unknown",
        userRole: ctx.user.role,
        organizationName: `Partner ${input.clientId}`,
        fileName: input.fileName,
        fileUrl,
        notes: `Partner note: ${input.label}`,
      }).catch(() => {});

      return { success: true, fileUrl };
    }),

  /**
   * List labeled notes for an organization.
   */
  listByOrg: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(orgIdentifierMatches(input.organizationSlug))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return await db
        .select()
        .from(orgNotes)
        .where(eq(orgNotes.organizationId, org.id))
        .orderBy(desc(orgNotes.createdAt));
    }),

  /**
   * List labeled notes for a partner (partner-level notes only, not org-specific).
   */
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      if (ctx.user.clientId && ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return await db
        .select()
        .from(orgNotes)
        .where(
          and(
            eq(orgNotes.clientId, input.clientId),
            isNull(orgNotes.organizationId)
          )
        )
        .orderBy(desc(orgNotes.createdAt));
    }),

  /**
   * Delete a note by ID. Users can only delete notes they own or their org/client owns.
   */
  delete: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [note] = await db
        .select()
        .from(orgNotes)
        .where(eq(orgNotes.id, input.noteId))
        .limit(1);

      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });

      // Access check: partner users can only delete notes in their client
      if (ctx.user.clientId && note.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db.delete(orgNotes).where(eq(orgNotes.id, input.noteId));
      return { success: true };
    }),
});
