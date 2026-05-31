# Data Dictionary & Type Contracts

> **Purpose:** This file codifies the field mappings, return types, and naming
> conventions that have repeatedly caused `tsc` failures (and the resulting
> *silent* deploy failures, since `vite build`/`esbuild` do **not** type-check).
> Follow these contracts and this entire class of bug becomes structurally
> impossible — `tsc` will catch any violation **as long as the build runs it**
> (see §0).

---

## 0. The non-negotiable guardrail: `tsc` must gate the build

`esbuild`/`vite build` strip types and bundle happily even when the code is
type-broken. The deploy pipeline runs `tsc --noEmit` and **fails on type errors**
— so "build passes" locally is a false signal.

- **The build script MUST run `tsc` first:**
  ```jsonc
  // package.json
  "build": "tsc --noEmit && vite build && esbuild server/_core/index.ts ..."
  ```
- **`tsconfig.json` MUST set a real `target`:**
  ```jsonc
  "target": "ES2022"
  ```
  Without it, TS defaults to ES3 and emits phantom `TS2802` "Map/Set can only be
  iterated…" errors that mask the real ones. (This is why error counts appeared
  to be 3 vs 15 vs 51 — the noise was hiding the signal.)
- **Before every commit / PR:** `npm run check` (`tsc --noEmit`) must be **0 errors**.

Everything below is enforceable *only* because `tsc` is the gate. Keep it the gate.

---

## 1. Database access — `requireDb()`, never `getDb()`

`server/db.ts` exposes two helpers:

| Function | Returns | Use when |
|----------|---------|----------|
| `getDb()` | `Database \| null` | **Only** if you explicitly handle the `null` case |
| `requireDb()` | `Database` (throws `INTERNAL_SERVER_ERROR` if no DB) | **Everywhere else** — routers, services, cron |

**Rule:** In any router/service that needs the DB, write:
```ts
const db = await requireDb();
```
Do **not** write `const db = await getDb();` and then dereference `db.*` — TS will
(correctly) flag `'db' is possibly 'null'` (TS18047). There is no module-level
`db` export; `import { db } from "../db"` does not exist.

---

## 2. File uploads — `uploadToGoogleDrive` returns an **object**, not a string

Canonical signature (`server/routers/files.ts`):
```ts
uploadToGoogleDrive(fileName, fileBuffer, organizationName, orgDriveFolderId?)
  : Promise<{ driveUrl: string | null; s3Url: string; driveFileId: string | null; s3Key: string }>
```

**Never** assign the result to a `string` column. **Always** destructure:
```ts
const { driveUrl, s3Url, driveFileId, s3Key } =
  await uploadToGoogleDrive(fileName, buffer, org.name, org.googleDriveFolderId);
const fileUrl = driveUrl || s3Url;   // the canonical "one URL" for string columns
```
Then store `fileUrl` (string), `s3Key`, and `driveFileId` in their respective columns.

### Upload mutation return `status` (what the client actually reads on `main`)

Only the **adhoc** upload surfaces a status the client consumes:

| Mutation | Returns | Consumed by |
|----------|---------|-------------|
| `intake.uploadAdhocFile` | `{ success, fileUrl, status: { drive: boolean; s3: boolean; audit: boolean } }` | `useHomeData` reads `status.drive` / `status.audit` |
| `intake.uploadFile`, `proceduralLibrary.uploadDocument` | `{ success, fileUrl, ... }` — **no consumed `status` object** | client reads `success`/`fileUrl` only |

> ⚠️ The adhoc status field is **`audit`**, never `notion`. There is **no
> `.status.notion`** anywhere — those references were a bug and were removed. If
> you add a status object to `uploadFile`/`uploadDocument`, you must add the
> client consumer too, or `tsc` will flag the unread/!-matching shape.

---

## 3. Status / enum unions — single source of truth

| Union | Source of truth | Members |
|-------|-----------------|---------|
| `StatusType` | `client/src/components/StatusBadge.tsx` | `"done" \| "na" \| "open" \| "pass" \| "fail" \| "in_progress" \| "blocked"` |
| `ValidationStatus` | `Validation.tsx` | `Exclude<StatusType, "done">` — validation has **no** "done" state |
| `organizations.status` (DB) | `drizzle/schema.ts` | `"active" \| "completed" \| "paused" \| "inactive"` (default `"active"`) |

Rules:
- Define `ValidationStatus` as `Exclude<StatusType, "done">` — do **not** re-spell
  the union, and type any `STATUS_CYCLE` / `Record<ValidationStatus, …>` with it.
- `organizations` **create input does not include `status`** — new orgs are
  `"active"` by default. Use the literal `"active"`, not `input.status`.

---

## 4. tRPC procedures — names and inputs are the contract

tRPC infers client types from the server router end-to-end, so a mismatch is a
**compile error** — but only if the procedure name and input schema are right.

- **Name the procedure what the client calls.** The client calls
  `trpc.intake.saveResponse` and `trpc.intake.submitFeedback`; the server must
  export procedures with those exact names (they were once mis-named
  `toggleOrgCustomTaskPublic` / `deleteOrgCustomTaskPublic` and silently broke).
- **The `.input(z.object({…}))` schema must match the client's `.mutate({…})`
  payload exactly.** Canonical inputs:

  | Procedure | Type | Input schema |
  |-----------|------|--------------|
  | `intake.saveResponse` | `protectedProcedure` | `{ organizationSlug, questionId, response, userEmail }` |
  | `intake.submitFeedback` | `protectedProcedure` | `{ organizationSlug, rating: z.number().min(1).max(5), comments?: string }` |

- **Never re-type a mutation's return on the client.** Read it off the inferred
  result; if you reference `data.foo`, the server must return `foo`.

---

## 5. ⭐ Notion dual-write: DB column names ≠ `*Payload` field names

This is the single biggest source of the recurring errors. The MySQL schema and
the Notion `dispatch.*` payloads use **different names for the same data.** The
payload interfaces in `server/notionDualWrite.ts` are the **source of truth** for
what `dispatch.*({...})` accepts. When wiring a dispatch call, map DB → payload
using this table — do not guess from the column name.

### `dispatch.partnerTemplate` → `PartnerTemplatePayload`
| DB column (`partnerTemplates`) | Payload field |
|---|---|
| `label` | **`title`** |
| `isActive` | **`active`** |
| `fileName`, `fileUrl`, `mimeType`, `fileSize`, `questionId`, `uploadedBy` | same |
| *(none)* | `partnerName` (look up from `clientId`) |

### `dispatch.specification` → `SpecificationPayload`
| DB column (`specifications`) | Payload field |
|---|---|
| `title`, `description`, `category` | same |
| `isActive` | **`active`** |
| — | **`key`** (required; not a file column — do **not** pass `fileName`/`fileUrl`/`version`) |

### `dispatch.partnerTaskTemplate` → `PartnerTaskTemplatePayload`
| DB column (`partnerTaskTemplates`) | Payload field |
|---|---|
| `title`, `section`, `description`, `createdBy` | same |
| `isActive` | **`active`** |
| `type`, `sortOrder` | **not used** — payload wants **`taskId`**, **`owner`** |

### `dispatch.vendorAudit` → `VendorAuditPayload`
| DB column (`vendorAuditLog`) | Payload field |
|---|---|
| `systemType` | **`field`** |
| `previousValue` | **`oldValue`** |
| `performedAt` | **`createdAt`** |
| `action`, `newValue`, `performedBy` | same |
| — | **`vendorId`** (required) |

### `dispatch.question` → `QuestionPayload`
| DB column (`questions`) | Payload field |
|---|---|
| `questionType` | **`type`** |
| `questionNumber` | **`sortOrder`** |
| `questionText` | **`fullText`** |
| `questionId` | **`key`** |
| `sectionId` | **`section`** |

### `dispatch.questionOption` → `QuestionOptionPayload`
| DB column (`questionOptions`) | Payload field |
|---|---|
| `optionValue` | **`value`** |
| `optionLabel` | **`label`** |
| `displayOrder` | **`sortOrder`** |

### `dispatch.partnerDocument` → `PartnerDocPayload`
Required fields: `mysqlId, clientId, partnerName, title, fileName, fileUrl,
driveFileId, mimeType, fileSize, category, uploadedBy, active, createdAt`.
There is **no `version` field** — do not pass one.

> For every other dispatch type, open the matching `*Payload` interface in
> `server/notionDualWrite.ts` before wiring the call. The interface — not the DB
> row — defines the contract.

---

## 6. Backfill (`server/routers/backfill.ts`)

Backfill reads **DB rows** and maps them into the **payload** shapes above. The
same DB-column-vs-payload-name rule applies: e.g. a `partnerTemplates` row has
`row.label` (→ `title`), a `vendorAuditLog` row has `row.systemType` (→ `field`),
`row.previousValue` (→ `oldValue`), `row.performedAt` (→ `createdAt`). Always map;
never pass `row.<payloadFieldName>` — that column usually doesn't exist.

---

## 7. Server port — latent risk, not a confirmed bug

`server/_core/index.ts` (bundled to `dist/index.js`) is the prod entry. It uses
`findAvailablePort()`, which starts at `process.env.PORT` and walks to the next
free port if the preferred one looks busy. **In practice this works in production
today** (the live deploy binds `PORT` on the first try), so this is a *latent
edge-case risk*, not a current failure. The risk: if the injected `PORT` ever
probes as busy, the app would silently bind elsewhere and the platform's
health-check on `PORT` would fail with no error. Hardening (optional): in
production, bind exactly to `process.env.PORT` and skip the fallback.

---

## Pre-flight checklist (before commit / PR)

1. `npm run check` → **0** `tsc` errors. (Not "build passes" — `tsc`.)
2. DB access uses `requireDb()`.
3. Upload results destructured; string columns get `driveUrl || s3Url`.
4. New/changed mutation return shapes match what the client reads.
5. Any `dispatch.*` call maps DB columns to payload fields per §5 — verified
   against the `*Payload` interface, not guessed.
6. New tRPC procedure name + input schema match the client call sites.
