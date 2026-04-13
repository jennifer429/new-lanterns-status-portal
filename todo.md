# New Lantern Implementation Portal - TODO

> **Last reviewed:** April 13, 2026

## Remaining Refactoring

- [ ] Extract shared admin table components (`StatusBadge`, `ActionButton`, `AdminTable`) — reduces ~200 lines of copy-paste across admin tabs
- [ ] Split `server/routers/admin.ts` (~2,000 lines) into sub-routers by domain (questions, orgs, users, vendors, templates, metrics)
- [ ] Migrate manual admin role checks in `notes.ts`, `proceduralLibrary.ts`, `ai.ts` to `adminDbProcedure` where endpoints are admin-only

## Backlog

- [ ] Add per-role progress tracking (IT/Clinical/Admin) on tasks page
- [ ] Define Drizzle relations in `drizzle/relations.ts` (currently empty)
- [ ] Remove legacy `intakeResponses` table after confirming all data migrated to `responses`
- [ ] Decide on Notion CRM sync architecture (see `docs/design-notion-crm-architecture.md`)
