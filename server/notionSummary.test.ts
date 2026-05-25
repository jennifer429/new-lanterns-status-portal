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

  it("summarizes workflow config with active paths", () => {
    const answer = JSON.stringify({
      paths: { ordersFromRIS: true, ordersFromEHR: false, manualEntry: true },
      systems: {},
      notes: { ordersFromRIS_note: "Primary workflow" },
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("Active: Orders from RIS");
    expect(result).toContain("Manual Entry");
    expect(result).toContain('Orders from RIS: "Primary workflow"');
    expect(result).not.toContain("Orders from EHR");
  });

  it("summarizes workflow config with systems", () => {
    const answer = JSON.stringify({
      paths: { priorsPush: true },
      systems: { priorsPushSource: "Laurel Bridge" },
      notes: {},
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("Active: Priors Push");
    expect(result).toContain("Systems: priorsPushSource: Laurel Bridge");
  });

  it("returns 'No workflows active' when all paths are false", () => {
    const answer = JSON.stringify({
      paths: { ordersFromRIS: false, ordersFromEHR: false },
      systems: {},
      notes: {},
    });
    expect(generateAnswerSummary(answer)).toBe("No workflows active");
  });

  it("summarizes generic JSON objects by keys", () => {
    const answer = JSON.stringify({ key1: "val", key2: "val", key3: "val" });
    expect(generateAnswerSummary(answer)).toBe("key1, key2, key3");
  });

  it("truncates generic objects with many keys", () => {
    const obj: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) obj[`field${i}`] = "v";
    const result = generateAnswerSummary(JSON.stringify(obj));
    expect(result).toContain("(+3 more)");
  });

  it("handles images workflow config", () => {
    const answer = JSON.stringify({
      paths: { imagesFromModalities: true, imagesViaVNA: true, imagesViaAI: false },
      systems: {},
      notes: { imagesFromModalities_note: "All scanners" },
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("Images from Modalities");
    expect(result).toContain("Images via VNA");
    expect(result).not.toContain("Images via AI");
    expect(result).toContain('Images from Modalities: "All scanners"');
  });

  it("handles reports workflow config", () => {
    const answer = JSON.stringify({
      paths: { reportsToRIS: true, reportsToEHR: false, reportsToPortal: true },
      systems: {},
      notes: {},
    });
    const result = generateAnswerSummary(answer);
    expect(result).toContain("Reports to RIS");
    expect(result).toContain("Reports to Portal");
    expect(result).not.toContain("Reports to EHR");
  });
});
