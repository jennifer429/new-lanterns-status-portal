# Sync Architecture — Developer Reference

This document explains how data flows between Notion (source of truth) and MySQL (read cache) in the New Lantern Implementation Portal.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        NOTION                                │
│  (Source of Truth for all definition & configuration data)   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Questionnaire│  │  Contacts    │  │   Systems    │      │
│  │  Responses   │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Task      │  │    Test      │  │ Connectivity │      │
│  │ Definitions  │  │ Definitions  │  │   Matrix     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │   Cron Sync (every 5 min) │
              │   Notion → MySQL          │
              └─────────────┬─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        MySQL                                 │
│  (Read cache — portal reads from here for performance)       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │intakeResponses│ │   contacts   │  │   systems    │      │
│  │ (JSON blobs) │  │ (normalized) │  │ (normalized) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │taskDefinitions│ │testDefinitions│ │ connectivity │      │
│  │  (cached)    │  │   (cached)   │  │  (direct*)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Portal Frontend                            │
│  (Reads from MySQL via tRPC, writes dual to Notion + MySQL)  │
└─────────────────────────────────────────────────────────────┘
```

*Connectivity currently reads directly from Notion (legacy pattern, to be migrated).

---

## Write Path (User Edits in Portal)

When a user makes a change through the portal UI:

1. **tRPC router** receives the mutation
2. **Write to Notion** (source of truth) — if this fails, the mutation fails
3. **Write to MySQL** (cache) — for instant UI feedback without waiting for cron
4. **Return success** to the frontend

This "dual-write" pattern ensures:
- Notion always has the latest data
- The portal reflects changes immediately
- If the MySQL write fails but Notion succeeds, cron will fix it within 5 minutes

---

## Read Path (Portal Page Load)

When the portal loads data:

1. **tRPC router** queries MySQL directly
2. **Returns cached data** — no Notion API calls on page load
3. **Frontend renders** from the MySQL response

This keeps page loads fast (< 100ms for data queries) regardless of Notion API latency.

---

## Sync-Back Path (Cron)

Background jobs run every 5 minutes to keep MySQL in sync with Notion:

### Job 1: Questionnaire Sync (`:00, :05, :10...`)
- File: `server/notionSyncBack.ts`
- Reads all pages from the Questionnaire Notion database
- Upserts into `intakeResponses` table (JSON blob per org × question)
- Updates Sync Config page with last success time

### Job 2: Contacts & Systems Sync (`:02, :07, :12...`)
- File: `server/notionSyncContacts.ts`
- Reads all pages from Contacts and Systems Notion databases
- Upserts into normalized `contacts` and `systems` MySQL tables
- Returns stats: rows upserted, rows failed

### Job 3: Task & Test Definitions Sync (`:04, :09, :14...`)
- File: `server/notionSyncTasksTests.ts` (to be created)
- Reads all pages from Task Definitions and Test Definitions databases
- Upserts into `taskDefinitions` and `testDefinitions` MySQL tables
- Only syncs definition metadata (not completion status — that stays in MySQL)

### Job 4: Hourly Log (`:00 every hour`)
- Aggregates sync stats from the past hour
- Writes a single summary entry to the Sync Log Notion database
- Includes: total runs, total rows synced, failures, duration

### Job 5: Purge Old Logs (`3 AM every 3 days`)
- Deletes Sync Log entries older than 7 days from Notion
- Keeps the log database manageable

---

## File Map

| File | Purpose |
|------|---------|
| `server/cron.ts` | Registers all cron jobs, manages hourly logging and purge |
| `server/notionSyncBack.ts` | Questionnaire sync: Notion → MySQL `intakeResponses` |
| `server/notionSyncContacts.ts` | Contacts & Systems sync: Notion → MySQL normalized tables |
| `server/notionSyncTasksTests.ts` | Task & Test defs sync: Notion → MySQL cache tables |
| `server/notion.ts` | Notion client factory and helpers |
| `server/routers/contacts.ts` | Contacts CRUD router (dual-write) |
| `server/routers/systems.ts` | Systems CRUD router (dual-write) |
| `server/routers/implementation.ts` | Task completion router (reads defs from MySQL) |
| `server/routers/validation.ts` | Test results router (reads defs from MySQL) |
| `server/routers/syncHealth.ts` | Admin sync trigger + health status |
| `server/_core/env.ts` | All Notion database IDs and env var mappings |

---

## Adding a New Synced Table

To add a new Notion database to the sync system:

1. **Create the Notion database** (via MCP or Notion UI)
2. **Add env vars** to `server/_core/env.ts`:
   - Add to `envSchema` (with `.default("")`)
   - Add to `ENV_OVERRIDES` (hardcoded IDs)
   - Add to `ENV` export object
3. **Create MySQL cache table** in `drizzle/schema.ts`, run `pnpm db:push`
4. **Create sync module** (e.g., `server/notionSyncNewTable.ts`):
   - Export a function that fetches all rows from Notion and upserts into MySQL
   - Return `{ upserted: number, failed: number }`
5. **Register in cron** (`server/cron.ts`):
   - Add to the appropriate offset schedule
   - Include in the hourly stats aggregation
6. **Create tRPC router** with dual-write pattern:
   - Read procedures query MySQL
   - Write procedures write to Notion first, then MySQL
7. **Add to admin sync** (`server/routers/syncHealth.ts`):
   - Include in `triggerFullSync` mutation
8. **Update references** (`references/notion-task-test-definitions.md`)

---

## Admin Manual Sync

The "Refresh Sync" button in the Platform Admin header triggers `syncHealth.triggerFullSync`:

1. Runs all sync jobs in parallel (questionnaire + contacts + systems + tasks + tests)
2. Returns per-table stats
3. Shows a toast with results

Only admin users can trigger this. The endpoint is protected by `protectedProcedure` + role check.

---

## Error Handling

- **Notion API timeout**: Sync logs the error, increments `consecutiveFailures` on the Sync Config page, and retries on the next cron cycle.
- **MySQL write failure**: Logged but not fatal — Notion remains the source of truth and the next sync will retry.
- **Dual-write partial failure**: If Notion write succeeds but MySQL fails, the data is safe in Notion and will sync on the next cron cycle. The frontend may show stale data for up to 5 minutes.

---

## Monitoring

- **Sync Config page** (Notion): Shows `Enabled`, `Last Successful Sync`, `Consecutive Failures`
- **Sync Log database** (Notion): Hourly entries with aggregated stats
- **Server logs**: Every sync run logs to stdout with timing and row counts
- **`syncHealth.status` endpoint**: Returns current health for the admin UI
