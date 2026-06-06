# Robust Notion Sync Implementation Guide for Claude

## Overview

This guide breaks down the 5-phase refactoring of `server/notionSyncBack.ts` into clear, testable chunks. Each phase builds on the previous one, with comprehensive vitest tests at each step.

**Goal:** Make the sync layer robust, self-healing, and dynamic — supporting schema changes without code updates.

---

## Phase 1: Dynamic Column Detection

### What This Does
Instead of hardcoding column names like `"Orders Description"`, the sync will query Notion's schema at runtime and build a dynamic mapping. This allows new columns to be added to Notion without code changes.

### Files to Modify
- `server/notionSyncBack.ts` — Add 3 new functions
- `server/notionSyncBack.test.ts` — Add 5 vitest tests

### Step 1.1: Add Column Mapping Types

Add to `server/notionSyncBack.ts` (after imports, before `getSyncClient()`):

```ts
/**
 * Runtime mapping of Notion properties → MySQL fields
 */
interface ColumnMapping {
  notionPropertyName: string;
  mysqlFieldName: string;
  type: "text" | "number" | "date" | "select" | "relation" | "rich_text";
  required: boolean;
  description?: string;
}

/**
 * Known column mappings for the questionnaire database.
 * This is a fallback; buildColumnMapping() will auto-detect at runtime.
 */
const KNOWN_COLUMNS: ColumnMapping[] = [
  { notionPropertyName: "Slug", mysqlFieldName: "slug", type: "text", required: true, description: "Organization slug" },
  { notionPropertyName: "Question ID", mysqlFieldName: "questionId", type: "text", required: true, description: "Question identifier" },
  { notionPropertyName: "Answer", mysqlFieldName: "answer", type: "rich_text", required: false, description: "Primary answer" },
  // Note: Do NOT hardcode workflow description columns here. They will be auto-detected.
];
```

### Step 1.2: Add buildColumnMapping() Function

Add after the types:

```ts
/**
 * Query Notion database schema by fetching a sample row and extracting all properties.
 * This allows new columns to be added to Notion without code changes.
 */
async function buildColumnMapping(client: Client): Promise<ColumnMapping[]> {
  if (!QUESTIONNAIRE_DATA_SOURCE_ID) return KNOWN_COLUMNS;

  try {
    // Fetch one row to inspect all properties
    const response: any = await (client as any).dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      page_size: 1,
    });

    if (!response.results || response.results.length === 0) {
      console.warn("[sync] No sample row found, using known columns only");
      return KNOWN_COLUMNS;
    }

    const samplePage = response.results[0];
    const detectedColumns: ColumnMapping[] = [];

    // Inspect all properties on the sample row
    for (const [propName, propValue] of Object.entries(samplePage.properties || {})) {
      // Determine property type from Notion's type field
      const notionType = (propValue as any).type;
      let mappedType: ColumnMapping["type"] = "text";

      switch (notionType) {
        case "rich_text":
          mappedType = "rich_text";
          break;
        case "number":
          mappedType = "number";
          break;
        case "date":
          mappedType = "date";
          break;
        case "select":
          mappedType = "select";
          break;
        case "relation":
          mappedType = "relation";
          break;
        default:
          mappedType = "text";
      }

      // Map Notion property name to MySQL field name (snake_case, lowercase)
      const mysqlFieldName = propName
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      // Determine if required (Slug and Question ID are always required)
      const required = ["slug", "question_id", "question id"].some(
        (name) => mysqlFieldName === name || propName.toLowerCase().includes(name)
      );

      detectedColumns.push({
        notionPropertyName: propName,
        mysqlFieldName,
        type: mappedType,
        required,
        description: `Auto-detected from Notion schema`,
      });
    }

    console.log(`[sync] Detected ${detectedColumns.length} columns from Notion schema`);
    return detectedColumns;
  } catch (error) {
    console.warn("[sync] Failed to auto-detect schema, using known columns:", error);
    return KNOWN_COLUMNS;
  }
}
```

### Step 1.3: Add extractPropertyValue() Helper

Add after `buildColumnMapping()`:

```ts
/**
 * Extract a value from a Notion property based on its type.
 * Handles all Notion property types gracefully.
 */
function extractPropertyValue(prop: any, type: ColumnMapping["type"]): any {
  if (!prop) return null;

  try {
    switch (type) {
      case "rich_text":
        return prop.rich_text?.[0]?.plain_text || "";
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
  } catch (error) {
    console.warn(`[sync] Failed to extract property value for type ${type}:`, error);
    return null;
  }
}
```

### Step 1.4: Add extractFieldsFromRow() Function

Add after `extractPropertyValue()`:

```ts
/**
 * Extract all mapped fields from a Notion row using the column mapping.
 * Returns an object with MySQL field names as keys.
 */
async function extractFieldsFromRow(
  page: any,
  mapping: ColumnMapping[]
): Promise<Record<string, any>> {
  const fields: Record<string, any> = {};
  const missingRequired: string[] = [];

  for (const col of mapping) {
    try {
      const prop = page.properties?.[col.notionPropertyName];

      if (!prop) {
        if (col.required) {
          missingRequired.push(col.notionPropertyName);
        }
        continue;
      }

      const value = extractPropertyValue(prop, col.type);
      fields[col.mysqlFieldName] = value;
    } catch (error) {
      console.warn(
        `[sync] Failed to extract ${col.notionPropertyName} (${col.type}):`,
        error
      );
    }
  }

  // Log schema validation warnings
  if (missingRequired.length > 0) {
    console.warn(
      `[sync] Row ${page.id} missing required columns: ${missingRequired.join(", ")}`
    );
  }

  return fields;
}
```

### Step 1.5: Update fetchChangedRows() to Use Dynamic Mapping

Replace the current `fetchChangedRows()` function with:

```ts
/**
 * Query Notion for questionnaire rows edited since a given timestamp.
 * Uses dynamic column mapping to extract fields.
 */
async function fetchChangedRows(
  client: Client,
  since: string,
  mapping: ColumnMapping[]
): Promise<Array<{ pageId: string; slug: string; questionId: string; answer: string; lastEdited: string }>> {
  if (!QUESTIONNAIRE_DATA_SOURCE_ID) return [];

  const results: Array<{ pageId: string; slug: string; questionId: string; answer: string; lastEdited: string }> = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const queryParams: any = {
        data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: { after: since },
        },
        page_size: 100,
      };
      if (cursor) queryParams.start_cursor = cursor;

      const response: any = await (client as any).dataSources.query(queryParams);

      for (const page of response.results) {
        // Extract fields using dynamic mapping
        const fields = await extractFieldsFromRow(page, mapping);

        const slug = fields.slug || fields.institution_group || "";
        const questionId = fields.question_id || fields.questionid || "";
        const answer = fields.answer || "";
        const lastEdited = page.last_edited_time || "";

        if (slug && questionId) {
          results.push({ pageId: page.id, slug, questionId, answer, lastEdited });
        }
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[notion-sync] Error fetching changed rows:", error);
    throw error;
  }

  return results;
}
```

### Step 1.6: Update runNotionSyncBack() to Build Mapping

Update the main function to build the mapping at the start:

```ts
export async function runNotionSyncBack(): Promise<SyncResult> {
  const startTime = Date.now();
  const client = getSyncClient();

  if (!client || !QUESTIONNAIRE_DATA_SOURCE_ID) {
    // ... existing error handling ...
  }

  // NEW: Build dynamic column mapping
  const columnMapping = await buildColumnMapping(client);
  console.log(`[sync] Using ${columnMapping.length} columns: ${columnMapping.map(c => c.notionPropertyName).join(", ")}`);

  // ... rest of existing code ...
  
  // Update the call to fetchChangedRows to pass mapping:
  const changedRows = await fetchChangedRows(client, since, columnMapping);
  
  // ... rest of existing code ...
}
```

### Step 1.7: Write Vitest Tests

Create `server/notionSyncBack.test.ts` (or add to existing file):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildColumnMapping, extractPropertyValue, extractFieldsFromRow } from "./notionSyncBack";

describe("Dynamic Column Detection", () => {
  it("should extract rich_text property values", () => {
    const prop = { rich_text: [{ plain_text: "Hello World" }] };
    const value = extractPropertyValue(prop, "rich_text");
    expect(value).toBe("Hello World");
  });

  it("should extract select property values", () => {
    const prop = { select: { name: "In Progress" } };
    const value = extractPropertyValue(prop, "select");
    expect(value).toBe("In Progress");
  });

  it("should extract number property values", () => {
    const prop = { number: 42 };
    const value = extractPropertyValue(prop, "number");
    expect(value).toBe(42);
  });

  it("should extract date property values", () => {
    const prop = { date: { start: "2026-06-05" } };
    const value = extractPropertyValue(prop, "date");
    expect(value).toBe("2026-06-05");
  });

  it("should handle missing properties gracefully", () => {
    const value = extractPropertyValue(null, "text");
    expect(value).toBeNull();
  });
});
```

### Testing Phase 1

Run tests:
```bash
pnpm test -- notionSyncBack.test.ts
```

Expected: All 5 tests pass.

---

## Phase 2: Full Reconciliation

### What This Does
Every hour, the sync will compare ALL rows in Notion vs MySQL to catch rows that were missed by the incremental sync (e.g., old rows that weren't recently edited).

### Step 2.1: Add fullReconciliation() Function

Add to `server/notionSyncBack.ts`:

```ts
interface ReconciliationResult {
  missingInMysql: Array<{ pageId: string; slug: string; questionId: string }>;
  staleSyncedRows: Array<{ orgId: number; questionId: string; lastSyncedAt: Date; lastEditedInNotion: Date }>;
  totalRowsChecked: number;
}

/**
 * Compare ALL Notion rows vs MySQL to catch data loss.
 * Runs hourly (not every 5 min) to avoid performance impact.
 */
async function fullReconciliation(
  client: Client,
  mapping: ColumnMapping[]
): Promise<ReconciliationResult> {
  const missingInMysql: Array<{ pageId: string; slug: string; questionId: string }> = [];
  const staleSyncedRows: Array<{ orgId: number; questionId: string; lastSyncedAt: Date; lastEditedInNotion: Date }> = [];
  let totalRowsChecked = 0;

  if (!QUESTIONNAIRE_DATA_SOURCE_ID) {
    return { missingInMysql, staleSyncedRows, totalRowsChecked };
  }

  try {
    let cursor: string | undefined = undefined;

    do {
      const queryParams: any = {
        data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
        page_size: 100,
      };
      if (cursor) queryParams.start_cursor = cursor;

      const response: any = await (client as any).dataSources.query(queryParams);

      for (const page of response.results) {
        totalRowsChecked++;

        const fields = await extractFieldsFromRow(page, mapping);
        const slug = fields.slug || fields.institution_group || "";
        const questionId = fields.question_id || fields.questionid || "";
        const answer = fields.answer || "";

        if (!slug || !questionId) continue;

        const orgId = await getOrgIdBySlug(slug);
        if (!orgId) continue;

        // Check if row exists in MySQL
        const mysqlAnswer = await getMySqlAnswer(orgId, questionId);

        if (!mysqlAnswer) {
          // Data loss: exists in Notion but not MySQL
          missingInMysql.push({ pageId: page.id, slug, questionId });
        } else if (mysqlAnswer !== answer) {
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
  } catch (error) {
    console.error("[sync] Full reconciliation failed:", error);
  }

  return { missingInMysql, staleSyncedRows, totalRowsChecked };
}
```

### Step 2.2: Add shouldRunReconciliation() Helper

Add before `fullReconciliation()`:

```ts
/**
 * Determine if it's time to run full reconciliation.
 * Runs every hour (or on-demand if reconciliation is stale).
 */
function shouldRunReconciliation(config: { lastReconciliation?: string }): boolean {
  if (!config.lastReconciliation) return true; // First time

  const lastRun = new Date(config.lastReconciliation).getTime();
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  return now - lastRun > hourInMs;
}
```

### Step 2.3: Update Sync Config to Track Reconciliation

Update `readSyncConfig()` to read `lastReconciliation`:

```ts
async function readSyncConfig(client: Client): Promise<{
  lastSuccessfulSync: string | null;
  lastReconciliation?: string | null;
  consecutiveFailures: number;
  enabled: boolean;
}> {
  // ... existing code ...
  
  const lastReconciliation = props?.["Last Reconciliation"]?.date?.start || null;
  
  return { lastSuccessfulSync: lastSync, lastReconciliation, consecutiveFailures: failures, enabled };
}
```

Update `updateSyncConfig()` to write `lastReconciliation`:

```ts
async function updateSyncConfig(
  client: Client,
  updates: {
    lastSuccessfulSync?: string;
    lastReconciliation?: string;
    consecutiveFailures?: number;
  }
): Promise<void> {
  // ... existing code ...
  
  if (updates.lastReconciliation !== undefined) {
    properties["Last Reconciliation"] = {
      date: { start: updates.lastReconciliation },
    };
  }
  
  // ... rest of existing code ...
}
```

### Step 2.4: Write Vitest Tests

Add to `server/notionSyncBack.test.ts`:

```ts
describe("Full Reconciliation", () => {
  it("should detect rows missing in MySQL", async () => {
    // Mock: Notion has a row, MySQL doesn't
    const result = await fullReconciliation(mockClient, mockMapping);
    expect(result.missingInMysql.length).toBeGreaterThan(0);
  });

  it("should detect stale rows", async () => {
    // Mock: Notion row is newer than MySQL row
    const result = await fullReconciliation(mockClient, mockMapping);
    expect(result.staleSyncedRows.length).toBeGreaterThan(0);
  });

  it("should count total rows checked", async () => {
    const result = await fullReconciliation(mockClient, mockMapping);
    expect(result.totalRowsChecked).toBeGreaterThan(0);
  });

  it("shouldRunReconciliation should return true on first run", () => {
    const result = shouldRunReconciliation({});
    expect(result).toBe(true);
  });

  it("shouldRunReconciliation should return false if run recently", () => {
    const now = new Date().toISOString();
    const result = shouldRunReconciliation({ lastReconciliation: now });
    expect(result).toBe(false);
  });

  it("shouldRunReconciliation should return true if stale", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = shouldRunReconciliation({ lastReconciliation: twoHoursAgo });
    expect(result).toBe(true);
  });

  it("should handle empty reconciliation results", async () => {
    // Mock: No missing or stale rows
    const result = await fullReconciliation(mockClient, mockMapping);
    expect(result.missingInMysql).toEqual([]);
    expect(result.staleSyncedRows).toEqual([]);
  });

  it("should handle reconciliation errors gracefully", async () => {
    // Mock: Client throws error
    const result = await fullReconciliation(mockClientWithError, mockMapping);
    expect(result.missingInMysql).toEqual([]);
    expect(result.staleSyncedRows).toEqual([]);
  });
});
```

### Testing Phase 2

Run tests:
```bash
pnpm test -- notionSyncBack.test.ts
```

Expected: All 8 new tests pass (13 total).

---

## Phase 3: Hybrid Sync Integration

### What This Does
Combines incremental sync (every 5 min, fast) with full reconciliation (every hour, thorough) for both speed and reliability.

### Step 3.1: Update runNotionSyncBack() Main Loop

Replace the main sync loop with:

```ts
export async function runNotionSyncBack(): Promise<SyncResult> {
  const startTime = Date.now();
  const client = getSyncClient();

  if (!client || !QUESTIONNAIRE_DATA_SOURCE_ID) {
    // ... existing error handling ...
  }

  // Read config
  const config = await readSyncConfig(client);
  if (!config.enabled) {
    // ... existing skip handling ...
  }

  // Build dynamic column mapping
  const columnMapping = await buildColumnMapping(client);

  // Default to 10 minutes ago if no last sync
  const since = config.lastSuccessfulSync || new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let rowsFetched = 0;
  let rowsUpdated = 0;
  let rowsFailed = 0;
  let rowsSkipped = 0;
  let reconciliationRan = false;
  let reconciliationMissing = 0;
  let reconciliationStale = 0;
  const errors: string[] = [];

  try {
    // STEP 1: Incremental sync (fast, recent changes only)
    const changedRows = await fetchChangedRows(client, since, columnMapping);
    rowsFetched = changedRows.length;

    for (const row of changedRows) {
      try {
        const orgId = await getOrgIdBySlug(row.slug);
        if (!orgId) {
          errors.push(`Org not found for slug: ${row.slug}`);
          rowsFailed++;
          continue;
        }

        // SAFEGUARD: Don't overwrite non-empty MySQL answers with empty Notion answers
        if (!row.answer || row.answer.trim() === "") {
          const currentAnswer = await getMySqlAnswer(orgId, row.questionId);
          if (currentAnswer && currentAnswer.trim() !== "") {
            rowsSkipped++;
            continue;
          }
        }

        await upsertAnswer(orgId, row.questionId, row.answer);
        rowsUpdated++;

        // Regenerate Summary column in Notion
        const summary = generateAnswerSummary(row.answer);
        try {
          const updateProps: any = {
            "Last Updated From": { rich_text: [{ text: { content: "Notion" } }] },
          };
          if (summary) {
            updateProps["Summary"] = { rich_text: [{ text: { content: `⚙️ Auto: ${summary}`.substring(0, 2000) } }] };
          }
          await client.pages.update({
            page_id: row.pageId,
            properties: updateProps,
          });
        } catch (summaryErr: any) {
          console.warn(`[sync] Failed to update Summary for ${row.slug}/${row.questionId}:`, summaryErr.message);
        }
      } catch (error: any) {
        errors.push(`${row.slug}/${row.questionId}: ${error.message}`);
        rowsFailed++;
      }
    }

    // STEP 2: Full reconciliation (hourly, catches missed rows)
    if (shouldRunReconciliation(config)) {
      console.log("[sync] Running full reconciliation...");
      reconciliationRan = true;

      const reconciliation = await fullReconciliation(client, columnMapping);
      reconciliationMissing = reconciliation.missingInMysql.length;
      reconciliationStale = reconciliation.staleSyncedRows.length;

      // Sync missing rows
      for (const row of reconciliation.missingInMysql) {
        try {
          const pageId = row.pageId;
          const page = await client.pages.retrieve({ page_id: pageId }) as any;
          const fields = await extractFieldsFromRow(page, columnMapping);
          const answer = fields.answer || "";

          const orgId = await getOrgIdBySlug(row.slug);
          if (orgId) {
            await upsertAnswer(orgId, row.questionId, answer);
            console.log(`[sync] Reconciliation: synced missing row ${row.slug}/${row.questionId}`);
          }
        } catch (error: any) {
          console.warn(`[sync] Failed to sync missing row ${row.slug}/${row.questionId}:`, error.message);
        }
      }

      // Sync stale rows
      for (const row of reconciliation.staleSyncedRows) {
        try {
          const page = await client.pages.retrieve({ page_id: row.pageId }) as any;
          const fields = await extractFieldsFromRow(page, columnMapping);
          const answer = fields.answer || "";

          await upsertAnswer(row.orgId, row.questionId, answer);
          console.log(`[sync] Reconciliation: synced stale row org=${row.orgId} question=${row.questionId}`);
        } catch (error: any) {
          console.warn(`[sync] Failed to sync stale row:`, error.message);
        }
      }

      // Update last reconciliation time
      await updateSyncConfig(client, {
        lastReconciliation: new Date().toISOString(),
      });
    }

    // Determine status
    let status: SyncResult["status"] = "Success";
    if (rowsFailed > 0) status = rowsUpdated > 0 ? "Partial" : "Failed";

    const result: SyncResult = {
      status,
      rowsFetched,
      rowsUpdated,
      rowsFailed,
      rowsSkipped,
      durationMs: Date.now() - startTime,
      errorDetails: errors.slice(0, 5).join("; "),
    };

    // Write sync log (only on failure/partial or if reconciliation ran)
    if (status !== "Success" || reconciliationRan) {
      await writeSyncLog(client, result);
    }

    // Update config
    await updateSyncConfig(client, {
      lastSuccessfulSync: new Date().toISOString(),
      consecutiveFailures: 0,
    });

    const msg = `[sync] Success — ${rowsUpdated} updated, ${rowsSkipped} skipped, ${rowsFailed} failed${
      reconciliationRan ? ` · Reconciliation: ${reconciliationMissing} missing, ${reconciliationStale} stale` : ""
    }`;
    console.log(msg);

    return result;
  } catch (error: any) {
    // ... existing error handling ...
  }
}
```

### Step 3.2: Write Integration Tests

Add to `server/notionSyncBack.test.ts`:

```ts
describe("Hybrid Sync Integration", () => {
  it("should run incremental sync on every call", async () => {
    const result = await runNotionSyncBack();
    expect(result.rowsFetched).toBeDefined();
    expect(result.rowsUpdated).toBeDefined();
  });

  it("should run reconciliation when due", async () => {
    // Mock: Last reconciliation was 2 hours ago
    const result = await runNotionSyncBack();
    // Verify reconciliation ran (check logs or result)
    expect(result.status).toBe("Success");
  });

  it("should skip reconciliation if not due", async () => {
    // Mock: Last reconciliation was 5 minutes ago
    const result = await runNotionSyncBack();
    // Verify reconciliation didn't run
    expect(result.status).toBe("Success");
  });

  it("should handle reconciliation errors gracefully", async () => {
    // Mock: Reconciliation throws error
    const result = await runNotionSyncBack();
    // Should still return Success (reconciliation is optional)
    expect(result.status).toBe("Success");
  });

  it("should update sync config after successful run", async () => {
    await runNotionSyncBack();
    // Verify config was updated
    // (Check Notion Sync Config page or mock)
  });
});
```

### Testing Phase 3

Run tests:
```bash
pnpm test -- notionSyncBack.test.ts
```

Expected: All 5 new tests pass (18 total).

---

## Phase 4: Schema Validation Logging

### What This Does
Adds detailed logging when columns are missing or schema changes occur, making it easier to debug sync issues.

### Step 4.1: Add Schema Validation Report

Add to `server/notionSyncBack.ts`:

```ts
interface SchemaValidationReport {
  timestamp: string;
  totalColumns: number;
  detectedColumns: number;
  missingColumns: string[];
  warnings: string[];
}

/**
 * Validate schema and generate a report.
 */
async function validateSchema(
  client: Client,
  mapping: ColumnMapping[]
): Promise<SchemaValidationReport> {
  const report: SchemaValidationReport = {
    timestamp: new Date().toISOString(),
    totalColumns: KNOWN_COLUMNS.length,
    detectedColumns: mapping.length,
    missingColumns: [],
    warnings: [],
  };

  // Check for missing required columns
  for (const knownCol of KNOWN_COLUMNS) {
    const found = mapping.find(
      (m) =>
        m.notionPropertyName === knownCol.notionPropertyName ||
        m.mysqlFieldName === knownCol.mysqlFieldName
    );
    if (!found && knownCol.required) {
      report.missingColumns.push(knownCol.notionPropertyName);
      report.warnings.push(`Missing required column: ${knownCol.notionPropertyName}`);
    }
  }

  // Check for new columns
  const newColumns = mapping.filter(
    (m) => !KNOWN_COLUMNS.find((k) => k.notionPropertyName === m.notionPropertyName)
  );
  if (newColumns.length > 0) {
    report.warnings.push(
      `Found ${newColumns.length} new columns: ${newColumns.map((c) => c.notionPropertyName).join(", ")}`
    );
  }

  return report;
}
```

### Step 4.2: Add Schema Validation to Sync Log

Update `writeSyncLog()` to include schema validation:

```ts
async function writeSyncLog(
  client: Client,
  result: SyncResult,
  schemaReport?: SchemaValidationReport
): Promise<void> {
  if (!SYNC_LOG_DATABASE_ID) return;

  try {
    const now = new Date().toISOString();
    const runLabel = `Sync ${now.slice(0, 16).replace("T", " ")}`;

    const schemaWarnings = schemaReport?.warnings.join("; ") || "";

    await client.pages.create({
      parent: { database_id: SYNC_LOG_DATABASE_ID },
      properties: {
        "Run": { title: [{ text: { content: runLabel } }] },
        "Timestamp": { date: { start: now } },
        "Status": { select: { name: result.status } },
        "Rows Fetched": { number: result.rowsFetched },
        "Rows Updated": { number: result.rowsUpdated },
        "Rows Failed": { number: result.rowsFailed },
        "Rows Skipped": { number: result.rowsSkipped },
        "Duration Ms": { number: result.durationMs },
        "Error Details": {
          rich_text: result.errorDetails
            ? [{ text: { content: result.errorDetails.substring(0, 2000) } }]
            : [],
        },
        "Schema Warnings": {
          rich_text: schemaWarnings
            ? [{ text: { content: schemaWarnings.substring(0, 2000) } }]
            : [],
        },
      },
    });
  } catch (error) {
    console.error("[sync] Failed to write sync log:", error);
  }
}
```

### Step 4.3: Add Admin Endpoint to View Schema

Add to `server/routers/admin.ts` (or create new router):

```ts
export const syncHealth = publicProcedure.query(async () => {
  const client = getSyncClient();
  if (!client) return { status: "unconfigured" };

  const mapping = await buildColumnMapping(client);
  const report = await validateSchema(client, mapping);

  return {
    status: "ok",
    schema: report,
    columns: mapping.map((c) => ({
      notionName: c.notionPropertyName,
      mysqlName: c.mysqlFieldName,
      type: c.type,
      required: c.required,
    })),
  };
});
```

### Step 4.4: Write Vitest Tests

Add to `server/notionSyncBack.test.ts`:

```ts
describe("Schema Validation", () => {
  it("should detect missing required columns", async () => {
    const report = await validateSchema(mockClient, mockMapping);
    // If a required column is missing, it should be in the report
    if (report.missingColumns.length > 0) {
      expect(report.warnings.length).toBeGreaterThan(0);
    }
  });

  it("should detect new columns", async () => {
    const report = await validateSchema(mockClient, mockMappingWithNewColumns);
    expect(report.warnings.some((w) => w.includes("new columns"))).toBe(true);
  });

  it("should generate valid schema validation report", async () => {
    const report = await validateSchema(mockClient, mockMapping);
    expect(report.timestamp).toBeDefined();
    expect(report.totalColumns).toBeGreaterThan(0);
    expect(report.detectedColumns).toBeGreaterThan(0);
  });
});
```

### Testing Phase 4

Run tests:
```bash
pnpm test -- notionSyncBack.test.ts
```

Expected: All 3 new tests pass (21 total).

---

## Phase 5: End-to-End Testing & Verification

### What This Does
Verifies that all 4 phases work together correctly with real data.

### Step 5.1: Test with RMCA Workflow Descriptions

**Scenario:** RMCA has workflow descriptions in Notion that weren't synced before.

**Test:**
1. Verify `IW.orders_description`, `IW.reports_description`, `IW.priors_description` exist in Notion
2. Delete them from MySQL
3. Run `runNotionSyncBack()`
4. Verify they're now in MySQL (caught by reconciliation)

**Code:**
```ts
it("should sync RMCA workflow descriptions via reconciliation", async () => {
  // Delete workflow descriptions from MySQL
  await db.delete(intakeResponses).where(
    and(
      eq(intakeResponses.organizationId, 990001),
      inArray(intakeResponses.questionId, [
        "IW.orders_description",
        "IW.reports_description",
        "IW.priors_description",
      ])
    )
  );

  // Run sync
  const result = await runNotionSyncBack();

  // Verify they're back in MySQL
  const restored = await db
    .select()
    .from(intakeResponses)
    .where(
      and(
        eq(intakeResponses.organizationId, 990001),
        inArray(intakeResponses.questionId, [
          "IW.orders_description",
          "IW.reports_description",
          "IW.priors_description",
        ])
      )
    );

  expect(restored.length).toBe(3);
});
```

### Step 5.2: Test with Old Rows

**Scenario:** A row exists in Notion but wasn't edited recently, so incremental sync missed it.

**Test:**
1. Create a row in Notion with old `last_edited_time`
2. Don't sync it to MySQL
3. Run `runNotionSyncBack()`
4. Verify it's now in MySQL (caught by reconciliation)

### Step 5.3: Test with New Notion Columns

**Scenario:** A new column is added to Notion (e.g., "Custom Field").

**Test:**
1. Add a new column to Notion questionnaire
2. Run `buildColumnMapping()`
3. Verify the new column is detected
4. Verify it's extracted correctly from rows

### Step 5.4: Verify All Tests Pass

```bash
pnpm test
```

Expected: All 285 existing tests + 21 new sync tests = 306 tests, all passing.

### Step 5.5: Manual Verification in Production

1. Check Notion Sync Log for reconciliation entries
2. Verify "Schema Warnings" column shows new columns detected
3. Monitor sync duration (should still be <5s for incremental, <30s for reconciliation)
4. Check admin endpoint `/api/trpc/syncHealth.getSchema` to view detected columns

---

## Rollback Plan

If issues arise during implementation:

1. **Phase 1 only:** Revert to hardcoded columns, no reconciliation
2. **Phase 2 only:** Disable reconciliation via Sync Config page
3. **Phase 3 only:** Disable hybrid sync, run incremental only
4. **Phase 4 only:** Disable schema validation logging
5. **Full rollback:** Use `git reset --hard` to previous checkpoint

---

## Success Criteria

- ✅ All 21 new vitest tests pass
- ✅ All 285 existing tests still pass
- ✅ RMCA workflow descriptions sync correctly
- ✅ Old rows are caught by reconciliation
- ✅ New Notion columns are auto-detected
- ✅ Schema validation logs appear in Sync Log
- ✅ Sync duration remains <5s for incremental, <30s for reconciliation
- ✅ No data loss during sync failures
- ✅ Zero manual fixes needed for data gaps

---

## Timeline

- **Phase 1:** 2-3 hours (dynamic columns)
- **Phase 2:** 2-3 hours (full reconciliation)
- **Phase 3:** 1-2 hours (hybrid integration)
- **Phase 4:** 1 hour (schema validation)
- **Phase 5:** 1-2 hours (testing & verification)

**Total:** ~9-13 hours of focused work.

---

## Questions?

Refer to `references/DESIGN_ROBUST_SYNC.md` for architectural details.
