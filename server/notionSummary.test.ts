import { describe, it, expect } from "vitest";
import { generateAnswerSummary } from "./notionSummary";

describe("generateAnswerSummary", () => {
  it("returns empty string for plain text answers", () => {
    expect(generateAnswerSummary("Hello world")).toBe("");
    expect(generateAnswerSummary("Some plain answer")).toBe("");
  });

  it("returns empty string for empty/null input", () => {
    expect(generateAnswerSummary("")).toBe("");
    expect(generateAnswerSummary("   ")).toBe("");
  });

  it("summarizes multi-select arrays", () => {
    const answer = JSON.stringify(["CT", "MRI", "X-Ray"]);
    expect(generateAnswerSummary(answer)).toBe("CT, MRI, X-Ray");
  });

  it("handles empty arrays", () => {
    expect(generateAnswerSummary("[]")).toBe("None selected");
  });

  it("summarizes workflow config with active paths and inline notes", () => {
    const answer = JSON.stringify({
      paths: { ordersFromRIS: true, ordersFromEHR: false, manualEntry: true },
      systems: {},
      notes: { ordersFromRIS_note: "Primary workflow" },
    });
    const result = generateAnswerSummary(answer);
    // Single-line format: ✓ Path ("note") · ✓ Path2
    expect(result).toContain('✓ Orders from RIS ("Primary workflow")');
    expect(result).toContain("✓ Manual Entry");
    expect(result).not.toContain("Orders from EHR");
    // Should be a single line (no newlines)
    expect(result).not.toContain("\n");
  });

  it("summarizes workflow config with systems inline", () => {
    const answer = JSON.stringify({
      paths: { priorsPush: true },
      systems: { priorsPushSource: "Laurel Bridge" },
      notes: {},
    });
    const result = generateAnswerSummary(answer);
    // Single-line: ✓ Priors Push | priorsPushSource: Laurel Bridge
    expect(result).toContain("✓ Priors Push");
    expect(result).toContain("| priorsPushSource: Laurel Bridge");
    expect(result).not.toContain("\n");
  });

  it("returns 'No workflows active' when all paths are false", () => {
    const answer = JSON.stringify({
      paths: { ordersFromRIS: false, ordersFromEHR: false },
      systems: {},
      notes: {},
    });
    expect(generateAnswerSummary(answer)).toBe("No workflows active");
  });

  it("handles images workflow config with inline notes", () => {
    const answer = JSON.stringify({
      paths: { imagesFromModalities: true, imagesViaVNA: true, imagesViaAI: false },
      systems: {},
      notes: { imagesFromModalities_note: "All scanners" },
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain('✓ Images from Modalities ("All scanners")');
    expect(result).toContain("✓ Images via VNA");
    expect(result).not.toContain("Images via AI");
    expect(result).not.toContain("\n");
  });

  it("handles reports workflow config", () => {
    const answer = JSON.stringify({
      paths: { reportsToRIS: true, reportsToEHR: false, reportsToPortal: true },
      systems: {},
      notes: {},
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("✓ Reports to RIS");
    expect(result).toContain("✓ Reports to Portal");
    expect(result).not.toContain("Reports to EHR");
    expect(result).not.toContain("\n");
  });

  it("truncates long notes to 30 chars", () => {
    const answer = JSON.stringify({
      paths: { ordersFromRIS: true },
      systems: {},
      notes: { ordersFromRIS_note: "This is a very long note that exceeds thirty characters easily" },
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("✓ Orders from RIS");
    expect(result).toContain("...");
    // Should not contain the full note
    expect(result).not.toContain("exceeds thirty characters easily");
  });

  // ── New tests for ARCH.systems, IW.systems, CONN.endpoints, contacts ──

  it("summarizes ARCH.systems array of system objects", () => {
    const answer = JSON.stringify([
      { id: "pacs-1", name: "Visage", type: "PACS", description: "" },
      { id: "vna-1", name: "Merge", type: "VNA", description: "Confirmed" },
      { id: "rtr-1", name: "Silverback", type: "Router", description: "" },
      { id: "ehr-1", name: "Cerner", type: "EHR", description: "Main EHR" },
    ]);
    const result = generateAnswerSummary(answer);
    expect(result).toBe("Visage (PACS), Merge (VNA), Silverback (Router), Cerner (EHR)");
  });

  it("summarizes IW.systems with empty names gracefully", () => {
    const answer = JSON.stringify([
      { id: "1", name: "Epic", type: "RIS", notes: "" },
      { id: "2", name: "", type: "PACS", notes: "" },
      { id: "3", name: "", type: "VNA", notes: "" },
    ]);
    const result = generateAnswerSummary(answer);
    expect(result).toBe("Epic (RIS), PACS, VNA");
  });

  it("truncates systems list when more than 6", () => {
    const systems = Array.from({ length: 8 }, (_, i) => ({
      id: `id-${i}`, name: `System${i}`, type: "Type", notes: "",
    }));
    const result = generateAnswerSummary(JSON.stringify(systems));
    expect(result).toContain("System0 (Type)");
    expect(result).toContain("(+3 more)");
  });

  it("summarizes CONN.endpoints with traffic type and source/dest", () => {
    const answer = JSON.stringify([
      {
        id: "conn_1", trafficType: "HL7 ORM (Orders)",
        sourceSystem: "BayCare Cloverleaf", destinationSystem: "New Lantern",
        sourceIp: "", sourcePort: "", destIp: "", destPort: "",
        sourceAeTitle: "", destAeTitle: "", envTest: false, envProd: true, notes: "",
      },
      {
        id: "conn_2", trafficType: "DICOM - C-STORE (Images)",
        sourceSystem: "Silverback", destinationSystem: "New Lantern PACS",
        sourceIp: "", sourcePort: "", destIp: "", destPort: "",
        sourceAeTitle: "", destAeTitle: "", envTest: true, envProd: true, notes: "",
      },
    ]);
    const result = generateAnswerSummary(answer);
    expect(result).toContain("HL7 ORM (Orders): BayCare Cloverleaf → New Lantern");
    expect(result).toContain("DICOM - C-STORE (Images): Silverback → New Lantern PACS");
  });

  it("truncates endpoints list when more than 4", () => {
    const endpoints = Array.from({ length: 6 }, (_, i) => ({
      id: `conn_${i}`, trafficType: `Type${i}`,
      sourceSystem: `Src${i}`, destinationSystem: `Dst${i}`,
      sourceIp: "", sourcePort: "", destIp: "", destPort: "",
      sourceAeTitle: "", destAeTitle: "", envTest: false, envProd: true, notes: "",
    }));
    const result = generateAnswerSummary(JSON.stringify(endpoints));
    expect(result).toContain("Type0: Src0 → Dst0");
    expect(result).toContain("(+3 more)");
  });

  it("summarizes contacts object with admin and additional contacts", () => {
    const answer = JSON.stringify({
      admin: { name: "Shonna Simpson", phone: "813-586-5850", email: "shonna@test.org", title: "PM" },
      additional_contacts: [
        { name: "Kevin Kadakia", email: "kevin@test.com", org: "RadOne", role: "Lead" },
        { name: "Tarang Patel", email: "tarang@test.com", org: "RadOne", role: "Medical" },
        { name: "Chris Parisi", email: "chris@test.com", org: "BayCare", role: "Security" },
        { name: "Aaron Baker", email: "aaron@test.com", org: "BayCare", role: "ISS" },
      ],
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("Admin: Shonna Simpson");
    expect(result).toContain("Kevin Kadakia");
    expect(result).toContain("(+2 more)");
  });

  it("handles contacts with only admin", () => {
    const answer = JSON.stringify({
      admin: { name: "John Doe", phone: "", email: "john@test.org" },
      additional_contacts: [],
    });
    const result = generateAnswerSummary(answer);
    expect(result).toBe("Admin: John Doe");
  });

  it("summarizes generic JSON objects with key-value pairs", () => {
    const answer = JSON.stringify({ hostname: "srv01.local", port: 8080, ssl: true });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("hostname: srv01.local");
    expect(result).toContain("port: 8080");
    expect(result).toContain("ssl: true");
  });

  it("truncates generic objects with many keys", () => {
    const obj: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) obj[`field${i}`] = "v";
    const result = generateAnswerSummary(JSON.stringify(obj));
    expect(result).toContain("(+4 more)");
  });
});
