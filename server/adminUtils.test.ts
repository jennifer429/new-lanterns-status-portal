import { describe, it, expect } from "vitest";

/**
 * Tests for shared admin utility functions
 * These functions transform backend sectionProgress data for display in admin dashboards
 */

// Import the functions we're testing
import { transformSectionProgress } from "@/lib/adminUtils";

describe("Admin Utilities", () => {
  describe("transformSectionProgress", () => {
    it("should transform backend format to display format and include all 6 sections", () => {
      const backendData = {
        "Organization Info": { completed: 5, total: 10 },
        "Integration Workflows": { completed: 3, total: 6 },
        "Connectivity": { completed: 0, total: 5 },
      };

      const result = transformSectionProgress(backendData);

      // Should return all 6 sections, with provided data and 0% for missing sections
      expect(result.length).toBe(6);
      expect(result).toContainEqual({ name: "Organization Info", progress: 50 });
      expect(result).toContainEqual({ name: "Integration Workflows", progress: 50 });
      expect(result).toContainEqual({ name: "Connectivity", progress: 0 });
      expect(result).toContainEqual({ name: "HL7 & DICOM Data", progress: 0 });
      expect(result).toContainEqual({ name: "Architecture", progress: 0 });
      expect(result).toContainEqual({ name: "Configuration Files", progress: 0 });
    });

    it("should return all 6 sections at 0% for empty/undefined input", () => {
      const result = transformSectionProgress(undefined);
      expect(result.length).toBe(6);
      expect(result.every(s => s.progress === 0)).toBe(true);
      // Verify it includes expected section names
      const sectionNames = result.map(s => s.name);
      expect(sectionNames).toContain("Organization Info");
      expect(sectionNames).toContain("Architecture");
      expect(sectionNames).toContain("Integration Workflows");
      expect(sectionNames).toContain("Connectivity");
      expect(sectionNames).toContain("Configuration Files");
      expect(sectionNames).toContain("HL7 & DICOM Data");
    });

    it("should handle zero total (avoid division by zero)", () => {
      const backendData = {
        "Organization Info": { completed: 0, total: 0 },
      };

      const result = transformSectionProgress(backendData);

      // Should return all 6 sections, with 0% for the one with zero total
      expect(result.length).toBe(6);
      const orgInfoSection = result.find(s => s.name === "Organization Info");
      expect(orgInfoSection?.progress).toBe(0);
    });

    it("should round percentages correctly", () => {
      const backendData = {
        "Organization Info": { completed: 1, total: 3 }, // 33.333...%
        "Connectivity": { completed: 2, total: 3 }, // 66.666...%
      };

      const result = transformSectionProgress(backendData);

      // Should return all 6 sections with correct rounding for provided data
      expect(result.length).toBe(6);
      expect(result).toContainEqual({ name: "Organization Info", progress: 33 });
      expect(result).toContainEqual({ name: "Connectivity", progress: 67 });
    });
  });
});
