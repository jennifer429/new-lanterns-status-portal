/**
 * Backfill Router
 *
 * Admin-only endpoint that reads all MySQL tables and pushes existing data
 * to their corresponding Notion databases. This ensures nothing is MySQL-only.
 *
 * Designed to be run once (or re-run safely — upsert logic prevents duplicates).
 * Rate-limited to avoid Notion API throttling (3 requests/sec with backoff).
 */
import { z } from "zod";
import { adminDbProcedure, router } from "../_core/trpc";
import {
  aiAuditLogs,
  activityFeed,
  orgNotes,
  partnerDocuments,
  partnerDocAudit,
  onboardingFeedback,
  orgCustomTasks,
  sectionProgress,
  vendorAuditLog,
  fileAttachments,
  intakeFileAttachments,
  partnerTemplates,
  partnerTaskTemplates,
  specifications,
  systemVendorOptions,
  questions,
  questionOptions,
  users,
  clients,
  organizations,
  implementationOrgs,
} from "../../drizzle/schema";
import {
  syncAiChatLog,
  syncActivityFeed,
  syncOrgNote,
  syncPartnerDocument,
  syncPartnerDocAudit,
  syncOnboardingFeedback,
  syncOrgCustomTask,
  syncSectionProgress,
  syncVendorAudit,
  syncTaskFile,
  syncIntakeFile,
  syncPartnerTemplate,
  syncPartnerTaskTemplate,
  syncSpecification,
  syncSystemVendor,
  syncQuestion,
  syncQuestionOption,
  syncPortalUser,
  syncClient,
  syncOrganization,
  syncImplementationOrg,
} from "../notionDualWrite";
import { eq } from "drizzle-orm";

// Rate limiter: 3 requests/sec with exponential backoff on 429
async function rateLimitedSync<T>(
  items: T[],
  syncFn: (item: T) => Promise<boolean>,
  tableName: string
): Promise<{ synced: number; failed: number; total: number }> {
  let synced = 0;
  let failed = 0;
  const total = items.length;
  let delay = 350; // ~3/sec

  for (let i = 0; i < items.length; i++) {
    try {
      const success = await syncFn(items[i]);
      if (success) synced++;
      else failed++;
      delay = 350; // reset on success
    } catch (err: any) {
      if (err?.status === 429 || err?.code === "rate_limited") {
        delay = Math.min(delay * 2, 5000); // exponential backoff, max 5s
        i--; // retry this item
      } else {
        failed++;
        console.error(`[backfill:${tableName}] Failed item ${i}:`, err?.message || err);
      }
    }
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(`[backfill:${tableName}] Done: ${synced}/${total} synced, ${failed} failed`);
  return { synced, failed, total };
}

export const backfillRouter = router({
  /**
   * Run backfill for a specific table or all tables.
   * Returns progress stats per table.
   */
  run: adminDbProcedure
    .input(
      z.object({
        table: z.enum([
          "all",
          "aiAuditLogs",
          "activityFeed",
          "orgNotes",
          "partnerDocuments",
          "partnerDocAudit",
          "onboardingFeedback",
          "orgCustomTasks",
          "sectionProgress",
          "vendorAuditLog",
          "fileAttachments",
          "intakeFileAttachments",
          "partnerTemplates",
          "partnerTaskTemplates",
          "specifications",
          "systemVendorOptions",
          "questions",
          "questionOptions",
          "users",
          "clients",
          "organizations",
          "implementationOrgs",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const results: Record<string, { synced: number; failed: number; total: number }> = {};
      const tablesToSync = input.table === "all"
        ? [
            "clients",
            "organizations",
            "users",
            "questions",
            "questionOptions",
            "specifications",
            "systemVendorOptions",
            "partnerTemplates",
            "partnerTaskTemplates",
            "implementationOrgs",
            "sectionProgress",
            "orgNotes",
            "partnerDocuments",
            "partnerDocAudit",
            "fileAttachments",
            "intakeFileAttachments",
            "orgCustomTasks",
            "onboardingFeedback",
            "activityFeed",
            "vendorAuditLog",
            "aiAuditLogs",
          ]
        : [input.table];

      // Helper to get org name by ID
      const orgNameCache = new Map<number, string>();
      async function getOrgName(orgId: number): Promise<string> {
        if (orgNameCache.has(orgId)) return orgNameCache.get(orgId)!;
        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const name = org?.name || `Org #${orgId}`;
        orgNameCache.set(orgId, name);
        return name;
      }

      // Helper to get client name by ID
      const clientNameCache = new Map<number, string>();
      async function getClientName(clientId: number): Promise<string> {
        if (clientNameCache.has(clientId)) return clientNameCache.get(clientId)!;
        const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1);
        const name = client?.name || `Client #${clientId}`;
        clientNameCache.set(clientId, name);
        return name;
      }

      for (const table of tablesToSync) {
        switch (table) {
          case "aiAuditLogs": {
            const rows = await db.select().from(aiAuditLogs);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = row.organizationId ? await getOrgName(row.organizationId) : null;
                return syncAiChatLog({
                  mysqlId: row.id,
                  organizationId: row.organizationId ?? null,
                  orgName,
                  userEmail: row.actorEmail || "unknown",
                  userRole: row.actorRole || "user",
                  prompt: row.userPrompt || "",
                  response: row.aiResponse || "",
                  model: "claude",
                  tokensUsed: null,
                  toolCalls: row.toolArgs || null,
                  createdAt: row.createdAt,
                });
              },
              "aiAuditLogs"
            );
            break;
          }

          case "activityFeed": {
            const rows = await db.select().from(activityFeed);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncActivityFeed({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  eventType: row.source,
                  actor: row.author || null,
                  description: row.message,
                  createdAt: row.createdAt,
                });
              },
              "activityFeed"
            );
            break;
          }

          case "orgNotes": {
            const rows = await db.select().from(orgNotes);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = row.organizationId ? await getOrgName(row.organizationId) : "Partner-level";
                return syncOrgNote({
                  mysqlId: row.id,
                  organizationId: row.organizationId || 0,
                  orgName,
                  clientId: row.clientId || null,
                  label: row.label || null,
                  fileName: row.fileName,
                  fileUrl: row.fileUrl || null,
                  driveFileId: row.driveFileId || null,
                  fileSize: row.fileSize || null,
                  mimeType: row.mimeType || null,
                  uploadedBy: row.uploadedBy || null,
                  createdAt: row.createdAt,
                });
              },
              "orgNotes"
            );
            break;
          }

          case "partnerDocuments": {
            const rows = await db.select().from(partnerDocuments);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const partnerName = await getClientName(row.clientId);
                return syncPartnerDocument({
                  mysqlId: row.id,
                  clientId: row.clientId,
                  partnerName,
                  title: row.title,
                  fileName: row.filename,
                  fileUrl: row.url || null,
                  driveFileId: row.driveFileId || null,
                  mimeType: row.mimeType || null,
                  fileSize: row.size || null,
                  category: null, // categoryId is a FK, not a string
                  uploadedBy: row.uploadedByName || null,
                  active: true,
                  createdAt: row.createdAt,
                });
              },
              "partnerDocuments"
            );
            break;
          }

          case "partnerDocAudit": {
            const rows = await db.select().from(partnerDocAudit);
            // Get document titles for display
            const docTitleCache = new Map<number, string>();
            for (const row of rows) {
              if (!docTitleCache.has(row.documentId)) {
                const [doc] = await db.select({ title: partnerDocuments.title }).from(partnerDocuments).where(eq(partnerDocuments.id, row.documentId)).limit(1);
                docTitleCache.set(row.documentId, doc?.title || `Doc #${row.documentId}`);
              }
            }
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncPartnerDocAudit({
                  mysqlId: row.id,
                  documentId: row.documentId,
                  documentTitle: docTitleCache.get(row.documentId) || `Doc #${row.documentId}`,
                  action: row.action,
                  userId: row.userId,
                  userName: row.userName,
                  userEmail: row.userEmail,
                  createdAt: row.createdAt,
                }),
              "partnerDocAudit"
            );
            break;
          }

          case "onboardingFeedback": {
            const rows = await db.select().from(onboardingFeedback);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncOnboardingFeedback({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  rating: row.rating,
                  comments: row.comments || null,
                  submittedBy: row.submittedBy || null,
                  createdAt: row.createdAt,
                });
              },
              "onboardingFeedback"
            );
            break;
          }

          case "orgCustomTasks": {
            const rows = await db.select().from(orgCustomTasks);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncOrgCustomTask({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  taskId: `custom-${row.id}`,
                  title: row.title,
                  section: row.section || null,
                  description: row.description || null,
                  owner: null,
                  status: row.isComplete ? "complete" : "pending",
                  createdBy: row.createdBy || null,
                  createdAt: row.createdAt,
                });
              },
              "orgCustomTasks"
            );
            break;
          }

          case "sectionProgress": {
            const rows = await db.select().from(sectionProgress);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncSectionProgress({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  sectionName: row.sectionName,
                  status: row.status || null,
                  progress: row.progress,
                  expectedEnd: row.expectedEnd || null,
                  updatedAt: row.updatedAt,
                });
              },
              "sectionProgress"
            );
            break;
          }

          case "vendorAuditLog": {
            const rows = await db.select().from(vendorAuditLog);
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncVendorAudit({
                  mysqlId: row.id,
                  vendorId: row.vendorId ?? 0,
                  action: row.action,
                  field: row.field || null,
                  oldValue: row.oldValue || null,
                  newValue: row.newValue || null,
                  performedBy: row.performedBy || null,
                  createdAt: row.createdAt,
                }),
              "vendorAuditLog"
            );
            break;
          }

          case "fileAttachments": {
            const rows = await db.select().from(fileAttachments);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncTaskFile({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  taskId: row.taskId,
                  fileName: row.fileName,
                  fileUrl: row.fileUrl || null,
                  driveFileId: null,
                  fileSize: row.fileSize || null,
                  mimeType: row.mimeType || null,
                  uploadedBy: row.uploadedBy || null,
                  createdAt: row.createdAt,
                });
              },
              "fileAttachments"
            );
            break;
          }

          case "intakeFileAttachments": {
            const rows = await db.select().from(intakeFileAttachments);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncIntakeFile({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  questionId: row.questionId,
                  fileName: row.fileName,
                  fileUrl: row.fileUrl || null,
                  driveFileId: row.driveFileId || null,
                  fileSize: row.fileSize || null,
                  mimeType: row.mimeType || null,
                  uploadedBy: row.uploadedBy || null,
                  createdAt: row.createdAt,
                });
              },
              "intakeFileAttachments"
            );
            break;
          }

          case "partnerTemplates": {
            const rows = await db.select().from(partnerTemplates);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const partnerName = await getClientName(row.clientId);
                return syncPartnerTemplate({
                  mysqlId: row.id,
                  clientId: row.clientId,
                  partnerName,
                  title: row.title,
                  questionId: row.questionId || null,
                  fileName: row.fileName,
                  fileUrl: row.fileUrl || null,
                  mimeType: row.mimeType || null,
                  fileSize: row.fileSize || null,
                  active: row.isActive === 1,
                  uploadedBy: row.uploadedBy || null,
                  createdAt: row.createdAt,
                });
              },
              "partnerTemplates"
            );
            break;
          }

          case "partnerTaskTemplates": {
            const rows = await db.select().from(partnerTaskTemplates);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const partnerName = await getClientName(row.clientId);
                return syncPartnerTaskTemplate({
                  mysqlId: row.id,
                  clientId: row.clientId,
                  partnerName,
                  title: row.title,
                  taskId: `ptt-${row.id}`,
                  section: row.section || null,
                  description: row.description || null,
                  owner: null,
                  active: row.isActive === 1,
                  createdBy: row.createdBy || null,
                  createdAt: row.createdAt,
                });
              },
              "partnerTaskTemplates"
            );
            break;
          }

          case "specifications": {
            const rows = await db.select().from(specifications);
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncSpecification({
                  mysqlId: row.id,
                  title: row.title,
                  key: row.fileName, // use fileName as the key
                  description: row.description || null,
                  category: row.category || null,
                  active: row.isActive === 1,
                  createdAt: row.createdAt,
                }),
              "specifications"
            );
            break;
          }

          case "systemVendorOptions": {
            const rows = await db.select().from(systemVendorOptions);
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncSystemVendor({
                  mysqlId: row.id,
                  systemType: row.systemType,
                  vendorName: row.vendorName,
                  productName: row.vendorName, // schema doesn't have separate productName
                  active: row.isActive === 1,
                  createdAt: row.createdAt,
                }),
              "systemVendorOptions"
            );
            break;
          }

          case "questions": {
            const rows = await db.select().from(questions);
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncQuestion({
                  mysqlId: row.id,
                  key: row.questionId,
                  section: row.sectionId,
                  type: row.questionType,
                  required: row.required === 1,
                  active: true,
                  sortOrder: row.questionNumber,
                  fullText: row.questionText,
                  createdAt: row.createdAt,
                }),
              "questions"
            );
            break;
          }

          case "questionOptions": {
            const rows = await db.select().from(questionOptions);
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncQuestionOption({
                  mysqlId: row.id,
                  questionId: row.questionId,
                  questionKey: `q-${row.questionId}`,
                  label: row.optionLabel,
                  value: row.optionValue,
                  sortOrder: row.displayOrder,
                  createdAt: row.createdAt,
                }),
              "questionOptions"
            );
            break;
          }

          case "users": {
            const rows = await db.select().from(users);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = row.organizationId ? await getOrgName(row.organizationId) : null;
                const partnerName = row.clientId ? await getClientName(row.clientId) : null;
                return syncPortalUser({
                  mysqlId: row.id,
                  name: row.name || "Unnamed",
                  email: row.email || "no-email",
                  role: row.role,
                  clientId: row.clientId || null,
                  partnerName,
                  organizationId: row.organizationId || null,
                  orgName,
                  active: row.isActive === 1,
                  lastLogin: row.lastLoginAt || null,
                  createdAt: row.createdAt,
                });
              },
              "users"
            );
            break;
          }

          case "clients": {
            const rows = await db.select().from(clients);
            // Count orgs per client
            const orgCounts = new Map<number, number>();
            const allOrgs = await db.select({ clientId: organizations.clientId }).from(organizations);
            for (const o of allOrgs) {
              if (o.clientId) orgCounts.set(o.clientId, (orgCounts.get(o.clientId) || 0) + 1);
            }
            results[table] = await rateLimitedSync(
              rows,
              async (row) =>
                syncClient({
                  mysqlId: row.id,
                  name: row.name,
                  slug: row.slug,
                  contactName: null,
                  contactEmail: null,
                  active: row.status === "active",
                  orgCount: orgCounts.get(row.id) || 0,
                  createdAt: row.createdAt,
                }),
              "clients"
            );
            break;
          }

          case "organizations": {
            const rows = await db.select().from(organizations);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const partnerName = row.clientId ? await getClientName(row.clientId) : "Unassigned";
                return syncOrganization({
                  mysqlId: row.id,
                  name: row.name,
                  slug: row.slug,
                  clientId: row.clientId || null,
                  partnerName,
                  contactName: row.contactName || null,
                  contactEmail: row.contactEmail || null,
                  contactPhone: row.contactPhone || null,
                  status: row.status || null,
                  startDate: row.startDate ? new Date(row.startDate) : null,
                  goalDate: row.goalDate ? new Date(row.goalDate) : null,
                  driveFolderId: row.googleDriveFolderId || null,
                  createdAt: row.createdAt,
                });
              },
              "organizations"
            );
            break;
          }

          case "implementationOrgs": {
            const rows = await db.select().from(implementationOrgs);
            results[table] = await rateLimitedSync(
              rows,
              async (row) => {
                const orgName = await getOrgName(row.organizationId);
                return syncImplementationOrg({
                  mysqlId: row.id,
                  organizationId: row.organizationId,
                  orgName,
                  name: row.name,
                  orgType: row.orgType,
                  color: row.color || null,
                  sortOrder: row.sortOrder,
                  active: row.isActive === 1,
                  createdAt: row.createdAt,
                });
              },
              "implementationOrgs"
            );
            break;
          }
        }
      }

      return {
        message: `Backfill complete for ${tablesToSync.length} table(s)`,
        results,
      };
    }),

  /**
   * Get a summary of row counts per table to estimate backfill size.
   */
  preview: adminDbProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const counts: Record<string, number> = {};

    const tables = [
      { name: "aiAuditLogs", table: aiAuditLogs },
      { name: "activityFeed", table: activityFeed },
      { name: "orgNotes", table: orgNotes },
      { name: "partnerDocuments", table: partnerDocuments },
      { name: "partnerDocAudit", table: partnerDocAudit },
      { name: "onboardingFeedback", table: onboardingFeedback },
      { name: "orgCustomTasks", table: orgCustomTasks },
      { name: "sectionProgress", table: sectionProgress },
      { name: "vendorAuditLog", table: vendorAuditLog },
      { name: "fileAttachments", table: fileAttachments },
      { name: "intakeFileAttachments", table: intakeFileAttachments },
      { name: "partnerTemplates", table: partnerTemplates },
      { name: "partnerTaskTemplates", table: partnerTaskTemplates },
      { name: "specifications", table: specifications },
      { name: "systemVendorOptions", table: systemVendorOptions },
      { name: "questions", table: questions },
      { name: "questionOptions", table: questionOptions },
      { name: "users", table: users },
      { name: "clients", table: clients },
      { name: "organizations", table: organizations },
      { name: "implementationOrgs", table: implementationOrgs },
    ];

    for (const { name, table } of tables) {
      const rows = await db.select().from(table);
      counts[name] = rows.length;
    }

    return { counts, totalRows: Object.values(counts).reduce((a, b) => a + b, 0) };
  }),
});
