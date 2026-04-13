# Refactoring Recommendations

A prioritized audit of the New Lantern Implementation Portal codebase, organized by impact and effort.

**Last Updated:** April 13, 2026

---

## 1. ~~Dead Code Removal~~ — DONE

All dead files identified in the original audit have been deleted. The pages (`ComponentShowcase`, `IntakeNew`, `PartnerAdmin`, `ManageUsers`, `Intake-collapsible`), components (`ActivityFeed`, `IntakeForm`, `WizardCompletion`, `ManusDialog`, `ProgressLogo`), and shared data files (`wizard-data.ts`, `intake-questions.ts`, `questionnaire-data.ts`) have all been removed.

---

## 2. ~~Use the `adminProcedure` Middleware~~ — DONE (in admin.ts)

`server/routers/admin.ts` now uses `adminDbProcedure` (58 endpoints), which handles both role checking and DB injection at the middleware level. Only `getCurrentUser` uses `protectedProcedure` (correctly, since non-admins need it).

**Remaining:** Other routers (`files.ts`, `notes.ts`, `proceduralLibrary.ts`, `users.ts`, `ai.ts`) still use `protectedProcedure` with manual inline role checks. These could be migrated to `adminDbProcedure` where appropriate.

---

## 3. ~~Consolidate Hardcoded Admin Routes~~ — DONE

The hardcoded partner-specific admin routes (`/org/SRV/admin`, `/org/RadOne/admin`) have been removed. `App.tsx` now has only 4 PlatformAdmin routes using the generic `:slug` pattern:

```tsx
<Route path="/org/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/admin">{() => <PlatformAdmin />}</Route>
<Route path="/org/:slug/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/:slug/admin">{() => <PlatformAdmin />}</Route>
```

---

## 4. Extract Shared Admin Table Components (Medium Effort, Medium Impact)

Across `OrgsTab`, `UsersTab`, `TemplatesTab`, `VendorPicklistsTab`, and `PartnersTab`, the same patterns are copy-pasted:

- **Status badges** (Active/Done/Inactive) with identical color classes appear 7+ times
- **Action buttons** (Edit/Deactivate/Activate) with the same `text-[10px] border border-border/40` styling appear 18+ times
- **Table wrapper** (`<Card>` + `<table>` + `<colgroup>` + `<thead>`) appears 10 times

**Recommendation:** Extract three small shared components:

```
components/admin/StatusBadge.tsx    → <StatusBadge status="active" />
components/admin/ActionButton.tsx   → <ActionButton icon={Edit} label="Edit" onClick={...} />
components/admin/AdminTable.tsx     → <AdminTable headers={[...]} children={...} />
```

This would reduce each tab file by roughly 30-40% and ensure visual consistency is maintained from a single source.

---

## 5. ~~Split `IntakeNewRedesign.tsx`~~ — DONE

The intake form has been split into focused sub-components under `client/src/pages/intake/`:

| File | Responsibility |
|------|---------------|
| `QuestionRenderer.tsx` | Renders a single question by type |
| `IntakeSidebar.tsx` | Left sidebar section navigation |
| `IntakeHeader.tsx` | Header with progress and actions |
| `ImportDialog.tsx` | Import/export functionality |
| `FeedbackModal.tsx` | Post-completion feedback |
| `ArchitectureOverview.tsx` | Architecture section rendering |
| `SystemEditRow.tsx` | System type editing row |
| `MobileBottomNav.tsx` | Mobile navigation |
| `intakeUtils.ts` | Shared utilities |
| `systemConstants.ts` | System type constants |

`IntakeNewRedesign.tsx` remains as the orchestrator composing these sub-components.

---

## 6. Split `server/routers/admin.ts` (High Effort, High Impact)

At **2,189 lines**, this is the largest server file. It handles questions CRUD, organizations CRUD, users CRUD, vendor options, task templates, partner management, file operations, and metrics — all in one file.

**Recommendation:** Split by domain into sub-routers:

| Proposed File | Responsibility |
|---------------|---------------|
| `admin/questions.ts` | Question and option CRUD |
| `admin/organizations.ts` | Org create/edit/deactivate/reactivate/complete |
| `admin/users.ts` | User create/edit/deactivate/reactivate |
| `admin/vendors.ts` | Vendor picklist and audit log |
| `admin/templates.ts` | Partner task templates |
| `admin/metrics.ts` | Dashboard metrics and completion calculations |
| `admin/index.ts` | Merges sub-routers into `adminRouter` |

The template README already recommends splitting routers at ~150 lines. This file is 14x that threshold.

---

## 7. ~~Consolidate Overlapping Shared Data Files~~ — DONE

The three dead shared data files (`questionnaire-data.ts`, `wizard-data.ts`, `intake-questions.ts`) were removed as part of the dead code cleanup in item 1.

---

## Summary: Current Status

| Priority | Refactoring | Status | Notes |
|----------|-------------|--------|-------|
| 1 | Delete dead files | **DONE** | ~5,260 lines removed |
| 2 | Use `adminProcedure` middleware | **DONE** | admin.ts uses `adminDbProcedure` (58 endpoints). Other routers still have manual checks. |
| 3 | Consolidate admin routes | **DONE** | Hardcoded partner routes removed; 4 generic routes remain |
| 4 | Extract shared admin table components | **TODO** | StatusBadge, ActionButton, AdminTable |
| 5 | Split `IntakeNewRedesign.tsx` | **DONE** | Split into `pages/intake/` sub-components |
| 6 | Split `admin.ts` router | **TODO** | Still ~2,000 lines in one file |
| 7 | Remove dead shared data files | **DONE** | Included in item 1 |

**Remaining work:** Items 4 and 6 are the two structural improvements still open. Additionally, the consistency scan (April 2026) found:
- **Mixed DB access patterns:** 4 routers use `requireDb()` (auto-throws), 9 use `getDb()` + manual null check. Standardize on `requireDb()`.
- **Mixed error types:** `files.ts` and `webhooks.ts` throw plain `Error` instead of `TRPCError`. Should use `TRPCError` for consistency.
- **Mixed import paths:** 4 server router files use `../../shared/` relative paths instead of `@shared/` alias. Standardize on `@shared/`.
