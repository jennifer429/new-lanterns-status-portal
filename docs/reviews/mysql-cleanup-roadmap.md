# Safe Cleanup Roadmap: MySQL Data Storage

## 1. Executive Summary

This document outlines a safe, test-driven roadmap for cleaning up the MySQL data storage issues in the `new-lanterns-status-portal` project. The strategy prioritizes establishing a robust safety net through targeted test scripts before making incremental, reversible changes to the schema and routing logic. 

The goal is to eliminate dead tables (like `responses`), resolve the `__question_na:` marker hack, and enforce referential integrity without causing regressions in the portal UI or Notion synchronization.

## 2. Phase 1: Establish the Safety Net (Test-First)

Before altering any schema or routing logic, we must expand the existing Vitest suite to cover the specific data paths we intend to modify.

### 2.1 Enhance the Data Quality Check
The existing `server/dataQualityCheck.test.ts` proves the integrity monitor works, but the monitor itself (`server/dataQualityCheck.ts`) needs updating.
*   **Action:** Write a test asserting that `responses`, `questions`, and `question_options` are no longer checked for orphans or duplicates. 
*   **Action:** Add tests to ensure `workflowPathways` and `validationResults` are included in the `FAIL`-severity orphan checks.

### 2.2 Export and Progress Calculation Tests
The CSV export and dashboard metrics currently rely on hardcoded TypeScript arrays (`TASK_SECTION_DEFS`, `questionnaireSections`). We must ensure that transitioning these to database queries does not alter the output.
*   **Action:** Expand `server/export-import.test.ts` to assert that `__question_na:` markers are correctly handled (or ignored) during export.
*   **Action:** Write a snapshot test for `server/routers/exports.ts` (`gatherOrgData`) using a seeded test database to freeze the current output structure. Any refactoring must produce an identical JSON snapshot.

### 2.3 The "N/A" Marker Test Harness
*   **Action:** Create `server/intake.na-markers.test.ts`. Seed an organization, simulate the admin "Go-Live" action (which currently injects `__question_na:` rows), and assert the expected progress calculation. This test will serve as the verification gate when we migrate to an `isNotApplicable` boolean column.

## 3. Phase 2: Deprecate and Drop Dead Tables

With tests in place, we can safely remove the legacy tables that are polluting the schema.

### 3.1 Remove Router Imports
*   **Action:** Remove all `import { responses, questions, question_options }` statements from `server/routers/organizations.ts`, `server/routers/admin.ts`, and `server/routers/backfill.ts`.
*   **Verification:** Run `npm run check` (TypeScript compiler) to ensure no active code was relying on these imports.

### 3.2 Generate and Apply the Drop Migration
*   **Action:** Remove the `responses`, `questions`, and `questionOptions` definitions from `drizzle/schema.ts`.
*   **Action:** Run `pnpm drizzle-kit generate` to create the migration SQL (e.g., `0062_drop_legacy_responses.sql`).
*   **Verification:** Run the Vitest suite (`npm run test`). Ensure `dataQualityCheck.ts` no longer references these tables.

## 4. Phase 3: Schema Hardening & Constraint Enforcement

This phase addresses the missing foreign keys and inconsistent data types identified in the storage review.

### 4.1 Deduplication Pre-Flight
Before adding unique indexes or foreign keys, existing data must be cleaned.
*   **Action:** Write and run a script (`scripts/dedupe-workflow-pathways.mjs`) to find and delete duplicate `(organizationId, workflowType, pathId)` rows in `workflowPathways`.
*   **Action:** Run the existing `scripts/data-quality-check.mjs` to ensure no orphaned rows exist in `validationResults` or `workflowPathways`.

### 4.2 Apply Foreign Keys and Unique Constraints
*   **Action:** Update `drizzle/schema.ts` to add `uniqueIndex` to `workflowPathways` and `references(() => organizations.id, { onDelete: "cascade" })` to `validationResults`, `aiAuditLogs`, and `workflowPathways`.
*   **Action:** Generate the migration and apply it via `pnpm db:push` during a low-traffic window.
*   **Verification:** Run `server/fk-rejection.test.ts` to ensure the application gracefully handles FK violations (returning 404s instead of 500s).

### 4.3 Clean Up `activityFeed` and File Columns
*   **Action:** Remove `"clickup"` and `"linear"` from the `activityFeed.source` enum in `drizzle/schema.ts`.
*   **Action:** Rename `driveFileId` to `s3Key` in `intakeFileAttachments` to reflect its actual usage, updating the corresponding queries in `server/routers/intake.ts`.

## 5. Phase 4: Refactoring the N/A Marker Hack

This is the highest-risk change, as it touches the core questionnaire logic and Notion synchronization.

### 5.1 Schema Update
*   **Action:** Add `isNotApplicable: tinyint("isNotApplicable").default(0).notNull()` to `intakeResponses` in `drizzle/schema.ts`. Generate and apply the migration.

### 5.2 Dual-Write Migration Script
*   **Action:** Write a migration script (`scripts/migrate-na-markers.mjs`) that:
    1. Finds all rows in `intakeResponses` where `questionId LIKE '__question_na:%'`.
    2. Extracts the real `questionId`.
    3. Upserts a new row with the real `questionId` and `isNotApplicable = 1`.
    4. Deletes the old `__question_na:` row.

### 5.3 Router and Sync Logic Updates
*   **Action:** Update `server/routers/admin.ts` (the "Go-Live" logic) to set `isNotApplicable = 1` instead of injecting synthetic IDs.
*   **Action:** Update `server/notionSyncBack.ts` and `server/notion.ts` to sync the `isNotApplicable` state correctly, preventing synthetic IDs from polluting Notion.
*   **Verification:** Run the `server/intake.na-markers.test.ts` created in Phase 1. Ensure the progress calculations (`overallProgress.test.ts`) still treat N/A questions as completed for the denominator.

## 6. Phase 5: Unifying Definitions (Removing Hardcoded Arrays)

The final phase aligns the portal's exports and metrics with the actual database state.

### 6.1 Shift Exports to Database Queries
*   **Action:** Refactor `gatherOrgData` in `server/routers/exports.ts`. Instead of importing `TASK_SECTION_DEFS`, query the `taskDefinitions` table.
*   **Action:** Update `getMetrics` in `server/routers/organizations.ts` to calculate progress based on active questions in the database rather than `questionnaireSections`.

### 6.2 Verification Gate
*   **Action:** Run the snapshot tests created in Phase 1. The JSON output of `gatherOrgData` must remain identical, proving that the shift from hardcoded arrays to database queries did not alter the external data contract.
