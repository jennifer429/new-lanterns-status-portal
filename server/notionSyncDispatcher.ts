/**
 * Notion Sync Dispatcher
 *
 * Centralized module that provides fire-and-forget dual-write calls.
 * Each function accepts the MySQL row data (after insert/update) and
 * dispatches to the appropriate notionDualWrite function.
 *
 * Usage pattern in routers:
 *   import { dispatch } from "../notionSyncDispatcher";
 *   // After MySQL insert:
 *   dispatch.aiChatLog({ mysqlId: result.insertId, ... });
 *
 * All dispatch calls are fire-and-forget (no await needed).
 * Failures are logged and enqueued for retry automatically.
 */

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
  syncEmailLog,
  type AiChatLogPayload,
  type ActivityFeedPayload,
  type OrgNotePayload,
  type PartnerDocPayload,
  type PartnerDocAuditPayload,
  type OnboardingFeedbackPayload,
  type OrgCustomTaskPayload,
  type SectionProgressPayload,
  type VendorAuditPayload,
  type TaskFilePayload,
  type IntakeFilePayload,
  type PartnerTemplatePayload,
  type PartnerTaskTemplatePayload,
  type SpecificationPayload,
  type SystemVendorPayload,
  type QuestionPayload,
  type QuestionOptionPayload,
  type PortalUserPayload,
  type ClientPayload,
  type OrganizationPayload,
  type ImplementationOrgPayload,
  type EmailLogPayload,
} from "./notionDualWrite";

/**
 * Fire-and-forget wrapper. Logs errors but never throws.
 */
function fireAndForget(fn: () => Promise<boolean>, label: string): void {
  fn().catch((err) => {
    console.error(`[sync-dispatch] ${label} failed:`, err?.message || err);
  });
}

/**
 * Dispatch object — call any method fire-and-forget style.
 * Example: dispatch.aiChatLog({ mysqlId: 42, ... });
 */
export const dispatch = {
  aiChatLog(payload: AiChatLogPayload): void {
    fireAndForget(() => syncAiChatLog(payload), "aiChatLog");
  },

  activityFeed(payload: ActivityFeedPayload): void {
    fireAndForget(() => syncActivityFeed(payload), "activityFeed");
  },

  orgNote(payload: OrgNotePayload): void {
    fireAndForget(() => syncOrgNote(payload), "orgNote");
  },

  partnerDocument(payload: PartnerDocPayload): void {
    fireAndForget(() => syncPartnerDocument(payload), "partnerDocument");
  },

  onboardingFeedback(payload: OnboardingFeedbackPayload): void {
    fireAndForget(() => syncOnboardingFeedback(payload), "onboardingFeedback");
  },

  orgCustomTask(payload: OrgCustomTaskPayload): void {
    fireAndForget(() => syncOrgCustomTask(payload), "orgCustomTask");
  },

  sectionProgress(payload: SectionProgressPayload): void {
    fireAndForget(() => syncSectionProgress(payload), "sectionProgress");
  },

  vendorAudit(payload: VendorAuditPayload): void {
    fireAndForget(() => syncVendorAudit(payload), "vendorAudit");
  },

  taskFile(payload: TaskFilePayload): void {
    fireAndForget(() => syncTaskFile(payload), "taskFile");
  },

  intakeFile(payload: IntakeFilePayload): void {
    fireAndForget(() => syncIntakeFile(payload), "intakeFile");
  },

  partnerTemplate(payload: PartnerTemplatePayload): void {
    fireAndForget(() => syncPartnerTemplate(payload), "partnerTemplate");
  },

  partnerTaskTemplate(payload: PartnerTaskTemplatePayload): void {
    fireAndForget(() => syncPartnerTaskTemplate(payload), "partnerTaskTemplate");
  },

  specification(payload: SpecificationPayload): void {
    fireAndForget(() => syncSpecification(payload), "specification");
  },

  systemVendor(payload: SystemVendorPayload): void {
    fireAndForget(() => syncSystemVendor(payload), "systemVendor");
  },

  question(payload: QuestionPayload): void {
    fireAndForget(() => syncQuestion(payload), "question");
  },

  questionOption(payload: QuestionOptionPayload): void {
    fireAndForget(() => syncQuestionOption(payload), "questionOption");
  },

  portalUser(payload: PortalUserPayload): void {
    fireAndForget(() => syncPortalUser(payload), "portalUser");
  },

  client(payload: ClientPayload): void {
    fireAndForget(() => syncClient(payload), "client");
  },

  organization(payload: OrganizationPayload): void {
    fireAndForget(() => syncOrganization(payload), "organization");
  },

  implementationOrg(payload: ImplementationOrgPayload): void {
    fireAndForget(() => syncImplementationOrg(payload), "implementationOrg");
  },

  // Aliases for convenience (routers may use shorter names)
  activity(payload: ActivityFeedPayload): void {
    fireAndForget(() => syncActivityFeed(payload), "activityFeed");
  },

  partnerDocAudit(payload: PartnerDocAuditPayload): void {
    fireAndForget(() => syncPartnerDocAudit(payload), "partnerDocAudit");
  },

  taskFileAttachment(payload: TaskFilePayload): void {
    fireAndForget(() => syncTaskFile(payload), "taskFileAttachment");
  },

  user(payload: PortalUserPayload): void {
    fireAndForget(() => syncPortalUser(payload), "user");
  },

  emailLog(payload: EmailLogPayload): void {
    fireAndForget(() => syncEmailLog(payload), "emailLog");
  },
};
