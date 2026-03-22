import { int, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";

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
  clientId: int("clientId"), // Link user to client (RadOne, SRV, etc.)
  organizationId: int("organizationId"), // Link user to organization (null for admins)
  isActive: tinyint("isActive").default(1).notNull(), // 1 = active, 0 = deactivated (works for all user types)
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
  clientId: int("clientId"), // FK to clients.id (temporarily optional for migration)
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-safe identifier
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  startDate: varchar("startDate", { length: 50 }),
  goalDate: varchar("goalDate", { length: 50 }),
  status: mysqlEnum("status", ["active", "completed", "paused", "inactive"]).default("active").notNull(),
  // Integration IDs (set by PM during org creation)
  linearIssueId: varchar("linearIssueId", { length: 100 }), // Linear issue ID for two-way communication
  clickupListId: varchar("clickupListId", { length: 100 }), // ClickUp list ID for tasks
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
  organizationId: int("organizationId").notNull(),
  sectionName: varchar("sectionName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "in-progress", "complete"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(), // 0-100
  expectedEnd: varchar("expectedEnd", { length: 50 }),
  actualEnd: varchar("actualEnd", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SectionProgress = typeof sectionProgress.$inferSelect;
export type InsertSectionProgress = typeof sectionProgress.$inferInsert;

/**
 * Task completion tracking - stores which tasks are completed
 */
export const taskCompletion = mysqlTable("taskCompletion", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskCompletion = typeof taskCompletion.$inferSelect;
export type InsertTaskCompletion = typeof taskCompletion.$inferInsert;

/**
 * File attachments - stores uploaded files for tasks
 */
export const fileAttachments = mysqlTable("fileAttachments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  organizationId: int("organizationId").notNull(),
  questionId: int("questionId").notNull(), // Foreign key to questions.id
  response: text("response"), // Text answer or JSON for complex responses
  fileUrl: text("fileUrl"), // For file uploads
  userEmail: varchar("userEmail", { length: 320 }), // Who provided this response
  createdAt: timestamp("createdAt").defaultNow().notNull(), // When first answered
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // When last modified
});

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * Question Options - individual options for dropdown and multi-select questions
 * Allows easy management and updates of question choices
 */
export const questionOptions = mysqlTable("question_options", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(), // FK to questions.id
  optionValue: varchar("optionValue", { length: 255 }).notNull(), // Internal value (e.g., "eastern")
  optionLabel: varchar("optionLabel", { length: 255 }).notNull(), // Display text (e.g., "Eastern Time")
  displayOrder: int("displayOrder").default(0).notNull(), // Order in dropdown (1, 2, 3...)
  isActive: int("isActive").default(1).notNull(), // 0 = disabled, 1 = active
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertQuestionOption = typeof questionOptions.$inferInsert;

/**
 * Legacy intake responses table - kept for migration reference, will be removed after migration
 * @deprecated Use questions and responses tables instead
 */
export const intakeResponses = mysqlTable("intakeResponses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  questionId: varchar("questionId", { length: 50 }).notNull(),
  section: varchar("section", { length: 255 }).notNull(),
  response: text("response"),
  fileUrl: text("fileUrl"),
  status: mysqlEnum("status", ["not_started", "in_progress", "complete"]).default("not_started").notNull(),
  updatedBy: varchar("updatedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type InsertIntakeResponse = typeof intakeResponses.$inferInsert;

/**
 * Intake file attachments - stores files uploaded in intake form questions
 */
export const intakeFileAttachments = mysqlTable("intakeFileAttachments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
 * Activity feed - stores updates from Linear/ClickUp for client visibility
 */
export const activityFeed = mysqlTable("activityFeed", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  source: mysqlEnum("source", ["linear", "clickup", "manual"]).notNull(),
  sourceId: varchar("sourceId", { length: 100 }), // Linear issue ID or ClickUp task ID
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
  userId: int("userId").notNull(),
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
  organizationId: int("organizationId").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  comments: text("comments"),
  submittedBy: varchar("submittedBy", { length: 320 }), // User email
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
  clientId: int("clientId").notNull(), // FK to clients.id - which partner owns this template
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
  status: mysqlEnum("status", ["Pass", "Fail", "Not Tested", "Pending", "N/A"]).default("Not Tested").notNull(),
  signOff: varchar("signOff", { length: 255 }),
  notes: text("notes"),
  /** User-settable date for when this test was documented. Auto-populates with today's date. */
  testedDate: varchar("testedDate", { length: 10 }), // YYYY-MM-DD format
  updatedBy: varchar("updatedBy", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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

