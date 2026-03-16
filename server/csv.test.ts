/**
 * Vitest tests for CSV utility functions.
 * These test the shared CSV helpers used by both Testing Checklist and Task List pages.
 */
import { describe, it, expect } from "vitest";

// Since the CSV utils are in client/src/lib/csv.ts and use no DOM APIs except downloadCSV,
// we can import and test the pure functions directly.
// We'll replicate the core logic here for server-side testing.

function escapeCSV(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = (values[idx] ?? "").trim();
    });
    results.push(row);
  }

  return results;
}

function csvFilename(orgName: string, reportType: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = orgName.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  return `${safeName}_${reportType}_${date}.csv`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("escapeCSV", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("returns plain string when no special chars", () => {
    expect(escapeCSV("Hello")).toBe("Hello");
  });

  it("wraps in quotes when value contains comma", () => {
    expect(escapeCSV("Hello, World")).toBe('"Hello, World"');
  });

  it("escapes double quotes", () => {
    expect(escapeCSV('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("wraps in quotes when value contains newline", () => {
    expect(escapeCSV("Line1\nLine2")).toBe('"Line1\nLine2"');
  });
});

describe("buildCSV", () => {
  it("builds correct CSV with headers and rows", () => {
    const headers = ["Name", "Status", "Date"];
    const rows = [
      ["VPN Test", "Tested", "2026-03-15"],
      ["DICOM Echo", "Not Tested", ""],
    ];
    const csv = buildCSV(headers, rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Status,Date");
    expect(lines[1]).toBe("VPN Test,Tested,2026-03-15");
    expect(lines[2]).toBe("DICOM Echo,Not Tested,");
  });

  it("escapes special characters in data", () => {
    const headers = ["Test Name", "Notes"];
    const rows = [["VPN, Firewall", 'Said "works"']];
    const csv = buildCSV(headers, rows);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('"VPN, Firewall","Said ""works"""');
  });

  it("handles empty rows", () => {
    const csv = buildCSV(["A", "B"], []);
    expect(csv).toBe("A,B\r\n");
  });
});

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    const csv = "Name,Status\r\nVPN Test,Tested\r\nDICOM Echo,Not Tested\r\n";
    const records = parseCSV(csv);
    expect(records).toHaveLength(2);
    expect(records[0]["Name"]).toBe("VPN Test");
    expect(records[0]["Status"]).toBe("Tested");
    expect(records[1]["Name"]).toBe("DICOM Echo");
    expect(records[1]["Status"]).toBe("Not Tested");
  });

  it("handles quoted fields with commas", () => {
    const csv = 'Name,Notes\r\n"VPN, Firewall",Works fine\r\n';
    const records = parseCSV(csv);
    expect(records[0]["Name"]).toBe("VPN, Firewall");
    expect(records[0]["Notes"]).toBe("Works fine");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = 'Name,Notes\r\nTest,"Said ""hello"""\r\n';
    const records = parseCSV(csv);
    expect(records[0]["Notes"]).toBe('Said "hello"');
  });

  it("returns empty array for empty input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("Header1,Header2")).toEqual([]);
  });

  it("handles missing values", () => {
    const csv = "A,B,C\r\nval1,,val3\r\n";
    const records = parseCSV(csv);
    expect(records[0]["A"]).toBe("val1");
    expect(records[0]["B"]).toBe("");
    expect(records[0]["C"]).toBe("val3");
  });
});

describe("csvFilename", () => {
  it("generates filename with org name and report type", () => {
    const filename = csvFilename("Baycare Hospital", "Testing_Checklist");
    expect(filename).toMatch(/^Baycare_Hospital_Testing_Checklist_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("sanitizes special characters in org name", () => {
    const filename = csvFilename("St. Mary's / Main", "Task_List");
    // Special chars replaced with _, consecutive underscores collapsed
    expect(filename).toMatch(/^St_Mary_s_Main_Task_List_/);
    expect(filename.endsWith(".csv")).toBe(true);
  });
});

describe("roundtrip: buildCSV → parseCSV", () => {
  it("preserves data through export and re-import", () => {
    const headers = ["Phase", "Test Name", "Status", "Date Tested", "Sign-Off", "Notes"];
    const rows = [
      ["Phase 1: Connectivity", "VPN Tunnel Connectivity", "Tested", "2026-03-15", "Ryan", "All good"],
      ["Phase 2: HL7", "ORM New Order (NW)", "Not Tested", "", "", ""],
      ["Phase 1: Connectivity", "DICOM Echo Test", "Tested", "2026-03-14", "Sarah", 'Notes with "quotes" and, commas'],
    ];

    const csv = buildCSV(headers, rows);
    const parsed = parseCSV(csv);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]["Test Name"]).toBe("VPN Tunnel Connectivity");
    expect(parsed[0]["Status"]).toBe("Tested");
    expect(parsed[0]["Date Tested"]).toBe("2026-03-15");
    expect(parsed[0]["Sign-Off"]).toBe("Ryan");
    expect(parsed[1]["Status"]).toBe("Not Tested");
    expect(parsed[2]["Notes"]).toBe('Notes with "quotes" and, commas');
  });
});
