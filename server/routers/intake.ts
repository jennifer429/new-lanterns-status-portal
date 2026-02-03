import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { intakeResponses, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const intakeRouter = router({
  /**
   * Get all intake responses for an organization
   */
  getResponses: publicProcedure
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

      // Get all responses for this organization
      const responses = await db
        .select()
        .from(intakeResponses)
        .where(eq(intakeResponses.organizationId, org.id));

      return responses;
    }),

  /**
   * Save or update an intake response
   */
  saveResponse: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        questionId: z.string(),
        section: z.string(),
        response: z.string(),
        fileUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
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
            fileUrl: input.fileUrl,
            status: input.response ? "complete" : "not_started",
            updatedAt: new Date(),
          })
          .where(eq(intakeResponses.id, existing.id));

        return { success: true, action: "updated" };
      } else {
        // Insert new response
        await db.insert(intakeResponses).values({
          organizationId: org.id,
          questionId: input.questionId,
          section: input.section,
          response: input.response,
          fileUrl: input.fileUrl,
          status: input.response ? "complete" : "not_started",
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
    .mutation(async ({ input }) => {
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

      // Process each response
      const results = [];
      for (const [questionId, response] of Object.entries(input.responses)) {
        // Skip empty responses
        if (!response || response === '' || response === null) continue;

        // Convert response to string for storage
        const responseStr = typeof response === 'object' ? JSON.stringify(response) : String(response);

        // Check if response already exists
        const [existing] = await db
          .select()
          .from(intakeResponses)
          .where(
            and(
              eq(intakeResponses.organizationId, org.id),
              eq(intakeResponses.questionId, questionId)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing response
          await db
            .update(intakeResponses)
            .set({
              response: responseStr,
              status: "complete",
              updatedAt: new Date(),
            })
            .where(eq(intakeResponses.id, existing.id));
          results.push({ questionId, action: "updated" });
        } else {
          // Insert new response - need to determine section from questionId
          // For now, we'll extract section from questionId prefix
          const section = questionId.split('_')[0] || 'unknown';
          await db.insert(intakeResponses).values({
            organizationId: org.id,
            questionId,
            section,
            response: responseStr,
            status: "complete",
          });
          results.push({ questionId, action: "created" });
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

      // Get all responses for this organization
      const responses = await db
        .select()
        .from(intakeResponses)
        .where(eq(intakeResponses.organizationId, org.id));

      // Calculate completion by section
      const sectionProgress: Record<string, { total: number; completed: number }> = {};

      responses.forEach((response) => {
        if (!sectionProgress[response.section]) {
          sectionProgress[response.section] = { total: 0, completed: 0 };
        }
        sectionProgress[response.section].total++;
        if (response.status === "complete") {
          sectionProgress[response.section].completed++;
        }
      });

      return {
        totalQuestions: responses.length,
        completedQuestions: responses.filter((r) => r.status === "complete").length,
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
      })
    )
    .mutation(async ({ input }) => {
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

      // Decode base64 file data
      const fileBuffer = Buffer.from(input.fileData, "base64");

      // Check if should upload to Google Drive (only RadOne organizations)
      const shouldUpload = input.organizationSlug.toLowerCase().startsWith("radone");

      if (shouldUpload) {
        // Upload to Google Drive using rclone
        const { execSync } = await import("child_process");
        const fs = await import("fs");
        const path = await import("path");
        
        // Create temp file
        const tempDir = "/tmp";
        const tempFilePath = path.join(tempDir, `${Date.now()}-${input.fileName}`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        try {
          // Upload to Google Drive (to root, files will be organized by naming convention)
          const fileName = `${org.slug}_${Date.now()}_${input.fileName}`;
          const drivePath = `manus_google_drive:${fileName}`;
          execSync(`rclone copy "${tempFilePath}" "manus_google_drive:" --config /home/ubuntu/.gdrive-rclone.ini`, {
            stdio: 'pipe'
          });

          // Wait for file to be available (Google Drive sync delay)
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Get shareable link with retry
          let fileUrl = '';
          let retries = 3;
          while (retries > 0 && !fileUrl) {
            try {
              const linkOutput = execSync(`rclone link "${drivePath}" --config /home/ubuntu/.gdrive-rclone.ini`, {
                encoding: 'utf-8',
                stdio: 'pipe'
              });
              fileUrl = linkOutput.trim();
            } catch (linkError: any) {
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                throw linkError;
              }
            }
          }

          // Clean up temp file
          fs.unlinkSync(tempFilePath);

          // Store file info in database
          const { intakeFileAttachments } = await import("../../drizzle/schema");
          await db.insert(intakeFileAttachments).values({
            organizationId: org.id,
            questionId: input.questionId,
            fileName: input.fileName,
            fileUrl,
            driveFileId: drivePath,
            fileSize: fileBuffer.length,
            mimeType: input.mimeType,
            uploadedBy: org.contactName || "Unknown",
          });

          return {
            success: true,
            fileUrl,
            message: "File uploaded to Google Drive successfully",
          };
        } catch (error: any) {
          // Clean up temp file on error
          try { fs.unlinkSync(tempFilePath); } catch {}
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to upload file to Google Drive: ${error.message}`,
          });
        }
      } else {
        // For non-RadOne organizations, just acknowledge the upload
        // (You could store files locally or in another storage if needed)
        return {
          success: true,
          message: "File received (Notion sync disabled for this organization)",
        };
      }
    }),
});
