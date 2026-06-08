# Entity Relationship Diagram & Sync Flow

## Core Hierarchy

```
┌─────────────┐
│   Clients   │  (e.g., RadOne, SRV)
│  (Partners) │
└──────┬──────┘
       │ 1:N
       │
┌──────▼──────────────┐
│  Organizations      │  (e.g., Hospital A, Hospital B)
│  (Hospitals/Sites)  │
└──────┬──────────────┘
       │ 1:N
       ├─────────────────────────────────────┐
       │                                     │
┌──────▼────────────┐          ┌────────────▼─────────┐
│   Users           │          │  Responses           │
│ (Portal Access)   │          │ (Questionnaire Data) │
└───────────────────┘          └──────────────────────┘
```

## Synced Tables (from Notion)

```
NOTION (Source of Truth)
  │
  ├─ Questionnaire DB ──┐
  │                     └──→ MySQL: questions, responses
  │
  ├─ Contacts DB ───────────→ MySQL: contacts
  │
  ├─ Systems DB ────────────→ MySQL: systems
  │
  ├─ Task Definitions DB ───→ MySQL: taskDefinitions
  │
  ├─ Task Completions DB ───→ MySQL: taskCompletion
  │
  ├─ Validation Results DB ─→ MySQL: validationResults
  │
  └─ Workflow Pathways DB ──→ MySQL: workflowPathways
```

## Portal-Only Tables (NOT synced)

```
MySQL (Portal)
  │
  ├─ templateTaskCompletion  (which template tasks did user complete?)
  ├─ orgCustomTasks          (custom tasks created by admins)
  ├─ orgNotes                (internal notes)
  ├─ activityFeed            (audit trail)
  ├─ syncHealth              (sync observability)
  └─ syncErrors              (error logging)
```

## Current Sync Flow (Broken)

```
┌─────────────────────────────────────────────────────────────┐
│ NOTION (Source of Truth)                                    │
│  - Questionnaire DB (Claude writes)                         │
│  - Contacts DB (Claude writes)                              │
│  - Systems DB (Claude writes)                               │
│  - Task Definitions DB (Claude writes)                      │
│  - Task Completions DB (Claude writes)                      │
│  - Validation Results DB (Claude writes)                    │
│  - Workflow Pathways DB (Claude writes)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ 10 cron jobs (every 5 min)
                     │ - Questionnaire sync
                     │ - Contacts/Systems sync
                     │ - Task Definitions sync
                     │ - Task Completions & Validation sync
                     │ - Retry queue processor
                     │ - Reconciliation (hourly)
                     │ - Data quality check (daily)
                     │ - Hourly flush to Notion Sync Log
                     │ - Daily summary
                     │ - Sync log purge
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ MYSQL (Also treated as Source of Truth?)                    │
│  - questions (synced)                                       │
│  - responses (synced)                                       │
│  - contacts (synced)                                        │
│  - systems (synced)                                         │
│  - taskDefinitions (synced)                                 │
│  - taskCompletion (synced)                                  │
│  - validationResults (synced)                               │
│  - workflowPathways (synced)                                │
│  - templateTaskCompletion (local only)                      │
│  - orgCustomTasks (local only)                              │
│  - orgNotes (local only)                                    │
│  - syncHealth (observability)                               │
│  - syncErrors (error logging)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Live queries
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PORTAL (User Interface)                                     │
│  - Users view/edit data                                     │
│  - Edits saved to MySQL                                     │
│  - Sometimes synced back to Notion (inconsistent)           │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- ❌ 10 cron jobs = 10 failure points
- ❌ Partial failures = inconsistent data
- ❌ Stale alerts = noise
- ❌ No clear observability
- ❌ Manual retry queue = you have to babysit it

---

## Proposed Sync Flow (Simple & Reliable)

```
┌─────────────────────────────────────────────────────────────┐
│ NOTION (Single Source of Truth)                             │
│  - Questionnaire DB (Claude writes)                         │
│  - Contacts DB (Claude writes)                              │
│  - Systems DB (Claude writes)                               │
│  - Task Definitions DB (Claude writes)                      │
│  - Task Completions DB (Claude writes)                      │
│  - Validation Results DB (Claude writes)                    │
│  - Workflow Pathways DB (Claude writes)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ Sync-on-Read (immediate, on-demand)
                     │  When user opens a page:
                     │  - Check if MySQL cache is fresh (< 5 min)
                     │  - If fresh → serve from MySQL
                     │  - If stale → fetch from Notion in background
                     │
                     └─ Background Sync (every 30 min)
                        1 consolidated job:
                        - Pull all Notion tables
                        - Update MySQL with ON DUPLICATE KEY UPDATE
                        - Fail per-table (isolated)
                        - Log to syncErrors table
                        - Retry with exponential backoff
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ MYSQL (Cache Layer)                                         │
│  - questions (synced, with syncedAt timestamp)              │
│  - responses (synced, with syncedAt timestamp)              │
│  - contacts (synced, with syncedAt timestamp)               │
│  - systems (synced, with syncedAt timestamp)                │
│  - taskDefinitions (synced, with syncedAt timestamp)        │
│  - taskCompletion (synced, with syncedAt timestamp)         │
│  - validationResults (synced, with syncedAt timestamp)      │
│  - workflowPathways (synced, with syncedAt timestamp)       │
│  - templateTaskCompletion (local only)                      │
│  - orgCustomTasks (local only)                              │
│  - orgNotes (local only)                                    │
│  - syncHealth (observability)                               │
│  - syncErrors (error logging)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Live queries (fast)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PORTAL (User Interface)                                     │
│  - Users view data (from MySQL cache)                       │
│  - Users edit data (saved to MySQL)                         │
│  - Edits synced back to Notion on next cycle (30 min)       │
│  - Sync health dashboard shows status (green/red)           │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ 1 cron job = 1 failure point
- ✅ Per-table failures = isolated (one table failing doesn't block others)
- ✅ No stale alerts = sync health dashboard instead
- ✅ Clear observability = see exactly what synced and what failed
- ✅ Automatic retry = exponential backoff, no manual intervention

---

## Sync Health Dashboard (New)

```
┌──────────────────────────────────────────────────────────────┐
│ Sync Health Dashboard                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Last Sync: 2026-06-07 14:30:00 UTC (5 min ago)             │
│  Status: ✅ SUCCESS (all tables synced)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Table              │ Status │ Rows  │ Last Sync       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ questions          │ ✅     │ 1,234 │ 5 min ago       │ │
│  │ responses          │ ✅     │ 5,678 │ 5 min ago       │ │
│  │ contacts           │ ✅     │ 234   │ 5 min ago       │ │
│  │ systems            │ ✅     │ 89    │ 5 min ago       │ │
│  │ taskDefinitions    │ ✅     │ 45    │ 5 min ago       │ │
│  │ taskCompletion     │ ✅     │ 1,234 │ 5 min ago       │ │
│  │ validationResults  │ ✅     │ 567   │ 5 min ago       │ │
│  │ workflowPathways   │ ✅     │ 23    │ 5 min ago       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Recent Errors: None                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Sync Error Logging (New)

```
syncErrors table:
┌─────────────────────────────────────────────────────────────┐
│ id │ table       │ error              │ attempt │ timestamp   │
├─────────────────────────────────────────────────────────────┤
│ 1  │ contacts    │ Notion API timeout │ 1       │ 14:25:00    │
│ 2  │ contacts    │ Notion API timeout │ 2       │ 14:27:00    │
│ 3  │ contacts    │ Notion API timeout │ 3       │ 14:32:00    │
│ 4  │ systems     │ FK violation       │ 1       │ 14:30:00    │
└─────────────────────────────────────────────────────────────┘

When attempt >= 3:
  → Alert owner once
  → Go quiet until next scheduled sync
  → No spam
```

---

## Sync Retry Logic (New)

```
Failure detected in sync job
  │
  ├─ Attempt 1: Retry in 2 minutes
  │  └─ Success? → Done
  │  └─ Failure? → Continue
  │
  ├─ Attempt 2: Retry in 5 minutes
  │  └─ Success? → Done
  │  └─ Failure? → Continue
  │
  ├─ Attempt 3: Retry in 15 minutes
  │  └─ Success? → Done
  │  └─ Failure? → Continue
  │
  └─ Attempt 4+: Alert owner once, then go quiet
     └─ Next scheduled sync (30 min) will retry
```

---

**End of Diagram**
