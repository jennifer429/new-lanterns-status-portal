import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { intakeResponses, intakeFileAttachments, organizations, questions, onboardingFeedback, clients, partnerTemplates, partnerTaskTemplates, orgCustomTasks, workflowPathways } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { uploadToGoogleDrive } from "./files";
import { logFileActivity } from "../fileAuditLog";

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

      // Get organization with partner info via LEFT JOIN
      const result = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          clientId: organizations.clientId,
          partnerName: sql<string>`COALESCE(clients.name, '')`,
        })
        .from(organizations)
        .leftJoin(sql`clients`, sql`organizations.clientId = clients.id`)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      if (!result || result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      return result[0];
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

      // Get organization by slug
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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
   * Save or update an intake response
   */
  saveResponse: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        questionId: z.string(), // Question identifier (e.g., "H.1", "A.2")
        response: z.string(),
        userEmail: z.string(),
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Use intakeResponses table which stores questionId as varchar (no foreign key validation)
      // Check if response already exists
      const [existing] = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.organizationId, org.id),
            eq(intakeResponses.questionId, input.questionId)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing response
        await db
          .update(intakeResponses)
          .set({
            response: input.response,
            updatedBy: input.userEmail,
          })
          .where(eq(intakeResponses.id, existing.id));

        return { success: true, action: "updated" };
      } else {
        // Insert new response
        await db.insert(intakeResponses).values({
          organizationId: org.id,
          questionId: input.questionId,
          section: 'intake', // Default section
          response: input.response,
          updatedBy: input.userEmail,
        });

        return { success: true, action: "created" };
      }
    }),

  /**
   * Save multiple responses at once (batch save for auto-save)
   */
  saveResponses: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        responses: z.record(z.string(), z.any()),
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
      }

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      // Process each response using intakeResponses table (no question validation)
      const results = [];
      for (const [questionIdStr, response] of Object.entries(input.responses)) {
        // Skip empty responses
        if (!response || response === '' || response === null) continue;

        // Convert response to string for storage
        const responseStr = typeof response === 'object' ? JSON.stringify(response) : String(response);

        // Check if response already exists in intakeResponses table
        const [existing] = await db
          .select()
          .from(intakeResponses)
          .where(
            and(
              eq(intakeResponses.organizationId, org.id),
              eq(intakeResponses.questionId, questionIdStr)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing response
          await db
            .update(intakeResponses)
            .set({
              response: responseStr,
              updatedBy: ctx.user?.email || 'batch-save@system',
            })
            .where(eq(intakeResponses.id, existing.id));
          results.push({ questionId: questionIdStr, action: "updated" });
        } else {
          // Insert new response
          await db.insert(intakeResponses).values({
            organizationId: org.id,
            questionId: questionIdStr,
            section: 'intake', // Default section
            response: responseStr,
            updatedBy: ctx.user?.email || 'batch-save@system',
          });
          results.push({ questionId: questionIdStr, action: "created" });
        }
      }

      return { success: true, saved: results.length };
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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
  uploadFile: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        questionId: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded file data
        mimeType: z.string(),
        userEmail: z.string().email(),
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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
        const fileUrl = await uploadToGoogleDrive(fileName, fileBuffer, org.name, org.googleDriveFolderId);
        const s3Key = fileName; // store filename as reference

        // Store file info in database
        await db.insert(intakeFileAttachments).values({
          organizationId: org.id,
          questionId: input.questionId, // String question ID (e.g., "D.13")
          fileName: input.fileName,
          fileUrl,
          driveFileId: s3Key, // Store S3 key for reference
          fileSize: fileBuffer.length,
          mimeType: input.mimeType,
          uploadedBy: input.userEmail,
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

        return {
          success: true,
          fileUrl,
          message: "File uploaded successfully",
        };
      } catch (error: any) {
        console.error("[Upload Error] Full error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to upload file: ${error.message}`,
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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

      return files;
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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

      return files;
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error: " + (error instanceof Error ? error.message : String(error)) });
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

      return { success: true };
    }),

  /**
   * Submit onboarding feedback
   */
  submitFeedback: publicProcedure
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
      await db.insert(onboardingFeedback).values({
        organizationId: org.id,
        rating: input.rating,
        comments: input.comments || null,
        submittedBy: ctx.user?.email || null,
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
  uploadAdhocFile: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
        userEmail: z.string().email(),
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

      const fileUrl = await uploadToGoogleDrive(storedName, fileBuffer, org.name, org.googleDriveFolderId);

      await db.insert(intakeFileAttachments).values({
        organizationId: org.id,
        questionId: "ADHOC",
        fileName: input.fileName,
        fileUrl,
        driveFileId: storedName,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
        uploadedBy: input.userEmail,
      });

      // Audit log
      logFileActivity({
        action: "upload",
        userEmail: input.userEmail,
        userRole: ctx.user?.role || "user",
        organizationName: org.name,
        fileName: input.fileName,
        fileUrl,
        notes: "Adhoc file upload",
      }).catch(() => {});

      return { success: true, fileUrl };
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

      return await db
        .select()
        .from(intakeFileAttachments)
        .where(
          and(
            eq(intakeFileAttachments.organizationId, org.id),
            eq(intakeFileAttachments.questionId, "ADHOC")
          )
        )
        .orderBy(sql`${intakeFileAttachments.createdAt} DESC`);
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
});
