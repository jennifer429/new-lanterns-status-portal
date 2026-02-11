import { describe, it, expect } from "vitest";

/**
 * Tests for shared admin utility functions
 * These functions transform backend sectionProgress data for display in admin dashboards
 */

// Import the functions we're testing
import { transformSectionProgress } from "../client/src/lib/adminUtils";

describe("Admin Utilities", () => {
  describe("transformSectionProgress", () => {
    it("should transform backend format to display format and include all 9 sections", () => {
      const backendData = {
        "Organization Info": { completed: 5, total: 10 },
        "Orders Workflow": { completed: 1, total: 1 },
        "Images Workflow": { completed: 0, total: 1 },
      };

      const result = transformSectionProgress(backendData);

      // Should return all 9 sections, with provided data and 0% for missing sections
      expect(result.length).toBe(9);
      expect(result).toContainEqual({ name: "Organization Info", progress: 50 });
      expect(result).toContainEqual({ name: "Orders Workflow", progress: 100 });
      expect(result).toContainEqual({ name: "Images Workflow", progress: 0 });
    });

    it("should return all 9 sections at 0% for empty/undefined input", () => {
      const result = transformSectionProgress(undefined);
      expect(result.length).toBe(9);
      expect(result.every(s => s.progress === 0)).toBe(true);
      // Verify it includes expected section names
      const sectionNames = result.map(s => s.name);
      expect(sectionNames).toContain("Organization Info");
      expect(sectionNames).toContain("Orders Workflow");
      expect(sectionNames).toContain("Images Workflow");
    });

    it("should handle zero total (avoid division by zero)", () => {
      const backendData = {
        "Organization Info": { completed: 0, total: 0 },
      };

      const result = transformSectionProgress(backendData);

      // Should return all 9 sections, with 0% for the one with zero total
      expect(result.length).toBe(9);
      const orgInfoSection = result.find(s => s.name === "Organization Info");
      expect(orgInfoSection?.progress).toBe(0);
    });

    it("should round percentages correctly", () => {
      const backendData = {
        "Organization Info": { completed: 1, total: 3 }, // 33.333...%
        "Orders Workflow": { completed: 2, total: 3 }, // 66.666...%
      };

      const result = transformSectionProgress(backendData);

      // Should return all 9 sections with correct rounding for provided data
      expect(result.length).toBe(9);
      expect(result).toContainEqual({ name: "Organization Info", progress: 33 });
      expect(result).toContainEqual({ name: "Orders Workflow", progress: 67 });
    });
  });


});
