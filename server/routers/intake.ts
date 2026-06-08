import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { requireDb } from "../db";
import { dispatch } from "../notionSyncDispatcher";
import { intakeResponses, intakeFileAttachments, organizations, questions, onboardingFeedback, clients, partnerTemplates, partnerTaskTemplates, orgCustomTasks, templateTaskCompletion, workflowPathways } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { uploadToGoogleDrive } from "./files";
import { resolveFileUrl } from "../googleDrive";
import { logFileActivity } from "../fileAuditLog";
import { resolveOrgByIdentifier } from "../_core/orgLookup";
import { isForeignKeyViolation } from "../dbErrors";
import { fileUploadInput } from "../_core/fileValidation";
import { syncAnswerToNotion, syncFileToNotion, removeFileFromNotion } from "../notion";
import { syncConnectivityToNotion } from "./connectivity";
import { assertOrgAccess } from "../_core/orgAccess";

/**
 * Replace each attachment's stored `fileUrl` with a freshly-resolved, directly
 * renderable URL (see resolveFileUrl). Runs in parallel and never throws — a
 * single failed lookup falls back to the stored URL for that row.
 */
async function resolveFileUrls<T extends { fileUrl: string; driveFileId?: string | null }>(
  files: T[]
): Promise<T[]> {
  return Promise.all(
    files.map(async (file) => {
      try {
        const fileUrl = await resolveFileUrl(file.fileUrl, file.driveFileId);
        return { ...file, fileUrl };
      } catch {
        return file;
      }
    })
  );
}

export const intakeRouter = router({
  /**
   * Get organization info including partner name
   */
  getOrganizationInfo: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await requireDb();

      const org = await resolveOrgByIdentifier(db, input.organizationSlug);
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      let partnerName = "";
      if (org.clientId) {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, org.clientId))
          .limit(1);
        partnerName = client?.name ?? "";
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        clientId: org.clientId,
        partnerName,
      };
    }),
  /**
   * Get file count for an organization
   */
  getFileCount: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await requireDb();

      const org = await resolveOrgByIdentifier(db, input.organizationSlug);

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Count files for this organization
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(intakeFileAttachments)
        .where(eq(intakeFileAttachments.organizationId, org.id));

      return result[0]?.count || 0;
    }),
  /**
   * Get all intake responses for an organization (with org name included)
   */
  getResponses: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      // Resolve organization by slug, with a name-based fallback for orgs
      // whose slug is out-of-sync with their renamed name.
      let org;
      try {
        org = await resolveOrgByIdentifier(db, input.organizationSlug);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Get all responses for this organization from intakeResponses table
      // This table stores questionId as varchar (e.g., "H.1", "A.2") directly
      const responsesData = await db
        .select({
          id: intakeResponses.id,
          organizationId: intakeResponses.organizationId,
          questionId: intakeResponses.questionId, // Already a string identifier
          response: intakeResponses.response,
          fileUrl: intakeResponses.fileUrl,
          userEmail: intakeResponses.updatedBy, // Map updatedBy to userEmail for compatibility
          createdAt: intakeResponses.createdAt,
          updatedAt: intakeResponses.updatedAt,
        })
        .from(intakeResponses)
        .where(eq(intakeResponses.organizationId, org.id));

      // Include organization name in each response
      const responsesWithOrgName = responsesData.map(r => ({
        ...r,
        organizationName: org.name,
        organizationSlug: org.slug,
      }));

      return responsesWithOrgName;
    }),

  /**
   * Save a single intake response (auto-save from questionnaire)
   */
  saveResponse: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        questionId: z.string(),
        response: z.string(),
        userEmail: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      let org;
      try {
        org = await resolveOrgByIdentifier(db, input.organizationSlug);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Use INSERT ... ON DUPLICATE KEY UPDATE to prevent race conditions
      // that can create duplicate rows when concurrent saves hit the server
      try {
        await db.execute(
          sql`INSERT INTO intakeResponses (organizationId, questionId, section, response, updatedBy)
              VALUES (${org.id}, ${input.questionId}, 'intake', ${input.response}, ${input.userEmail})
              ON DUPLICATE KEY UPDATE response = VALUES(response), updatedBy = VALUES(updatedBy)`
        );
      } catch (error) {
        // The org's FK can be rejected if the organization was deleted between
        // the lookup above and this write (cascade delete / concurrent removal).
        // Surface a clean 404 instead of a raw 500.
        if (isForeignKeyViolation(error)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organization no longer exists" });
        }
        throw error;
      }

      // Note: Sync to Notion is now handled by background cron jobs, not on user save
      // This keeps user saves fast and doesn't block on Notion API calls

      return { success: true, action: "upserted" };
    }),

  /**
   * Save multiple responses at once (batch save for auto-save)
   */
  saveResponses: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        responses: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      let org;
      try {
        org = await resolveOrgByIdentifier(db, input.organizationSlug);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Use INSERT ... ON DUPLICATE KEY UPDATE to prevent race conditions
      const userEmail = ctx.user?.email || 'batch-save@system';
      let saved = 0;
      for (const [questionIdStr, response] of Object.entries(input.responses)) {
        // Skip empty responses
        if (!response || response === '' || response === null) continue;

        // Convert response to string for storage
        const responseStr = typeof response === 'object' ? JSON.stringify(response) : String(response);

        try {
          await db.execute(
            sql`INSERT INTO intakeResponses (organizationId, questionId, section, response, updatedBy)
                VALUES (${org.id}, ${questionIdStr}, 'intake', ${responseStr}, ${userEmail})
                ON DUPLICATE KEY UPDATE response = VALUES(response), updatedBy = VALUES(updatedBy)`
          );
        } catch (error) {
          // Every row in this batch targets the same org, so an FK rejection
          // means the organization was deleted underneath us — stop and surface
          // a clean 404 rather than a raw 500 partway through the loop.
          if (isForeignKeyViolation(error)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Organization no longer exists" });
          }
          throw error;
        }

        // Note: Sync to Notion is now handled by background cron jobs, not on user save

        saved++;
      }

      return { success: true, saved };
    }),

  /**
   * Get intake progress summary
   */
  getProgress: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      let org;
      try {
        org = await resolveOrgByIdentifier(db, input.organizationSlug);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Use the same shared utility as the admin dashboard and Home.tsx so
      // all three always show the same number.
      const [{ calculateProgress }, { questionnaireSections }] = await Promise.all([
        import('../../shared/progressCalculation'),
        import('../../shared/questionnaireData'),
      ]);

      const [responsesData, orgFiles, pathwayRows] = await Promise.all([
        db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, org.id)),
        db.select().from(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, org.id)),
        db.select().from(workflowPathways).where(eq(workflowPathways.organizationId, org.id)),
      ]);

      // Surface workflowPathways summaries as synthetic IW.*_description responses
      // so calculateProgress sees the integration-workflows section as answered.
      const existingQids = new Set(responsesData.map(r => r.questionId));
      for (const row of pathwayRows) {
        if (row.pathId !== "__summary") continue;
        const qid = `IW.${row.workflowType}_description`;
        if (existingQids.has(qid)) continue;
        if (!row.notes || row.notes.trim().length === 0) continue;
        responsesData.push({
          id: -1,
          organizationId: org.id,
          questionId: qid,
          section: "integration-workflows",
          response: row.notes,
          fileUrl: null,
          status: "complete",
          updatedBy: null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }

      const allQuestions = questionnaireSections.flatMap((section: any) => {
        if (section.type === 'workflow') {
          return [{ id: `${section.id}_config`, sectionTitle: section.title, isWorkflow: true, conditionalOn: null }];
        }
        if (section.type === 'integration-workflows') {
          return ['orders', 'images', 'priors', 'reports'].map(wf => ({
            id: `IW.${wf}_description`,
            sectionTitle: section.title,
            isWorkflow: false,
            type: 'textarea',
            conditionalOn: null,
          }));
        }
        return (section.questions || []).map((q: any) => ({
          id: q.id,
          sectionTitle: section.title,
          conditionalOn: q.conditionalOn || null,
          type: q.type,
        }));
      });

      const progress = calculateProgress(allQuestions, responsesData, orgFiles);

      return {
        totalQuestions: progress.totalQuestions,
        completedQuestions: progress.completedQuestions,
        completionPercent: progress.completionPercentage,
        sectionProgress: Object.fromEntries(
          Object.entries(progress.sectionProgress).map(([title, s]: [string, any]) => [
            title,
            { total: s.total, completed: s.completed },
          ])
        ),
      };
    }),

  /**
   * Upload file for intake question
   * Uploads to Google Drive for RadOne organizations
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string().max(100),
        questionId: z.string().max(100),
        ...fileUploadInput,
        userEmail: z.string().email().max(320),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Get organization by slug
      let org;
      try {
        [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, input.organizationSlug))
          .limit(1);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Get question details from questionnaireData.ts (primary source)
      // This ensures CF.1-CF.5 and other questions work even if not in DB
      const { questionnaireSections } = await import("../../shared/questionnaireData");
      let questionText = "";
      let shortTitle = "file";
      
      // Find question in questionnaireData.ts
      for (const section of questionnaireSections) {
        if (!section.questions) continue; // Skip workflow sections without questions
        const foundQuestion = section.questions.find(q => q.id === input.questionId);
        if (foundQuestion) {
          questionText = foundQuestion.text; // Use 'text' property, not 'question'
          // Generate short title from question text (first 3-4 words)
          const words = questionText.split(' ').slice(0, 4).join('_');
          shortTitle = words.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
          break;
        }
      }
      
      // Optionally check DB for curated shortTitle (if question exists there)
      const [dbQuestion] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, input.questionId))
        .limit(1);

      if (dbQuestion?.shortTitle) {
        shortTitle = dbQuestion.shortTitle;
      }

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");

      try {
        // Build filename: {orgName}_{userEmail}_{questionId}-{shortTitle}_{timestamp}.{ext}
        const timestamp = Date.now();
        const fileExt = input.fileName.split('.').pop();
        const sanitizedEmail = input.userEmail.replace(/@/g, '-at-').replace(/[^a-zA-Z0-9.-]/g, '_');
        const sanitizedOrgName = org.name.replace(/[^a-zA-Z0-9-]/g, '_');
        const fileName = `${sanitizedOrgName}_${sanitizedEmail}_${input.questionId}-${shortTitle}_${timestamp}.${fileExt}`;
        
        // Upload to Google Drive (per-customer folder)
        const { driveUrl, s3Url, driveFileId: uploadedDriveFileId, s3Key } = await uploadToGoogleDrive(fileName, fileBuffer, org.name, org.googleDriveFolderId, input.mimeType);
        // Use the S3 URL as the canonical link: it serves the raw bytes (with the
        // correct content-type) so it renders in <img> and opens as the file,
        // unlike the Drive webViewLink which is an HTML preview page.
        const fileUrl = s3Url;

        // Store file info in database
        const [intakeFileRes] = await db.insert(intakeFileAttachments).values({
          organizationId: org.id,
          questionId: input.questionId, // String question ID (e.g., "D.13")
          fileName: input.fileName,
          fileUrl,
          driveFileId: s3Key, // S3 object key — used to regenerate a fresh download URL on read
          fileSize: fileBuffer.length,
          mimeType: input.mimeType,
          uploadedBy: input.userEmail,
        });
        dispatch.intakeFile({
          mysqlId: (intakeFileRes as any).insertId || 0,
          organizationId: org.id,
          orgName: org.name,
          questionId: input.questionId,
          fileName: input.fileName,
          fileUrl,
          driveFileId: s3Key,
          fileSize: fileBuffer.length,
          mimeType: input.mimeType,
          uploadedBy: input.userEmail,
          createdAt: new Date(),
        });

        // Audit log
        logFileActivity({
          action: "upload",
          userEmail: input.userEmail,
          userRole: "user",
          organizationName: org.name,
          fileName: input.fileName,
          fileUrl,
          notes: `Questionnaire Q: ${input.questionId}`,
        }).catch(() => {});

        // Note: Sync to Notion is now handled by background cron jobs, not on user save

        return {
          success: true,
          fileUrl,
          message: "File uploaded successfully",
        };
      } catch (error) {
        console.error("[Upload Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload file",
        });
      }
    }),


  /**
   * Get uploaded files for a specific organization and question
   */
  getUploadedFiles: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        questionId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      // Get organization by slug
      let org;
      try {
        [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, input.organizationSlug))
          .limit(1);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Get uploaded files for this question
      const files = await db
        .select()
        .from(intakeFileAttachments)
        .where(
          and(
            eq(intakeFileAttachments.organizationId, org.id),
            eq(intakeFileAttachments.questionId, input.questionId)
          )
        )
        .orderBy(sql`${intakeFileAttachments.createdAt} DESC`);

      return resolveFileUrls(files);
    }),

  /**
   * Get all uploaded files for an organization (for validation)
   */
  getAllUploadedFiles: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      // Get organization by slug
      let org;
      try {
        [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, input.organizationSlug))
          .limit(1);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Get all uploaded files for this organization
      const files = await db
        .select()
        .from(intakeFileAttachments)
        .where(eq(intakeFileAttachments.organizationId, org.id))
        .orderBy(sql`${intakeFileAttachments.createdAt} DESC`);

      return resolveFileUrls(files);
    }),

  /**
   * Preview file content (first few lines for CSV/TXT)
   */
  previewFile: publicProcedure
    .input(
      z.object({
        fileUrl: z.string(),
        fileName: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const fileExt = input.fileName.split('.').pop()?.toLowerCase();
        
        // Only support CSV and TXT preview
        if (!['csv', 'txt'].includes(fileExt || '')) {
          return {
            supported: false,
            message: 'Preview not available for this file type',
          };
        }

        // Fetch file content from S3
        const response = await fetch(input.fileUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch file');
        }

        const text = await response.text();
        const lines = text.split('\n');
        
        // Return first 10 lines
        const preview = lines.slice(0, 10).join('\n');
        const totalLines = lines.length;
        
        return {
          supported: true,
          content: preview,
          totalLines,
          previewLines: Math.min(10, totalLines),
          fileType: fileExt,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to preview file',
        });
      }
    }),

  /**
   * Delete uploaded file (for non-admin users on intake portal)
   */
  deleteFile: publicProcedure
    .input(
      z.object({
        fileId: z.number(),
        organizationSlug: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Get organization by slug
      let org;
      try {
        [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, input.organizationSlug))
          .limit(1);
      } catch (error) {
        console.error('[intake] Database error when fetching organization:', error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Get file details to verify it belongs to this organization
      const [file] = await db
        .select()
        .from(intakeFileAttachments)
        .where(eq(intakeFileAttachments.id, input.fileId))
        .limit(1);

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }

      // Verify file belongs to this organization
      if (file.organizationId !== org.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this file" });
      }

      // Delete from database (S3 file remains)
      await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.id, input.fileId));

      // Remove file from Notion Files column (fire-and-forget)
      if (file.fileUrl) {
        removeFileFromNotion(org.slug, file.questionId, file.fileUrl)
          .catch(err => console.error('[notion] file removal error:', err.message));
      }

      return { success: true };
    }),

  /**
   * Submit onboarding feedback (rating + comments)
   */
  submitFeedback: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        rating: z.number().min(1).max(5),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Get organization by slug
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Insert feedback
      const [fbResult] = await db.insert(onboardingFeedback).values({
        organizationId: org.id,
        rating: input.rating,
        comments: input.comments || null,
        submittedBy: ctx.user?.email || null,
      });
      dispatch.onboardingFeedback({
        mysqlId: (fbResult as any).insertId || 0,
        organizationId: org.id,
        orgName: org.name,
        rating: input.rating,
        comments: input.comments || null,
        submittedBy: ctx.user?.email || null,
        createdAt: new Date(),
      });

      return { success: true };
    }),

  /**
   * Get partner templates for an organization (by slug → clientId)
   * Returns templates scoped to the org's partner so the intake form can show download buttons
   */
  getTemplatesForOrg: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      // Get the org to find its clientId
      const [org] = await db.select().from(organizations)
        .where(eq(organizations.slug, input.organizationSlug)).limit(1);
      if (!org || !org.clientId) return [];

      // Get all active templates for this org's partner
      return await db.select().from(partnerTemplates)
        .where(and(eq(partnerTemplates.clientId, org.clientId), eq(partnerTemplates.isActive, 1)))
        .orderBy(partnerTemplates.questionId);
    }),

  /**
   * Upload an adhoc file (meeting notes, transcripts, etc.) from the dashboard
   */
  uploadAdhocFile: protectedProcedure
    .input(
      z.object({
        organizationSlug: z.string().max(100),
        ...fileUploadInput,
        userEmail: z.string().email().max(320),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const fileBuffer = Buffer.from(input.fileData, "base64");
      const timestamp = Date.now();
      const fileExt = input.fileName.split(".").pop();
      const sanitizedEmail = input.userEmail.replace(/@/g, "-at-").replace(/[^a-zA-Z0-9.-]/g, "_");
      const sanitizedOrg = org.name.replace(/[^a-zA-Z0-9-]/g, "_");
      const storedName = `${sanitizedOrg}_${sanitizedEmail}_ADHOC_${timestamp}.${fileExt}`;

      const { driveUrl, s3Url, driveFileId, s3Key } = await uploadToGoogleDrive(storedName, fileBuffer, org.name, org.googleDriveFolderId, input.mimeType);
      // S3 URL is the canonical link (raw bytes, correct content-type, renders inline).
      const finalUrl = s3Url;

      const [adhocFileRes] = await db.insert(intakeFileAttachments).values({
        organizationId: org.id,
        questionId: "ADHOC",
        fileName: input.fileName,
        fileUrl: finalUrl,
        driveFileId: s3Key,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: input.userEmail,
      });
      dispatch.intakeFile({
        mysqlId: (adhocFileRes as any).insertId || 0,
        organizationId: org.id,
        orgName: org.name,
        questionId: "ADHOC",
        fileName: input.fileName,
        fileUrl: finalUrl,
        driveFileId: s3Key,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: input.userEmail,
        createdAt: new Date(),
      });

      // Audit log
      let auditLogged = true;
      try {
        await logFileActivity({
          action: "upload",
          userEmail: input.userEmail,
          userRole: ctx.user?.role || "user",
          organizationName: org.name,
          fileName: input.fileName,
          fileUrl: finalUrl,
          notes: `Adhoc Upload | Drive: ${driveUrl ? 'Yes' : 'No'} | S3: Yes`,
        });
      } catch (e) {
        auditLogged = false;
      }

      return { 
        success: true, 
        fileUrl: finalUrl,
        status: {
          drive: !!driveUrl,
          s3: true,
          audit: auditLogged
        }
      };
    }),

  /**
   * Get adhoc files for an organization
   */
  getAdhocFiles: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const adhocFiles = await db
        .select()
        .from(intakeFileAttachments)
        .where(
          and(
            eq(intakeFileAttachments.organizationId, org.id),
            eq(intakeFileAttachments.questionId, "ADHOC")
          )
        )
        .orderBy(sql`${intakeFileAttachments.createdAt} DESC`);

      return resolveFileUrls(adhocFiles);
    }),

  /**
   * Get active vendor options grouped by system type (for intake form dropdowns)
   */
  getActiveVendorOptions: publicProcedure.query(async () => {
    const db = await requireDb();

    const { systemVendorOptions } = await import("../../drizzle/schema");
    const activeOptions = await db.select().from(systemVendorOptions)
      .where(eq(systemVendorOptions.isActive, 1))
      .orderBy(systemVendorOptions.systemType, systemVendorOptions.vendorName);

    // Group by systemType (alphabetized, with "Other" always last)
    const grouped: Record<string, string[]> = {};
    for (const opt of activeOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt.vendorName);
    }
    // Ensure "Other" is always last in each group
    for (const key of Object.keys(grouped)) {
      const list = grouped[key];
      const otherIdx = list.indexOf('Other');
      if (otherIdx > -1) {
        list.splice(otherIdx, 1);
        list.push('Other');
      }
    }
    return grouped;
  }),

  /**
   * Add a vendor option from the intake questionnaire.
   * Trims input, dedupes case-insensitively (returns the existing canonical name
   * so the caller can still select it), and logs to the audit trail.
   */
  addVendorOption: publicProcedure
    .input(z.object({
      systemType: z.string().min(1),
      vendorName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { systemVendorOptions, vendorAuditLog } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");

      const systemType = input.systemType.trim();
      const vendorName = input.vendorName.trim().replace(/\s+/g, " ");
      if (!systemType || !vendorName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "System type and vendor name are required." });
      }

      const existing = await db.select().from(systemVendorOptions)
        .where(eq(systemVendorOptions.systemType, systemType))
        .orderBy(desc(systemVendorOptions.displayOrder));

      const dup = existing.find(v => v.vendorName.toLowerCase() === vendorName.toLowerCase());
      if (dup) {
        // Idempotent: if the vendor already exists (active or hidden), make sure
        // it's active so the caller can pick it, and return the canonical name.
        if (!dup.isActive) {
          await db.update(systemVendorOptions)
            .set({ isActive: 1 })
            .where(eq(systemVendorOptions.id, dup.id));
          const [toggleAuditRes] = await db.insert(vendorAuditLog).values({
            action: 'toggle',
            systemType,
            vendorName: dup.vendorName,
            previousValue: 'inactive',
            newValue: 'active',
            performedBy: ctx.user?.email || "intake-user",
          });
          dispatch.vendorAudit({
            mysqlId: (toggleAuditRes as any).insertId || 0,
            vendorId: dup.id,
            action: 'toggle',
            field: systemType,
            oldValue: 'inactive',
            newValue: 'active',
            performedBy: ctx.user?.email || "intake-user",
            createdAt: new Date(),
          });
        }
        return { success: true, vendorName: dup.vendorName, alreadyExisted: true };
      }

      const maxOrder = existing.length > 0 ? existing[0].displayOrder : 0;
      const [newVendorRes] = await db.insert(systemVendorOptions).values({
        systemType,
        vendorName,
        displayOrder: maxOrder + 1,
        createdBy: ctx.user?.email || "intake-user",
      });
      dispatch.systemVendor({
        mysqlId: (newVendorRes as any).insertId || 0,
        systemType,
        vendorName,
        productName: vendorName,
        active: true,
        createdAt: new Date(),
      });

      const [addAuditRes] = await db.insert(vendorAuditLog).values({
        action: 'add',
        systemType,
        vendorName,
        newValue: vendorName,
        performedBy: ctx.user?.email || "intake-user",
      });
      dispatch.vendorAudit({
        mysqlId: (addAuditRes as any).insertId || 0,
        vendorId: (newVendorRes as any).insertId || 0,
        action: 'add',
        field: systemType,
        oldValue: null,
        newValue: vendorName,
        performedBy: ctx.user?.email || "intake-user",
        createdAt: new Date(),
      });

      return { success: true, vendorName, alreadyExisted: false };
    }),


  /**
   * Get task templates for an org (by slug → clientId → partner tasks).
   * Used by the Tasks page to show partner-defined action items.
   */
  getTaskTemplatesForOrg: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [org] = await db
        .select({ id: organizations.id, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org?.clientId) return [];

      return db
        .select()
        .from(partnerTaskTemplates)
        .where(and(
          eq(partnerTaskTemplates.clientId, org.clientId),
          eq(partnerTaskTemplates.isActive, 1),
        ))
        .orderBy(partnerTaskTemplates.sortOrder, partnerTaskTemplates.id);
    }),

  /**
   * Parse an uploaded document with the LLM and extract answers for the questionnaire.
   * Supports PDF and images. Returns a map of questionId -> extracted answer.
   */
  parseDocumentForAutofill: publicProcedure
    .input(z.object({
      fileData: z.string(), // base64 encoded file content
      mimeType: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("../_core/llm");
      const { questionnaireSections } = await import("../../shared/questionnaireData");

      // Collect only answerable (non-upload, non-workflow) questions
      const fillableQuestions = questionnaireSections.flatMap((section) => {
        if (section.type === 'workflow' || !section.questions) return [];
        return section.questions
          .filter((q) => q.type !== 'upload' && q.type !== 'upload-download')
          .map((q) => ({
            id: q.id,
            text: q.text,
            type: q.type,
            options: q.options ?? null,
            section: section.title,
          }));
      });

      const questionsPrompt = fillableQuestions.map((q) => {
        let line = `[${q.id}] ${q.text} (type: ${q.type}`;
        if (q.options) line += `, options: ${q.options.join(' | ')}`;
        line += ')';
        return line;
      }).join('\n');

      const systemPrompt =
        `You are an expert at extracting information from medical imaging onboarding documents to pre-fill a questionnaire. ` +
        `Analyze the provided document and extract only information that clearly maps to the questionnaire fields. ` +
        `For dropdown fields, your answer must be one of the listed options exactly. ` +
        `For multi-select fields, return a JSON array of selected options. ` +
        `For date fields, use MM/DD/YYYY format. ` +
        `Return ONLY a valid JSON object where keys are question IDs (e.g. "H.1") and values are the extracted answers as strings. ` +
        `Omit any question for which you cannot find a clear answer in the document.`;

      const userPrompt =
        `Please analyze this document and extract information to fill out the following questionnaire fields:\n\n` +
        `${questionsPrompt}\n\n` +
        `Return a JSON object like:\n` +
        `{\n  "H.1": "3",\n  "A.1": "Jane Smith, IT Director, jane@example.com",\n  "D.3": ["CT","MRI"]\n}\n\n` +
        `Only include fields where the document contains relevant information.`;

      // Build the file content block for the LLM
      let fileContentBlock: Record<string, unknown>;
      const { mimeType, fileData } = input;

      if (mimeType.startsWith('image/')) {
        fileContentBlock = {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${fileData}`,
            detail: 'high',
          },
        };
      } else {
        fileContentBlock = {
          type: 'file_url',
          file_url: {
            url: `data:${mimeType};base64,${fileData}`,
            mime_type: mimeType === 'application/pdf' ? 'application/pdf' : 'application/pdf',
          },
        };
      }

      const result = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              fileContentBlock as any,
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        responseFormat: { type: 'json_object' },
      });

      const rawContent = result.choices[0]?.message?.content;
      const rawText = typeof rawContent === 'string'
        ? rawContent
        : JSON.stringify(rawContent ?? {});

      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { answers = JSON.parse(jsonMatch[0]); } catch { /* leave empty */ }
        }
      }

      // Normalise all values to strings (multi-select stays as array → JSON string stored later by the form)
      const normalised: Record<string, string> = {};
      for (const [id, val] of Object.entries(answers)) {
        if (val === null || val === undefined) continue;
        normalised[id] = Array.isArray(val) ? JSON.stringify(val) : String(val);
      }

      return { answers: normalised };
    }),

  // ---------------------------------------------------------------------------
  // Org-specific custom tasks (added by hospital users, not partner templates)
  // ---------------------------------------------------------------------------

  /**
   * Get all custom tasks for an org (by slug).
   */
  getOrgCustomTasks: publicProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) return [];

      return db
        .select()
        .from(orgCustomTasks)
        .where(eq(orgCustomTasks.organizationId, org.id))
        .orderBy(orgCustomTasks.createdAt);
    }),

  /**
   * Add a custom task to an org's task list.
   */
  addOrgCustomTask: publicProcedure
    .input(z.object({
      organizationSlug: z.string(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      section: z.string().optional(),
      type: z.enum(["review", "upload", "schedule", "form"]).default("review"),
      userEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      const [result] = await db.insert(orgCustomTasks).values({
        organizationId: org.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        section: input.section?.trim() || null,
        type: input.type,
        createdBy: input.userEmail || null,
        isComplete: 0,
      });
      dispatch.orgCustomTask({
        mysqlId: result.insertId || 0,
        organizationId: org.id,
        orgName: input.organizationSlug,
        taskId: `custom-${result.insertId}`,
        title: input.title.trim(),
        section: input.section?.trim() || null,
        description: input.description?.trim() || null,
        owner: input.userEmail || null,
        status: "pending",
        createdBy: input.userEmail || null,
        createdAt: new Date(),
      });

      const [created] = await db
        .select()
        .from(orgCustomTasks)
        .where(eq(orgCustomTasks.id, result.insertId))
        .limit(1);

      return created;
    }),

  /**
   * Toggle completion state of a custom task.
   */
  toggleOrgCustomTask: publicProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [task] = await db
        .select()
        .from(orgCustomTasks)
        .where(eq(orgCustomTasks.id, input.taskId))
        .limit(1);

      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      await db
        .update(orgCustomTasks)
        .set({ isComplete: task.isComplete ? 0 : 1 })
        .where(eq(orgCustomTasks.id, input.taskId));

      return { id: task.id, isComplete: !task.isComplete };
    }),

  /**
   * Delete a custom task.
   */
  deleteOrgCustomTask: publicProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      await db
        .delete(orgCustomTasks)
        .where(eq(orgCustomTasks.id, input.taskId));

      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // Per-org completion state for partner template tasks
  // ---------------------------------------------------------------------------

  /**
   * Get the per-org completion state for partner template tasks.
   * Returns the rows so the client can build the set of completed template IDs.
   */
  getTemplateTaskCompletion: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select({ id: organizations.id, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) return [];

      // Verify access: platform admin, partner admin (if org.clientId matches), or org user
      await assertOrgAccess(ctx.user, org);

      return db
        .select()
        .from(templateTaskCompletion)
        .where(eq(templateTaskCompletion.organizationId, org.id));
    }),

  /**
   * Toggle completion state of a partner template task for a specific org.
   * Upserts on (organizationId, templateTaskId): creates a completed row the
   * first time, then flips isComplete on subsequent calls.
   */
  toggleTemplateTask: protectedProcedure
    .input(z.object({
      organizationSlug: z.string(),
      templateTaskId: z.number(),
      userEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [org] = await db
        .select({ id: organizations.id, clientId: organizations.clientId })
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      // Verify access: platform admin, partner admin (if org.clientId matches), or org user
      await assertOrgAccess(ctx.user, org);

      const [existing] = await db
        .select()
        .from(templateTaskCompletion)
        .where(and(
          eq(templateTaskCompletion.organizationId, org.id),
          eq(templateTaskCompletion.templateTaskId, input.templateTaskId),
        ))
        .limit(1);

      if (existing) {
        const nextComplete = existing.isComplete ? 0 : 1;
        await db
          .update(templateTaskCompletion)
          .set({
            isComplete: nextComplete,
            completedAt: nextComplete ? new Date() : null,
            completedBy: nextComplete ? (input.userEmail || null) : null,
          })
          .where(eq(templateTaskCompletion.id, existing.id));

        return { templateTaskId: input.templateTaskId, isComplete: !!nextComplete };
      }

      await db.insert(templateTaskCompletion).values({
        organizationId: org.id,
        templateTaskId: input.templateTaskId,
        isComplete: 1,
        completedAt: new Date(),
        completedBy: input.userEmail || null,
      });

      return { templateTaskId: input.templateTaskId, isComplete: true };
    }),
});
