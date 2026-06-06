# Robust Notion Sync Architecture

## Problem Statement

The current Notion → MySQL sync is brittle and loses data:

### Issue #1: Hardcoded Column Names
**Current code (notionSyncBack.ts:180-182):**
```ts
const ordersDescription = props?.["Orders Description"]?.rich_text?.[0]?.plain_text || "";
const reportsDescription = props?.["Reports Description"]?.rich_text?.[0]?.plain_text || "";
const priorsDescription = props?.["Priors Description"]?.rich_text?.[0]?.plain_text || "";
```

**Problem:**
- These columns don't exist in Notion (verified: RMCA questionnaire has no such columns)
- Code silently extracts empty strings, creates no-op rows
- When columns ARE added to Notion later, code must be updated + redeployed
- No validation that columns exist before trying to extract them

**Impact:** RMCA workflow descriptions exist in Notion but never synced to MySQL.

### Issue #2: `last_edited_time` Filter Misses Existing Rows
**Current code (notionSyncBack.ts:160-163):**
```ts
filter: {
  timestamp: "last_edited_time",
  last_edited_time: { after: since },
},
```

**Problem:**
- Only syncs rows edited AFTER `since` (default: 10 min ago)
- Rows that exist in Notion but weren't recently edited are skipped
- RMCA workflow descriptions were created in Notion but not edited after that → sync skipped them
- If sync fails for an hour, all rows edited before that hour are permanently lost

**Impact:** Data gaps when sync is stale or misses a cycle.

### Issue #3: No Schema Validation
**Current code:**
- Assumes Notion columns exist
- No logging when columns are missing
- No way to detect schema changes without manual testing

**Impact:** Silent failures, hard to debug.

### Issue #4: Incremental-Only Sync
**Current approach:**
- Every 5 minutes, query "what changed since last sync?"
- If sync fails, the lookback window is lost
- No full reconciliation to catch missed rows

**Impact:** Data loss during outages, no recovery mechanism.

---

## Solution: Dynamic, Robust Sync Architecture

### Core Principles

1. **Dynamic Column Detection** — Query Notion schema at runtime, don't hardcode column names
2. **Full Reconciliation** — Periodically compare ALL Notion rows vs MySQL (not just recent edits)
3. **Schema Validation** — Log warnings when expected columns are missing
4. **Graceful Degradation** — Skip missing columns, don't fail entire sync
5. **Fallback Logic** — If a row exists in Notion but not MySQL, sync it regardless of age

### Architecture

#### Phase 1: Dynamic Column Mapping

**Goal:** Build a runtime map of Notion columns → MySQL fields

```ts
interface ColumnMapping {
  notionPropertyName: string;
  mysqlFieldName: string;
  type: "text" | "number" | "date" | "select" | "relation";
  required: boolean;
}

async function buildColumnMapping(client: Client): Promise<ColumnMapping[]> {
  // Query Notion database schema (via pages.retrieve on a sample row)
  // Extract all property names and types
  // Return mapping of which Notion columns → MySQL fields
  
  // Example output:
  // [
  //   { notionPropertyName: "Slug", mysqlFieldName: "slug", type: "text", required: true },
  //   { notionPropertyName: "Question ID", mysqlFieldName: "questionId", type: "text", required: true },
  //   { notionPropertyName: "Answer", mysqlFieldName: "answer", type: "text", required: false },
  //   { notionPropertyName: "Orders Description", mysqlFieldName: "answer", type: "text", required: false },
  //   // ... more columns
  // ]
}

async function extractFieldsFromRow(
  page: any,
  mapping: ColumnMapping[]
): Promise<Record<string, any>> {
  const fields: Record<string, any> = {};
  
  for (const col of mapping) {
    try {
      const prop = page.properties[col.notionPropertyName];
      if (!prop) {
        if (col.required) {
          console.warn(`[sync] Missing required column: ${col.notionPropertyName}`);
        }
        continue;
      }
      
      // Extract value based on type
      const value = extractPropertyValue(prop, col.type);
      fields[col.mysqlFieldName] = value;
    } catch (error) {
      console.warn(`[sync] Failed to extract ${col.notionPropertyName}:`, error);
    }
  }
  
  return fields;
}

function extractPropertyValue(prop: any, type: string): any {
  switch (type) {
    case "text":
      return prop.rich_text?.[0]?.plain_text || "";
    case "select":
      return prop.select?.name || "";
    case "number":
      return prop.number ?? null;
    case "date":
      return prop.date?.start || null;
    case "relation":
      return prop.relation?.map((r: any) => r.id) || [];
    default:
      return null;
  }
}
```

#### Phase 2: Full Reconciliation

**Goal:** Periodically compare ALL Notion rows vs MySQL to catch missed data

```ts
async function fullReconciliation(client: Client): Promise<{
  missingInMysql: Array<{ pageId: string; slug: string; questionId: string }>;
  staleSyncedRows: Array<{ orgId: number; questionId: string; lastSyncedAt: Date; lastEditedInNotion: Date }>;
}> {
  // Query ALL rows from Notion (paginate through all)
  // For each row, check if it exists in MySQL with matching data
  // Return list of:
  //   - Rows in Notion but not MySQL (data loss)
  //   - Rows in MySQL but not updated since Notion was edited (stale)
  
  const missingInMysql: Array<{ pageId: string; slug: string; questionId: string }> = [];
  const staleSyncedRows: Array<{ orgId: number; questionId: string; lastSyncedAt: Date; lastEditedInNotion: Date }> = [];
  
  let cursor: string | undefined = undefined;
  do {
    const response = await (client as any).dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: cursor,
    });
    
    for (const page of response.results) {
      const fields = await extractFieldsFromRow(page, columnMapping);
      const { slug, questionId, answer } = fields;
      
      if (!slug || !questionId) continue;
      
      const orgId = await getOrgIdBySlug(slug);
      if (!orgId) continue;
      
      // Check if row exists in MySQL
      const mysqlRow = await getMySqlAnswer(orgId, questionId);
      
      if (!mysqlRow) {
        // Data loss: exists in Notion but not MySQL
        missingInMysql.push({ pageId: page.id, slug, questionId });
      } else if (mysqlRow !== answer) {
        // Stale: MySQL data doesn't match Notion
        staleSyncedRows.push({
          orgId,
          questionId,
          lastSyncedAt: new Date(page.last_edited_time),
          lastEditedInNotion: new Date(page.last_edited_time),
        });
      }
    }
    
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  
  return { missingInMysql, staleSyncedRows };
}
```

#### Phase 3: Hybrid Sync Strategy

**Goal:** Combine incremental (fast) + full reconciliation (thorough)

```ts
async function runNotionSyncBack(): Promise<SyncResult> {
  const client = getSyncClient();
  
  // Step 1: Build dynamic column mapping
  const columnMapping = await buildColumnMapping(client);
  
  // Step 2: Incremental sync (fast, recent changes only)
  const config = await readSyncConfig(client);
  const since = config.lastSuccessfulSync || new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const changedRows = await fetchChangedRows(client, since, columnMapping);
  for (const row of changedRows) {
    await upsertAnswer(row.orgId, row.questionId, row.answer);
  }
  
  // Step 3: Full reconciliation (every hour, or on-demand)
  const shouldReconcile = shouldRunReconciliation(config);
  if (shouldReconcile) {
    const { missingInMysql, staleSyncedRows } = await fullReconciliation(client);
    
    // Sync missing rows
    for (const row of missingInMysql) {
      const fields = await getNotionRowFields(client, row.pageId, columnMapping);
      await upsertAnswer(row.orgId, row.questionId, fields.answer);
    }
    
    // Log stale rows for investigation
    if (staleSyncedRows.length > 0) {
      console.warn(`[sync] Found ${staleSyncedRows.length} stale rows, reconciling...`);
      // Upsert stale rows to bring MySQL in sync
    }
  }
  
  // Update config
  await updateSyncConfig(client, {
    lastSuccessfulSync: new Date().toISOString(),
    lastReconciliation: shouldReconcile ? new Date().toISOString() : undefined,
    consecutiveFailures: 0,
  });
  
  return result;
}
```

---

## Implementation Phases

### Phase 1: Dynamic Column Detection
- [ ] Add `buildColumnMapping()` function
- [ ] Add `extractFieldsFromRow()` function
- [ ] Add `extractPropertyValue()` helper
- [ ] Update `fetchChangedRows()` to use dynamic mapping
- [ ] Write vitest tests (5 tests)

### Phase 2: Full Reconciliation
- [ ] Add `fullReconciliation()` function
- [ ] Add reconciliation schedule (hourly)
- [ ] Add reconciliation results to Sync Log
- [ ] Write vitest tests (8 tests)

### Phase 3: Hybrid Sync
- [ ] Update `runNotionSyncBack()` to call both incremental + reconciliation
- [ ] Update Sync Config schema to track last reconciliation time
- [ ] Add reconciliation flag to Sync Log
- [ ] Write integration tests (5 tests)

### Phase 4: Schema Validation
- [ ] Add logging for missing required columns
- [ ] Add schema validation report to Sync Log
- [ ] Add admin endpoint to view schema validation results
- [ ] Write vitest tests (3 tests)

### Phase 5: Testing & Verification
- [ ] Test with RMCA workflow descriptions (should now sync)
- [ ] Test with old rows (should be caught by reconciliation)
- [ ] Test with new Notion columns (should be auto-detected)
- [ ] Verify all 285 tests still pass

---

## Expected Outcomes

1. **No more hardcoded column names** — Dynamic detection handles schema changes
2. **No more data loss** — Full reconciliation catches missed rows
3. **Better observability** — Schema validation logs help debug issues
4. **Graceful degradation** — Missing columns don't break entire sync
5. **RMCA workflow descriptions sync correctly** — Old rows are caught by reconciliation

---

## Risk Mitigation

- **Performance:** Full reconciliation runs hourly (not every 5 min), so no impact on sync speed
- **Backward compatibility:** Incremental sync still works as before, reconciliation is additive
- **Testing:** Comprehensive vitest coverage before deploying to production
- **Rollback:** If issues arise, can disable reconciliation via Sync Config page
