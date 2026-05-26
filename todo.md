# New Lantern Implementation Portal - TODO

> **Last reviewed:** April 23, 2026

## Remaining Refactoring

- [ ] Extract shared admin table components (`StatusBadge`, `ActionButton`, `AdminTable`) — reduces ~200 lines of copy-paste across admin tabs
- [ ] Split `server/routers/admin.ts` (~2,000 lines) into sub-routers by domain (questions, orgs, users, vendors, templates, metrics)
- [ ] Migrate manual admin role checks in `notes.ts`, `proceduralLibrary.ts`, `ai.ts` to `adminDbProcedure` where endpoints are admin-only

## Swimlane Task Flow View

- [x] Swimlane task flow view: visualize existing tasks as colored blocks in org swimlanes
- [x] Org assignment for tasks: PM can assign tasks to orgs (Rad Group, Hospital, New Lantern, Scipio, Silverback, etc.)
- [x] Status colors: yellow=in progress, green=done, red=blocked, gray=N/A, white=not started
- [x] Toggle between list view and swimlane view on task page
- [x] New Lantern positioned on right side of swimlane layout
- [x] Silverback positioned in middle swimlane

## Backlog

- [ ] Add per-role progress tracking (IT/Clinical/Admin) on tasks page
- [ ] Define Drizzle relations in `drizzle/relations.ts` (currently empty)
- [ ] Remove legacy `intakeResponses` table after confirming all data migrated to `responses`
- [ ] Decide on Notion CRM sync architecture (see `docs/design-notion-crm-architecture.md`)

## Bugs

- [x] Fix broken task and testing references to questionnaire (orgPath undefined in RelatedAnswers, useOrgParams typing, activePhase type)
- [x] Fix connectivity network endpoints data loss — rows populated yesterday are blank today (switched to Implementations-Updates Notion integration, updated data source ID)
- [x] Update NOTION_CONNECTIVITY_DATASOURCE_ID to correct value (53f78f54-2908-43d4-b471-df049652d470)
- [ ] Fix connectivity router site filtering to handle relation-type Site field (pending — needs testing with live data)
- [x] Add data-loss safeguard: don't overwrite local connectivity data with empty Notion response

## Swimlane Rewrite — PM Coordination Tracker

- [x] Rewrite SwimlaneMockup.tsx as PM coordination tracker (not integration guide)
- [x] 5 phases: Discovery, Connectivity, Data Validation, Go-Live, Support
- [x] 7 party rows: Hospital IT, EHR Vendor, RIS Vendor, PACS/VNA, Rad Group PM, DataFirst+Scipio, New Lantern
- [x] One card per cell: assignment, owner, status, due, blocker, follow-up
- [x] Silverback as system box in Connectivity column, not a row
- [x] Edit Milestone slide-out panel (visual only, no real save)
- [x] Simple dark mode, no technical jargon, no bottom clutter
- [x] Rewrite SwimlaneView.tsx (Task List swimlane toggle) as static PM coordination tracker matching mockup

## Swimlane Visual Fixes (match mockup)

- [x] Bold saturated status-colored card backgrounds (green=done, yellow=in-progress, dark=open, red=blocked)
- [x] Colored phase header bars
- [x] Edit panel with populated sample data
- [x] N/A cell shows text overlay, not dashed border

## Swimlane Refinements (Apr 23)

- [x] Rename DataFirst + Scipio to Scipiotech & Data First
- [x] New column headers: Discovery, Connectivity, Data Feed Testing, Production Configuration, Go Live
- [x] Shrink cards: remove owner bullet and dates, keep just assignment text
- [x] Row labels: keep colored badge circles, leave white name blank for questionnaire population

## Swimlane Row Names from Questionnaire

- [x] Pull real vendor/hospital names from questionnaire responses into swimlane row labels
- [x] Remove Rad Group row from swimlane (they know what they do)
- [x] Replace grid: 5 columns (Questionnaire, Connectivity, Data Implementation, Go-Live Pre-Prod, Go-Live) × 5 rows (Health Care Org, EHR/RIS Vendor, PACS Vendor, Partner, New Lantern)
- [x] Clean up card verbiage to be less repetitive
- [x] Integrate questionnaire data to auto-populate vendor names (e.g. Epic, GE) next to swimlane rows

## Questionnaire Navigation Fix

- [x] Fix Save & Continue to advance to next sequential section (not jump to first incomplete)

## RRAL Import Bug

- [x] Fix RRAL import not persisting — race condition between import saves, auto-save, and existingResponses refetch
- [x] Fix RRAL import not persisting — root cause: duplicate DB row for IW.images_description + existingResponses useEffect overwriting local state on every refetch
- [x] Delete duplicate intakeResponses row (id=2160007)
- [x] Add UNIQUE index on (organizationId, questionId) to prevent future duplicates
- [x] Convert saveResponse/saveResponses to use ON DUPLICATE KEY UPDATE (race-condition-proof)
- [x] Add hasHydratedRef to only load server data once on initial page load (prevent refetch overwrites)
- [x] Add refetchOnWindowFocus: false to getResponses query

## Hardening Backlog (from May 2026 code review)

> Low-risk items (file caps, log scrubbing, CSV formula guard, env validation) landed in the same review pass.
> The items below are **medium / high risk** and need their own branches + a DB migration plan.

### Medium risk

- [ ] **Auth lockdown — `swimlane`, `connectivity`, `validation`, `implementation` routers** — every endpoint is `publicProcedure` today. Convert to `protectedProcedure` and add an org-membership helper that asserts `ctx.user.clientId` matches the org's `clientId` before reading or writing. Watch for unauth callers (intake form, public org pages) — verify each endpoint isn't legitimately public before locking it.
- [ ] **Hash invite + password-reset tokens at rest** — `passwordResetTokens.token` and `users.inviteToken` are stored plaintext. Hash with SHA-256 before insert, hash-on-compare during verify. Migration must invalidate any pending tokens (irreversible).
- [ ] **`admin.updateOrganization` IDOR** — fetch the org first and verify `ctx.user.clientId === org.clientId` before allowing partner admins to update; today a partner admin can change another partner's `clientId`.
- [ ] **`notes.ts:40-42` partner check** — replace `org.clientId !== ctx.user.clientId` with an explicit null check so unowned orgs aren't accessible.
- [ ] **`files.checkFileAccess`** — reject orgs whose `clientId` is null when caller is a partner admin.
- [ ] **`auth.checkEmail` enumeration** — returns existence directly; add a fixed-delay or fold into the password-reset request flow.
- [ ] **Cookie `sameSite: "none"`** — verify `secure: true` is enforced everywhere; otherwise switch to `"lax"`.

### High risk (needs DB migration + dedupe pass)

- [ ] **UNIQUE constraints + DB-level upserts** — add composite UNIQUE indexes and switch manual SELECT-then-INSERT-or-UPDATE to `onDuplicateKeyUpdate` inside `db.transaction()`:

  | Table | UNIQUE on | Routers to rewrite | Status |
  |---|---|---|---|
  | `responses` | `(organizationId, questionId)` | intake.ts, admin.ts | pending |
  | `intakeResponses` | `(organizationId, questionId)` | intake.ts, admin.ts (bulk) | **done in PR #76** (`saveResponse`, `saveResponses`); admin bulk import still pending |
  | `sectionProgress` | `(organizationId, sectionName)` | organizations.ts | pending |
  | `taskCompletion` | `(organizationId, taskId)` | implementation.ts, organizations.ts | pending |
  | `validationResults` | `(organizationId, testKey)` | validation.ts | pending |
  | `taskOrgAssignment` | `(organizationId, taskId)` | swimlane.ts (replace delete-then-insert) | pending |
  | `partnerTemplates` | `(clientId, questionId)` where `isActive=1` | admin.ts | pending |

  **Pre-flight:** write a dedupe script (`scripts/dedupe-pre-unique.mjs`) that finds duplicate rows per table, picks the latest `id`, and deletes the rest. Run it in staging first; the UNIQUE migration will fail otherwise.

- [ ] **Reads that need explicit `ORDER BY`** (silent staleness without UNIQUEs above):
  - `intake.getAllUploadedFiles` — `ORDER BY createdAt DESC`
  - `files.getByTask` — `ORDER BY createdAt DESC`
  - `validation.getResults` — `ORDER BY id DESC` so the map keeps the newest
  - `implementation.getTasks` — same
  - `swimlane.getVendorNames` (intakeResponses read) — `ORDER BY id DESC LIMIT 1`
  - `ai.listDashboard`, `ai.getOrganizationSummary` — same
  - `notion.readIntakeResponseFromNotion` — sort Notion results by created time

- [ ] **IDOR test harness** — vitest + a seeded test DB with two clients × two orgs × four user roles (platform admin, partner admin, partner admin of *other* partner, org user). Per-router fixtures asserting cross-tenant access is denied. Estimated ~400 LOC.

- [ ] **Webhook signature verification** — *deferred until Linear/Zapier integration is reintroduced via API + Zap*. When re-adding, HMAC-verify with a shared secret + replay protection.

- [ ] **DB migration to drop `organizations.linearIssueId`, `organizations.clickupListId`, and narrow `activityFeed.source` enum** — schema.ts already updated (May 2026); needs `npm run db:push` after dedupe of any historical `source IN ('linear','clickup')` rows.

### Notes / smaller follow-ups

- [ ] Strip the dead `responses` table once `intakeResponses` confirmed sole source of truth (see existing backlog item).
- [ ] Replace `(... as any)` casts in `connectivity.ts` Notion code with proper Notion property types.
- [ ] Wrap all `JSON.parse` calls in routers with try/catch (`swimlane.ts:291`, `intake.ts:976/980/988`).
- [ ] Centralize soft-delete filtering (`isActive=1`) so query paths can't accidentally include archived rows across `partnerTemplates`, `specifications`, `systemVendorOptions`, `partnerTaskTemplates`.
- [ ] Add indexes: `passwordResetTokens.expiresAt` for cleanup; `users.email` `notNull()` to make the unique constraint meaningful.

## Vendor Picklist Cleanup & Redesign

- [x] Delete all audit test entries from systemVendorOptions (191 rows: AuditAdd_*, AuditToggle_*, AuditUpdate_*)
- [x] Delete all test entries from vendorAuditLog (1,573 rows: Audit*, AlphaTest_*, ActiveTest_*, BulkTest_*)
- [x] Redesign vendor picklist admin UI as collapsible cards (consistent site design framework)
- [x] Audit log hidden by default, toggled via "Show History" button
- [x] Vendor items displayed as compact card rows with eye/edit/delete icons
- [x] Document design decision: collapsible cards pattern for all admin controls

## Notion Questionnaire Database — Full Matrix & File Sync

- [x] Delete test orgs from MySQL and archive their Notion rows (9 test orgs removed)
- [x] Fix Lodi Memorial slug leading space
- [x] Add Institution Group, Slug, Created At, Updated By columns to Notion questionnaire DB
- [x] Migrate all 517 MySQL intake responses to Notion (with question text, section, status)
- [x] Backfill 28 file-only rows into Notion with Files column linked to actual file URLs
- [x] Create full site×question matrix: 20 orgs × 45 questions = 900 total rows (554 blank rows created)
- [x] Rewrite server/notion.ts — per-row sync (syncAnswerToNotion, syncFileToNotion, removeFileFromNotion)
- [x] Wire intake.saveResponse to sync answer to Notion (fire-and-forget)
- [x] Wire intake.saveResponses (batch) to sync each answer to Notion
- [x] Wire intake.uploadFile to sync file URL to Notion Files column
- [x] Wire intake.deleteFile to remove file from Notion Files column
- [x] Remove radone-only filter — all orgs now sync to Notion

## Notion → MySQL Periodic Sync-Back

- [x] Create Sync Log Notion database (Run Timestamp, Status, Rows Fetched/Updated/Failed, Error Details, Duration)
- [x] Create Sync Config Notion database/page (Last Successful Sync, Consecutive Failures, Enabled)
- [x] Write sync-back heartbeat job (query Notion by last_edited_time, upsert MySQL, write log)
- [x] Add safeguards: skip empty-answer overwrites, diff check, updatedBy = notion-sync@system
- [x] Add owner notification on consecutive failures
- [x] Add health check tRPC endpoint (reads Sync Config page)
- [x] Test end-to-end: manually edit Notion answer → verify it appears in portal
- [x] Fix notionSyncBack.ts to use dataSources.query (not databases.query which doesn't exist in SDK v5)
- [x] Fix NOTION_DATASOURCE_ID and NOTION_SYNC_LOG_DATASOURCE_ID env vars to correct IDs
- [x] Delete duplicate RRAL::A.2 row in Notion
- [x] Write sync quality check script (scripts/sync-quality-check.mjs): no dupes, no data loss, consistency, coverage
- [x] Quality check results: 6/7 passed, 1 dupe fixed, all 20 sampled answers match perfectly

## Contacts & Systems as Notion Databases
- [x] Create Contacts Notion database (Site, Role, Name, Phone, Email)
- [x] Create Systems Notion database (Site, System Type, Vendor, Product Name, Notes)
- [x] Set env vars for new database IDs (NOTION_CONTACTS_DATASOURCE_ID, NOTION_CONTACTS_DATABASE_ID, NOTION_SYSTEMS_DATASOURCE_ID, NOTION_SYSTEMS_DATABASE_ID)
- [x] Migrate existing contacts JSON blobs into Contacts database rows (45 contacts, 72 systems)
- [x] Migrate existing systems JSON blobs into Systems database rows
- [x] Create normalized MySQL tables (contacts, systems) as read-cache
- [x] Create contacts tRPC router (getForOrg, createRow, updateRow, archiveRow) — dual-write: Notion + MySQL
- [x] Create systems tRPC router (getForOrg, createRow, updateRow, archiveRow) — dual-write: Notion + MySQL
- [x] Add contacts/systems Notion → MySQL sync-back to cron (every 5 min, offset +2)
- [x] Add admin "Refresh Sync" button (triggerFullSync: questionnaire + contacts + systems)
- [x] Write vitest for syncHealth router (7 tests passing)
- [ ] Update frontend contacts-table to use Notion-backed CRUD
- [ ] Update frontend systems-list to use Notion-backed CRUD
- [ ] Test end-to-end: add/edit/delete from portal, verify in Notion

## Sync Logging Improvements
- [x] Change Notion Sync Log from every-run to hourly aggregated entries
- [x] Add purge job: delete Sync Log entries older than 7 days (run every 3 days at 3 AM)
- [x] Fix "archived ancestor" error on Sync Config page (user restored from Notion trash)

## Tasks & Tests as Notion Databases (same workflow as questionnaires)
- [ ] Create Notion "Task Definitions" database (Key, Title, Description, Section, Duration, IntakeLink, IntakeLinkLabel, SpecLink, SpecLinkLabel, Active, SortOrder)
- [ ] Create Notion "Test Definitions" database (Key, Name, Description, Phase, RelatedQuestions, Active, SortOrder)
- [ ] Migrate hardcoded taskDefs.ts (39 tasks across 7 sections) into Notion Task Definitions rows
- [ ] Migrate hardcoded validation phases (28 tests across 4 phases) into Notion Test Definitions rows
- [ ] Add env vars: NOTION_TASKS_DATABASE_ID, NOTION_TASKS_DATASOURCE_ID, NOTION_TESTS_DATABASE_ID, NOTION_TESTS_DATASOURCE_ID
- [ ] Create MySQL cache tables: taskDefinitions, testDefinitions
- [ ] Update implementation router: read task defs from MySQL (not hardcoded), write status to Notion + MySQL
- [ ] Update validation router: read test defs from MySQL (not hardcoded), write status to Notion + MySQL
- [ ] Add cron sync-back for task/test definitions (Notion → MySQL every 5 min, offset +4)
- [ ] Update admin Refresh Sync to include task/test definitions
- [ ] Write vitest for new routers

## Notion Summary Column for JSON Answers

- [x] Add "Summary" RICH_TEXT column to Notion questionnaire database
- [x] Write generateAnswerSummary() utility (server/notionSummary.ts)
- [x] Backfill all 79 existing JSON rows with human-readable summaries
- [x] Wire Summary generation into syncAnswerToNotion (portal → Notion writes)
- [x] Wire Summary regeneration into notionSyncBack (Notion → MySQL sync-back)
- [x] Write vitest tests for generateAnswerSummary (11 tests passing)

## Task Completion & Validation Results — Notion Dual-Write + Sync-Back

- [x] Build Notion dual-write helper for task completions (syncTaskCompletionToNotion)
- [x] Build Notion dual-write helper for validation results (syncValidationResultToNotion)
- [x] Wire dual-write into task completion router mutations
- [x] Wire dual-write into validation result router mutations
- [x] Build sync-back module (Notion → MySQL) for task completions
- [x] Build sync-back module (Notion → MySQL) for validation results
- [x] Register periodic sync-back cron job (5-min interval)
- [x] Integrate into triggerFullSync
- [x] Write vitest tests for dual-write and sync-back (7 tests passing)

## Fix [object Object] Summaries for ARCH.systems, CONN.endpoints, A.contacts

- [x] Add deep parsing for ARCH.systems arrays (name + type)
- [x] Add deep parsing for IW.systems arrays (name + type)
- [x] Add deep parsing for CONN.endpoints arrays (trafficType + source → dest)
- [x] Add deep parsing for A.contacts objects (admin + additional_contacts)
- [x] Add generic object fallback for remaining JSON types
- [x] Update vitest tests (18 tests passing)
- [x] Re-backfill Notion: checked 94 JSON answers, updated 13 summaries
- [x] Condense workflow summaries to single-line format with inline notes (✓ Path ("note") · ✓ Path2 | sys: val)
- [x] Truncate long notes to 50 chars with "..." suffix (bumped from 30 for better readability)
- [x] Re-backfill all Notion rows with new format
- [x] Confirm automation hooks regenerate on every portal write and sync-back

## Site Relation + Last Synced Timestamp

- [x] Add "Site" relation column to Task Completion Records Notion database
- [x] Add "Site" relation column to Validation Results Notion database
- [x] Populate Site column for existing rows (already populated during migration)
- [x] Update dual-write code to set Site (orgName) on every new write
- [x] Add Last Synced timestamp tracking to cron jobs (questionnaire, contacts/systems, tasks/validation)
- [x] Expose Last Synced via tRPC syncHealth.status endpoint
- [x] Display Last Synced in portal admin panel header (relative time, auto-refreshes every 60s)

## Sync Safeguards

### Safeguard 1: Staleness Alert
- [x] Show yellow warning banner in admin panel when sync is >15min stale
- [x] Send notifyOwner alert when sync staleness exceeds 15 minutes (throttled to 1/hour)
- [x] Only show banner to NL admins (not regular users)

### Safeguard 2: Retry Queue + Reconciliation
- [x] Create MySQL table for failed dual-write queue (notionRetryQueue)
- [x] On dual-write failure, insert into retry queue instead of just logging
- [x] Add cron job to retry queued writes (every 5 min, max 3 attempts)
- [x] Notify owner on persistent failures (3+ consecutive retries)
- [x] Add hourly reconciliation: compare MySQL updatedAt vs Notion last_edited_time
- [x] Flag out-of-sync rows and notify owner with details + cleanup plan

### Safeguard 3: Notion Table UX
- [x] Add "⚙️ Auto:" prefix to Summary column values
- [x] Add "Last Updated From" column to all 3 databases (Questionnaire, Task Completion, Validation Results)
- [x] Set "Last Updated From" on every write (portal = "Portal", sync-back = "Notion")
- [x] Create pre-built Notion views: Workflow Decisions, By Status (board), By Site (table), All Answers by Site

## Sync Dashboard Page

- [x] ~~Removed~~ — sync monitoring moved to Notion Sync Log database (no portal dashboard)

## Sync Log Noise Reduction

- [x] Remove per-run writeSyncLog calls from notionSyncBack.ts (was writing every 5 min)
- [x] Hourly flush: only write to Notion Sync Log on failure/partial (skip success)
- [x] Reconciliation: write to Notion Sync Log when out-of-sync rows found
- [x] Daily summary: always write once at midnight UTC (proof of life)
- [x] Keep 7-day purge unchanged

## Production Sync Fix (20 rows out of sync)

- [x] Root cause: in-memory 1-hour lookback on server restart missed May 20 Notion edits permanently
- [x] Fix: Changed startup lookback from 1 hour to 7 days to catch edits missed during downtime
- [x] Fix: Added "Last Updated From" filter to skip rows already marked by sync-back (prevents feedback loop)
- [x] Fix: Added missing mock for notionSyncBackTasks in syncHealth.test.ts (was causing timeout)

## Sync Infrastructure Improvements (May 25)

- [x] Purge duplicate/noisy Sync Log entries from Notion (1,406 stale entries archived)
- [x] Persist task/validation sync checkpoint to Notion (same design as questionnaire Sync Config)
- [x] Investigate and fix duplicate cron instances (root cause: 3 pipelines each writing per-run logs; fixed by removing per-run writes + added cronStarted guard)

## Sync Reliability Final Fixes (May 26)

- [x] Remove lastUpdatedFrom !== "Notion" filter (was permanently blocking rows from re-sync)
- [x] Add updatedAt: new Date() to all upserts (forces MySQL timestamp to advance on no-op data)
- [x] Persist sync checkpoints to MySQL syncCheckpoints table (replaces broken Notion approach)
- [x] Verify full sync resolved all 10 out-of-sync rows (confirmed May 26)
- [x] Add error logging to task/validation sync catch blocks (console.error for production visibility)
- [x] Investigate org 1140001 — orphan test data deleted from MySQL + archived in Notion
- [x] Rename Notion Sync Log from "Questionnaire Sync Log" to "Portal Sync Log"
- [x] Add filtered views to Notion Sync Log (Failures Only, Last 7 Days)

## Dirty-Check Sync (prevent phantom drift)
- [x] Implement dirty-check in upsertTaskCompletion — skip write if data identical
- [x] Implement dirty-check in upsertValidationResult — skip write if data identical
- [x] Write vitest tests proving: skip on identical, write on real change, new row always inserts (13 tests, all pass)
- [x] Fix 3 consecutive failures on sync pipelines (reset to 0, server running healthy)

## Claude Scan Fixes
- [ ] Convert file audit log from Google Sheets to Notion database
- [x] Gate /org/admin links behind role checks (UserMenu, Implementation, Validation) — already gated with user?.role === "admin"
- [ ] Fix password reset test assertion (error message mismatch)
- [ ] Fix vendor-options test assertions (limit:5 → limit:50, addSystemType return shape)
- [ ] Update CLAUDE.md to reflect actual routers, tables, and endpoints

## Option C: notionLastEdited version check
- [x] Add notionLastEdited column to taskCompletion and validationResults schemas
- [x] Run migration (pnpm db:push)
- [x] Rewire sync-back to skip if notionLastEdited matches incoming last_edited_time
- [x] Update portal dual-write to set notionLastEdited = null on write
- [x] Update reconciliation to only flag rows where notionLastEdited = null and stale > 10min
- [x] Write tests proving: skip on same version, write on new version, portal nulls the field (8 tests, all pass)
- [x] Backfill existing rows with current Notion last_edited_time values (290 tasks + 68 validation = all filled)

## Cleanup & Organization (May 26)
- [x] Move active Notion databases under INTERFACES page (6 databases moved)
- [x] Remove dead ENV properties from env.ts (notionSyncConfigDataSourceId, notionTaskDefinitionsDbId, notionTestDefinitionsDbId, notionTaskCompletionDbId, notionValidationResultsDbId)
- [x] Remove NOTION_SYNC_CONFIG_DATASOURCE_ID test assertion (env var still exists but property is unused)
- [x] Archive one-time migration scripts from scripts/ directory (17 files moved to scripts/archived/)
- [x] Gate /org/admin links behind role checks (UserMenu, Implementation, Validation) — already gated with user?.role === "admin"
