import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";
import { questions } from "./schema";

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
