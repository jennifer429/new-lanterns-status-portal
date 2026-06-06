/**
 * Tests for the in-process data-quality check (server/dataQualityCheck.ts).
 *
 * Proves:
 * 1. A clean DB (no orphans, no duplicates) yields all PASS, 0 fail/warn.
 * 2. An orphan in a FAIL-severity table produces a FAIL finding.
 * 3. An orphan in a Notion-cache table (contacts/systems) produces a WARN, not FAIL.
 * 4. A duplicate logical key produces a FAIL finding.
 * 5. A DB error is captured as WARN — the check never throws.
 * 6. getLastDataQualityResult() returns the most recent result.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Routes each raw query to a row array based on the table name in the SQL text.
// Set by individual tests; defaults to "everything clean" (empty rows).
let rowsForQuery: (queryText: string) => any[] = () => [];

const mockExecute = vi.fn(async (query: any) => {
  const text: string = query?.queryChunks?.[0]?.value?.[0] ?? "";
  return [rowsForQuery(text), []];
});

const mockDb = { execute: mockExecute };

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getDb: vi.fn(async () => mockDb),
}));

import { runDataQualityCheck, getLastDataQualityResult } from "./dataQualityCheck";

beforeEach(() => {
  rowsForQuery = () => [];
  mockExecute.mockClear();
});

describe("data-quality check", () => {
  it("reports all PASS when the DB is clean", async () => {
    const result = await runDataQualityCheck();
    expect(result.failed).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
    // Every finding on a clean run is a PASS.
    expect(result.findings.every((f) => f.status === "PASS")).toBe(true);
  });

  it("flags an orphan in a FAIL-severity table as FAIL", async () => {
    rowsForQuery = (text) =>
      text.includes("`responses` c") ? [{ val: 999, cnt: 3 }] : [];

    const result = await runDataQualityCheck();
    expect(result.failed).toBeGreaterThanOrEqual(1);
    const finding = result.findings.find((f) => f.test.startsWith("responses.organizationId"));
    expect(finding?.status).toBe("FAIL");
    expect(finding?.detail).toContain("organizationId=999");
  });

  it("flags an orphan in a Notion-cache table as WARN, not FAIL", async () => {
    rowsForQuery = (text) =>
      text.includes("`contacts` c") ? [{ val: 42, cnt: 1 }] : [];

    const result = await runDataQualityCheck();
    expect(result.failed).toBe(0);
    expect(result.warnings).toBe(1);
    const finding = result.findings.find((f) => f.test.startsWith("contacts.organizationId"));
    expect(finding?.status).toBe("WARN");
  });

  it("flags a duplicate logical key as FAIL", async () => {
    rowsForQuery = (text) =>
      text.includes("FROM `taskCompletion`") && text.includes("HAVING")
        ? [{ organizationId: 1, taskId: "network:vpn", cnt: 2 }]
        : [];

    const result = await runDataQualityCheck();
    const finding = result.findings.find((f) => f.test.includes("taskCompletion unique"));
    expect(finding?.status).toBe("FAIL");
    expect(finding?.detail).toContain("taskId=network:vpn");
  });

  it("captures a DB error as WARN and never throws", async () => {
    mockExecute.mockImplementationOnce(async () => {
      throw new Error("connection reset");
    });
    const result = await runDataQualityCheck();
    expect(result.warnings).toBeGreaterThanOrEqual(1);
    // The very first orphan check errored → recorded as WARN, not a crash.
    expect(result.findings[0].status).toBe("WARN");
    expect(result.findings[0].detail).toContain("connection reset");
  });

  it("caches the most recent result", async () => {
    rowsForQuery = (text) => (text.includes("`contacts` c") ? [{ val: 7, cnt: 1 }] : []);
    const result = await runDataQualityCheck();
    const cached = getLastDataQualityResult();
    expect(cached).not.toBeNull();
    expect(cached!.warnings).toBe(result.warnings);
    expect(cached!.ranAt).toBe(result.ranAt);
  });
});
