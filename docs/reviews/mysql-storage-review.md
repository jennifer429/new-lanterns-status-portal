# MySQL Data Storage & Retrieval Review: New Lanterns Status Portal

## 1. Executive Summary

This review focuses on the MySQL data storage layer of the `new-lanterns-status-portal` project, specifically analyzing the Drizzle ORM schema (`drizzle/schema.ts`), data retrieval paths (routers and exports), and overall data quality. The analysis reveals a system in transition, carrying significant technical debt from a migration away from legacy tables. There are pronounced disconnects between how data is stored, how it is retrieved for the portal, and how it is exported, leading to data quality and integrity risks.

## 2. Unused Tables and Dead Columns

The schema contains several tables and columns that are either entirely obsolete or only partially used, polluting the database and creating confusion during data retrieval.

### 2.1 The Legacy `responses` Table
The most prominent dead table is `responses` (and its parent `questions` and `question_options`). 
*   **Status:** The system has migrated to `intakeResponses` (keyed by a `varchar` question ID) to support the hardcoded `shared/questionnaireData.ts` definitions. 
*   **Issue:** Despite this migration, `responses` is still imported in multiple routers (e.g., `server/routers/organizations.ts`), and the `dataQualityCheck.ts` script still runs orphan and duplicate checks against it. It should be dropped entirely to prevent developer confusion.

### 2.2 Unused Status Columns in `intakeResponses`
The `intakeResponses` table includes a `status` column (`mysqlEnum("status", ["not_started", "in_progress", "complete"])`). 
*   **Issue:** This column is never updated during normal user form saves (`saveResponse` and `saveResponses` only upsert the `response` and `updatedBy` fields). It is only artificially set to `"complete"` when an admin forces an organization to "Go-Live" and the system auto-generates N/A markers. It provides no real value for tracking actual question progress.

### 2.3 Dead `activityFeed` Sources and Foreign Keys
The `activityFeed` table contains an enum for `source` (`["manual", "clickup", "linear"]`) and a `sourceId` column. 
*   **Issue:** As noted in `todo.md`, the Linear and ClickUp integrations were removed. The enum needs to be narrowed, and any related columns (like `linearIssueId` and `clickupListId`, which appear to have already been dropped from `organizations`) must be fully purged from the data layer.

### 2.4 Ambiguous File References
The `intakeFileAttachments` table contains both a `fileUrl` and a `driveFileId`. 
*   **Issue:** The schema comments state `driveFileId` holds the "S3 key or Google Drive file ID". However, the router code (`server/routers/intake.ts`) explicitly maps the `s3Key` to the `driveFileId` column, completely abandoning the Google Drive ID for retrieval. This column naming is highly misleading.

## 3. Data Retrieval and Extract Disconnects

A major architectural flaw in the system is that data retrieval for portal dashboards and CSV exports does not rely purely on the normalized MySQL tables. Instead, it relies on hardcoded TypeScript definitions, leading to drift.

### 3.1 Hardcoded Definitions vs. Database Tables
The database contains a `taskDefinitions` table (synced from Notion). However, the `exports.ts` router and the `organizations.ts` metrics calculations **do not query this table**. 
*   **Issue:** Instead, they import `TASK_SECTION_DEFS` from `shared/taskDefs.ts`. If a task is added or modified in Notion (and synced to `taskDefinitions`), the CSV export and the admin dashboard progress bars will completely ignore it because they are hardcoded to the local TypeScript array. The same issue exists for `validationResults` (hardcoded to `VAL_PHASES` in `shared/validationDefs.ts`) and `intakeResponses` (hardcoded to `questionnaireSections`).

### 3.2 The `sectionProgress` Cache Race
The `sectionProgress` table stores the calculated completion percentage for questionnaire sections. 
*   **Issue:** While `updateSectionProgress` uses a safe `onDuplicateKeyUpdate` to prevent race conditions during writes, the data is essentially a derived cache. In `exports.ts` and `organizations.ts`, the progress is frequently recalculated on the fly using `calculateProgress()` rather than reading the stored values in `sectionProgress`. This means the table is largely redundant for reads and only serves as a vehicle to sync progress back to Notion.

## 4. Data Quality and Integrity Issues

### 4.1 The N/A Marker Hack (`__question_na:`)
When an organization goes live, the admin router (`server/routers/admin.ts`) automatically marks all unanswered questions as N/A. 
*   **Issue:** Instead of using a dedicated status column or table, it inserts literal string responses into `intakeResponses` with a mutated ID: `questionId: "__question_na:H.1", response: "true"`. 
*   **Impact:** This breaks the referential integrity of the `questionId` field. The CSV export logic (`exports.ts`) and progress calculators have to perform string manipulation (`startsWith('__question_na:')`) to filter these out or count them. Furthermore, these synthetic rows are picked up by the Notion dual-write dispatcher, polluting the Notion database with fake question IDs.

### 4.2 Missing Foreign Key Constraints
Several tables are missing critical Foreign Key constraints on `organizationId`:
*   `validationResults`
*   `aiAuditLogs`
*   `contacts` (Notion cache)
*   `systems` (Notion cache)
*   `workflowPathways`

While the Notion caches might omit FKs intentionally to avoid sync failures on missing orgs, `validationResults` and `workflowPathways` are core application state. If an organization is deleted, these rows will be orphaned, leading to data leaks and constraint violations in the `dataQualityCheck.ts` monitor.

### 4.3 Inconsistent Date Types
Dates are stored inconsistently across the schema. While `createdAt` and `updatedAt` use proper `timestamp` types, business logic dates are stored as `varchar`:
*   `organizations.targetGoLiveDate` (`varchar(50)`)
*   `organizations.liveDate` (`varchar(50)`)
*   `taskCompletion.targetDate` (`varchar(20)`)
*   `validationResults.testedDate` (`varchar(10)`)

This prevents the database from performing date math, sorting properly, or validating date formats, pushing all date integrity responsibilities to the Node.js layer.

## 5. Recommendations

1.  **Drop Legacy Tables:** Immediately drop `responses`, `questions`, and `question_options` to prevent developer confusion and remove them from the `dataQualityCheck.ts` script.
2.  **Unify Definitions:** Refactor `exports.ts` and `organizations.ts` to query `taskDefinitions` and `intakeResponses` dynamically, rather than relying on hardcoded `shared/*.ts` arrays. This ensures exports match the database state.
3.  **Refactor N/A Logic:** Remove the `__question_na:` hack. Add an `isNotApplicable` boolean column to `intakeResponses` (similar to how it is handled in `taskCompletion`).
4.  **Enforce Foreign Keys:** Add `organizationId` foreign key constraints with `onDelete: "cascade"` to `validationResults` and `workflowPathways`.
5.  **Standardize Date Types:** Migrate all `varchar` date fields to proper `DATE` or `TIMESTAMP` columns in MySQL to ensure data integrity.
