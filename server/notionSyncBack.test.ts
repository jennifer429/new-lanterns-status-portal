import { describe, it, expect } from "vitest";
import {
  extractPropertyValue,
  extractFieldsFromRow,
  buildColumnMapping,
  validateSchema,
  shouldRunReconciliation,
  fullReconciliation,
  dedupeRowsByKey,
  getSyncHealth,
  KNOWN_COLUMNS,
  type ColumnMapping,
  type ReconciliationDeps,
} from "./notionSyncBack";

/**
 * Tests for the robust Notion sync-back module.
 * See references/CLAUDE_SYNC_IMPLEMENTATION.md (Phases 1–5).
 *
 * These tests exercise the pure / mockable units (no live Notion or MySQL):
 *   - Phase 1: dynamic column detection (extractPropertyValue, extractFieldsFromRow, buildColumnMapping)
 *   - Phase 2: full reconciliation (shouldRunReconciliation, fullReconciliation with injected deps)
 *   - Phase 4: schema validation (validateSchema)
 */

// ---------------------------------------------------------------------------
// Test helpers — fake Notion client over the dataSources.query / pages APIs
// ---------------------------------------------------------------------------

function makeClient(pages: any[], opts: { throwError?: boolean } = {}): any {
  return {
    dataSources: {
      query: async (_params: any) => {
        if (opts.throwError) throw new Error("notion boom");
        return { results: pages, has_more: false, next_cursor: null };
      },
    },
    pages: {
      retrieve: async ({ page_id }: { page_id: string }) => pages.find((p) => p.id === page_id),
      update: async () => ({}),
    },
  };
}

function richText(value: string) {
  return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

function selectProp(name: string) {
  return { type: "select", select: { name } };
}

function questionnairePageEdited(id: string, slug: string, questionId: string, answer: string, lastEdited: string) {
  return {
    id,
    last_edited_time: lastEdited,
    properties: {
      Slug: richText(slug),
      "Question ID": richText(questionId),
      Answer: richText(answer),
    },
  };
}

function questionnairePage(id: string, slug: string, questionId: string, answer: string) {
  return questionnairePageEdited(id, slug, questionId, answer, "2026-06-05T00:00:00.000Z");
}

// ---------------------------------------------------------------------------
// Existing env / health checks
// ---------------------------------------------------------------------------

describe("Notion Sync-Back config", () => {
  it("should have NOTION_SYNC_LOG_DATASOURCE_ID configured", () => {
    const val = process.env.NOTION_SYNC_LOG_DATASOURCE_ID;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should have NOTION_SYNC_CONFIG_PAGE_ID configured", () => {
    const val = process.env.NOTION_SYNC_CONFIG_PAGE_ID;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("getSyncHealth returns expected shape", async () => {
    const health = await getSyncHealth();
    expect(health).toHaveProperty("enabled");
    expect(health).toHaveProperty("lastSuccessfulSync");
    expect(health).toHaveProperty("consecutiveFailures");
    expect(health).toHaveProperty("isHealthy");
    expect(typeof health.enabled).toBe("boolean");
    expect(typeof health.consecutiveFailures).toBe("number");
    expect(typeof health.isHealthy).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Phase 1: Dynamic Column Detection
// ---------------------------------------------------------------------------

describe("Phase 1 — extractPropertyValue", () => {
  it("extracts rich_text values", () => {
    expect(extractPropertyValue({ rich_text: [{ plain_text: "Hello World" }] }, "rich_text")).toBe("Hello World");
  });

  it("extracts text values from rich_text", () => {
    expect(extractPropertyValue({ rich_text: [{ plain_text: "abc" }] }, "text")).toBe("abc");
  });

  it("extracts select values", () => {
    expect(extractPropertyValue({ select: { name: "In Progress" } }, "select")).toBe("In Progress");
  });

  it("extracts number values", () => {
    expect(extractPropertyValue({ number: 42 }, "number")).toBe(42);
  });

  it("extracts date values", () => {
    expect(extractPropertyValue({ date: { start: "2026-06-05" } }, "date")).toBe("2026-06-05");
  });

  it("extracts relation values as id arrays", () => {
    expect(extractPropertyValue({ relation: [{ id: "a" }, { id: "b" }] }, "relation")).toEqual(["a", "b"]);
  });

  it("returns null for missing properties", () => {
    expect(extractPropertyValue(null, "text")).toBeNull();
    expect(extractPropertyValue(undefined, "rich_text")).toBeNull();
  });
});

describe("Phase 1 — extractFieldsFromRow", () => {
  it("maps Notion properties to MySQL field names via the mapping", async () => {
    const page = questionnairePage("p1", "boulder", "IW.orders", "place an order");
    const fields = await extractFieldsFromRow(page, KNOWN_COLUMNS);
    expect(fields.slug).toBe("boulder");
    expect(fields.question_id).toBe("IW.orders");
    expect(fields.answer).toBe("place an order");
  });

  it("skips columns absent from the row", async () => {
    const page = {
      id: "p2",
      properties: { Slug: richText("boulder") }, // no Question ID / Answer
    };
    const fields = await extractFieldsFromRow(page, KNOWN_COLUMNS);
    expect(fields.slug).toBe("boulder");
    expect(fields).not.toHaveProperty("answer");
    expect(fields).not.toHaveProperty("question_id");
  });
});

describe("Phase 1 — buildColumnMapping", () => {
  it("auto-detects columns from a sample row", async () => {
    const page = {
      id: "p1",
      properties: {
        Slug: richText("boulder"),
        "Question ID": richText("IW.orders"),
        "Orders Description": richText("desc"),
        Priority: { type: "number", number: 1 },
      },
    };
    const mapping = await buildColumnMapping(makeClient([page]));
    expect(mapping.length).toBe(4);
    const detected = mapping.find((m) => m.notionPropertyName === "Orders Description");
    expect(detected).toBeDefined();
    expect(detected!.mysqlFieldName).toBe("orders_description");
    // Slug and Question ID are flagged required
    expect(mapping.find((m) => m.notionPropertyName === "Slug")!.required).toBe(true);
    expect(mapping.find((m) => m.notionPropertyName === "Question ID")!.required).toBe(true);
  });

  it("falls back to KNOWN_COLUMNS when no sample row exists", async () => {
    const mapping = await buildColumnMapping(makeClient([]));
    expect(mapping).toEqual(KNOWN_COLUMNS);
  });

  it("falls back to KNOWN_COLUMNS when the query throws", async () => {
    const mapping = await buildColumnMapping(makeClient([], { throwError: true }));
    expect(mapping).toEqual(KNOWN_COLUMNS);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Full Reconciliation
// ---------------------------------------------------------------------------

describe("Phase 2 — shouldRunReconciliation", () => {
  it("returns true on the first run (no prior reconciliation)", () => {
    expect(shouldRunReconciliation({})).toBe(true);
    expect(shouldRunReconciliation({ lastReconciliation: null })).toBe(true);
  });

  it("returns false when reconciliation ran recently", () => {
    expect(shouldRunReconciliation({ lastReconciliation: new Date().toISOString() })).toBe(false);
  });

  it("returns true when the last reconciliation is stale (>1h)", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(shouldRunReconciliation({ lastReconciliation: twoHoursAgo })).toBe(true);
  });
});

describe("Phase 2 — fullReconciliation", () => {
  const mapping = KNOWN_COLUMNS;

  it("detects rows present in Notion but missing in MySQL", async () => {
    const client = makeClient([questionnairePage("p1", "boulder", "IW.orders", "answer")]);
    const deps: ReconciliationDeps = {
      getOrgId: async () => 1,
      getMysqlAnswer: async () => null, // missing in MySQL
    };
    const result = await fullReconciliation(client, mapping, deps);
    expect(result.missingInMysql).toHaveLength(1);
    expect(result.missingInMysql[0].questionId).toBe("IW.orders");
    expect(result.staleSyncedRows).toHaveLength(0);
  });

  it("detects stale rows where MySQL differs from Notion", async () => {
    const client = makeClient([questionnairePage("p1", "boulder", "IW.orders", "notion-value")]);
    const deps: ReconciliationDeps = {
      getOrgId: async () => 1,
      getMysqlAnswer: async () => "stale-mysql-value",
    };
    const result = await fullReconciliation(client, mapping, deps);
    expect(result.staleSyncedRows).toHaveLength(1);
    expect(result.missingInMysql).toHaveLength(0);
  });

  it("counts all rows checked", async () => {
    const pages = [
      questionnairePage("p1", "boulder", "Q1", "a"),
      questionnairePage("p2", "boulder", "Q2", "b"),
      questionnairePage("p3", "boulder", "Q3", "c"),
    ];
    const deps: ReconciliationDeps = { getOrgId: async () => 1, getMysqlAnswer: async () => "a" };
    const result = await fullReconciliation(makeClient(pages), mapping, deps);
    expect(result.totalRowsChecked).toBe(3);
  });

  it("reports no issues when MySQL matches Notion", async () => {
    const client = makeClient([questionnairePage("p1", "boulder", "IW.orders", "same")]);
    const deps: ReconciliationDeps = { getOrgId: async () => 1, getMysqlAnswer: async () => "same" };
    const result = await fullReconciliation(client, mapping, deps);
    expect(result.missingInMysql).toEqual([]);
    expect(result.staleSyncedRows).toEqual([]);
  });

  it("handles query errors gracefully", async () => {
    const client = makeClient([], { throwError: true });
    const deps: ReconciliationDeps = { getOrgId: async () => 1, getMysqlAnswer: async () => null };
    const result = await fullReconciliation(client, mapping, deps);
    expect(result.missingInMysql).toEqual([]);
    expect(result.staleSyncedRows).toEqual([]);
    expect(result.totalRowsChecked).toBe(0);
  });

  it("skips rows whose org slug does not resolve", async () => {
    const client = makeClient([questionnairePage("p1", "unknown", "IW.orders", "answer")]);
    const deps: ReconciliationDeps = { getOrgId: async () => null, getMysqlAnswer: async () => null };
    const result = await fullReconciliation(client, mapping, deps);
    expect(result.missingInMysql).toEqual([]);
  });
});

describe("Phase 2 — dedupeRowsByKey (duplicate Notion rows)", () => {
  it("keeps the most-recently-edited row per (slug, questionId)", () => {
    const rows = [
      { slug: "RMCA", questionId: "IW.reports_description", answer: "old", lastEdited: "2026-05-19T19:48:00.000Z" },
      { slug: "RMCA", questionId: "IW.reports_description", answer: "newest", lastEdited: "2026-06-06T02:00:00.000Z" },
      { slug: "RMCA", questionId: "IW.reports_description", answer: "mid", lastEdited: "2026-05-19T20:00:00.000Z" },
    ];
    const deduped = dedupeRowsByKey(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].answer).toBe("newest");
  });

  it("keeps distinct (slug, questionId) pairs separate", () => {
    const rows = [
      { slug: "RMCA", questionId: "IW.orders_description", answer: "a", lastEdited: "2026-06-06T02:00:00.000Z" },
      { slug: "RMCA", questionId: "IW.priors_description", answer: "b", lastEdited: "2026-06-06T02:00:00.000Z" },
      { slug: "NMHS", questionId: "IW.orders_description", answer: "c", lastEdited: "2026-06-06T02:00:00.000Z" },
    ];
    expect(dedupeRowsByKey(rows)).toHaveLength(3);
  });

  it("collapses reconciliation duplicates so a missing row is reported once", async () => {
    // Notion holds the same RMCA reports row 3 times; MySQL has none.
    const pages = [
      questionnairePageEdited("p1", "RMCA", "IW.reports_description", "v1", "2026-05-19T19:48:00.000Z"),
      questionnairePageEdited("p2", "RMCA", "IW.reports_description", "v2", "2026-06-06T02:00:00.000Z"),
      questionnairePageEdited("p3", "RMCA", "IW.reports_description", "v3", "2026-05-19T20:00:00.000Z"),
    ];
    const deps: ReconciliationDeps = { getOrgId: async () => 7, getMysqlAnswer: async () => null };
    const result = await fullReconciliation(makeClient(pages), KNOWN_COLUMNS, deps);
    expect(result.totalRowsChecked).toBe(3); // all rows scanned
    expect(result.missingInMysql).toHaveLength(1); // but reported once
    expect(result.missingInMysql[0].pageId).toBe("p2"); // the newest-edited canonical page
  });
});

// ---------------------------------------------------------------------------
// Phase 4: Schema Validation
// ---------------------------------------------------------------------------

describe("Phase 4 — validateSchema", () => {
  it("generates a report with counts and timestamp", async () => {
    const report = await validateSchema(null, KNOWN_COLUMNS);
    expect(report.timestamp).toBeTruthy();
    expect(report.totalColumns).toBeGreaterThan(0);
    expect(report.detectedColumns).toBe(KNOWN_COLUMNS.length);
    expect(report.missingColumns).toEqual([]);
  });

  it("flags newly-discovered columns as warnings", async () => {
    const mapping: ColumnMapping[] = [
      ...KNOWN_COLUMNS,
      { notionPropertyName: "Orders Description", mysqlFieldName: "orders_description", type: "rich_text", required: false },
    ];
    const report = await validateSchema(null, mapping);
    expect(report.warnings.some((w) => w.includes("new columns"))).toBe(true);
  });

  it("flags missing required columns", async () => {
    // Mapping without the required "Slug" column
    const mapping = KNOWN_COLUMNS.filter((c) => c.notionPropertyName !== "Slug");
    const report = await validateSchema(null, mapping);
    expect(report.missingColumns).toContain("Slug");
    expect(report.warnings.some((w) => w.includes("Missing required column"))).toBe(true);
  });
});
