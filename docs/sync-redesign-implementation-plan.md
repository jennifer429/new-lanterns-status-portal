# Sync Redesign Implementation Plan for Claude

**Goal:** Replace the broken 10-cron-job sync system with a simple, reliable, observable 1-job sync.

**Current State:** 20-30% success rate, silent failures, 4+ hour outages go undetected.

**Target State:** >95% success rate, clear observability, automatic retry, per-table isolation.

---

## Phase 1: Add Observability Infrastructure (1 day)

### What to do:
1. Create two new tables in `drizzle/schema.ts`:
   - `syncHealth` — tracks last sync time, status, row counts for each table
   - `syncErrors` — logs all sync failures with error messages and retry attempts

2. Create a new router endpoint `trpc.admin.getSyncHealth()` that returns:
   ```typescript
   {
     lastSyncAt: Date,
     overallStatus: 'success' | 'partial' | 'failed',
     tables: [
       {
         name: 'questions',
         status: 'success' | 'partial' | 'failed',
         rowsSynced: number,
         rowsFailed: number,
         lastSyncAt: Date,
         errorMessage?: string
       }
     ],
     recentErrors: [
       { table, error, attempt, timestamp }
     ]
   }
   ```

3. Create a new admin dashboard component `SyncHealthDashboard.tsx` that displays:
   - Overall sync status (green/yellow/red)
   - Last sync time
   - Per-table status with row counts
   - Recent errors (last 10)

### Why first:
- Gives you immediate visibility into what's working/broken
- Makes it easy to test the new sync logic
- Provides a foundation for the new cron job to write to

### Success criteria:
- Dashboard shows all 8 synced tables
- You can see when each table last synced
- You can see errors for each table
- No guessing about sync health

---

## Phase 2: Build New Consolidated Sync Job (1 day)

### What to do:
1. Create a new file `server/notionSyncConsolidated.ts` with a single function:
   ```typescript
   async function syncAllFromNotionConsolidated(): Promise<{
     tables: Record<string, {
       status: 'success' | 'partial' | 'failed',
       rowsFetched: number,
       rowsUpdated: number,
       rowsFailed: number,
       error?: string
     }>
   }>
   ```

2. This function should:
   - Loop through each synced table (questions, responses, contacts, systems, taskDefinitions, taskCompletion, validationResults, workflowPathways)
   - For each table:
     - Fetch all rows from Notion
     - Upsert into MySQL with `ON DUPLICATE KEY UPDATE`
     - Catch errors per-table (don't let one failure block others)
     - Log results to `syncHealth` and `syncErrors` tables
   - Return results for all tables

3. Key implementation details:
   - **Per-table isolation:** If contacts sync fails, tasks still sync
   - **ON DUPLICATE KEY UPDATE:** Prevents race conditions
   - **Error logging:** Every failure logged to `syncErrors` table with timestamp and attempt count
   - **Timestamp tracking:** Add `syncedAt` timestamp to each synced table so you can see staleness

### Why:
- Replaces 10 fragile cron jobs with 1 solid job
- Failures are isolated (one table failing doesn't block others)
- Clear error logging (not buried in Notion Sync Log)
- Easy to debug (all logic in one place)

### Success criteria:
- New job runs without errors
- All 8 tables sync successfully
- Dashboard shows all tables as "success"
- No failures in `syncErrors` table

---

## Phase 3: Replace Cron Job (1 day)

### What to do:
1. In `server/cron.ts`, replace all 10 cron jobs with 1:
   ```typescript
   // Old: 10 jobs (questionnaire, contacts, systems, tasks, validation, retry, reconciliation, etc.)
   // New: 1 job
   cron.schedule("*/30 * * * *", async () => {
     const start = Date.now();
     try {
       const result = await syncAllFromNotionConsolidated();
       const durationMs = Date.now() - start;
       
       // Update syncHealth table
       await updateSyncHealth(result, durationMs);
       
       // Alert owner if critical failures
       const criticalFailures = Object.entries(result.tables)
         .filter(([_, r]) => r.status === 'failed')
         .map(([table, _]) => table);
       
       if (criticalFailures.length > 0) {
         await notifyOwner({
           title: `Sync failed for: ${criticalFailures.join(', ')}`,
           content: `Check sync health dashboard for details.`
         });
       }
     } catch (error) {
       console.error("[cron] Consolidated sync failed:", error);
       await notifyOwner({
         title: "Sync job crashed",
         content: `Error: ${error.message}`
       });
     }
   });
   ```

2. Remove all 10 old cron jobs:
   - `notionSyncBack` (questionnaire)
   - `notionSyncContacts` (contacts/systems)
   - `notionSyncTaskDefs` (task definitions)
   - `notionSyncBackTasks` (task completions & validation)
   - `processRetryQueue` (retry logic)
   - `runReconciliation` (reconciliation)
   - `runDataQualityCheck` (data quality)
   - `writeHourlySyncLog` (hourly flush)
   - `writeDailySummary` (daily summary)
   - `purgeSyncLog` (sync log purge)

3. Keep only:
   - Startup recovery (runs once at server start)
   - New consolidated sync (every 30 min)

### Why:
- Simpler cron registry (easier to debug)
- Fewer failure points
- Clearer alerting (one alert per failure, not spam)
- Faster sync (30 min instead of 5 min, but more reliable)

### Success criteria:
- Cron job runs every 30 minutes
- Dashboard updates after each run
- No errors in logs
- All tables show "success"

---

## Phase 4: Add Automatic Retry Logic (1 day)

### What to do:
1. When a table sync fails, automatically retry with exponential backoff:
   ```typescript
   async function retryFailedTableSync(table: string, attempt: number) {
     const backoffMs = [2, 5, 15, 60][Math.min(attempt, 3)] * 60 * 1000;
     
     setTimeout(async () => {
       try {
         const result = await syncSingleTable(table);
         if (result.status === 'success') {
           console.log(`[sync-retry] ${table} recovered after ${attempt} attempts`);
           await updateSyncHealth({ [table]: result });
         } else if (attempt < 3) {
           await retryFailedTableSync(table, attempt + 1);
         } else {
           console.error(`[sync-retry] ${table} failed after 3 retries`);
           // Alert owner on 3rd failure
           await notifyOwner({
             title: `Sync retry exhausted for ${table}`,
             content: `Failed 3 times. Will retry on next scheduled sync (30 min).`
           });
         }
       } catch (error) {
         if (attempt < 3) {
           await retryFailedTableSync(table, attempt + 1);
         }
       }
     }, backoffMs);
   }
   ```

2. Integrate into the consolidated sync job:
   - When a table fails, call `retryFailedTableSync(table, 1)`
   - Don't wait for retry (fire and forget)
   - Log all retry attempts to `syncErrors` table

### Why:
- Failed syncs recover automatically
- No manual intervention needed
- Exponential backoff prevents hammering Notion API
- Clear retry history in `syncErrors` table

### Success criteria:
- When a table sync fails, it retries automatically
- Retries happen at 2 min, 5 min, 15 min intervals
- After 3 failures, owner gets one alert
- Dashboard shows retry status

---

## Phase 5: Testing & Validation (2 days)

### What to do:
1. **Simulate failures:**
   - Block Notion API (to test timeout handling)
   - Corrupt a row in MySQL (to test FK violations)
   - Kill the database connection (to test recovery)
   - Verify each failure is caught, logged, and retried

2. **Monitor for 24 hours:**
   - Run the new sync every 30 min
   - Verify all tables sync successfully
   - Check dashboard for accuracy
   - Verify no false alerts

3. **Verify data consistency:**
   - Pick 5 random rows from each synced table
   - Compare MySQL vs Notion
   - Verify they match

4. **Load test:**
   - Sync with 10,000+ rows
   - Verify performance (should be < 30 sec per table)
   - Verify no memory leaks

### Success criteria:
- 24 hours of 100% successful syncs
- All data matches between MySQL and Notion
- Dashboard is accurate
- No false alerts
- Performance is acceptable

---

## Phase 6: Deployment & Cleanup (1 day)

### What to do:
1. **Deploy new code:**
   - Merge to main
   - Deploy to production
   - Monitor for 1 hour

2. **Verify in production:**
   - Check sync health dashboard
   - Verify all tables synced
   - Check logs for errors

3. **Cleanup:**
   - Remove old sync files:
     - `server/notionSyncBack.ts`
     - `server/notionSyncContacts.ts`
     - `server/notionSyncTaskDefs.ts`
     - `server/notionSyncBackTasks.ts`
     - `server/notionRetryQueue.ts`
     - `server/notionReconciliation.ts`
     - `server/dataQualityCheck.ts`
   - Remove old Notion Sync Log writes
   - Archive old sync logs

4. **Document:**
   - Update `docs/sync-architecture.md` with new design
   - Add runbook for debugging sync issues
   - Add runbook for manual recovery

### Success criteria:
- Production is running new sync
- No errors in logs
- Dashboard shows all tables synced
- Old code is removed
- Documentation is updated

---

## Implementation Order

1. **Phase 1** (1 day) — Add observability (syncHealth, syncErrors tables, dashboard)
2. **Phase 2** (1 day) — Build consolidated sync job
3. **Phase 3** (1 day) — Replace cron jobs
4. **Phase 4** (1 day) — Add retry logic
5. **Phase 5** (2 days) — Test & validate
6. **Phase 6** (1 day) — Deploy & cleanup

**Total: 7 days**

---

## Key Decisions for Claude

### 1. Sync Frequency
- **Current:** Every 5 minutes (10 jobs)
- **Proposed:** Every 30 minutes (1 job)
- **Rationale:** Simpler, more reliable, still fresh enough for MySQL cache model

### 2. Failure Handling
- **Current:** Partial failures (some rows sync, others fail)
- **Proposed:** Per-table isolation (one table failing doesn't block others)
- **Rationale:** Better reliability, clearer observability

### 3. Alerting
- **Current:** Stale alerts every 15 min (noise), silent failures
- **Proposed:** One alert per critical failure, dashboard for visibility
- **Rationale:** Signal over noise, clear observability

### 4. Retry Strategy
- **Current:** Manual retry queue (you have to babysit it)
- **Proposed:** Automatic exponential backoff (2 min, 5 min, 15 min, then alert)
- **Rationale:** Self-healing, no manual intervention

### 5. Data Model
- **Current:** MySQL treated as source of truth (complex sync logic)
- **Proposed:** Notion as source of truth, MySQL as cache (simple sync logic)
- **Rationale:** Single source of truth, simpler architecture

---

## Success Metrics

When Phase 6 is complete, you should be able to say:

✅ **"I trust the system"** — Sync health dashboard shows green, I know exactly what's syncing

✅ **"I know when something breaks"** — One clear alert per failure, not buried in logs

✅ **"It fixes itself"** — Failed syncs retry automatically, I don't have to babysit it

✅ **"I don't lose data"** — Notion is the source of truth, MySQL is just a cache

✅ **"Updates are fast"** — Portal reads from MySQL (fast), syncs every 30 min (reliable)

---

## Questions for Claude

1. **Sync frequency:** Is 30 minutes acceptable, or should it be 15 min, 10 min, or 5 min?
2. **Alert threshold:** Should we alert on first failure, or after 3 retries?
3. **Notion Sync Log:** Should we keep writing to Notion Sync Log, or just use `syncErrors` table?
4. **Data quality checks:** Should we keep the daily data quality check, or remove it?

---

**End of Plan**
