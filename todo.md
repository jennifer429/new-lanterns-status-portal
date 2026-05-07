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
