# Activity & Audit (§9) — Implementation Instructions

> **Status:** Spec / not yet built. Follow these steps to implement.
> **Why:** A real incident — a user uploaded files that "didn't stick" with no way
> to see what happened. The fix is an **append-only activity log** surfaced to the
> user where **every action carries a verifiable outcome**, so a silent failure
> becomes a visible, retryable row.
> **Source of truth:** mockup `app/Activity.jsx` + HANDOFF §9. UI is the visual
> truth; this doc is the build order.

Before writing code, read `docs/data-dictionary.md` (type contracts) and
`docs/deploy-runbook.md` (the `tsc` gate — `npm run check` must be 0 before any push).

---

## Status model (the whole point)

Every event has exactly one status. Map the three real failure modes:

| status | meaning | UI |
|--------|---------|----|
| `failed` | write/upload rejected (wrong type/size/destination) — **did not save** | red, shows `error_reason` + **Retry** + "Why did this fail?" |
| `saved` | written locally, **Notion mirror not yet confirmed** | amber, "sync pending" |
| `synced` | saved **and** confirmed retrievable in Notion | teal, "open" link (proves retrievability) |
| `info` | non-actionable note (login, etc.) | muted, no status pill |

`saved → synced` is a **flip**, not a new row: an upload writes `saved`, then the
event is updated to `synced` when the Notion dual-write/sync confirms.

---

## Step 1 — Schema: append-only events table

Add to `drizzle/schema.ts` (match existing conventions — `int` pk, `mysqlEnum`,
`timestamp`):

```ts
export const activityEvents = mysqlTable("activityEvents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  actorUserId: int("actorUserId"),                 // null for system events
  action: mysqlEnum("action", [
    "upload", "answer", "task", "test", "contacts", "sync", "login", "invite",
  ]).notNull(),
  target: varchar("target", { length: 500 }),       // "Configuration Files · CF.1"
  detail: text("detail"),                            // "lodi-proc-codes.xlsx · 1.2 MB"
  status: mysqlEnum("status", ["synced", "saved", "failed", "info"]).notNull().default("info"),
  fileId: int("fileId"),                             // optional → fileAttachments
  errorReason: text("errorReason"),                  // why a failed action failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

- **Append-only:** never UPDATE except the single `saved → synced` flip (Step 5).
- Export the type from `shared/types.ts` if the client needs it.
- Run `npm run db:push` (generate + migrate). This is a real migration — see the
  deploy runbook; confirm it applies on the publish target.
- **Distinct from `activityFeed`** (which is *manual admin-posted notes*). Do not
  conflate — `activityEvents` is the per-action audit; `activityFeed` stays as-is.

## Step 2 — Logging helper

New `server/activityLog.ts`:

```ts
export async function logActivity(e: {
  organizationId: number; actorUserId?: number | null;
  action: ActivityAction; target?: string; detail?: string;
  status: "synced" | "saved" | "failed" | "info";
  fileId?: number | null; errorReason?: string | null;
}): Promise<number>   // returns inserted id (so callers can flip saved→synced)
```
- Fire-and-forget for non-critical paths; `await` where you need the id.
- Never let logging throw into the caller (wrap in try/catch, log to console).

## Step 3 — Wire logging into write paths

Add a `logActivity(...)` call at each write site. Minimum set (in priority order):

1. **Upload** (`intake.uploadFile`, `intake.uploadAdhocFile`, `proceduralLibrary.uploadDocument`)
   — `action:"upload"`, status `saved` on success, `failed` on reject (Step 4).
2. **Answer** (`intake.saveResponse`) — `action:"answer"`, `saved`/`synced`.
3. **Task** (`implementation.updateTask`) — `action:"task"`.
4. **Test** (`validation.updateResult`) — `action:"test"`.
5. **Contacts** (the `A.contacts` save path) — `action:"contacts"`.
6. **Sync / login / invite** — `info` events as useful.

> ⚠️ These edits touch server router files. Coordinate with whoever owns the
> Notion dual-write wiring to avoid merge conflicts; keep each call additive.

## Step 4 — Uploads must NOT silently 200

In every upload handler:
- Validate type/size/destination **before** "success". On reject:
  - return a real tRPC error the UI surfaces (don't 200), **and**
  - write a `failed` event with a human `errorReason`
    (e.g. `"file exceeded the .csv type filter and was not saved"`).
- On accept: write a `saved` event (Step 3) carrying `fileId`.

## Step 5 — Flip `saved → synced` on Notion confirm

Where the Notion dual-write / sync-back confirms a row, `UPDATE activityEvents
SET status='synced'` for the matching event (carry the event id or match by
fileId/target). Hook this into the existing dual-write success path or the
reconciliation job. If sync never confirms, the row correctly stays `saved`.

## Step 6 — Read endpoint

New `server/routers/activity.ts` (register in `server/routers.ts`):
- `getForOrg({ organizationSlug })` → `protectedProcedure`, returns events for the
  org ordered by `createdAt desc`, scoped to the caller's org/client (reuse the
  access checks in `intake.getResponses`).
- Derive counts (`synced` / `saved` / `failed`) server- or client-side for the tiles.

## Step 7 — Client: Activity view + nav + route

Recreate `app/Activity.jsx` as `client/src/pages/Activity.tsx` using the New
Lantern theme tokens (see `docs/data-dictionary.md` §3 for status unions):

- **Page:** overline + title + description; **3 confidence tiles** (Synced &
  retrievable / Saved · sync pending / Failed · needs retry); a **red banner +
  Retry** when `failed > 0`; **filter chips** (All / Files / Questionnaire /
  Tasks / Testing); and the **feed** — each row: icon · title · target · status
  pill · timestamp; `synced` rows get an "open file" link; `failed` rows get
  **Retry upload** + "Why did this fail?".
- **Nav:** add `{ label: "Activity", icon: Activity, href: \`${orgBase}/activity\` }`
  to the `navItems` array in `client/src/pages/Home.tsx` (between Tasks and the
  hidden Knowledge entry). Mobile strip picks it up automatically.
- **Route:** add `/org/:clientSlug/:slug/activity` → `Activity` in `client/src/App.tsx`.
- **Dashboard summary:** add a compact "Your recent activity" feed to `Home.tsx`
  (reuse the row component, `max={5}`, `compact`) with an "N uploads need
  attention" CTA when failures exist — confidence at a glance on landing.

## Phasing (recommended rollout)

- **Phase B (view-first, no migration, no server-file edits):** Steps 6–7 only,
  with the read endpoint returning seeded/empty data. Ships safely; the failure/
  retry UI is present but not yet backed. Good if consolidating.
- **Phase A (full value):** Steps 1–5 (migration + logging + upload-reject + flip).
  This is where a silent failure actually becomes visible. Needs the schema
  go-ahead + coordination on the server upload files.

## Definition of done

- A rejected upload returns an error **and** appears as a `failed` row with a
  reason and a working Retry.
- A successful upload appears as `saved`, then flips to `synced` once Notion
  confirms; `synced` rows expose a working "open" link.
- Confidence tiles + dashboard summary reflect real counts.
- `npm run check` (tsc) = 0; build passes; `activityEvents` migration applied on
  the publish target.

## Open questions

1. Retry mechanism: re-POST the original file (client must still hold it) vs a
   server-side re-attempt — decide before building Retry.
2. Retention/volume of `activityEvents` (append-only grows) — purge policy?
3. Does `actorUserId` need to gate visibility (only show the viewer's own actions
   vs all org actions)? Mockup shows org-wide; confirm.
