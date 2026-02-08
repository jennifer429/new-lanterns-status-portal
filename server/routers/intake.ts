import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { intakeResponses, intakeFileAttachments, organizations, questions, questionOptions, responses, onboardingFeedback } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export const intakeRouter = router({
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Get all responses for this organization from new responses table
      // Join with questions table to get the questionId string (e.g., "H.1", "A.2")
      const responsesData = await db
        .select({
          id: responses.id,
          organizationId: responses.organizationId,
          questionId: questions.questionId, // Get the string identifier from questions table
          response: responses.response,
          fileUrl: responses.fileUrl,
          userEmail: responses.userEmail,
          createdAt: responses.createdAt,
          updatedAt: responses.updatedAt,
        })
        .from(responses)
        .leftJoin(questions, eq(responses.questionId, questions.id))
        .where(eq(responses.organizationId, org.id));

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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Find question by questionId (e.g., "H.1" or "orders-workflow_config")
      const [question] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, input.questionId))
        .limit(1);

      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Question ${input.questionId} not found` });
      }

      // Check if response already exists
      const [existing] = await db
        .select()
        .from(responses)
        .where(
          and(
            eq(responses.organizationId, org.id),
            eq(responses.questionId, question.id)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing response
        await db
          .update(responses)
          .set({
            response: input.response,
            userEmail: input.userEmail,
          })
          .where(eq(responses.id, existing.id));

        return { success: true, action: "updated" };
      } else {
        // Insert new response
        await db.insert(responses).values({
          organizationId: org.id,
          questionId: question.id,
          response: input.response,
          userEmail: input.userEmail,
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Process each response
      const results = [];
      for (const [questionIdStr, response] of Object.entries(input.responses)) {
        // Skip empty responses
        if (!response || response === '' || response === null) continue;

        // Convert response to string for storage
        const responseStr = typeof response === 'object' ? JSON.stringify(response) : String(response);

        // Find question by questionId
        const [question] = await db
          .select()
          .from(questions)
          .where(eq(questions.questionId, questionIdStr))
          .limit(1);

        if (!question) {
          console.warn(`Question ${questionIdStr} not found, skipping`);
          continue;
        }

        // Check if response already exists
        const [existing] = await db
          .select()
          .from(responses)
          .where(
            and(
              eq(responses.organizationId, org.id),
              eq(responses.questionId, question.id)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing response
          await db
            .update(responses)
            .set({
              response: responseStr,
              userEmail: 'batch-save@system', // TODO: Get from context
            })
            .where(eq(responses.id, existing.id));
          results.push({ questionId: questionIdStr, action: "updated" });
        } else {
          // Insert new response
          await db.insert(responses).values({
            organizationId: org.id,
            questionId: question.id,
            response: responseStr,
            userEmail: 'batch-save@system', // TODO: Get from context
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Get all responses for this organization with question details
      const responsesData = await db
        .select({
          response: responses,
          question: questions,
        })
        .from(responses)
        .leftJoin(questions, eq(responses.questionId, questions.id))
        .where(eq(responses.organizationId, org.id));

      // Get total question count from database
      const [{ count: totalQuestions }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions);

      // Calculate completion by section
      const sectionProgress: Record<string, { total: number; completed: number }> = {};

      responsesData.forEach(({ response, question }) => {
        if (!question) return;
        const section = question.sectionId;
        if (!sectionProgress[section]) {
          sectionProgress[section] = { total: 0, completed: 0 };
        }
        sectionProgress[section].total++;
        if (response.response && response.response.trim() !== '') {
          sectionProgress[section].completed++;
        }
      });

      // Calculate overall completion
      const completedCount = responsesData.filter(({ response }) => 
        response.response && response.response.trim() !== ''
      ).length;

      return {
        totalQuestions,
        completedQuestions: completedCount,
        sectionProgress,
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      // Get question details for short title
      const [question] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, input.questionId))
        .limit(1);
      
      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");

      try {
        // Build filename: {orgName}_{userEmail}_{questionId}-{shortTitle}_{timestamp}.{ext}
        const timestamp = Date.now();
        const fileExt = input.fileName.split('.').pop();
        const sanitizedEmail = input.userEmail.replace(/@/g, '-at-').replace(/[^a-zA-Z0-9.-]/g, '_');
        const sanitizedOrgName = org.name.replace(/[^a-zA-Z0-9-]/g, '_');
        const fileName = `${sanitizedOrgName}_${sanitizedEmail}_${input.questionId}-${question.shortTitle}_${timestamp}.${fileExt}`;
        
        // Upload to S3 using built-in storage helper
        const { storagePut } = await import("../storage");
        const s3Key = `intake-files/${org.slug}/${fileName}`;
        const { url: fileUrl } = await storagePut(s3Key, fileBuffer, input.mimeType);

        // Store file info in database
        const { intakeFileAttachments } = await import("../../drizzle/schema");
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
   * Get all questions from database
   */
  getAllQuestions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const allQuestions = await db
      .select()
      .from(questions)
      .orderBy(questions.sectionId, questions.questionNumber);
    
    return allQuestions;
  }),

  /**
   * Get responses from new schema (with org name and user email)
   */
  getResponsesNew: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get organization
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);
      
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      
      // Get responses with organization name
      const responsesData = await db
        .select()
        .from(responses)
        .where(eq(responses.organizationId, input.organizationId));
      
      // Include organization name
      const responsesWithOrgName = responsesData.map(r => ({
        ...r,
        organizationName: org.name,
        organizationSlug: org.slug,
      }));
      
      return responsesWithOrgName;
    }),

  /**
   * Save response with user email tracking
   */
  saveResponseNew: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        questionId: z.number(),
        response: z.string().optional(),
        fileUrl: z.string().optional(),
        userEmail: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if response exists
      const [existing] = await db
        .select()
        .from(responses)
        .where(
          and(
            eq(responses.organizationId, input.organizationId),
            eq(responses.questionId, input.questionId)
          )
        )
        .limit(1);
      
      if (existing) {
        // Update with new user email and timestamp
        await db
          .update(responses)
          .set({
            response: input.response,
            fileUrl: input.fileUrl,
            userEmail: input.userEmail,
            // updatedAt automatically set by onUpdateNow()
          })
          .where(eq(responses.id, existing.id));
        
        return { success: true, responseId: existing.id, action: 'updated' };
      } else {
        // Insert new response
        const [newResponse] = await db.insert(responses).values({
          organizationId: input.organizationId,
          questionId: input.questionId,
          response: input.response,
          fileUrl: input.fileUrl,
          userEmail: input.userEmail,
          // createdAt and updatedAt automatically set
        });
        
        return { success: true, responseId: newResponse.insertId, action: 'created' };
      }
    }),

  /**
   * Get completion metrics with org name
   */
  getCompletionMetricsNew: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get organization
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);
      
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      
      // Get total question count
      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(questions);
      const totalQuestions = totalResult?.count || 0;
      
      // Get completed responses count
      const [completedResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(responses)
        .where(
          and(
            eq(responses.organizationId, input.organizationId),
            sql`${responses.response} IS NOT NULL AND ${responses.response} != ''`
          )
        );
      const completedQuestions = completedResult?.count || 0;
      
      const completionPercentage = totalQuestions > 0
        ? Math.round((completedQuestions / totalQuestions) * 100)
        : 0;
      
      // Get section breakdown
      const allQuestions = await db.select().from(questions);
      const allResponses = await db
        .select()
        .from(responses)
        .where(eq(responses.organizationId, input.organizationId));
      
      const responseMap = new Map();
      allResponses.forEach(r => responseMap.set(r.questionId, r));
      
      const sectionStats: Record<string, { total: number; completed: number; percentage: number }> = {};
      
      allQuestions.forEach(q => {
        if (!sectionStats[q.sectionTitle]) {
          sectionStats[q.sectionTitle] = { total: 0, completed: 0, percentage: 0 };
        }
        
        sectionStats[q.sectionTitle].total++;
        
        const resp = responseMap.get(q.id);
        if (resp && resp.response && resp.response !== '') {
          sectionStats[q.sectionTitle].completed++;
        }
      });
      
      Object.keys(sectionStats).forEach(sectionTitle => {
        const stats = sectionStats[sectionTitle];
        stats.percentage = stats.total > 0
          ? Math.round((stats.completed / stats.total) * 100)
          : 0;
      });
      
      return {
        organizationName: org.name,
        organizationSlug: org.slug,
        totalQuestions,
        completedQuestions,
        completionPercentage,
        sectionStats,
      };
    }),

  /**
   * Get all questions with their options from question_options table
   */
  getQuestionsWithOptions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Get all questions
    const allQuestions = await db.select().from(questions).orderBy(questions.sectionId, questions.questionNumber);

    // Get all options
    const allOptions = await db.select().from(questionOptions).where(eq(questionOptions.isActive, 1)).orderBy(questionOptions.displayOrder);

    // Group options by questionId
    const optionsByQuestion = allOptions.reduce((acc, option) => {
      if (!acc[option.questionId]) {
        acc[option.questionId] = [];
      }
      acc[option.questionId].push(option);
      return acc;
    }, {} as Record<number, typeof allOptions>);

    // Attach options to questions
    const questionsWithOptions = allQuestions.map(q => ({
      ...q,
      optionsArray: optionsByQuestion[q.id] || [],
    }));

    return questionsWithOptions;
  }),

  /**
   * Get options for a specific question
   */
  getQuestionOptions: publicProcedure
    .input(z.object({ questionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const options = await db
        .select()
        .from(questionOptions)
        .where(and(
          eq(questionOptions.questionId, input.questionId),
          eq(questionOptions.isActive, 1)
        ))
        .orderBy(questionOptions.displayOrder);

      return options;
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
      const { intakeFileAttachments } = await import("../../drizzle/schema");
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
      const { intakeFileAttachments } = await import("../../drizzle/schema");
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
      const { intakeFileAttachments } = await import("../../drizzle/schema");
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
});
