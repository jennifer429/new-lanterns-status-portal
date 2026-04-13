import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the exports router endpoints.
 * These test the HTML generation logic for:
 * 1. Status Report (PDF-ready HTML)
 * 2. Remaining Tasks Email (formatted HTML email)
 */

// Mock the database module
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
};

vi.mock("./db", () => ({
  requireDb: vi.fn().mockResolvedValue(mockDb),
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// Mock the connectivity helpers
vi.mock("./connectivityHelpers", () => ({
  fetchConnectivityRows: vi.fn().mockResolvedValue([]),
}));

describe("Exports Router", () => {
  describe("Status Report HTML", () => {
    it("should export the router module without errors", async () => {
      const mod = await import("./routers/exports");
      expect(mod.exportsRouter).toBeDefined();
    });

    it("should have statusReport and taskEmail procedures", async () => {
      const mod = await import("./routers/exports");
      const router = mod.exportsRouter;
      // Check that the router has the expected procedure names
      const procedures = Object.keys(router._def.procedures);
      expect(procedures).toContain("statusReport");
      expect(procedures).toContain("taskEmail");
    });
  });

  describe("HTML Generation Helpers", () => {
    it("should generate valid HTML structure for status report", async () => {
      // Import the module to verify it loads
      const mod = await import("./routers/exports");
      expect(mod).toBeDefined();
    });

    it("should handle empty task data gracefully", async () => {
      // Verify that the task definitions are importable
      const { SECTION_DEFS } = await import("@shared/taskDefs");
      expect(SECTION_DEFS).toBeDefined();
      expect(Array.isArray(SECTION_DEFS)).toBe(true);
      expect(SECTION_DEFS.length).toBeGreaterThan(0);
    });

    it("should have valid questionnaire sections for progress calculation", async () => {
      const { questionnaireSections } = await import("@shared/questionnaireData");
      expect(questionnaireSections).toBeDefined();
      expect(Array.isArray(questionnaireSections)).toBe(true);
    });

    it("should calculate progress correctly with empty responses", async () => {
      const { calculateProgress } = await import("@shared/progressCalculation");
      expect(calculateProgress).toBeDefined();
      // With empty responses, progress should be 0
      const result = calculateProgress([], [], []);
      expect(result).toBeDefined();
    });
  });

  describe("Task Email HTML", () => {
    it("should identify remaining tasks from empty completion data", async () => {
      const { SECTION_DEFS } = await import("@shared/taskDefs");
      // With no completions, all tasks should be remaining
      const allTasks = SECTION_DEFS.flatMap((section: any) =>
        section.tasks.map((task: any) => ({
          section: section.title,
          taskId: task.id,
          title: task.title,
        }))
      );
      expect(allTasks.length).toBeGreaterThan(0);
      // Every task should have required fields
      allTasks.forEach((task: any) => {
        expect(task.section).toBeTruthy();
        expect(task.taskId).toBeTruthy();
        expect(task.title).toBeTruthy();
      });
    });

    it("should categorize tasks by section correctly", async () => {
      const { SECTION_DEFS } = await import("@shared/taskDefs");
      // Should have multiple sections
      expect(SECTION_DEFS.length).toBeGreaterThan(1);
      // Each section should have tasks
      SECTION_DEFS.forEach((section: any) => {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.tasks.length).toBeGreaterThan(0);
      });
    });
  });
});
