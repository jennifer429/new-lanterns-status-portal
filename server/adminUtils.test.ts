import { describe, it, expect } from "vitest";

/**
 * Tests for shared admin utility functions
 * These functions transform backend sectionProgress data for display in admin dashboards
 */

// Import the functions we're testing
import { transformSectionProgress, getInProgressSections } from "../client/src/lib/adminUtils";

describe("Admin Utilities", () => {
  describe("transformSectionProgress", () => {
    it("should transform backend format to display format", () => {
      const backendData = {
        "Organization Information": { completed: 5, total: 10 },
        "Orders Workflow": { completed: 1, total: 1 },
        "Images Workflow": { completed: 0, total: 1 },
      };

      const result = transformSectionProgress(backendData);

      expect(result).toEqual([
        { name: "Organization Information", progress: 50 },
        { name: "Orders Workflow", progress: 100 },
        { name: "Images Workflow", progress: 0 },
      ]);
    });

    it("should handle empty sectionProgress", () => {
      const result = transformSectionProgress(undefined);
      expect(result).toEqual([]);
    });

    it("should handle zero total (avoid division by zero)", () => {
      const backendData = {
        "Empty Section": { completed: 0, total: 0 },
      };

      const result = transformSectionProgress(backendData);

      expect(result).toEqual([
        { name: "Empty Section", progress: 0 },
      ]);
    });

    it("should round percentages correctly", () => {
      const backendData = {
        "Section A": { completed: 1, total: 3 }, // 33.333...%
        "Section B": { completed: 2, total: 3 }, // 66.666...%
      };

      const result = transformSectionProgress(backendData);

      expect(result).toEqual([
        { name: "Section A", progress: 33 },
        { name: "Section B", progress: 67 },
      ]);
    });
  });

  describe("getInProgressSections", () => {
    it("should filter out sections with 0% progress", () => {
      const sectionProgress = [
        { name: "Section A", progress: 0 },
        { name: "Section B", progress: 50 },
        { name: "Section C", progress: 100 },
        { name: "Section D", progress: 0 },
      ];

      const result = getInProgressSections(sectionProgress);

      expect(result).toEqual([
        { name: "Section B", progress: 50 },
        { name: "Section C", progress: 100 },
      ]);
    });

    it("should return empty array when all sections are 0%", () => {
      const sectionProgress = [
        { name: "Section A", progress: 0 },
        { name: "Section B", progress: 0 },
      ];

      const result = getInProgressSections(sectionProgress);

      expect(result).toEqual([]);
    });

    it("should return all sections when none are 0%", () => {
      const sectionProgress = [
        { name: "Section A", progress: 25 },
        { name: "Section B", progress: 50 },
        { name: "Section C", progress: 100 },
      ];

      const result = getInProgressSections(sectionProgress);

      expect(result).toEqual(sectionProgress);
    });
  });

  describe("Integration: transformSectionProgress + getInProgressSections", () => {
    it("should work together to transform and filter backend data", () => {
      const backendData = {
        "Organization Information": { completed: 5, total: 10 },
        "Orders Workflow": { completed: 1, total: 1 },
        "Images Workflow": { completed: 0, total: 1 },
        "Priors Workflow": { completed: 0, total: 1 },
        "Reports Out Workflow": { completed: 0, total: 1 },
      };

      const transformed = transformSectionProgress(backendData);
      const inProgress = getInProgressSections(transformed);

      expect(inProgress).toEqual([
        { name: "Organization Information", progress: 50 },
        { name: "Orders Workflow", progress: 100 },
      ]);
    });
  });
});
