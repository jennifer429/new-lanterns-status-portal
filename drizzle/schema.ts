import { check, int, json, mysqlEnum, mysqlTable, text, timestamp, tinyint, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt hash for email/password auth
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }), // Link user to client (RadOne, SRV, etc.)
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "set null" }), // Link user to organization (null for admins)
  isActive: tinyint("isActive").default(1).notNull(), // 1 = active, 0 = deactivated (works for all user types)
  invitedAt: timestamp("invitedAt"), // When the invite email was sent
  inviteToken: varchar("inviteToken", { length: 128 }), // One-time token for "set your password" link
  inviteTokenExpiresAt: timestamp("inviteTokenExpiresAt"), // Token expiry
  lastLoginAt: timestamp("lastLoginAt"), // Track last login for admin dashboard metrics
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients table - represents NL's customers (e.g., RadOne, SRV)
 * Top level of the hierarchy: Client → Organizations (hospitals)
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "RadOne", "SRV"
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-safe identifier
  description: text("description"), // Optional description
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Organizations table - represents clinical organizations (hospitals/facilities)
 * Second level of hierarchy: belongs to a Client
 * Each organization gets a unique slug for URL-based access
 */
export const organizations = mysqlTable("organizations", {
  clientId: int("clientId").references(() => clients.id, { onDelete: "restrict" }), // FK to clients.id (temporarily optional for migration)
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-safe identifier
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  startDate: varchar("startDate", { length: 50 }),
  goalDate: varchar("goalDate", { length: 50 }),
  targetGoLiveDate: varchar("targetGoLiveDate", { length: 50 }), // planned go-live (YYYY-MM-DD)
  liveDate: varchar("liveDate", { length: 50 }), // actual go-live, set when flipped to completed (YYYY-MM-DD)
  goLiveAutoNa: text("goLiveAutoNa"), // JSON snapshot of items auto-marked N/A at go-live, used to revert on reopen
  status: mysqlEnum("status", ["active", "completed", "paused", "inactive"]).default("active").notNull(),
  googleDriveFolderId: varchar("googleDriveFolderId", { length: 100 }), // Google Drive folder ID for files
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Section progress tracking - stores completion status for each checklist section
 */
export const sectionProgress = mysqlTable("sectionProgress", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sectionName: varchar("sectionName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "in-progress", "complete"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(), // 0-100
  expectedEnd: varchar("expectedEnd", { length: 50 }),
  actualEnd: varchar("actualEnd", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one progress row per org+section (portal upserts on this tuple)
  orgSection: uniqueIndex("uq_section_org_name").on(t.organizationId, t.sectionName),
  // P1: progress is a percentage
  progressRange: check("chk_section_progress_pct", sql`progress between 0 and 100`),
}));

export type SectionProgress = typeof sectionProgress.$inferSelect;
export type InsertSectionProgress = typeof sectionProgress.$inferInsert;

/**
 * Task completion tracking - stores which tasks are completed
 */
export const taskCompletion = mysqlTable("taskCompletion", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sectionName: varchar("sectionName", { length: 255 }).notNull(),
  taskId: varchar("taskId", { length: 50 }).notNull(),
  completed: int("completed").default(0).notNull(), // 0 or 1 (boolean)
  notApplicable: int("notApplicable").default(0).notNull(), // 0 or 1 — marks task as N/A (excluded from counts)
  inProgress: int("inProgress").default(0).notNull(), // 0 or 1 — marks task as in-progress
  blocked: int("blocked").default(0).notNull(), // 0 or 1 — marks task as blocked
  completedAt: timestamp("completedAt"),
  completedBy: varchar("completedBy", { length: 255 }),
  targetDate: varchar("targetDate", { length: 20 }), // YYYY-MM-DD target/due date
  notes: text("notes"),
  /** Notion page last_edited_time — used as version check for sync-back. Null = portal wrote last (dual-write pending). */
  notionLastEdited: timestamp("notionLastEdited"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one status row per org+task
  orgTask: uniqueIndex("uq_taskcompletion_org_task").on(t.organizationId, t.taskId),
  // P1: completed / notApplicable / inProgress / blocked are mutually exclusive
  statusExclusive: check(
    "chk_task_status_exclusive",
    sql`(completed + notApplicable + inProgress + blocked) <= 1`
  ),
}));

export type TaskCompletion = typeof taskCompletion.$inferSelect;
export type InsertTaskCompletion = typeof taskCompletion.$inferInsert;

/**
 * File attachments - stores uploaded files for tasks
 */
export const fileAttachments = mysqlTable("fileAttachments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 50 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(), // S3 URL
  fileKey: varchar("fileKey", { length: 500 }).notNull(), // S3 key
  fileSize: int("fileSize"), // bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FileAttachment = typeof fileAttachments.$inferSelect;
export type InsertFileAttachment = typeof fileAttachments.$inferInsert;

/**
 * Questions - master list of all intake questions (single source of truth)
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  questionId: varchar("questionId", { length: 50 }).notNull().unique(), // e.g., "H.1", "A.7", "D.3"
  sectionId: varchar("sectionId", { length: 50 }).notNull(), // e.g., "org-info", "overview-arch"
  sectionTitle: varchar("sectionTitle", { length: 255 }).notNull(), // e.g., "Organization Information"
  questionNumber: int("questionNumber").notNull(), // Sequential number within section (1, 2, 3...)
  shortTitle: varchar("shortTitle", { length: 100 }).notNull(), // Short title for filenames, e.g., "Procedure-Code-List"
  questionText: text("questionText").notNull(),
  questionType: varchar("questionType", { length: 50 }).notNull(), // text, textarea, dropdown, date, multi-select, upload
  options: text("options"), // JSON array of options for dropdown/multi-select
  placeholder: text("placeholder"),
  notes: text("notes"),
  required: int("required").default(0).notNull(), // 0 or 1 (boolean)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Responses - stores user answers to questions with audit trail
 */
export const responses = mysqlTable("responses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => questions.id, { onDelete: "cascade" }), // Foreign key to questions.id
  response: text("response"), // Text answer or JSON for complex responses
  fileUrl: text("fileUrl"), // For file uploads
  userEmail: varchar("userEmail", { length: 320 }), // Who provided this response
  createdAt: timestamp("createdAt").defaultNow().notNull(), // When first answered
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // When last modified
}, (t) => ({
  // P0: one response row per org+question
  orgQuestion: uniqueIndex("uq_responses_org_question").on(t.organizationId, t.questionId),
}));

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * Question Options - individual options for dropdown and multi-select questions
 * Allows easy management and updates of question choices
 */
export const questionOptions = mysqlTable("question_options", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull().references(() => questions.id, { onDelete: "cascade" }), // FK to questions.id
  optionValue: varchar("optionValue", { length: 255 }).notNull(), // Internal value (e.g., "eastern")
  optionLabel: varchar("optionLabel", { length: 255 }).notNull(), // Display text (e.g., "Eastern Time")
  displayOrder: int("displayOrder").default(0).notNull(), // Order in dropdown (1, 2, 3...)
  isActive: int("isActive").default(1).notNull(), // 0 = disabled, 1 = active
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one option per question+value
  questionValue: uniqueIndex("uq_qoption_question_value").on(t.questionId, t.optionValue),
}));

export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertQuestionOption = typeof questionOptions.$inferInsert;

/**
 * Intake responses - primary storage for questionnaire answers.
 * Keyed by questionId varchar (e.g. "H.1", "CF.2") matching questionnaireData.ts section/question IDs.
 */
export const intakeResponses = mysqlTable("intakeResponses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  questionId: varchar("questionId", { length: 50 }).notNull(),
  section: varchar("section", { length: 255 }).notNull(),
  response: text("response"),
  fileUrl: text("fileUrl"),
  status: mysqlEnum("status", ["not_started", "in_progress", "complete"]).default("not_started").notNull(),
  updatedBy: varchar("updatedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one intake response per org+question
  orgQuestion: uniqueIndex("uq_intake_org_question").on(t.organizationId, t.questionId),
}));

export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type InsertIntakeResponse = typeof intakeResponses.$inferInsert;

/**
 * Intake file attachments - stores files uploaded in intake form questions
 */
export const intakeFileAttachments = mysqlTable("intakeFileAttachments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  questionId: varchar("questionId", { length: 50 }).notNull(), // e.g., "active_directory_sso"
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(), // Google Drive shareable link
  driveFileId: varchar("driveFileId", { length: 500 }), // S3 key or Google Drive file ID
  fileSize: int("fileSize"), // bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntakeFileAttachment = typeof intakeFileAttachments.$inferSelect;
export type InsertIntakeFileAttachment = typeof intakeFileAttachments.$inferInsert;

/**
 * Activity feed - manual updates posted to the client portal
 */
export const activityFeed = mysqlTable("activityFeed", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  source: mysqlEnum("source", ["manual", "clickup", "linear"]).notNull(),
  sourceId: varchar("sourceId", { length: 100 }),
  author: varchar("author", { length: 255 }),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityFeed = typeof activityFeed.$inferSelect;
export type InsertActivityFeed = typeof activityFeed.$inferInsert;

/**
 * Password reset tokens - stores temporary tokens for password reset flow
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: int("used").default(0).notNull(), // 0 or 1 (boolean)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Onboarding feedback - stores user ratings and comments about the intake experience
 */
export const onboardingFeedback = mysqlTable("onboardingFeedback", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  rating: int("rating").notNull(), // 1-5 stars
  comments: text("comments"),
  submittedBy: varchar("submittedBy", { length: 320 }), // User email
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  // P1: rating is a 1-5 star score
  ratingRange: check("chk_feedback_rating", sql`rating between 1 and 5`),
}));

export type OnboardingFeedback = typeof onboardingFeedback.$inferSelect;
export type InsertOnboardingFeedback = typeof onboardingFeedback.$inferInsert;

/**
 * Partner templates - stores downloadable template files scoped to a client (partner)
 * Each template is tied to a questionId (e.g., VPN form = E.1) and a clientId.
 * Partners can only see/manage their own templates. Platform admins can manage all.
 * Templates are displayed on the intake form for the matching question and partner.
 */
export const partnerTemplates = mysqlTable("partnerTemplates", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }), // FK to clients.id - which partner owns this template
  questionId: varchar("questionId", { length: 50 }).notNull(), // Which intake question this template belongs to (e.g., "E.1" for VPN form)
  label: varchar("label", { length: 255 }).notNull(), // Display name (e.g., "VPN Configuration Form")
  fileName: varchar("fileName", { length: 255 }).notNull(), // Original uploaded file name
  fileUrl: text("fileUrl").notNull(), // S3 URL for download
  s3Key: varchar("s3Key", { length: 500 }).notNull(), // S3 key for reference
  fileSize: int("fileSize"), // bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: varchar("uploadedBy", { length: 320 }), // Admin email who uploaded
  isActive: tinyint("isActive").default(1).notNull(), // 1 = active, 0 = soft-deleted
  deactivatedBy: varchar("deactivatedBy", { length: 320 }), // Admin email who deactivated/replaced this template
  deactivatedAt: timestamp("deactivatedAt"), // When the template was deactivated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerTemplate = typeof partnerTemplates.$inferSelect;;
export type InsertPartnerTemplate = typeof partnerTemplates.$inferInsert;
/**
 * New Lantern Specifications - global documents uploaded by admins, visible to all logged-in users.
 * These are spec sheets, integration guides, reference docs, etc. from New Lantern.
 */
export const specifications = mysqlTable("specifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(), // Display title (e.g., "HL7 Integration Guide")
  description: text("description"), // Optional description
  category: varchar("category", { length: 100 }), // Optional category for grouping (e.g., "Integration", "Security")
  fileName: varchar("fileName", { length: 255 }).notNull(), // Original uploaded file name
  fileUrl: text("fileUrl").notNull(), // S3 URL for download
  s3Key: varchar("s3Key", { length: 500 }).notNull(), // S3 key for reference
  fileSize: int("fileSize"), // bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: varchar("uploadedBy", { length: 320 }), // Admin email who uploaded
  isActive: tinyint("isActive").default(1).notNull(), // 1 = active, 0 = soft-deleted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Specification = typeof specifications.$inferSelect;
export type InsertSpecification = typeof specifications.$inferInsert;

/**
 * Validation test results - stores mutable test state per organization.
 * Phase/test definitions stay in shared/validationPhases.ts;
 * only the editable fields (actual, status, signOff) are persisted here.
 */
export const validationResults = mysqlTable("validationResults", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  /** Stable key: "<phaseIndex>:<testIndex>", e.g. "1:2" */
  testKey: varchar("testKey", { length: 20 }).notNull(),
  actual: text("actual"),
  status: mysqlEnum("status", ["Pass", "Fail", "Not Tested", "Pending", "N/A", "In Progress", "Blocked"]).default("Not Tested").notNull(),
  signOff: varchar("signOff", { length: 255 }),
  notes: text("notes"),
  /** User-settable date for when this test was documented. Auto-populates with today's date. */
  testedDate: varchar("testedDate", { length: 10 }), // YYYY-MM-DD format
  updatedBy: varchar("updatedBy", { length: 320 }),
  /** Notion page last_edited_time — used as version check for sync-back. Null = portal wrote last (dual-write pending). */
  notionLastEdited: timestamp("notionLastEdited"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one result row per org+test
  orgTest: uniqueIndex("uq_validation_org_testkey").on(t.organizationId, t.testKey),
}));

export type ValidationResult = typeof validationResults.$inferSelect;
export type InsertValidationResult = typeof validationResults.$inferInsert;

/**
 * System Vendor Options - admin-configurable picklist for system types in the Architecture section.
 * Both partner admins (RadOne-Admin) and platform admins can manage these.
 * Each row is one vendor option under a system type (e.g., type="PACS", vendorName="Fujifilm Synapse").
 */
export const systemVendorOptions = mysqlTable("systemVendorOptions", {
  id: int("id").autoincrement().primaryKey(),
  systemType: varchar("systemType", { length: 100 }).notNull(), // e.g., "PACS", "VNA", "EHR", "AI", "Reporting"
  vendorName: varchar("vendorName", { length: 255 }).notNull(), // e.g., "Fujifilm Synapse", "Epic"
  displayOrder: int("displayOrder").default(0).notNull(), // Sort order within the system type
  isActive: tinyint("isActive").default(1).notNull(), // 1 = active, 0 = hidden
  createdBy: varchar("createdBy", { length: 320 }), // Admin email who created
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemVendorOption = typeof systemVendorOptions.$inferSelect;
export type InsertSystemVendorOption = typeof systemVendorOptions.$inferInsert;

/**
 * Audit log for vendor picklist changes.
 * Tracks who changed what, when, and the before/after values.
 */
export const vendorAuditLog = mysqlTable("vendorAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 50 }).notNull(), // 'add', 'update', 'toggle', 'delete', 'add_system_type', 'seed_defaults'
  systemType: varchar("systemType", { length: 100 }).notNull(),
  vendorName: varchar("vendorName", { length: 255 }), // The vendor affected (null for bulk ops like seed)
  previousValue: text("previousValue"), // JSON or plain text of previous state
  newValue: text("newValue"), // JSON or plain text of new state
  performedBy: varchar("performedBy", { length: 320 }).notNull(), // Email of admin who made the change
  performedAt: timestamp("performedAt").defaultNow().notNull(),
});

export type VendorAuditLog = typeof vendorAuditLog.$inferSelect;
export type InsertVendorAuditLog = typeof vendorAuditLog.$inferInsert;

/**
 * Org Notes — labeled file uploads from the org and partner dashboards.
 * Supports both org-level notes (organizationId set) and partner-level notes (clientId set).
 * Users label each file (e.g., "Call Notes", "Template", "Reference Doc") for easy retrieval.
 */
export const orgNotes = mysqlTable("orgNotes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "cascade" }), // set for org-level notes; null for partner-level
  clientId: int("clientId").references(() => clients.id, { onDelete: "cascade" }), // set for partner-level notes; also set on org-level for easy filtering
  label: varchar("label", { length: 100 }).notNull().default("General"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  driveFileId: varchar("driveFileId", { length: 500 }), // Google Drive file ID (actual Drive ID only)
  s3Key: varchar("s3Key", { length: 500 }), // S3 storage key for direct access
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  // P1: a note must belong to an org or a partner (or both)
  ownerPresent: check("chk_orgnote_owner", sql`organizationId is not null or clientId is not null`),
}));

export type OrgNote = typeof orgNotes.$inferSelect;
export type InsertOrgNote = typeof orgNotes.$inferInsert;


/**
 * Partner Task Templates - reusable task definitions created by partner admins.
 * Each template represents an action item that orgs under this partner need to complete.
 * Partners can create, edit, and delete their own task templates.
 * These show up on the /org/:slug/tasks page for the partner's organizations.
 */
export const partnerTaskTemplates = mysqlTable("partnerTaskTemplates", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["upload", "schedule", "form", "review"]).notNull().default("review"),
  section: varchar("section", { length: 255 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdBy: varchar("createdBy", { length: 320 }),
  updatedBy: varchar("updatedBy", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PartnerTaskTemplate = typeof partnerTaskTemplates.$inferSelect;
export type InsertPartnerTaskTemplate = typeof partnerTaskTemplates.$inferInsert;

/**
 * Org-specific custom tasks — added by hospital users to their own task list.
 * These are per-org and do NOT affect the partner's template for other sites.
 */
export const orgCustomTasks = mysqlTable("orgCustomTasks", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["upload", "schedule", "form", "review"]).notNull().default("review"),
  section: varchar("section", { length: 255 }),
  isComplete: tinyint("isComplete").default(0).notNull(),
  createdBy: varchar("createdBy", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrgCustomTask = typeof orgCustomTasks.$inferSelect;
export type InsertOrgCustomTask = typeof orgCustomTasks.$inferInsert;

/**
 * Per-org completion state for partner-defined template tasks.
 *
 * The task definition lives in `partnerTaskTemplates` (shared across all of a
 * partner's sites), but each org tracks its own completion here so progress
 * persists across page refreshes and is isolated per site.
 */
export const templateTaskCompletion = mysqlTable("templateTaskCompletion", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  templateTaskId: int("templateTaskId").notNull().references(() => partnerTaskTemplates.id, { onDelete: "cascade" }),
  isComplete: tinyint("isComplete").default(0).notNull(),
  completedAt: timestamp("completedAt"),
  completedBy: varchar("completedBy", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one completion row per org+template task
  orgTemplateTask: uniqueIndex("uq_templatetask_org_task").on(t.organizationId, t.templateTaskId),
}));

export type TemplateTaskCompletion = typeof templateTaskCompletion.$inferSelect;
export type InsertTemplateTaskCompletion = typeof templateTaskCompletion.$inferInsert;

/**
 * AI Audit Logs - comprehensive logging for all AI assistant actions.
 * Every tool call, chat interaction, and data mutation initiated through the AI
 * is recorded here for compliance, debugging, and accountability.
 *
 * RBAC: Platform admins see all logs. Partner admins see only logs where clientId matches.
 */
export const aiAuditLogs = mysqlTable("aiAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  /** The tool/action that was executed (e.g., "chat", "create_organization", "list_users") */
  action: varchar("action", { length: 100 }).notNull(),
  /** High-level category for filtering */
  category: mysqlEnum("category", ["chat", "read", "write", "navigate", "extract"]).notNull(),
  /** The user who triggered the action */
  actorId: int("actorId"), // FK to users.id
  actorEmail: varchar("actorEmail", { length: 320 }),
  actorRole: varchar("actorRole", { length: 50 }), // "admin" role name
  /** Partner isolation: which client (partner) this action belongs to */
  clientId: int("clientId"), // FK to clients.id — null for platform admins
  /** Optional target references */
  organizationId: int("organizationId"), // If the action targeted a specific org
  organizationSlug: varchar("organizationSlug", { length: 100 }), // Slug for easy display
  targetUserId: int("targetUserId"), // If the action targeted a specific user
  targetUserEmail: varchar("targetUserEmail", { length: 320 }),
  /** The user's prompt / input that triggered this action */
  userPrompt: text("userPrompt"),
  /** The AI's response text */
  aiResponse: text("aiResponse"),
  /** Tool call arguments (JSON) */
  toolArgs: text("toolArgs"),
  /** Tool call result (JSON, truncated if large) */
  toolResult: text("toolResult"),
  /** Whether the action succeeded or failed */
  status: mysqlEnum("status", ["success", "error", "denied"]).default("success").notNull(),
  /** Error message if the action failed */
  errorMessage: text("errorMessage"),
  /** IP address of the request (for security auditing) */
  ipAddress: varchar("ipAddress", { length: 45 }),
  /** Duration of the action in milliseconds */
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiAuditLog = typeof aiAuditLogs.$inferSelect;
export type InsertAiAuditLog = typeof aiAuditLogs.$inferInsert;

// ============================================================================
// Partner Procedural Library
// ============================================================================

/**
 * Partner Documents — operational and procedural documents uploaded by partners.
 * Scoped to a client (partner). All organizations under that partner can view/download.
 * Partners can upload, edit metadata, and delete. Org users can only view/download.
 */
export const partnerDocuments = mysqlTable("partnerDocuments", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }), // FK to clients.id — which partner owns this document
  categoryId: int("categoryId"), // FK to partnerDocCategories.id — nullable for uncategorized (no table defined; not enforced)
  title: varchar("title", { length: 500 }).notNull(), // Document title
  description: text("description"), // Description of what the document is
  filename: varchar("filename", { length: 500 }).notNull(), // Original filename
  driveFileId: varchar("driveFileId", { length: 255 }), // Google Drive file ID (actual Drive ID, NOT s3 key)
  s3Key: varchar("s3Key", { length: 500 }), // S3 storage key for direct access (separate from driveFileId)
  url: varchar("url", { length: 2000 }).notNull(), // Primary URL (Drive URL if available, else S3)
  mimeType: varchar("mimeType", { length: 255 }).notNull(),
  size: int("size").notNull(), // File size in bytes
  uploadedById: int("uploadedById").notNull(), // FK to users.id — who uploaded
  uploadedByName: varchar("uploadedByName", { length: 255 }).notNull(), // Denormalized for display
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerDocument = typeof partnerDocuments.$inferSelect;
export type InsertPartnerDocument = typeof partnerDocuments.$inferInsert;

/**
 * Partner Document Audit Log — tracks who uploaded, viewed, or downloaded each document.
 * Provides a full audit trail for compliance and visibility.
 */
export const partnerDocAudit = mysqlTable("partnerDocAudit", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull().references(() => partnerDocuments.id, { onDelete: "cascade" }), // FK to partnerDocuments.id
  userId: int("userId").notNull(), // FK to users.id — who performed the action (denormalized name/email kept; no FK so audit survives user deletion)
  userName: varchar("userName", { length: 255 }).notNull(), // Denormalized for display
  userEmail: varchar("userEmail", { length: 320 }).notNull(), // Denormalized for display
  action: mysqlEnum("action", ["upload", "view", "download"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerDocAudit = typeof partnerDocAudit.$inferSelect;
export type InsertPartnerDocAudit = typeof partnerDocAudit.$inferInsert;


/**
 * Implementation Organizations — defines which orgs are involved in each implementation.
 * Each org in the swimlane (Rad Group, Hospital IT, New Lantern, Scipio, Silverback, etc.)
 * is a row here, scoped to an organization (hospital).
 */
export const implementationOrgs = mysqlTable("implementationOrgs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }), // FK to organizations.id
  name: varchar("name", { length: 255 }).notNull(), // e.g., "RadOne", "Memorial Hospital IT"
  orgType: varchar("orgType", { length: 100 }).notNull(), // e.g., "rad_group", "hospital", "new_lantern", "scipio", "silverback", "ehr_vendor", "ris_vendor", "pacs_vendor", "other"
  color: varchar("color", { length: 20 }), // Optional custom color for the swimlane
  sortOrder: int("sortOrder").default(0).notNull(), // Display order in swimlane (left to right)
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImplementationOrg = typeof implementationOrgs.$inferSelect;
export type InsertImplementationOrg = typeof implementationOrgs.$inferInsert;

/**
 * Task Org Assignment — maps each task to the org responsible for it in the swimlane view.
 * One task can only be assigned to one org at a time.
 */
export const taskOrgAssignment = mysqlTable("taskOrgAssignment", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }), // FK to organizations.id (the hospital/site)
  taskId: varchar("taskId", { length: 50 }).notNull(), // e.g., "network:vpn" from taskDefs
  implOrgId: int("implOrgId").notNull().references(() => implementationOrgs.id, { onDelete: "cascade" }), // FK to implementationOrgs.id (which org owns this task)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // P0: one impl-org assignment per org+task
  orgTask: uniqueIndex("uq_taskorg_org_task").on(t.organizationId, t.taskId),
}));

export type TaskOrgAssignment = typeof taskOrgAssignment.$inferSelect;
export type InsertTaskOrgAssignment = typeof taskOrgAssignment.$inferInsert;

/**
 * Contacts — normalized table for site contacts.
 * Source of truth is Notion; MySQL is the read-cache for performance.
 * Synced from Notion via cron job.
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  notionPageId: varchar("notionPageId", { length: 64 }).unique(), // Notion page ID for sync
  organizationId: int("organizationId").notNull(), // FK to organizations.id
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 100 }),
  notes: text("notes"),
  partner: varchar("partner", { length: 100 }),
  site: varchar("site", { length: 100 }),
  updatedBy: varchar("updatedBy", { length: 255 }),
  isArchived: tinyint("isArchived").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Systems — normalized table for site systems/infrastructure.
 * Source of truth is Notion; MySQL is the read-cache for performance.
 * Synced from Notion via cron job.
 */
export const systems = mysqlTable("systems", {
  id: int("id").autoincrement().primaryKey(),
  notionPageId: varchar("notionPageId", { length: 64 }).unique(), // Notion page ID for sync
  organizationId: int("organizationId").notNull(), // FK to organizations.id
  systemName: varchar("systemName", { length: 255 }).notNull(),
  systemType: varchar("systemType", { length: 100 }),
  vendor: varchar("vendor", { length: 255 }),
  version: varchar("version", { length: 100 }),
  notes: text("notes"),
  partner: varchar("partner", { length: 100 }),
  site: varchar("site", { length: 100 }),
  updatedBy: varchar("updatedBy", { length: 255 }),
  isArchived: tinyint("isArchived").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type System = typeof systems.$inferSelect;
export type InsertSystem = typeof systems.$inferInsert;


/**
 * Retry queue for failed Notion dual-writes.
 * When a dual-write to Notion fails, the payload is stored here and retried by cron.
 * After 3 consecutive failures, the owner is notified.
 */
export const notionRetryQueue = mysqlTable("notionRetryQueue", {
  id: int("id").autoincrement().primaryKey(),
  /** Type of write: "taskCompletion" | "validationResult" | "questionnaire" */
  writeType: varchar("writeType", { length: 50 }).notNull(),
  /** JSON payload to replay (contains all data needed to retry the Notion write) */
  payload: text("payload").notNull(),
  /** Number of retry attempts so far */
  retryCount: int("retryCount").default(0).notNull(),
  /** Last error message from the failed attempt */
  lastError: text("lastError"),
  /** Whether the owner has been notified about persistent failure */
  ownerNotified: tinyint("ownerNotified").default(0).notNull(),
  /** Status: "pending" | "succeeded" | "failed_permanent" */
  status: mysqlEnum("status", ["pending", "succeeded", "failed_permanent"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotionRetryQueue = typeof notionRetryQueue.$inferSelect;
export type InsertNotionRetryQueue = typeof notionRetryQueue.$inferInsert;


/**
 * Reconciliation Log - tracks hourly reconciliation check results.
 * Each row represents one reconciliation run with stats and any issues found.
 */
export const reconciliationLog = mysqlTable("reconciliationLog", {
  id: int("id").autoincrement().primaryKey(),
  /** Number of rows checked (sampled) */
  rowsChecked: int("rowsChecked").default(0).notNull(),
  /** Number of rows found out of sync */
  outOfSync: int("outOfSync").default(0).notNull(),
  /** JSON array of out-of-sync row details */
  issues: text("issues"),
  /** Duration of the reconciliation run in ms */
  durationMs: int("durationMs"),
  /** Overall status: "healthy" | "issues_found" | "error" */
  status: mysqlEnum("status", ["healthy", "issues_found", "error"]).default("healthy").notNull(),
  /** Error message if the run failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReconciliationLog = typeof reconciliationLog.$inferSelect;
export type InsertReconciliationLog = typeof reconciliationLog.$inferInsert;

/**
 * Sync Checkpoints - persists the last successful sync timestamp for each pipeline.
 * Survives server restarts (unlike in-memory timestamps).
 */
export const syncCheckpoints = mysqlTable("syncCheckpoints", {
  id: int("id").primaryKey().autoincrement(),
  /** Pipeline identifier (e.g. "task-completions", "validation-results") */
  pipeline: varchar("pipeline", { length: 100 }).notNull().unique(),
  /** ISO timestamp of the last successful sync */
  lastSuccessfulSync: timestamp("lastSuccessfulSync").notNull(),
  /** Number of consecutive failures since last success */
  consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SyncCheckpoint = typeof syncCheckpoints.$inferSelect;
export type InsertSyncCheckpoint = typeof syncCheckpoints.$inferInsert;

export const emailLog = mysqlTable("emailLog", {
  id: int("id").primaryKey().autoincrement(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  toAddress: varchar("toAddress", { length: 255 }).notNull(),
  fromAddress: varchar("fromAddress", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["sent", "failed", "queued", "bounced"]).notNull().default("sent"),
  errorMessage: text("errorMessage"),
  organizationId: int("organizationId"),
  triggeredBy: varchar("triggeredBy", { length: 255 }),
  messageId: varchar("messageId", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailLog = typeof emailLog.$inferSelect;
export type InsertEmailLog = typeof emailLog.$inferInsert;

/**
 * Cache for connectivity data fetched from Notion.
 * Used as a fallback when Notion API is unavailable or slow.
 */
export const connectivityCache = mysqlTable("connectivityCache", {
  id: int("id").autoincrement().primaryKey(),
  organizationSlug: varchar("organizationSlug", { length: 100 }).notNull().unique(),
  data: text("data").notNull(), // JSON stringified array of connectivity rows
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConnectivityCache = typeof connectivityCache.$inferSelect;
export type InsertConnectivityCache = typeof connectivityCache.$inferInsert;

/**
 * Workflow Pathways — structured per-org state for swim-lane diagrams
 * (Orders / Images / Priors / Reports). Holds the "what" that was previously
 * either packed into an intakeResponses JSON blob or not persisted at all.
 *
 * One row per (organizationId, workflowType, pathId). pathId values come from
 * the swim-lane definitions (e.g. "ordersFromRIS", "imagesFromModality"); the
 * special pathId "__summary" holds the per-workflow description + selected
 * systems list (used by the IntegrationWorkflows intake UI).
 */
export const workflowPathways = mysqlTable("workflowPathways", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // FK to organizations.id
  workflowType: varchar("workflowType", { length: 20 }).notNull(), // 'orders' | 'images' | 'priors' | 'reports'
  pathId: varchar("pathId", { length: 100 }).notNull(), // swim-lane pathway key
  enabled: tinyint("enabled").default(0).notNull(), // 1 = pathway in scope for this org
  sourceSystem: varchar("sourceSystem", { length: 255 }),
  middlewareSystem: varchar("middlewareSystem", { length: 255 }),
  destinationSystem: varchar("destinationSystem", { length: 255 }),
  systems: text("systems"), // JSON array of system names (used by the __summary row)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowPathway = typeof workflowPathways.$inferSelect;
export type InsertWorkflowPathway = typeof workflowPathways.$inferInsert;

/**
 * Task Definitions — MySQL cache of the Notion "Task Definitions" database.
 * The portal reads tasks from this table; the every-5-min Notion sync upserts
 * rows and soft-inactivates rows that have disappeared from Notion (so historic
 * taskCompletion rows referencing them are not orphaned).
 *
 * taskId is the stable string key referenced from the rest of the schema
 * (taskCompletion.taskId, taskOrgAssignment.taskId, etc.).
 */
export const taskDefinitions = mysqlTable("taskDefinitions", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 100 }).notNull().unique(), // e.g. "hl7:orm"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sectionId: varchar("sectionId", { length: 50 }), // e.g. "hl7"
  sectionTitle: varchar("sectionTitle", { length: 255 }),
  sectionDuration: varchar("sectionDuration", { length: 50 }),
  swimLanes: json("swimLanes"), // string[] — e.g. ["orders","reports"]
  dependsOn: json("dependsOn"), // string[] of taskId values
  sortOrder: int("sortOrder").default(0).notNull(),
  intakeLink: varchar("intakeLink", { length: 500 }),
  intakeLinkLabel: varchar("intakeLinkLabel", { length: 255 }),
  specLink: varchar("specLink", { length: 500 }),
  specLinkLabel: varchar("specLinkLabel", { length: 255 }),
  isActive: tinyint("isActive").default(1).notNull(), // 0 = soft-deleted (missing from Notion)
  notionPageId: varchar("notionPageId", { length: 64 }), // back-reference for debugging
  notionLastEdited: timestamp("notionLastEdited"), // last_edited_time from Notion
  syncedAt: timestamp("syncedAt").defaultNow().notNull(), // last time this row was touched by the sync
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TaskDefinition = typeof taskDefinitions.$inferSelect;
export type InsertTaskDefinition = typeof taskDefinitions.$inferInsert;
