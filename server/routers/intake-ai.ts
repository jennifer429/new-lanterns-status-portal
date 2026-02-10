import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { intakeResponses, organizations, auditLog } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Questionnaire structure from intake-questions.json
const QUESTIONNAIRE_SECTIONS = {
  "Header Info": [
    { id: "INFO.1", task: "Client Name", fieldType: "text" },
    { id: "INFO.3", task: "Target Go-Live Date set", fieldType: "date" }
  ],
  "Overview & Architecture": [
    { id: "A.1", task: "Identify Administrative point(s) of contact", fieldType: "textarea" },
    { id: "A.2", task: "Identify IT point(s) of contact - Connectivity & Systems", fieldType: "textarea" },
    { id: "A.3", task: "Identify Clinical Contact(s) - Technologist/Clinical Informatics", fieldType: "textarea" },
    { id: "A.4", task: "Identify Radiologist Champion(s)", fieldType: "textarea" },
    { id: "A.5", task: "Identify Project Manager (if applicable)", fieldType: "textarea" },
    { id: "A.7", task: "Will any systems be replaced during integration (PACS RIS EHR retirement)", fieldType: "textarea" },
    { id: "A.8", task: "Will your modality worklist system be impacted during this implementation?", fieldType: "textarea" },
    { id: "A.10", task: "If you have a Router - document details", fieldType: "textarea" },
    { id: "A.12", task: "What is your Integration Engine if you have one", fieldType: "textarea" },
    { id: "A.13", task: "What is your EHR system", fieldType: "text" },
    { id: "A.14", task: "What is your current PACS", fieldType: "text" }
  ],
  "Security & Permissions": [
    { id: "B.1", task: "Determine if security questionnaire is required", fieldType: "radio", options: ["Yes", "No", "In Progress"] },
    { id: "B.4", task: "Determine multi-tenancy requirements (separate MRNs by organization)", fieldType: "textarea" },
    { id: "B.5", task: "Determine multi-tenancy requirements (separate DICOM studies by PACS)", fieldType: "textarea" },
    { id: "B.6", task: "Determine multi-tenancy requirements (user restrictions by tenant)", fieldType: "textarea" }
  ],
  "Imaging Routing & Connectivity": [
    { id: "C.1", task: "Document estimated monthly volume", fieldType: "number" },
    { id: "C.2", task: "Identify current DICOM System of Record (SOR)", fieldType: "text" },
    { id: "C.3", task: "Confirm if SOR has IOCM capabilities", fieldType: "textarea" }
  ],
  "Data & Integration": [
    { id: "D.1", task: "Confirm capability to configure production systems for testing prior to go-live", fieldType: "radio", options: ["Yes", "No", "Needs Discussion"] },
    { id: "D.2", task: "Confirm requested go-live date (MMDDYY)", fieldType: "date" },
    { id: "D.3", task: "Document expected volume of images ready each month", fieldType: "number" },
    { id: "D.4", task: "Document expected modalities", fieldType: "textarea" },
    { id: "D.5", task: "Document integration engines or routers in use", fieldType: "textarea" },
    { id: "D.6", task: "Document number of PACS systems to be overlayed (if overlay PACS)", fieldType: "number" },
    { id: "D.7", task: "Document current PACS system", fieldType: "text" },
    { id: "D.8", task: "Document current Reporting system", fieldType: "text" },
    { id: "D.9", task: "Document current EMR/RIS system", fieldType: "text" },
    { id: "D.10", task: "Determine Prefetch Query Retrieve", fieldType: "textarea" },
    { id: "D.11", task: "Define how comparison reports will be sent/retrieved", fieldType: "textarea" }
  ],
  "Additional Workflows": [
    { id: "E.2", task: "Define tech notes input method", fieldType: "textarea" },
    { id: "E.3", task: "Document required EMR/RIS integrations", fieldType: "textarea" },
    { id: "E.4", task: "Identify applications producing secondary captures or AI results", fieldType: "textarea" },
    { id: "E.5", task: "Identify DICOM SR or other data sources for auto-populating fields", fieldType: "textarea" },
    { id: "E.6", task: "Document system for DICOM SR", fieldType: "text" },
    { id: "E.7", task: "Identify universal patient ID/index for unifying patients across sites", fieldType: "textarea" },
    { id: "E.8", task: "Obtain mapping of custom procedure codes from sites", fieldType: "file" },
    { id: "E.9", task: "Define handling of studies with multiple reports/orders", fieldType: "textarea" },
    { id: "E.10", task: "Identify specific reporting criteria (MIPS site-specific footers etc.)", fieldType: "textarea" },
    { id: "E.11", task: "Document downtime procedures when EMR/RIS offline", fieldType: "file" },
    { id: "E.12", task: "Define prelim report workflow requirements", fieldType: "textarea" },
    { id: "E.13", task: "Document credentialing process for each site", fieldType: "textarea" }
  ],
  "Rad Workflows": [
    { id: "F.1", task: "Document QA/QC workflow for image issues", fieldType: "textarea" },
    { id: "F.2", task: "Define radiologist-to-tech communication method", fieldType: "textarea" },
    { id: "F.3", task: "Identify central technologist for radiologist communication", fieldType: "text" },
    { id: "F.4", task: "Confirm each technologist has individual PACS login", fieldType: "radio", options: ["Yes", "No", "In Progress"] },
    { id: "F.5", task: "Document Peer Review requirements", fieldType: "textarea" },
    { id: "F.6", task: "Define critical result reporting process with referring physicians", fieldType: "textarea" },
    { id: "F.7", task: "Document radiologist scheduling process", fieldType: "textarea" }
  ]
};

export const intakeAiRouter = router({
  /**
   * Process transcript with AI and auto-fill questionnaire responses
   */
  processTranscript: publicProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        transcript: z.string(),
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

      // Validate user has access to this organization's client
      if (ctx.user?.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this organization" });
      }

      const importingUser = ctx.user?.email || "unknown@system";

      // Build the questionnaire for AI prompt
      const questionsList = Object.entries(QUESTIONNAIRE_SECTIONS)
        .flatMap(([section, questions]) => 
          questions.map(q => ({
            section,
            id: q.id,
            question: q.task,
            fieldType: q.fieldType,
            options: (q as any).options || null
          }))
        );

      // Create AI prompt
      const prompt = `You are an AI assistant helping to extract information from a transcript to fill out a questionnaire for a healthcare IT integration project.

TRANSCRIPT:
${input.transcript}

QUESTIONNAIRE:
${JSON.stringify(questionsList, null, 2)}

INSTRUCTIONS:
1. Read the transcript carefully
2. For each question in the questionnaire, extract the relevant answer from the transcript
3. If the transcript doesn't contain information for a question, leave it as null
4. For radio/dropdown questions, only use the provided options
5. For date fields, use MMDDYY format
6. For number fields, provide only numeric values
7. Return a JSON object with the structure: { "questionId": "answer", ... }

Return ONLY valid JSON, no additional text or explanation.`;

      let aiResponse;
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that extracts structured data from transcripts. Always respond with valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
      } catch (error) {
        console.error("AI processing error:", error);
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to process transcript with AI: " + (error instanceof Error ? error.message : String(error))
        });
      }

      // Process and save responses
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const [questionId, answer] of Object.entries(aiResponse)) {
        // Skip empty responses
        if (!answer || answer === "" || answer === null) {
          skippedCount++;
          continue;
        }

        // Find the section for this question
        let questionSection = "intake";
        for (const [section, questions] of Object.entries(QUESTIONNAIRE_SECTIONS)) {
          if (questions.some(q => q.id === questionId)) {
            questionSection = section;
            break;
          }
        }

        const responseStr = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);

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
              updatedBy: importingUser,
            })
            .where(eq(intakeResponses.id, existing.id));
          updatedCount++;
        } else {
          // Insert new response
          await db.insert(intakeResponses).values({
            organizationId: org.id,
            questionId: questionId,
            section: questionSection,
            response: responseStr,
            updatedBy: importingUser,
          });
          importedCount++;
        }
      }

      // Create audit log entry
      await db.insert(auditLog).values({
        organizationId: org.id,
        eventType: "import",
        eventDescription: `AI-processed transcript and imported responses: ${importedCount} new, ${updatedCount} updated, ${skippedCount} skipped`,
        userEmail: importingUser,
        metadata: JSON.stringify({
          source: "ai-transcript-processing",
          transcriptLength: input.transcript.length,
          importedCount,
          updatedCount,
          skippedCount,
          processedAt: new Date().toISOString(),
        }),
      });

      return {
        success: true,
        importedCount,
        updatedCount,
        skippedCount,
        totalProcessed: Object.keys(aiResponse).length,
      };
    }),
});
