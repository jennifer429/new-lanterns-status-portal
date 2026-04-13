# New Lantern Implementation Portal - TODO

> **Last reviewed:** April 13, 2026

## Remaining Refactoring (from REFACTORING_RECOMMENDATIONS.md)

- [ ] Extract shared admin table components (`StatusBadge`, `ActionButton`, `AdminTable`) — reduces ~200 lines of copy-paste across admin tabs
- [ ] Split `server/routers/admin.ts` (~2,000 lines) into sub-routers by domain (questions, orgs, users, vendors, templates, metrics)

## Code Consistency (from April 2026 audit)

- [ ] Standardize DB access: migrate remaining routers from `getDb()` + null check to `requireDb()` (affects files.ts, auth.ts, validation.ts, implementation.ts, ai.ts, webhooks.ts, exports.ts, proceduralLibrary.ts)
- [ ] Fix error types: `files.ts` and `webhooks.ts` throw plain `Error` instead of `TRPCError`
- [ ] Standardize import paths: `exports.ts`, `organizations.ts`, `ai.ts`, `admin.ts` use `../../shared/` relative paths instead of `@shared/` alias
- [ ] Migrate manual admin role checks in `notes.ts`, `proceduralLibrary.ts`, `users.ts`, `ai.ts` to use `adminDbProcedure`

## Backlog

- [ ] Add per-role progress tracking (IT/Clinical/Admin) on tasks page
- [ ] Define Drizzle relations in `drizzle/relations.ts` (currently empty)
- [ ] Remove legacy `intakeResponses` table after confirming all data migrated to `responses`
- [ ] Decide on Notion CRM sync architecture (see `docs/design-notion-crm-architecture.md`)
