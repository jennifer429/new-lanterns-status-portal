import { describe, it, expect } from "vitest";
import { computeOverallProgress } from "@shared/overallProgress";

describe("computeOverallProgress (shared formula)", () => {
  it("blends q*0.4 + v*0.3 + i*0.3 and rounds once at the end", () => {
    const r = computeOverallProgress({
      completedSections: 6,
      totalSections: 6,
      validation: { pass: 28, fail: 0, inProgress: 0, blocked: 0, na: 0, total: 28 },
      tasks: { completed: 30, inProgress: 0, blocked: 0, na: 0, total: 30 },
    });
    expect(r.overallPct).toBe(100);
  });

  it("counts N/A as resolved (Model B) and keeps the fixed denominator", () => {
    // 8 N/A tests count toward 'done'; partial credit for in-progress/blocked.
    const r = computeOverallProgress({
      completedSections: 5,
      totalSections: 6,
      validation: { pass: 9, fail: 1, inProgress: 3, blocked: 2, na: 8, total: 28 },
      tasks: { completed: 10, inProgress: 4, blocked: 1, na: 6, total: 30 },
    });
    expect(Math.round(r.qPct)).toBe(83);
    expect(Math.round(r.vPct)).toBe(69);
    expect(Math.round(r.iPct)).toBe(61);
    expect(r.overallPct).toBe(72);
  });

  it("reads an all-N/A category as 100% (nothing left to do)", () => {
    const r = computeOverallProgress({
      completedSections: 6,
      totalSections: 6,
      validation: { pass: 28, fail: 0, inProgress: 0, blocked: 0, na: 0, total: 28 },
      tasks: { completed: 0, inProgress: 0, blocked: 0, na: 30, total: 30 },
    });
    expect(r.iPct).toBe(100);
  });

  it("gives in-progress 50% and blocked 25% partial credit", () => {
    const r = computeOverallProgress({
      completedSections: 0,
      totalSections: 1,
      validation: { pass: 0, fail: 0, inProgress: 0, blocked: 0, na: 0, total: 1 },
      tasks: { completed: 0, inProgress: 1, blocked: 1, na: 0, total: 4 },
    });
    // (0 + 1*0.5 + 1*0.25) / 4 = 0.1875 -> 18.75%
    expect(r.iPct).toBeCloseTo(18.75, 5);
  });

  it("guards empty categories against NaN", () => {
    const r = computeOverallProgress({
      completedSections: 0,
      totalSections: 0,
      validation: { pass: 0, fail: 0, inProgress: 0, blocked: 0, na: 0, total: 0 },
      tasks: { completed: 0, inProgress: 0, blocked: 0, na: 0, total: 0 },
    });
    expect(r.overallPct).toBe(0);
    expect(Number.isNaN(r.qPct)).toBe(false);
  });
});
