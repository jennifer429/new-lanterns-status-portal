/**
 * Notion → MySQL Periodic Sync-Back Job
 *
 * Runs every 5 minutes. Queries Notion for questionnaire rows edited since
 * the last successful sync, and upserts their answers into MySQL.
 *
 * State is tracked entirely in Notion:
 *   - Sync Config page: last successful sync timestamp, last reconciliation timestamp,
 *     consecutive failures, enabled flag
 *   - Sync Log database: one row per run with status, counts, errors, duration, schema warnings
 *
 * Robust sync (see references/CLAUDE_SYNC_IMPLEMENTATION.md + references/DESIGN_ROBUST_SYNC.md):
 *   - Phase 1 — Dynamic column detection: the Notion schema is inspected at runtime so new
 *     columns sync without code changes (no more hardcoded "Orders Description" etc.).
 *   - Phase 2 — Full reconciliation: hourly, compares ALL Notion rows vs MySQL to recover
 *     rows the incremental last_edited_time filter misses (old/unedited rows).
 *   - Phase 3 — Hybrid sync: fast incremental every run + thorough reconciliation when due.
 *   - Phase 4 — Schema validation: missing/new columns are logged and surfaced in the Sync Log.
 *
 * Safeguards:
 *   - Skips rows where Notion answer is empty but MySQL answer is non-empty (prevents blanking)
 *   - Sets updatedBy = "notion-sync@system" so edits are auditable
 *   - Notifies owner after 3+ consecutive failures
 */

import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { intakeResponses, organizations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { generateAnswerSummary } from "./notionSummary";

const QUESTIONNAIRE_DATA_SOURCE_ID = ENV.notionDataSourceId || "";
const SYNC_LOG_DATABASE_ID = ENV.notionSyncLogDataSourceId || "";
// Sync Config uses pages.retrieve/update (page_id), no data_source needed
const SYNC_CONFIG_PAGE_ID = ENV.notionSyncConfigPageId || "";

const MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT = 3;
// Full reconciliation runs at most once per this interval (incremental still runs every cycle).
const RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface SyncResult {
  status: "Success" | "Partial" | "Failed" | "Skipped";
  rowsFetched: number;
  rowsUpdated: number;
  rowsFailed: number;
  rowsSkipped: number;
  durationMs: number;
  errorDetails: string;
}

// ---------------------------------------------------------------------------
// Phase 1: Dynamic Column Detection
// ---------------------------------------------------------------------------

/**
 * Runtime mapping of a Notion property → a MySQL field.
 */
export interface ColumnMapping {
  notionPropertyName: string;
  mysqlFieldName: string;
  type: "text" | "number" | "date" | "select" | "relation" | "rich_text";
  required: boolean;
  description?: string;
}

/**
 * Known column mappings for the questionnaire database. Used as a fallback when the
 * Notion schema can't be auto-detected. Workflow description columns are intentionally
 * NOT hardcoded here — they are auto-detected by buildColumnMapping().
 */
export const KNOWN_COLUMNS: ColumnMapping[] = [
  { notionPropertyName: "Slug", mysqlFieldName: "slug", type: "text", required: true, description: "Organization slug" },
  { notionPropertyName: "Question ID", mysqlFieldName: "question_id", type: "text", required: true, description: "Question identifier" },
  { notionPropertyName: "Answer", mysqlFieldName: "answer", type: "rich_text", required: false, description: "Primary answer" },
];

/**
 * Convert a Notion property name into a normalized MySQL field name (snake_case, lowercase).
 */
function toMysqlFieldName(propName: string): string {
  return propName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Query the Notion database schema by fetching a sample row and extracting all properties.
 * This allows new columns to be added to Notion without code changes. Falls back to
 * KNOWN_COLUMNS when no sample is available or the query fails.
 */
export async function buildColumnMapping(client: Client): Promise<ColumnMapping[]> {
  if (!QUESTIONNAIRE_DATA_SOURCE_ID) return KNOWN_COLUMNS;

  try {
    const response: any = await (client as any).dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      page_size: 1,
    });

    if (!response?.results || response.results.length === 0) {
      console.warn("[notion-sync] No sample row found, using known columns only");
      return KNOWN_COLUMNS;
    }

    const samplePage = response.results[0];
    const detectedColumns: ColumnMapping[] = [];

    for (const [propName, propValue] of Object.entries(samplePage.properties || {})) {
      const notionType = (propValue as any)?.type;
      let mappedType: ColumnMapping["type"];
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

      const mysqlFieldName = toMysqlFieldName(propName);
      const required = ["slug", "question_id", "question id"].some(
        (name) => mysqlFieldName === name || propName.toLowerCase().includes(name)
      );

      detectedColumns.push({
        notionPropertyName: propName,
        mysqlFieldName,
        type: mappedType,
        required,
        description: "Auto-detected from Notion schema",
      });
    }

    console.log(`[notion-sync] Detected ${detectedColumns.length} columns from Notion schema`);
    return detectedColumns;
  } catch (error) {
    console.warn("[notion-sync] Failed to auto-detect schema, using known columns:", error);
    return KNOWN_COLUMNS;
  }
}

/**
 * Extract a value from a Notion property based on its mapped type. Handles all supported
 * Notion property types gracefully, returning null/"" on failure rather than throwing.
 */
export function extractPropertyValue(prop: any, type: ColumnMapping["type"]): any {
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
    console.warn(`[notion-sync] Failed to extract property value for type ${type}:`, error);
    return null;
  }
}

/**
 * Extract all mapped fields from a Notion row using the column mapping.
 * Returns an object keyed by MySQL field name. Missing required columns are logged.
 */
export async function extractFieldsFromRow(
  page: any,
  mapping: ColumnMapping[]
): Promise<Record<string, any>> {
  const fields: Record<string, any> = {};
  const missingRequired: string[] = [];

  for (const col of mapping) {
    try {
      const prop = page?.properties?.[col.notionPropertyName];
      if (!prop) {
        if (col.required) missingRequired.push(col.notionPropertyName);
        continue;
      }
      fields[col.mysqlFieldName] = extractPropertyValue(prop, col.type);
    } catch (error) {
      console.warn(`[notion-sync] Failed to extract ${col.notionPropertyName} (${col.type}):`, error);
    }
  }

  if (missingRequired.length > 0) {
    console.warn(`[notion-sync] Row ${page?.id} missing required columns: ${missingRequired.join(", ")}`);
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Phase 4: Schema Validation
// ---------------------------------------------------------------------------

export interface SchemaValidationReport {
  timestamp: string;
  totalColumns: number;
  detectedColumns: number;
  missingColumns: string[];
  warnings: string[];
}

/**
 * Validate a detected column mapping against KNOWN_COLUMNS and produce a report:
 * which required columns are missing, and which new columns were discovered.
 */
export async function validateSchema(
  _client: Client | null,
  mapping: ColumnMapping[]
): Promise<SchemaValidationReport> {
  const report: SchemaValidationReport = {
    timestamp: new Date().toISOString(),
    totalColumns: KNOWN_COLUMNS.length,
    detectedColumns: mapping.length,
    missingColumns: [],
    warnings: [],
  };

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

/**
 * Build the current column mapping and schema validation report (used by the admin
 * sync dashboard to surface schema drift).
 */
export async function getSchemaHealth(): Promise<
  | { status: "unconfigured" }
  | { status: "ok"; schema: SchemaValidationReport; columns: ColumnMapping[] }
> {
  const client = getSyncClient();
  if (!client) return { status: "unconfigured" };

  const mapping = await buildColumnMapping(client);
  const schema = await validateSchema(client, mapping);
  return { status: "ok", schema, columns: mapping };
}

// ---------------------------------------------------------------------------
// Notion client + config
// ---------------------------------------------------------------------------

/**
 * Get the Notion client for sync operations.
 */
function getSyncClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  return new Client({ auth: ENV.notionApiKey });
}

/**
 * Read the sync config from Notion.
 */
async function readSyncConfig(client: Client): Promise<{
  lastSuccessfulSync: string | null;
  lastReconciliation: string | null;
  consecutiveFailures: number;
  enabled: boolean;
}> {
  if (!SYNC_CONFIG_PAGE_ID) {
    return { lastSuccessfulSync: null, lastReconciliation: null, consecutiveFailures: 0, enabled: false };
  }

  try {
    const page = await client.pages.retrieve({ page_id: SYNC_CONFIG_PAGE_ID }) as any;
    const props = page.properties;

    const lastSync = props?.["Last Successful Sync"]?.date?.start || null;
    // Optional property — absent on older Sync Config pages, treated as "never reconciled".
    const lastReconciliation = props?.["Last Reconciliation"]?.date?.start || null;
    const failures = props?.["Consecutive Failures"]?.number || 0;
    const enabled = props?.["Enabled"]?.checkbox ?? false;

    return { lastSuccessfulSync: lastSync, lastReconciliation, consecutiveFailures: failures, enabled };
  } catch (error) {
    console.error("[notion-sync] Failed to read sync config:", error);
    return { lastSuccessfulSync: null, lastReconciliation: null, consecutiveFailures: 0, enabled: false };
  }
}

/**
 * Update the sync config page in Notion.
 */
async function updateSyncConfig(
  client: Client,
  updates: {
    lastSuccessfulSync?: string;
    lastReconciliation?: string;
    consecutiveFailures?: number;
  }
): Promise<void> {
  if (!SYNC_CONFIG_PAGE_ID) return;

  const properties: any = {};

  if (updates.lastSuccessfulSync !== undefined) {
    properties["Last Successful Sync"] = {
      date: { start: updates.lastSuccessfulSync },
    };
  }

  if (updates.lastReconciliation !== undefined) {
    properties["Last Reconciliation"] = {
      date: { start: updates.lastReconciliation },
    };
  }

  if (updates.consecutiveFailures !== undefined) {
    properties["Consecutive Failures"] = {
      number: updates.consecutiveFailures,
    };
  }

  try {
    await client.pages.update({ page_id: SYNC_CONFIG_PAGE_ID, properties });
  } catch (error) {
    console.error("[notion-sync] Failed to update sync config:", error);
  }
}

/**
 * Write a log entry to the Sync Log database.
 */
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
    console.error("[notion-sync] Failed to write sync log:", error);
  }
}

/**
 * Query Notion for questionnaire rows edited since a given timestamp.
 * Uses the dynamic column mapping to extract fields.
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

  // Collapse duplicate Notion rows for the same org+question (newest edit wins).
  return dedupeRowsByKey(results);
}

/**
 * Collapse rows that share the same (slug, questionId) down to a single row, keeping the
 * one with the most recent `lastEdited`. Notion can hold duplicate questionnaire rows for
 * the same org+question (e.g. multiple "Reports workflow description" pages); without this,
 * upserts are non-deterministic (last-processed wins) and the reconciliation "stale" check
 * flip-flops. Newest-edited wins so the canonical answer is the one synced.
 */
export function dedupeRowsByKey<T extends { slug: string; questionId: string; lastEdited?: string }>(
  rows: T[]
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.slug}::${row.questionId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingTs = Date.parse(existing.lastEdited || "") || 0;
    const candidateTs = Date.parse(row.lastEdited || "") || 0;
    if (candidateTs >= existingTs) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/**
 * Look up the organization ID from a slug.
 */
async function getOrgIdBySlug(slug: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org?.id ?? null;
}

/**
 * Get the current MySQL answer for an org+question.
 */
async function getMySqlAnswer(orgId: number, questionId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ response: intakeResponses.response })
    .from(intakeResponses)
    .where(
      and(
        eq(intakeResponses.organizationId, orgId),
        eq(intakeResponses.questionId, questionId)
      )
    )
    .limit(1);
  return row?.response ?? null;
}

/**
 * Upsert an answer into MySQL from Notion.
 */
async function upsertAnswer(orgId: number, questionId: string, answer: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  const [existing] = await db
    .select({ id: intakeResponses.id })
    .from(intakeResponses)
    .where(
      and(
        eq(intakeResponses.organizationId, orgId),
        eq(intakeResponses.questionId, questionId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(intakeResponses)
      .set({
        response: answer,
        updatedAt: now,
        updatedBy: "notion-sync@system",
      })
      .where(eq(intakeResponses.id, existing.id));
  } else {
    await db.insert(intakeResponses).values({
      organizationId: orgId,
      questionId,
      section: "synced",
      response: answer,
      status: "complete",
      updatedBy: "notion-sync@system",
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Full Reconciliation
// ---------------------------------------------------------------------------

export interface ReconciliationResult {
  missingInMysql: Array<{ pageId: string; slug: string; questionId: string }>;
  staleSyncedRows: Array<{ pageId: string; orgId: number; questionId: string; lastSyncedAt: Date; lastEditedInNotion: Date }>;
  totalRowsChecked: number;
}

/**
 * Dependencies for fullReconciliation. Injectable so the function can be unit-tested
 * without a live database; defaults to the real MySQL-backed lookups.
 */
export interface ReconciliationDeps {
  getOrgId: (slug: string) => Promise<number | null>;
  getMysqlAnswer: (orgId: number, questionId: string) => Promise<string | null>;
}

/**
 * Determine if it's time to run full reconciliation. Runs on first ever run, or when
 * the last reconciliation is older than RECONCILIATION_INTERVAL_MS.
 */
export function shouldRunReconciliation(config: { lastReconciliation?: string | null }): boolean {
  if (!config.lastReconciliation) return true;
  const lastRun = new Date(config.lastReconciliation).getTime();
  if (Number.isNaN(lastRun)) return true;
  return Date.now() - lastRun > RECONCILIATION_INTERVAL_MS;
}

/**
 * Compare ALL Notion rows vs MySQL to catch data loss the incremental filter misses.
 * Returns rows present in Notion but missing in MySQL, and rows whose MySQL value is stale.
 * Runs hourly (not every cycle) to avoid performance impact.
 */
export async function fullReconciliation(
  client: Client,
  mapping: ColumnMapping[],
  deps?: ReconciliationDeps
): Promise<ReconciliationResult> {
  const getOrgId = deps?.getOrgId ?? getOrgIdBySlug;
  const getAnswer = deps?.getMysqlAnswer ?? getMySqlAnswer;

  const missingInMysql: ReconciliationResult["missingInMysql"] = [];
  const staleSyncedRows: ReconciliationResult["staleSyncedRows"] = [];
  let totalRowsChecked = 0;

  if (!QUESTIONNAIRE_DATA_SOURCE_ID) {
    return { missingInMysql, staleSyncedRows, totalRowsChecked };
  }

  try {
    // First pass: collect every candidate row from Notion (paginating through all).
    const candidates: Array<{ pageId: string; slug: string; questionId: string; answer: string; lastEdited: string }> = [];
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
        candidates.push({ pageId: page.id, slug, questionId, answer, lastEdited: page.last_edited_time || "" });
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    // Collapse duplicate Notion rows for the same org+question (newest edit wins) so the
    // comparison against MySQL is deterministic and the stale check doesn't flip-flop.
    const deduped = dedupeRowsByKey(candidates);

    // Second pass: compare each canonical row against MySQL.
    for (const row of deduped) {
      const orgId = await getOrgId(row.slug);
      if (!orgId) continue;

      const mysqlAnswer = await getAnswer(orgId, row.questionId);

      if (mysqlAnswer === null) {
        // Present in Notion, missing in MySQL → data loss to restore.
        missingInMysql.push({ pageId: row.pageId, slug: row.slug, questionId: row.questionId });
      } else if (mysqlAnswer !== row.answer) {
        // MySQL value doesn't match Notion → stale.
        const edited = new Date(row.lastEdited);
        staleSyncedRows.push({
          pageId: row.pageId,
          orgId,
          questionId: row.questionId,
          lastSyncedAt: edited,
          lastEditedInNotion: edited,
        });
      }
    }
  } catch (error) {
    console.error("[notion-sync] Full reconciliation failed:", error);
  }

  return { missingInMysql, staleSyncedRows, totalRowsChecked };
}

// ---------------------------------------------------------------------------
// Phase 3: Hybrid Sync (incremental + reconciliation)
// ---------------------------------------------------------------------------

/**
 * Main sync-back function. Called by the cron scheduler.
 */
export async function runNotionSyncBack(): Promise<SyncResult> {
  const startTime = Date.now();
  const client = getSyncClient();

  if (!client || !QUESTIONNAIRE_DATA_SOURCE_ID) {
    const result: SyncResult = {
      status: "Skipped",
      rowsFetched: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      rowsSkipped: 0,
      durationMs: Date.now() - startTime,
      errorDetails: "Notion credentials or database ID not configured",
    };
    console.log("[notion-sync] Skipped — not configured");
    return result;
  }

  // Read config
  const config = await readSyncConfig(client);
  if (!config.enabled) {
    const result: SyncResult = {
      status: "Skipped",
      rowsFetched: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      rowsSkipped: 0,
      durationMs: Date.now() - startTime,
      errorDetails: "Sync is disabled in config",
    };
    console.log("[notion-sync] Skipped — disabled in config");
    return result;
  }

  // Build dynamic column mapping + schema validation report
  const columnMapping = await buildColumnMapping(client);
  const schemaReport = await validateSchema(client, columnMapping);
  if (schemaReport.warnings.length > 0) {
    console.warn(`[notion-sync] Schema warnings: ${schemaReport.warnings.join("; ")}`);
  }

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

        // Regenerate Summary column in Notion for JSON answers + mark source as Notion
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
          // Non-fatal: log but don't fail the sync
          console.warn(`[notion-sync] Failed to update Summary/Source for ${row.slug}/${row.questionId}:`, summaryErr.message);
        }
      } catch (error: any) {
        errors.push(`${row.slug}/${row.questionId}: ${error.message}`);
        rowsFailed++;
      }
    }

    // STEP 2: Full reconciliation (hourly) — restore rows present in Notion but missing
    // in MySQL, and refresh stale rows. Failures here are non-fatal to the overall sync.
    if (shouldRunReconciliation(config)) {
      reconciliationRan = true;
      console.log("[notion-sync] Running full reconciliation...");
      try {
        const reconciliation = await fullReconciliation(client, columnMapping);
        reconciliationMissing = reconciliation.missingInMysql.length;
        reconciliationStale = reconciliation.staleSyncedRows.length;

        // Restore missing rows
        for (const row of reconciliation.missingInMysql) {
          try {
            const page = await client.pages.retrieve({ page_id: row.pageId }) as any;
            const fields = await extractFieldsFromRow(page, columnMapping);
            const answer = fields.answer || "";
            if (!answer || answer.trim() === "") continue;
            const orgId = await getOrgIdBySlug(row.slug);
            if (orgId) {
              await upsertAnswer(orgId, row.questionId, answer);
              rowsUpdated++;
              console.log(`[notion-sync] Reconciliation: restored missing row ${row.slug}/${row.questionId}`);
            }
          } catch (error: any) {
            console.warn(`[notion-sync] Failed to restore missing row ${row.slug}/${row.questionId}:`, error.message);
          }
        }

        // Refresh stale rows
        for (const row of reconciliation.staleSyncedRows) {
          try {
            const page = await client.pages.retrieve({ page_id: row.pageId }) as any;
            const fields = await extractFieldsFromRow(page, columnMapping);
            const answer = fields.answer || "";
            // Don't blank a non-empty MySQL value with an empty Notion value.
            if (!answer || answer.trim() === "") continue;
            await upsertAnswer(row.orgId, row.questionId, answer);
            rowsUpdated++;
            console.log(`[notion-sync] Reconciliation: refreshed stale row org=${row.orgId} question=${row.questionId}`);
          } catch (error: any) {
            console.warn(`[notion-sync] Failed to refresh stale row:`, error.message);
          }
        }

        await updateSyncConfig(client, { lastReconciliation: new Date().toISOString() });
      } catch (reconErr: any) {
        // Reconciliation is best-effort — log and continue.
        console.error("[notion-sync] Reconciliation error (non-fatal):", reconErr.message);
      }
    }

    // Determine status
    let status: SyncResult["status"] = "Success";
    if (rowsFailed > 0 && rowsUpdated === 0) {
      status = "Failed";
    } else if (rowsFailed > 0) {
      status = "Partial";
    }

    const result: SyncResult = {
      status,
      rowsFetched,
      rowsUpdated,
      rowsFailed,
      rowsSkipped,
      durationMs: Date.now() - startTime,
      errorDetails: errors.join("\n"),
    };

    // Write a Sync Log entry on failure/partial, or whenever reconciliation ran or
    // the schema produced warnings (so drift is visible).
    if (status !== "Success" || reconciliationRan || schemaReport.warnings.length > 0) {
      await writeSyncLog(client, result, schemaReport);
    }

    // Update config
    if (status === "Failed") {
      const newFailures = config.consecutiveFailures + 1;
      await updateSyncConfig(client, { consecutiveFailures: newFailures });

      // Alert owner if too many failures
      if (newFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT) {
        await notifyOwner({
          title: "⚠️ Notion Sync Failing",
          content: `The Notion→MySQL sync has failed ${newFailures} consecutive times.\n\nLatest errors:\n${errors.slice(0, 5).join("\n")}`,
        });
      }
    } else {
      await updateSyncConfig(client, {
        lastSuccessfulSync: new Date().toISOString(),
        consecutiveFailures: 0,
      });
    }

    console.log(
      `[notion-sync] ${status} — fetched: ${rowsFetched}, updated: ${rowsUpdated}, failed: ${rowsFailed}, skipped: ${rowsSkipped}` +
        (reconciliationRan ? ` · Reconciliation: ${reconciliationMissing} missing, ${reconciliationStale} stale` : "")
    );
    return result;
  } catch (error: any) {
    const newFailures = config.consecutiveFailures + 1;
    const result: SyncResult = {
      status: "Failed",
      rowsFetched,
      rowsUpdated,
      rowsFailed: rowsFailed + 1,
      rowsSkipped,
      durationMs: Date.now() - startTime,
      errorDetails: error.message || String(error),
    };

    try {
      await updateSyncConfig(client, { consecutiveFailures: newFailures });

      if (newFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT) {
        await notifyOwner({
          title: "⚠️ Notion Sync Failing",
          content: `The Notion→MySQL sync has failed ${newFailures} consecutive times.\n\nError: ${error.message}`,
        });
      }
    } catch (logError) {
      console.error("[notion-sync] Failed to write failure log:", logError);
    }

    console.error("[notion-sync] Failed:", error.message);
    return result;
  }
}

/**
 * Get current sync health status (for the health check endpoint).
 */
export async function getSyncHealth(): Promise<{
  enabled: boolean;
  lastSuccessfulSync: string | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}> {
  const client = getSyncClient();
  if (!client) {
    return { enabled: false, lastSuccessfulSync: null, consecutiveFailures: 0, isHealthy: false };
  }

  const config = await readSyncConfig(client);
  const isHealthy = config.enabled && config.consecutiveFailures < MAX_CONSECUTIVE_FAILURES_BEFORE_ALERT;

  return {
    enabled: config.enabled,
    lastSuccessfulSync: config.lastSuccessfulSync,
    consecutiveFailures: config.consecutiveFailures,
    isHealthy,
  };
}
