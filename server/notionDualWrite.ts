/**
 * Notion Dual-Write Module
 *
 * Syncs all MySQL-only tables to their corresponding Notion databases.
 * Pattern: fire-and-forget after MySQL write succeeds.
 * Failures are enqueued in the retry queue.
 *
 * Each function follows the same upsert pattern:
 * 1. Find existing page by MySQL ID
 * 2. If found → update properties
 * 3. If not found → create new page
 * 4. On failure → enqueue for retry
 */
import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { enqueueFailedWrite } from "./notionRetryQueue";

// ─── Database IDs (from ENV_OVERRIDES in env.ts) ─────────────────────────────
// These will be added to ENV_OVERRIDES so they're always correct
const DB_IDS = {
  aiChatLog: "2736e92a-7e47-46e4-8057-22060cfe2e97",
  activityFeed: "a7573e0f-a490-4f10-9fc9-8373130a9e8d",
  orgNotes: "1c6dd24e-9e6c-4c2e-89eb-2eb17633b7a0",
  partnerDocuments: "eee52626-74a4-4530-aa36-fab9c827260e",
  onboardingFeedback: "affd6d9d-8af0-4d5c-a0c0-8071de369815",
  orgCustomTasks: "2dd86264-c48c-487a-bdf2-0040941b7efe",
  sectionProgress: "b8394b07-df6d-4f6b-b13a-ba4716850b43",
  vendorAuditLog: "754de6b3-273b-4b2e-9905-40ec904b53c0",
  taskFileAttachments: "47902d3f-b209-4192-96df-70f745eeadc4",
  intakeFileAttachments: "5b911886-9795-40e1-a443-76f14095cc53",
  partnerTemplates: "e0854d35-46c6-4c4b-9acf-a552b1d551a0",
  partnerTaskTemplates: "7c873298-9cab-4b3b-9003-b015aff6f813",
  specifications: "073a1245-481d-4f72-bca9-cbe8e8d79102",
  systemVendorOptions: "9e9b239b-6c15-4974-a68a-0fb98e74339e",
  questions: "3820c757-2a4c-494e-be8c-aaf4eb2d5e7b",
  questionOptions: "9fc158c6-ff06-44b0-a854-4463513bd021",
  portalUsers: "ae5bcb66-dd66-45f1-a500-2f53c96f456a",
  clients: "e9032704-9917-4040-94df-b4bf7e23e24f",
  organizations: "b4a271d0-9cb7-4132-a7dc-5754591cdac1",
  implementationOrgs: "494fc299-f747-4442-a551-867de65d080c",
};

const DS_IDS = {
  aiChatLog: "27f0a0d3-7e20-4f99-9506-41cb6acfb98d",
  activityFeed: "1c9c7f8a-82ac-4fd0-a7aa-52d92cdacfdf",
  orgNotes: "1837f3d2-3a74-4e78-8888-798e8d23dc33",
  partnerDocuments: "a3716243-11e8-4c53-a0e9-3b5c019aa28b",
  onboardingFeedback: "b519faba-846a-4bc7-9cbe-3544e9f2358e",
  orgCustomTasks: "630e0031-9828-4a93-a878-cf032a3913b0",
  sectionProgress: "e5aff821-8b35-41a2-aa10-88233292a557",
  vendorAuditLog: "5362ba9e-2a06-41b6-837e-3fee788645f9",
  taskFileAttachments: "6a91a46b-92c8-4993-a438-9be52d99091f",
  intakeFileAttachments: "f6686c03-774e-4199-9b9f-2a32b147dee0",
  partnerTemplates: "a3a6d9e2-821f-4457-9a0b-d950a552c069",
  partnerTaskTemplates: "7e465daf-309e-4a40-9da4-c31c5581159a",
  specifications: "92898821-46a9-4b99-8d26-b9f46b966bec",
  systemVendorOptions: "f213558d-f91e-4015-95b5-275e6760fbf6",
  questions: "d3b05f91-8472-4df1-82af-e0cf8e63b952",
  questionOptions: "f1f8494c-7bb6-4564-aced-6177f48b9006",
  portalUsers: "6e3c6e66-e664-494a-b678-02dc2b82d431",
  clients: "f03477c2-bfd1-4266-b6b5-f5409760759b",
  organizations: "cbfdc89f-56b8-46d4-97ec-bb7f186baa85",
  implementationOrgs: "4faa1bc2-f55e-42b2-b85f-51bb0f29d437",
};

let notionClient: Client | null = null;
function getClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  if (!notionClient) {
    notionClient = new Client({ auth: ENV.notionApiKey });
  }
  return notionClient;
}

// ─── Generic Helpers ───────────────────────────────────────────────────────────

/**
 * Find a Notion page by MySQL ID in a given data source.
 */
async function findByMySqlId(
  client: Client,
  dataSourceId: string,
  mysqlId: number
): Promise<string | null> {
  try {
    const result: any = await (client as any).dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "MySQL ID",
        number: { equals: mysqlId },
      },
      page_size: 1,
    });
    return result.results?.[0]?.id || null;
  } catch (err) {
    console.error(`[notion-dual] findByMySqlId(${dataSourceId}, ${mysqlId}) error:`, err);
    return null;
  }
}

/**
 * Generic upsert: find by MySQL ID, update or create.
 */
async function upsertPage(opts: {
  dbId: string;
  dsId: string;
  mysqlId: number;
  title: string;
  properties: Record<string, any>;
  writeType: string;
}): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const pageId = await findByMySqlId(client, opts.dsId, opts.mysqlId);
    const props = {
      ...opts.properties,
      "MySQL ID": { number: opts.mysqlId },
      "Last Updated From": { select: { name: "Portal" } },
    };

    if (pageId) {
      await client.pages.update({ page_id: pageId, properties: props });
    } else {
      await client.pages.create({
        parent: { database_id: opts.dbId },
        properties: {
          Name: { title: [{ text: { content: opts.title.substring(0, 100) } }] },
          ...props,
        },
      });
    }
    return true;
  } catch (error: any) {
    console.error(`[notion-dual] ${opts.writeType} sync failed (id=${opts.mysqlId}):`, error.message);
    enqueueFailedWrite(
      { writeType: opts.writeType as any, data: { ...opts, properties: undefined, title: opts.title, mysqlId: opts.mysqlId } },
      error.message || "Unknown error"
    ).catch(() => {});
    return false;
  }
}

// ─── Notion property helpers ───────────────────────────────────────────────────

function richText(val: string | null | undefined): any {
  return { rich_text: [{ text: { content: (val || "").substring(0, 2000) } }] };
}

function num(val: number | null | undefined): any {
  return { number: val ?? null };
}

function checkbox(val: boolean | number | null | undefined): any {
  return { checkbox: !!val };
}

function select(val: string | null | undefined): any {
  if (!val) return { select: null };
  return { select: { name: val } };
}

function email(val: string | null | undefined): any {
  if (!val) return { email: null };
  return { email: val };
}

function url(val: string | null | undefined): any {
  if (!val) return { url: null };
  return { url: val };
}

function dateProperty(val: Date | string | null | undefined): any {
  if (!val) return { date: null };
  const iso = val instanceof Date ? val.toISOString() : new Date(val).toISOString();
  return { date: { start: iso } };
}

// ─── AI Chat Log ───────────────────────────────────────────────────────────────

export interface AiChatLogPayload {
  mysqlId: number;
  organizationId: number | null;
  orgName: string | null;
  userEmail: string;
  userRole: string;
  prompt: string;
  response: string;
  model: string;
  tokensUsed: number | null;
  toolCalls: string | null;
  createdAt: Date;
}

export async function syncAiChatLog(payload: AiChatLogPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.aiChatLog,
    dsId: DS_IDS.aiChatLog,
    mysqlId: payload.mysqlId,
    title: `${payload.userEmail} - ${payload.createdAt.toISOString().split("T")[0]}`,
    writeType: "aiChatLog",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "User Email": email(payload.userEmail),
      "User Role": select(payload.userRole),
      "Prompt": richText(payload.prompt),
      "Response": richText(payload.response),
      "Model": richText(payload.model),
      "Tokens Used": num(payload.tokensUsed),
      "Tool Calls": richText(payload.toolCalls),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

export interface ActivityFeedPayload {
  mysqlId: number;
  organizationId: number;
  orgName: string | null;
  eventType: string;
  actor: string | null;
  description: string | null;
  createdAt: Date;
}

export async function syncActivityFeed(payload: ActivityFeedPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.activityFeed,
    dsId: DS_IDS.activityFeed,
    mysqlId: payload.mysqlId,
    title: `${payload.eventType} - ${payload.actor || "system"} - ${payload.createdAt.toISOString().split("T")[0]}`,
    writeType: "activityFeed",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Event Type": select(payload.eventType),
      "Actor": richText(payload.actor),
      "Description": richText(payload.description),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Org Notes & Files ─────────────────────────────────────────────────────────

export interface OrgNotePayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  clientId: number | null;
  label: string | null;
  fileName: string;
  fileUrl: string | null;
  driveFileId: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function syncOrgNote(payload: OrgNotePayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.orgNotes,
    dsId: DS_IDS.orgNotes,
    mysqlId: payload.mysqlId,
    title: payload.fileName || "Untitled Note",
    writeType: "orgNote",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Client ID": num(payload.clientId),
      "Label": select(payload.label),
      "File URL": url(payload.fileUrl),
      "Drive File ID": richText(payload.driveFileId ?? null),
      "File Size": num(payload.fileSize),
      "MIME Type": richText(payload.mimeType),
      "Uploaded By": richText(payload.uploadedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Partner Documents ─────────────────────────────────────────────────────────

export interface PartnerDocPayload {
  mysqlId: number;
  clientId: number;
  partnerName: string;
  title: string;
  fileName: string;
  fileUrl: string | null;
  driveFileId: string | null;
  mimeType: string | null;
  fileSize: number | null;
  category: string | null;
  uploadedBy: string | null;
  active: boolean;
  createdAt: Date;
}

export async function syncPartnerDocument(payload: PartnerDocPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.partnerDocuments,
    dsId: DS_IDS.partnerDocuments,
    mysqlId: payload.mysqlId,
    title: payload.title || payload.fileName,
    writeType: "partnerDocument",
    properties: {
      "Client ID": num(payload.clientId),
      "Partner": richText(payload.partnerName),
      "File Name": richText(payload.fileName),
      "File URL": url(payload.fileUrl),
      "Drive File ID": richText(payload.driveFileId ?? null),
      "MIME Type": richText(payload.mimeType),
      "File Size": num(payload.fileSize),
      "Category": select(payload.category),
      "Uploaded By": richText(payload.uploadedBy),
      "Active": checkbox(payload.active),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Onboarding Feedback ───────────────────────────────────────────────────────

export interface OnboardingFeedbackPayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  rating: number;
  comments: string | null;
  submittedBy: string | null;
  createdAt: Date;
}

export async function syncOnboardingFeedback(payload: OnboardingFeedbackPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.onboardingFeedback,
    dsId: DS_IDS.onboardingFeedback,
    mysqlId: payload.mysqlId,
    title: `${payload.orgName} - ${payload.createdAt.toISOString().split("T")[0]}`,
    writeType: "onboardingFeedback",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Rating": num(payload.rating),
      "Comments": richText(payload.comments),
      "Submitted By": email(payload.submittedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Org Custom Tasks ──────────────────────────────────────────────────────────

export interface OrgCustomTaskPayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  taskId: string;
  title: string;
  section: string | null;
  description: string | null;
  owner: string | null;
  status: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export async function syncOrgCustomTask(payload: OrgCustomTaskPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.orgCustomTasks,
    dsId: DS_IDS.orgCustomTasks,
    mysqlId: payload.mysqlId,
    title: payload.title,
    writeType: "orgCustomTask",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Task ID": richText(payload.taskId),
      "Section": richText(payload.section),
      "Description": richText(payload.description),
      "Owner": select(payload.owner),
      "Status": select(payload.status),
      "Created By": richText(payload.createdBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Section Progress ──────────────────────────────────────────────────────────

export interface SectionProgressPayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  sectionName: string;
  status: string | null;
  progress: number;
  expectedEnd: string | null;
  updatedAt: Date;
}

export async function syncSectionProgress(payload: SectionProgressPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.sectionProgress,
    dsId: DS_IDS.sectionProgress,
    mysqlId: payload.mysqlId,
    title: `${payload.orgName} / ${payload.sectionName}`,
    writeType: "sectionProgress",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Section Name": richText(payload.sectionName),
      "Status": select(payload.status),
      "Progress": num(payload.progress),
      "Expected End": richText(payload.expectedEnd),
      "Updated At": dateProperty(payload.updatedAt),
    },
  });
}

// ─── Vendor Audit Log ──────────────────────────────────────────────────────────

export interface VendorAuditPayload {
  mysqlId: number;
  vendorId: number;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string | null;
  createdAt: Date;
}

export async function syncVendorAudit(payload: VendorAuditPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.vendorAuditLog,
    dsId: DS_IDS.vendorAuditLog,
    mysqlId: payload.mysqlId,
    title: `Vendor #${payload.vendorId} - ${payload.action}`,
    writeType: "vendorAudit",
    properties: {
      "Vendor ID": num(payload.vendorId),
      "Action": select(payload.action),
      "Field": richText(payload.field),
      "Old Value": richText(payload.oldValue),
      "New Value": richText(payload.newValue),
      "Performed By": richText(payload.performedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Task File Attachments ─────────────────────────────────────────────────────

export interface TaskFilePayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  taskId: string;
  fileName: string;
  fileUrl: string | null;
  driveFileId?: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function syncTaskFile(payload: TaskFilePayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.taskFileAttachments,
    dsId: DS_IDS.taskFileAttachments,
    mysqlId: payload.mysqlId,
    title: payload.fileName,
    writeType: "taskFile",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Task ID": richText(payload.taskId),
      "File URL": url(payload.fileUrl),
      "Drive File ID": richText(payload.driveFileId ?? null),
      "File Size": num(payload.fileSize),
      "MIME Type": richText(payload.mimeType),
      "Uploaded By": richText(payload.uploadedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Intake File Attachments ───────────────────────────────────────────────────

export interface IntakeFilePayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  questionId: string;
  fileName: string;
  fileUrl: string | null;
  driveFileId: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function syncIntakeFile(payload: IntakeFilePayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.intakeFileAttachments,
    dsId: DS_IDS.intakeFileAttachments,
    mysqlId: payload.mysqlId,
    title: payload.fileName,
    writeType: "intakeFile",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Question ID": richText(payload.questionId),
      "File URL": url(payload.fileUrl),
      "Drive File ID": richText(payload.driveFileId ?? null),
      "File Size": num(payload.fileSize),
      "MIME Type": richText(payload.mimeType),
      "Uploaded By": richText(payload.uploadedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Partner Templates ─────────────────────────────────────────────────────────

export interface PartnerTemplatePayload {
  mysqlId: number;
  clientId: number;
  partnerName: string;
  title: string;
  questionId: string | null;
  fileName: string;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  active: boolean;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function syncPartnerTemplate(payload: PartnerTemplatePayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.partnerTemplates,
    dsId: DS_IDS.partnerTemplates,
    mysqlId: payload.mysqlId,
    title: payload.title || payload.fileName,
    writeType: "partnerTemplate",
    properties: {
      "Client ID": num(payload.clientId),
      "Partner": richText(payload.partnerName),
      "Question ID": richText(payload.questionId),
      "File Name": richText(payload.fileName),
      "File URL": url(payload.fileUrl),
      "MIME Type": richText(payload.mimeType),
      "File Size": num(payload.fileSize),
      "Active": checkbox(payload.active),
      "Uploaded By": richText(payload.uploadedBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Partner Task Templates ────────────────────────────────────────────────────

export interface PartnerTaskTemplatePayload {
  mysqlId: number;
  clientId: number;
  partnerName: string;
  title: string;
  taskId: string;
  section: string | null;
  description: string | null;
  owner: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
}

export async function syncPartnerTaskTemplate(payload: PartnerTaskTemplatePayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.partnerTaskTemplates,
    dsId: DS_IDS.partnerTaskTemplates,
    mysqlId: payload.mysqlId,
    title: payload.title,
    writeType: "partnerTaskTemplate",
    properties: {
      "Client ID": num(payload.clientId),
      "Partner": richText(payload.partnerName),
      "Task ID": richText(payload.taskId),
      "Section": richText(payload.section),
      "Description": richText(payload.description),
      "Owner": select(payload.owner),
      "Active": checkbox(payload.active),
      "Created By": richText(payload.createdBy),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Specifications ────────────────────────────────────────────────────────────

export interface SpecificationPayload {
  mysqlId: number;
  title: string;
  key: string;
  description: string | null;
  category: string | null;
  active: boolean;
  createdAt: Date;
}

export async function syncSpecification(payload: SpecificationPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.specifications,
    dsId: DS_IDS.specifications,
    mysqlId: payload.mysqlId,
    title: payload.title,
    writeType: "specification",
    properties: {
      "Key": richText(payload.key),
      "Description": richText(payload.description),
      "Category": select(payload.category),
      "Active": checkbox(payload.active),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── System Vendor Options ─────────────────────────────────────────────────────

export interface SystemVendorPayload {
  mysqlId: number;
  systemType: string;
  vendorName: string;
  productName: string;
  active: boolean;
  createdAt: Date;
}

export async function syncSystemVendor(payload: SystemVendorPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.systemVendorOptions,
    dsId: DS_IDS.systemVendorOptions,
    mysqlId: payload.mysqlId,
    title: `${payload.vendorName} - ${payload.productName}`,
    writeType: "systemVendor",
    properties: {
      "System Type": select(payload.systemType),
      "Vendor Name": richText(payload.vendorName),
      "Product Name": richText(payload.productName),
      "Active": checkbox(payload.active),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Questions ─────────────────────────────────────────────────────────────────

export interface QuestionPayload {
  mysqlId: number;
  key: string;
  section: string;
  type: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  fullText: string;
  createdAt: Date;
}

export async function syncQuestion(payload: QuestionPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.questions,
    dsId: DS_IDS.questions,
    mysqlId: payload.mysqlId,
    title: payload.fullText.substring(0, 100),
    writeType: "question",
    properties: {
      "Key": richText(payload.key),
      "Section": richText(payload.section),
      "Type": select(payload.type),
      "Required": checkbox(payload.required),
      "Active": checkbox(payload.active),
      "Sort Order": num(payload.sortOrder),
      "Full Text": richText(payload.fullText),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Question Options ──────────────────────────────────────────────────────────

export interface QuestionOptionPayload {
  mysqlId: number;
  questionId: number;
  questionKey: string;
  label: string;
  value: string;
  sortOrder: number;
  createdAt: Date;
}

export async function syncQuestionOption(payload: QuestionOptionPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.questionOptions,
    dsId: DS_IDS.questionOptions,
    mysqlId: payload.mysqlId,
    title: payload.label,
    writeType: "questionOption",
    properties: {
      "Question ID": num(payload.questionId),
      "Question Key": richText(payload.questionKey),
      "Value": richText(payload.value),
      "Sort Order": num(payload.sortOrder),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Portal Users ──────────────────────────────────────────────────────────────

export interface PortalUserPayload {
  mysqlId: number;
  name: string;
  email: string;
  role: string;
  clientId?: number | null;
  partnerName?: string | null;
  organizationId?: number | null;
  orgName?: string | null;
  active: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
}

export async function syncPortalUser(payload: PortalUserPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.portalUsers,
    dsId: DS_IDS.portalUsers,
    mysqlId: payload.mysqlId,
    title: payload.name || payload.email,
    writeType: "portalUser",
    properties: {
      "Email": email(payload.email),
      "Role": select(payload.role),
      "Client ID": num(payload.clientId ?? null),
      "Partner": richText(payload.partnerName ?? null),
      "Organization ID": num(payload.organizationId ?? null),
      "Organization": richText(payload.orgName ?? null),
      "Active": checkbox(payload.active),
      "Last Login": dateProperty(payload.lastLogin ?? null),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Clients (Partners) ────────────────────────────────────────────────────────

export interface ClientPayload {
  mysqlId: number;
  name: string;
  slug: string;
  contactName: string | null;
  contactEmail: string | null;
  active: boolean;
  orgCount: number;
  createdAt: Date;
}

export async function syncClient(payload: ClientPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.clients,
    dsId: DS_IDS.clients,
    mysqlId: payload.mysqlId,
    title: payload.name,
    writeType: "client",
    properties: {
      "Slug": richText(payload.slug),
      "Contact Name": richText(payload.contactName),
      "Contact Email": email(payload.contactEmail),
      "Active": checkbox(payload.active),
      "Org Count": num(payload.orgCount),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Organizations ─────────────────────────────────────────────────────────────

export interface OrganizationPayload {
  mysqlId: number;
  name: string;
  slug: string;
  clientId?: number | null;
  partnerName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  startDate?: Date | null;
  goalDate?: Date | null;
  driveFolderId?: string | null;
  createdAt: Date;
}

export async function syncOrganization(payload: OrganizationPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.organizations,
    dsId: DS_IDS.organizations,
    mysqlId: payload.mysqlId,
    title: payload.name,
    writeType: "organization",
    properties: {
      "Slug": richText(payload.slug),
      "Client ID": num(payload.clientId ?? null),
      "Partner": richText(payload.partnerName),
      "Contact Name": richText(payload.contactName ?? null),
      "Contact Email": email(payload.contactEmail ?? null),
      "Contact Phone": richText(payload.contactPhone ?? null),
      "Status": select(payload.status ?? null),
      "Start Date": dateProperty(payload.startDate ?? null),
      "Goal Date": dateProperty(payload.goalDate ?? null),
      "Drive Folder ID": richText(payload.driveFolderId ?? null),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Implementation Orgs ───────────────────────────────────────────────────────

export interface ImplementationOrgPayload {
  mysqlId: number;
  organizationId: number;
  orgName: string;
  name: string;
  orgType: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
}

export async function syncImplementationOrg(payload: ImplementationOrgPayload): Promise<boolean> {
  return upsertPage({
    dbId: DB_IDS.implementationOrgs,
    dsId: DS_IDS.implementationOrgs,
    mysqlId: payload.mysqlId,
    title: payload.name,
    writeType: "implementationOrg",
    properties: {
      "Organization ID": num(payload.organizationId),
      "Organization": richText(payload.orgName),
      "Org Type": select(payload.orgType),
      "Color": richText(payload.color),
      "Sort Order": num(payload.sortOrder),
      "Active": checkbox(payload.active),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Partner Doc Audit ────────────────────────────────────────────────────────

export interface PartnerDocAuditPayload {
  mysqlId: number;
  documentId: number;
  documentTitle: string;
  action: string;
  userId: number;
  userName: string;
  userEmail: string;
  createdAt: Date;
}

export async function syncPartnerDocAudit(payload: PartnerDocAuditPayload): Promise<boolean> {
  // Partner doc audit goes into the same Partner Documents DB as a related entry
  // We use the partnerDocuments DB but with a different title format to distinguish
  return upsertPage({
    dbId: DB_IDS.partnerDocuments,
    dsId: DS_IDS.partnerDocuments,
    mysqlId: payload.mysqlId + 1000000, // Offset to avoid collision with document IDs
    title: `[Audit] ${payload.documentTitle || "Doc #" + payload.documentId} - ${payload.action}`,
    writeType: "partnerDocAudit",
    properties: {
      "File Name": richText(`Audit: ${payload.action} by ${payload.userName}`),
      "Category": select("audit"),
      "Uploaded By": richText(payload.userEmail),
      "Active": checkbox(true),
      "Created At": dateProperty(payload.createdAt),
    },
  });
}

// ─── Bulk Sync Utilities ───────────────────────────────────────────────────────

/**
 * Export all DB/DS IDs for use in sync-back modules.
 */
export { DB_IDS, DS_IDS };
