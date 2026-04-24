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
