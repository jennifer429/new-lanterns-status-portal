# Sync Architecture: Current State & Proposed Redesign

**Last Updated:** June 7, 2026  
**Status:** Diagnosis Complete — Ready for Redesign

---

## Executive Summary

**Current Problem:** 10 cron jobs, stale alerts, unpredictable failures, loss of confidence in data consistency.

**Root Cause:** MySQL is treated as a source of truth while also being synced from Notion. This creates complexity, race conditions, and partial failures.

**Proposed Solution:** Demote MySQL to a cache. Notion is the single source of truth. Sync is simple, observable, and reliable.

---

## Part 1: Current Architecture (What's Broken)

### Data Flow

```
Claude (AI Agent)
  ↓ (writes 99% of data)
Notion (Source of Truth?)
  ↓ (10 cron jobs, every 5 min)
MySQL (Also treated as Source of Truth?)
  ↓ (live queries)
Portal (User Interface)
  ↓ (users edit)
Notion (back-sync, sometimes)
```

### The Problem

1. **Two sources of truth** — Notion AND MySQL. When they disagree, which is right?
2. **10 cron jobs with complex logic:**
   - `notionSyncBack` — Questionnaire responses (every 5 min)
   - `notionSyncContacts` — Contacts & Systems (every 5 min, offset +2)
   - `notionSyncTaskDefs` — Task Definitions (every 5 min, offset +4)
   - `notionSyncBackTasks` — Task Completions & Validation (every 5 min, offset +3)
   - `processRetryQueue` — Retry failed syncs (every 5 min, offset +1)
   - `runReconciliation` — Find drift between MySQL and Notion (hourly)
   - `runDataQualityCheck` — Validate constraints (daily at 2:15 AM UTC)
   - `writeHourlySyncLog` — Log failures to Notion (hourly)
   - `writeDailySummary` — Proof of life (daily at midnight UTC)
   - `purgeSyncLog` — Clean up old logs (every 3 days)

3. **Partial failures are silent** — If Task Definitions sync fails but Contacts succeeds, you have inconsistent data.

4. **Stale alerts are noise** — 15-minute threshold fires constantly due to:
   - Database locks
   - Notion API timeouts
   - Cron job missing its window
   - Server under load

5. **No clear observability** — When something breaks:
   - Is it a Notion API issue?
   - Is it a MySQL lock?
   - Is it a network timeout?
   - Is it a bug in the sync logic?
   - You have to dig through logs to find out.

### Current Sync Checkpoint Table

| Table | Source | Synced From | Frequency | Failure Mode |
|-------|--------|-------------|-----------|--------------|
| `questions` | Notion | Questionnaire DB | Every 5 min | Partial (some Q's sync, others fail) |
| `responses` | Notion | Questionnaire DB | Every 5 min | Partial (some responses sync, others fail) |
| `contacts` | Notion | Contacts DB | Every 5 min | Partial (some contacts sync, others fail) |
| `systems` | Notion | Systems DB | Every 5 min | Partial (some systems sync, others fail) |
| `taskDefinitions` | Notion | Task Definitions DB | Every 5 min | Partial (some tasks sync, others fail) |
| `taskCompletion` | Notion | Task Completions DB | Every 5 min | Partial (some completions sync, others fail) |
| `validationResults` | Notion | Validation Results DB | Every 5 min | Partial (some results sync, others fail) |
| `workflowPathways` | Notion | Workflow Pathways DB | Every 5 min | Partial (some pathways sync, others fail) |
| `templateTaskCompletion` | Portal | N/A (local only) | N/A | N/A |
| `orgCustomTasks` | Portal | N/A (local only) | N/A | N/A |

---

## Part 2: Proposed Architecture (What Will Work)

### Core Principle: Single Source of Truth

**Notion is the source of truth. MySQL is a cache.**

```
Claude (AI Agent)
  ↓ (writes 99% of data)
Notion (SINGLE SOURCE OF TRUTH)
  ↓ (simple sync, every 30 min)
MySQL (Cache Layer)
  ↓ (live queries, fast)
Portal (User Interface)
  ↓ (users edit)
Notion (direct write)
  ↓ (sync back on next cycle)
MySQL (cache invalidated)
```

### New Sync Strategy

#### 1. **Sync-on-Read** (immediate, on-demand)

When a user opens a page:
- Check if MySQL cache is fresh (< 5 min old)
- If fresh → serve from MySQL (fast)
- If stale → fetch from Notion in background, serve cached data immediately
- User never sees loading spinner

**Implementation:**
```typescript
// In router, when fetching data:
const cachedData = await db.select().from(questions).where(...);
const cacheAge = Date.now() - (cachedData[0]?.syncedAt || 0);

if (cacheAge > 5 * 60 * 1000) {
  // Stale — refresh in background
  refreshFromNotionInBackground('questions');
}

return cachedData; // Serve immediately
```

#### 2. **Background Sync** (every 30 min, not 5 min)

Single consolidated job that:
- Pulls all Notion tables in one batch
- Updates MySQL with `ON DUPLICATE KEY UPDATE`
- Fails per-table, not all-or-nothing
- Logs clearly to `syncErrors` table

**Implementation:**
```typescript
async function syncAllFromNotion() {
  const results = {
    questions: await syncTable('questions', notionQuestionsDB),
    responses: await syncTable('responses', notionResponsesDB),
    contacts: await syncTable('contacts', notionContactsDB),
    systems: await syncTable('systems', notionSystemsDB),
    taskDefinitions: await syncTable('taskDefinitions', notionTaskDefsDB),
    // ... etc
  };

  // Log failures, not successes
  for (const [table, result] of Object.entries(results)) {
    if (result.failed > 0) {
      await logSyncError(table, result.errors);
    }
  }

  return results;
}
```

#### 3. **Automatic Retry with Exponential Backoff**

Failed sync? Retry automatically:
- 1st failure → retry in 2 min
- 2nd failure → retry in 5 min
- 3rd failure → retry in 15 min
- 4th+ failure → alert owner once, then go quiet until next scheduled cycle

**Implementation:**
```typescript
async function retryFailedSync(table: string, attempt: number) {
  const backoffMs = [2, 5, 15, 60][Math.min(attempt, 3)] * 60 * 1000;
  
  setTimeout(async () => {
    const result = await syncTable(table, notionDB);
    if (result.failed > 0 && attempt >= 3) {
      await notifyOwner({
        title: `Sync failed for ${table} after 3 retries`,
        content: `Last error: ${result.errors[0]}`
      });
    }
  }, backoffMs);
}
```

#### 4. **Sync Health Dashboard** (new)

Simple observability:
- Last sync time for each table
- Success/failure count
- Oldest unsynced row (staleness indicator)
- Error details (not buried in logs)

**Implementation:**
```typescript
// New table: syncHealth
export const syncHealth = mysqlTable("syncHealth", {
  id: int("id").autoincrement().primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncStatus: mysqlEnum("lastSyncStatus", ["success", "partial", "failed"]),
  rowsSynced: int("rowsSynced"),
  rowsFailed: int("rowsFailed"),
  errorMessage: text("errorMessage"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

---

## Part 3: Table Sync Mapping

### Tables Synced from Notion

| Table | Notion Database | Sync Frequency | Failure Mode | Notes |
|-------|-----------------|-----------------|--------------|-------|
| `questions` | Questionnaire DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `responses` | Questionnaire DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `contacts` | Contacts DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `systems` | Systems DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `taskDefinitions` | Task Definitions DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `taskCompletion` | Task Completions DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `validationResults` | Validation Results DB | 30 min | Per-table (isolated) | Claude writes, humans read |
| `workflowPathways` | Workflow Pathways DB | 30 min | Per-table (isolated) | Claude writes, humans read |

### Tables NOT Synced (Local Only)

| Table | Source | Purpose |
|-------|--------|---------|
| `templateTaskCompletion` | Portal | Track which template tasks user completed (not synced to Notion) |
| `orgCustomTasks` | Portal | Custom tasks created by admins (not synced to Notion) |
| `orgNotes` | Portal | Internal notes (not synced to Notion) |
| `activityFeed` | Portal | Audit trail (not synced to Notion) |
| `syncHealth` | Portal | Sync observability (not synced to Notion) |
| `syncErrors` | Portal | Error logging (not synced to Notion) |

---

## Part 4: Implementation Roadmap

### Phase 1: Add Sync Health Observability (1 day)

- [ ] Create `syncHealth` table
- [ ] Create `syncErrors` table
- [ ] Add sync health router endpoint
- [ ] Add sync health dashboard component

### Phase 2: Implement Sync-on-Read (2 days)

- [ ] Add `syncedAt` timestamp to all synced tables
- [ ] Modify all routers to check cache age
- [ ] Add background refresh logic
- [ ] Test with live data

### Phase 3: Consolidate Sync Jobs (2 days)

- [ ] Merge 10 cron jobs into 1
- [ ] Implement per-table error handling
- [ ] Implement retry logic with exponential backoff
- [ ] Remove stale alerts (replace with dashboard)

### Phase 4: Testing & Monitoring (2 days)

- [ ] Test partial failures (one table fails, others succeed)
- [ ] Test retry logic (simulate network timeouts)
- [ ] Monitor sync health dashboard for 1 week
- [ ] Verify data consistency (MySQL vs Notion)

---

## Part 5: Success Criteria

When this redesign is complete, you should be able to say:

- ✅ **"I trust the system"** — Data is always fresh or explicitly marked stale
- ✅ **"I know when something breaks"** — Sync health dashboard shows red, not buried in logs
- ✅ **"It fixes itself"** — Failed syncs retry automatically
- ✅ **"I don't have to babysit it"** — No manual intervention needed
- ✅ **"Updates are fast"** — Users see Claude's changes within 30 min (or immediately on page load)

---

## Part 6: Migration Plan

### Step 1: Deploy new tables (no downtime)
```sql
CREATE TABLE syncHealth (...);
CREATE TABLE syncErrors (...);
ALTER TABLE questions ADD COLUMN syncedAt TIMESTAMP;
ALTER TABLE responses ADD COLUMN syncedAt TIMESTAMP;
-- ... repeat for all synced tables
```

### Step 2: Deploy new sync logic (run in parallel with old)
- Keep 10 old cron jobs running
- Deploy new 1-job sync logic
- Monitor both for 1 day
- Verify data consistency

### Step 3: Switch over (1 minute downtime)
- Stop old cron jobs
- Start new cron job
- Verify sync health dashboard

### Step 4: Cleanup (next day)
- Remove old sync code
- Remove old cron jobs
- Archive old sync logs

---

## Questions for You

1. **Does this architecture make sense?** (Single source of truth, MySQL as cache)
2. **Is 30-minute sync frequency acceptable?** (Or should it be 15 min, 10 min, 5 min?)
3. **Should we add a "Sync Now" button for emergencies?** (Or trust the system?)
4. **Should sync health be visible to all users or just admins?** (Transparency vs noise)

---

## Appendix: Current Cron Job Details

### Job 1: Questionnaire Sync (every 5 min)
- **What:** Pulls all questions & responses from Notion Questionnaire DB
- **Where:** `server/notionSyncBack.ts`
- **Failure mode:** Partial (some rows sync, others fail)
- **Retry:** Via `notionRetryQueue` table (manual retry)

### Job 2: Contacts/Systems Sync (every 5 min, offset +2)
- **What:** Pulls all contacts & systems from Notion
- **Where:** `server/notionSyncContacts.ts`
- **Failure mode:** Partial (some rows sync, others fail)
- **Retry:** Via `notionRetryQueue` table (manual retry)

### Job 3: Task Definitions Sync (every 5 min, offset +4)
- **What:** Pulls all task definitions from Notion Task Definitions DB
- **Where:** `server/notionSyncTaskDefs.ts`
- **Failure mode:** Partial (some rows sync, others fail)
- **Retry:** Via `notionRetryQueue` table (manual retry)

### Job 4: Task Completions & Validation Sync (every 5 min, offset +3)
- **What:** Pulls all task completions & validation results from Notion
- **Where:** `server/notionSyncBackTasks.ts`
- **Failure mode:** Partial (some rows sync, others fail)
- **Retry:** Via `notionRetryQueue` table (manual retry)

### Job 5: Retry Queue Processor (every 5 min, offset +1)
- **What:** Retries rows that failed in previous sync
- **Where:** `server/notionRetryQueue.ts`
- **Failure mode:** Partial (some retries succeed, others fail again)
- **Retry:** Re-queued for next cycle

### Job 6: Reconciliation (hourly)
- **What:** Finds rows with >10 min drift between MySQL and Notion
- **Where:** `server/notionReconciliation.ts`
- **Failure mode:** Logs to Notion Sync Log, doesn't fix anything
- **Retry:** Manual (you have to investigate and fix)

### Job 7: Data Quality Check (daily at 2:15 AM UTC)
- **What:** Validates constraints (FK violations, orphaned rows, etc.)
- **Where:** `server/dataQualityCheck.ts`
- **Failure mode:** Logs to Notion Sync Log, alerts owner
- **Retry:** Manual (you have to investigate and fix)

### Job 8: Hourly Sync Log Flush (hourly)
- **What:** Aggregates stats from all jobs, writes to Notion Sync Log
- **Where:** `server/cron.ts`
- **Failure mode:** Logs are lost if write fails
- **Retry:** Manual (you have to check logs)

### Job 9: Daily Summary (daily at midnight UTC)
- **What:** Proof of life — writes summary to Notion Sync Log
- **Where:** `server/cron.ts`
- **Failure mode:** Summary is lost if write fails
- **Retry:** Manual (you have to check logs)

### Job 10: Sync Log Purge (every 3 days at 3:00 AM UTC)
- **What:** Archives sync log entries older than 7 days
- **Where:** `server/cron.ts`
- **Failure mode:** Old logs accumulate (not critical)
- **Retry:** Manual (you have to clean up)

---

**End of Document**
