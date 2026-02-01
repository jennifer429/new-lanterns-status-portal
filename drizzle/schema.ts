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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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