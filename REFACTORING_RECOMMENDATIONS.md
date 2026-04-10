# Refactoring Recommendations

A prioritized audit of the New Lantern Implementation Portal codebase, organized by impact and effort.

---

## 1. Dead Code Removal (Low Effort, High Impact)

The codebase contains approximately **5,260 lines** of unreferenced files left over from earlier iterations. These files are never imported, never routed to, and only add confusion when navigating the project. Deleting them is the single easiest cleanup.

| File | Lines | Why It's Dead |
|------|------:|---------------|
| `pages/ComponentShowcase.tsx` | 1,437 | Template demo page, never routed |
| `pages/IntakeNew.tsx` | 1,251 | Replaced by `IntakeNewRedesign.tsx` |
| `shared/wizard-data.ts` | 412 | Only imported by dead `WizardCompletion` |
| `shared/intake-questions.ts` | 400 | Only imported by dead `IntakeForm` |
| `pages/PartnerAdmin.tsx` | 421 | Never routed in `App.tsx` |
| `pages/ManageUsers.tsx` | 295 | Never routed in `App.tsx` |
| `pages/Intake-collapsible.tsx` | 285 | Never routed in `App.tsx` |
| `components/ActivityFeed.tsx` | 245 | Never imported |
| `components/IntakeForm.tsx` | 226 | Never imported |
| `components/WizardCompletion.tsx` | 127 | Never imported |
| `components/ManusDialog.tsx` | 89 | Never imported |
| `components/ProgressLogo.tsx` | 74 | Never imported |

**Recommendation:** Move these into a `_deprecated/` folder or delete them outright. This immediately makes the project easier to navigate and reduces the surface area for accidental edits.

---

## 2. Use the `adminProcedure` Middleware (Medium Effort, High Impact)

The file `server/_core/trpc.ts` already exports an `adminProcedure` that checks `ctx.user.role !== 'admin'` and throws `FORBIDDEN`. However, **zero routers use it**. Instead, `server/routers/admin.ts` manually repeats the role check **53 times** and the "Database not available" guard **54 times**.

The current pattern in every single procedure:

```ts
// Repeated 53 times in admin.ts alone
if (ctx.user.role !== "admin") {
  throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}
const db = await getDb();
if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
```

**Recommendation:** Replace `protectedProcedure` with `adminProcedure` in the admin router, and create a `dbProcedure` middleware that injects a guaranteed-non-null `db` into context. This would eliminate roughly 200 lines of boilerplate from `admin.ts` alone, and another 100+ lines across the other routers.

---

## 3. Consolidate Hardcoded Admin Routes (Low Effort, Medium Impact)

`App.tsx` has **10 separate `<Route>` entries** that all render `<PlatformAdmin />`, with hardcoded slugs for `SRV`, `RadOne`, and `admin`:

```tsx
<Route path="/org/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/admin">{() => <PlatformAdmin />}</Route>
<Route path="/org/SRV/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/SRV/admin">{() => <PlatformAdmin />}</Route>
<Route path="/org/RadOne/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/RadOne/admin">{() => <PlatformAdmin />}</Route>
<Route path="/org/:slug/admin/users">{() => <PlatformAdmin />}</Route>
<Route path="/org/:slug/admin">{() => <PlatformAdmin />}</Route>
```

The generic `:slug` routes already cover `SRV` and `RadOne`. The hardcoded variants are redundant.

**Recommendation:** Remove the 6 hardcoded routes and keep only the 2 generic `:slug` routes plus the top-level `/org/admin` routes. This cuts the route block from 10 entries to 4.

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

## 5. Split `IntakeNewRedesign.tsx` (High Effort, High Impact)

At **2,247 lines**, this is the largest file in the project. It contains the entire questionnaire experience in a single component: section navigation, question rendering (6+ question types), file upload handling, import/export logic, N/A toggling, auto-save, and the mobile sidebar.

**Recommendation:** Break it into focused sub-components:

| Proposed File | Responsibility |
|---------------|---------------|
| `QuestionRenderer.tsx` | Renders a single question by type (text, select, radio, file, etc.) |
| `SectionNav.tsx` | Left sidebar section navigation with completion indicators |
| `QuestionnaireToolbar.tsx` | Import/export/download actions |
| `FileUploadZone.tsx` | File drag-drop and upload logic (partially exists already) |
| `IntakeNewRedesign.tsx` | Orchestrator that composes the above |

This makes each piece independently testable and easier to modify without risk of breaking unrelated functionality.

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

## 7. Consolidate Overlapping Shared Data Files (Low Effort, Low Impact)

Three files in `shared/` define questionnaire structures with overlapping types:

| File | Lines | Used By |
|------|------:|---------|
| `questionnaire-data.ts` | 465 | Only `Intake-collapsible.tsx` (dead) |
| `wizard-data.ts` | 412 | Only `WizardCompletion.tsx` (dead) |
| `intake-questions.ts` | 400 | Only `IntakeForm.tsx` (dead) |

All three are only imported by dead files. If you complete step 1 (dead code removal), these go away automatically. The live questionnaire data is managed in the database and fetched via tRPC, which is the correct approach.

---

## Summary: Prioritized Action Plan

| Priority | Refactoring | Effort | Lines Saved | Risk |
|----------|-------------|--------|-------------|------|
| 1 | Delete dead files | 30 min | ~5,260 | None |
| 2 | Use `adminProcedure` middleware | 1-2 hrs | ~300 | Low |
| 3 | Consolidate admin routes | 15 min | ~20 | None |
| 4 | Extract shared admin table components | 2-3 hrs | ~200 | Low |
| 5 | Split `IntakeNewRedesign.tsx` | 4-6 hrs | 0 (restructure) | Medium |
| 6 | Split `admin.ts` router | 3-4 hrs | 0 (restructure) | Medium |
| 7 | Remove dead shared data files | Included in #1 | ~1,277 | None |

Items 1-3 are quick wins you could do today with essentially zero risk. Items 4-6 are structural improvements that pay off as the codebase continues to grow.
