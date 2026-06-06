/**
 * Tests for sync-boundary type coercion (server/syncBoundary.ts).
 *
 * These guard the Notion → MySQL boundary against the type confusion that
 * historically crashed whole sync runs (Invalid Date → NaN version checks,
 * out-of-enum status → CHECK constraint rejection).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { coerceNotionDate, coerceValidationStatus, safeJsonParse, VALIDATION_STATUSES } from "./syncBoundary";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("coerceNotionDate", () => {
  it("parses a valid ISO string into a Date", () => {
    const d = coerceNotionDate("2026-06-05T10:00:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe("2026-06-05T10:00:00.000Z");
  });

  it("passes a valid Date through unchanged", () => {
    const input = new Date("2026-01-02T03:04:05Z");
    expect(coerceNotionDate(input)).toBe(input);
  });

  it("returns null for null / undefined / empty / whitespace", () => {
    expect(coerceNotionDate(null)).toBeNull();
    expect(coerceNotionDate(undefined)).toBeNull();
    expect(coerceNotionDate("")).toBeNull();
    expect(coerceNotionDate("   ")).toBeNull();
  });

  it("returns null (not Invalid Date) for unparseable strings, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = coerceNotionDate("not a date", "task completedAt");
    expect(d).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("task completedAt");
  });

  it("returns null for an Invalid Date object", () => {
    expect(coerceNotionDate(new Date("garbage"))).toBeNull();
  });
});

describe("coerceValidationStatus", () => {
  it("passes every allowed enum value through", () => {
    for (const s of VALIDATION_STATUSES) {
      expect(coerceValidationStatus(s)).toBe(s);
    }
  });

  it("trims surrounding whitespace before matching", () => {
    expect(coerceValidationStatus("  Pass  ")).toBe("Pass");
  });

  it("falls back to 'Not Tested' for unknown values, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(coerceValidationStatus("Passed")).toBe("Not Tested");
    expect(coerceValidationStatus(null)).toBe("Not Tested");
    expect(coerceValidationStatus(undefined)).toBe("Not Tested");
    // null/undefined are silent defaults; only the genuine unknown string warns.
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    expect(safeJsonParse("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("returns the fallback for empty / null input", () => {
    expect(safeJsonParse("", { ok: true })).toEqual({ ok: true });
    expect(safeJsonParse(null)).toBeNull();
  });

  it("returns the fallback for malformed JSON instead of throwing, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeJsonParse("{bad json", [])).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
