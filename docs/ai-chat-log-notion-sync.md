# Implementation Spec: AI Chat Log → Notion Sync

> **Status:** Not implemented. The Notion "AI Chat Log" database exists but nothing in
> the codebase writes to it. This doc is the build plan to wire it up.
>
> **Branch:** implement on a feature branch, not `main`.

---

## Background / Why this exists

The in-portal AI assistant (`server/routers/ai.ts`) logs every action — chat messages,
tool calls, denials — by calling `writeAuditLog()`, which **only inserts into the MySQL
`aiAuditLogs` table** (`server/routers/ai.ts:90`). There are **395+ rows** there today.

A Notion database called **"AI Chat Log"** was created (under *INTERFACES* → *Operations: Team
Space*) to mirror these logs, but the sync was never built:

- **No env var** for its data source id (`server/_core/env.ts` has datasource ids for
  connectivity, sync-log, contacts, systems, task-completion, validation — but **none** for
  chat/audit).
- **No sync job** in `server/cron.ts` references `aiAuditLogs`.
- `writeAuditLog()` does not push to Notion.

Result: the Notion table is an empty shell. This spec adds a **one-way push** (MySQL →
Notion), consistent with the existing sync architecture.

### Notion database identifiers

| Thing | Value |
|-------|-------|
| Database id | `2736e92a-7e47-46e4-8057-22060cfe2e97` |
| Data source id | `27f0a0d3-7e20-4f99-9506-41cb6acfb98d` |
| Location | INTERFACES → Operations: Team Space |

### ⚠️ Schema note (verified)

The live Notion schema **matches the MySQL `aiAuditLogs` columns** and already includes the
sync-bookkeeping fields used by the other mirrors: **`MySQL ID`** (described as *"Primary key
from MySQL"*), **`Last Synced`**, **`Last Updated From`** (`Portal`/`Sync`). It does **not**
have `Tokens Used`, `Cost`, `Model`, or `User Name` columns — ignore any earlier description
that mentioned those; they don't exist in either the table or the schema.

Notion property → MySQL column map:

| Notion property | Type | MySQL column (`aiAuditLogs`) |
|-----------------|------|------------------------------|
| `Name` (title) | title | `action` |
| `Category` | select (`chat`/`read`/`write`/`navigate`/`extract`) | `category` |
| `Status` | select (`success`/`error`/`denied`) | `status` |
| `User Prompt` | text | `userPrompt` |
| `AI Response` | text | `aiResponse` |
| `Tool Args` | text | `toolArgs` |
| `Tool Result` | text | `toolResult` |
| `Error Message` | text | `errorMessage` |
| `Actor Email` | email | `actorEmail` |
| `Actor Role` | text | `actorRole` |
| `Client ID` | number | `clientId` |
| `Organization` | text | `organizationSlug` |
| `IP Address` | text | `ipAddress` |
| `Duration (ms)` | number | `durationMs` |
| `MySQL ID` | number | `id` |
| `Created At` | date | `createdAt` |
| `Last Updated From` | select | set to `"Sync"` (written by the job) |
| `Last Synced` | last_edited_time | auto-managed by Notion |

This is **append/one-way** (audit rows are never edited in Notion), so it's simpler than the
bidirectional sync-back jobs — it's the same shape as `writeToNotionSyncLog()` in `cron.ts`.

---

## Step 1 — Add the env var

**File:** `server/_core/env.ts`

1. Add to the zod schema (near the other datasource ids, ~line 30):
   ```ts
   NOTION_AI_CHAT_LOG_DATASOURCE_ID: z.string().default(""),
   ```
2. Add the known default (in the defaults block, ~line 65):
   ```ts
   NOTION_AI_CHAT_LOG_DATASOURCE_ID: "27f0a0d3-7e20-4f99-9506-41cb6acfb98d",
   ```
3. Export it in the `ENV` object (~line 106):
   ```ts
   notionAiChatLogDataSourceId: e.NOTION_AI_CHAT_LOG_DATASOURCE_ID,
   ```

> Set the real value as a deployment secret too; the default is a convenience fallback.

---

## Step 2 — New sync module

**File:** `server/notionSyncAiChatLog.ts` (new)

Model it on `writeToNotionSyncLog()` (`server/cron.ts:145`) for the page-create call and on
`runTaskValidationSyncBack()` (`server/notionSyncBackTasks.ts`) for the batch loop. Key
design points:

- **Direction:** MySQL → Notion only.
- **Idempotency / watermark:** track the highest `aiAuditLogs.id` already pushed. Two options:
  - **(Recommended) Watermark by id.** Persist the last-synced max id. Simplest store is a row
    in the existing `syncCheckpoints` table (already in `drizzle/schema.ts`) keyed e.g.
    `aiChatLog`. On each run, `SELECT * FROM aiAuditLogs WHERE id > :lastId ORDER BY id ASC
    LIMIT :batch`, create a Notion page per row, then advance the watermark to the last
    successfully-pushed id.
  - **Alt: query by `Created At` window** like the other jobs do with timestamps. Id-based is
    safer here because rows are immutable and monotonic.
- **Batch size:** cap per run (e.g. `BATCH = 50`) to stay under Notion rate limits; the next
  tick picks up the rest.
- **Truncation:** Notion rich_text caps at 2000 chars per text block — reuse the
  `.substring(0, 2000)` pattern from `writeToNotionSyncLog`. (`writeAuditLog` already truncates
  at the DB layer, but cap again defensively.)
- **Failure handling:** on a per-row create failure, push the payload to the retry queue via
  `enqueueFailedWrite()` (`server/notionRetryQueue.ts:28`) and continue; do **not** advance the
  watermark past a failed row's id unless it was enqueued.

Sketch:

```ts
import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { aiAuditLogs, syncCheckpoints } from "../drizzle/schema";
import { gt, asc } from "drizzle-orm";
import { enqueueFailedWrite } from "./notionRetryQueue";

const DATA_SOURCE_ID = ENV.notionAiChatLogDataSourceId || "";
const BATCH = 50;
const t = (s: string | null | undefined) => (s ? s.substring(0, 2000) : "");

export interface AiChatLogSyncResult {
  fetched: number;
  pushed: number;
  failed: number;
  errors: string[];
}

export async function runAiChatLogSync(): Promise<AiChatLogSyncResult> {
  const res: AiChatLogSyncResult = { fetched: 0, pushed: 0, failed: 0, errors: [] };
  if (!ENV.notionApiKey || !DATA_SOURCE_ID) return res; // disabled if unconfigured

  const db = await getDb();
  const lastId = await readWatermark(db);          // from syncCheckpoints
  const rows = await db.select().from(aiAuditLogs)
    .where(gt(aiAuditLogs.id, lastId))
    .orderBy(asc(aiAuditLogs.id))
    .limit(BATCH);
  res.fetched = rows.length;
  if (rows.length === 0) return res;

  const client = new Client({ auth: ENV.notionApiKey });
  let highWater = lastId;

  for (const r of rows) {
    try {
      await client.pages.create({
        parent: { database_id: DATA_SOURCE_ID }, // data_source id works as database parent
        properties: {
          "Name": { title: [{ text: { content: r.action } }] },
          "Category": { select: { name: r.category } },
          "Status": { select: { name: r.status } },
          "User Prompt": { rich_text: r.userPrompt ? [{ text: { content: t(r.userPrompt) } }] : [] },
          "AI Response": { rich_text: r.aiResponse ? [{ text: { content: t(r.aiResponse) } }] : [] },
          "Tool Args": { rich_text: r.toolArgs ? [{ text: { content: t(r.toolArgs) } }] : [] },
          "Tool Result": { rich_text: r.toolResult ? [{ text: { content: t(r.toolResult) } }] : [] },
          "Error Message": { rich_text: r.errorMessage ? [{ text: { content: t(r.errorMessage) } }] : [] },
          "Actor Email": { email: r.actorEmail || null },
          "Actor Role": { rich_text: r.actorRole ? [{ text: { content: r.actorRole } }] : [] },
          "Client ID": { number: r.clientId ?? null },
          "Organization": { rich_text: r.organizationSlug ? [{ text: { content: r.organizationSlug } }] : [] },
          "IP Address": { rich_text: r.ipAddress ? [{ text: { content: r.ipAddress } }] : [] },
          "Duration (ms)": { number: r.durationMs ?? null },
          "MySQL ID": { number: r.id },
          "Created At": { date: { start: new Date(r.createdAt).toISOString() } },
          "Last Updated From": { select: { name: "Sync" } },
        },
      });
      res.pushed++;
      highWater = r.id;
    } catch (err: any) {
      res.failed++;
      res.errors.push(`id ${r.id}: ${err.message?.substring(0, 120)}`);
      await enqueueFailedWrite({ kind: "aiChatLog", mysqlId: r.id }, err.message ?? "unknown");
      // stop advancing the watermark at the first hard failure so we retry next tick
      break;
    }
  }

  if (highWater > lastId) await writeWatermark(db, highWater);
  return res;
}
```

> `readWatermark` / `writeWatermark`: implement against `syncCheckpoints`. If that table's shape
> doesn't fit, the smallest alternative is "max `MySQL ID` already in Notion" — but that requires
> a Notion query per run, so prefer the local checkpoint.

---

## Step 3 — Register the cron job

**File:** `server/cron.ts`

1. Import at top (~line 20):
   ```ts
   import { runAiChatLogSync } from "./notionSyncAiChatLog";
   ```
2. Inside `startCronJobs()` add a schedule on an **unused minute offset** (existing jobs use
   `*/5`, `2,7,…`, `3,8,…`, `1,6,…`, `4,9,…`). The `:0,5` slot and `:1,6` slot are taken by
   questionnaire + retry-queue; use a free one, e.g. minute offset matching nothing else — pick
   `"*/5 * * * *"` is taken, so reuse the questionnaire tick is fine, OR add a distinct line.
   Recommended dedicated line:
   ```ts
   // AI Chat Log MySQL → Notion push: every 5 minutes
   cron.schedule("*/5 * * * *", async () => {
     const start = Date.now();
     try {
       const result = await runAiChatLogSync();
       hourlyStats.totalDurationMs += Date.now() - start;
       if (result.errors.length > 0) {
         hourlyStats.errors.push(`AI: ${result.errors[0].substring(0, 80)}`);
       }
       lastSynced.aiChatLog = new Date().toISOString();
       if (result.pushed > 0) {
         console.log(`[cron] AI Chat Log push — ${result.pushed} pushed / ${result.failed} failed`);
       }
     } catch (error: any) {
       hourlyStats.errors.push(`AI: ${error.message?.substring(0, 100)}`);
       console.error("[cron] AI Chat Log sync failed:", error);
     }
   });
   ```
3. Add `aiChatLog` to the `LastSyncedTimestamps` interface, the `lastSynced` object, and (if you
   want it in the staleness check) the `checkStalenessAndNotify` array — all near `server/cron.ts:29-57`.
   *Optional:* leave it out of the staleness alert at first, since a quiet chat (no new rows) is
   not a failure.

---

## Step 4 — Retry queue support

**File:** `server/notionRetryQueue.ts`

The queue's `processRetryQueue()` switches on payload `kind`. Add an `aiChatLog` case that
re-fetches the row by `mysqlId` and re-runs the single-page create (extract the create call from
Step 2 into a shared `pushOneAiChatLogRow(client, row)` helper so both the main job and the retry
path call it). Confirm `RetryPayload` permits the `{ kind: "aiChatLog", mysqlId }` shape.

---

## Step 5 — (Optional) Reconciliation

**File:** `server/notionReconciliation.ts`

For parity with other tables, add a check that compares `COUNT(*)` / max id in MySQL vs Notion
and flags drift. Lower priority — the id-watermark + retry queue already guarantee
at-least-once delivery. Add only if you want the daily drift report to cover chat logs.

---

## Step 6 — Tests

**File:** `server/notionSyncAiChatLog.test.ts` (new) — follow `server/notionSyncBack.test.ts`.

Cover:
- Disabled when `notionApiKey` or datasource id missing (returns zeroed result, no calls).
- Pushes only rows with `id > watermark`, in ascending id order.
- Advances watermark to the last successfully-pushed id.
- On a create failure: stops, does **not** advance past the failed id, enqueues a retry.
- Truncates >2000-char text fields.
- Maps `category`/`status` enums to Notion `select` names correctly.

Mock the Notion `Client.pages.create` and the db layer as the existing sync tests do.

---

## Step 7 — Backfill the existing 395 rows (one-time)

The cron job only pushes rows newer than the watermark. To import history:

- **Simplest:** initialise the watermark to `0` (or no checkpoint) so the first runs page through
  all rows in `BATCH`-sized chunks over several ticks. Since rows are immutable, this is safe and
  self-throttling.
- **Or** add a one-off script under `scripts/` that loops `runAiChatLogSync()` until
  `fetched === 0`.

Verify no duplicates: with the id-watermark there won't be, as long as the watermark is persisted
between runs.

---

## Verification checklist

- [ ] `npm run check` passes (no TS errors).
- [ ] `npm run test` — new test file green.
- [ ] In a deployed/DB-connected env: send an AI chat message, wait one tick (≤5 min), confirm a
      new page appears in the Notion "AI Chat Log" table with correct `MySQL ID`, `Category`,
      `Status`, prompt/response.
- [ ] Trigger a failure (e.g. temporarily bad datasource id) → row lands in the retry queue, not lost.
- [ ] Backfill completes and Notion row count converges on MySQL `SELECT COUNT(*) FROM aiAuditLogs`.

---

## Files touched (summary)

| File | Change |
|------|--------|
| `server/_core/env.ts` | add `NOTION_AI_CHAT_LOG_DATASOURCE_ID` (schema + default + ENV export) |
| `server/notionSyncAiChatLog.ts` | **new** — `runAiChatLogSync()` + `pushOneAiChatLogRow()` + watermark helpers |
| `server/cron.ts` | import + register 5-min job; add `aiChatLog` to `lastSynced` |
| `server/notionRetryQueue.ts` | add `aiChatLog` case to `processRetryQueue` + payload type |
| `server/notionReconciliation.ts` | *(optional)* drift check |
| `server/notionSyncAiChatLog.test.ts` | **new** — unit tests |
| `scripts/backfill-ai-chat-log.mjs` | *(optional)* one-off history backfill |

## Design rationale (the "consistent synchronization" requirement)

- **One-way push, not sync-back:** audit rows are write-once in MySQL and never edited in Notion,
  so a unidirectional push is correct and avoids the blanking/conflict safeguards the
  bidirectional jobs need.
- **`MySQL ID` as the stable key** + a persisted **id watermark** gives idempotent, ordered,
  at-least-once delivery — matching how the other mirrors use `MySQL ID` for upserts.
- **Same plumbing as existing jobs:** node-cron schedule, `hourlyStats` aggregation, retry queue,
  optional reconciliation — so it behaves and is monitored like everything else.
