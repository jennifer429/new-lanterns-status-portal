import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt hash for email/password auth
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  organizationId: int("organizationId"), // Link user to organization (null for admins)
  lastLoginAt: timestamp("lastLoginAt"), // Track last login for admin dashboard metrics
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations table - represents hospitals/clients
 * Each organization gets a unique slug for URL-based access
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-safe identifier
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  startDate: varchar("startDate", { length: 50 }),
  goalDate: varchar("goalDate", { length: 50 }),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
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
  completedAt: timestamp("completedAt"),
  completedBy: varchar("completedBy", { length: 255 }),
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
 * Intake responses - stores hospital answers to intake questions
 */
export const intakeResponses = mysqlTable("intakeResponses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  questionId: varchar("questionId", { length: 50 }).notNull(), // e.g., "A.1", "B.4"
  section: varchar("section", { length: 255 }).notNull(), // e.g., "Overview & Architecture"
  response: text("response"), // Text answer
  fileUrl: text("fileUrl"), // For file uploads
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
  driveFileId: varchar("driveFileId", { length: 100 }), // Google Drive file ID
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