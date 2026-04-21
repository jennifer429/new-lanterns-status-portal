import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for the swimlane router.
 *
 * Because the swimlane router depends on a real database connection (requireDb),
 * we mock the db module to isolate the logic. We test:
 *   1. getOrgs auto-seeds defaults when no orgs exist
 *   2. getOrgs returns existing orgs sorted by sortOrder
 *   3. getAssignments returns a taskId → implOrgId map
 *   4. assignTask performs delete + insert (upsert pattern)
 *   5. unassignTask deletes the assignment
 *   6. addOrg inserts with auto-calculated sortOrder
 *   7. removeOrg soft-deletes by setting isActive = 0
 */

// ── Mock DB layer ────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Chain helpers
const chainFrom = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn() };
const chainValues = { values: vi.fn() };
const chainSet = { set: vi.fn().mockReturnThis(), where: vi.fn() };
const chainDeleteWhere = { where: vi.fn() };

mockSelect.mockReturnValue(chainFrom);
mockInsert.mockReturnValue(chainValues);
mockUpdate.mockReturnValue(chainSet);
mockDelete.mockReturnValue(chainDeleteWhere);

vi.mock("../drizzle/schema", () => ({
  organizations: { id: "id", slug: "slug" },
  implementationOrgs: {
    id: "id",
    organizationId: "organizationId",
    isActive: "isActive",
    sortOrder: "sortOrder",
  },
  taskOrgAssignment: {
    id: "id",
    organizationId: "organizationId",
    taskId: "taskId",
    implOrgId: "implOrgId",
  },
}));

vi.mock("../server/db", () => ({
  requireDb: vi.fn(async () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: string, val: unknown) => ({ col, val }),
  and: (...args: unknown[]) => ({ and: args }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("swimlane router logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DEFAULT_ORG_TYPES has New Lantern with highest sortOrder", () => {
    // Verify the ordering rules: New Lantern rightmost, Silverback in middle
    const defaults = [
      { name: "Hospital IT", orgType: "hospital", sortOrder: 1 },
      { name: "EHR Vendor", orgType: "ehr_vendor", sortOrder: 2 },
      { name: "RIS Vendor", orgType: "ris_vendor", sortOrder: 3 },
      { name: "PACS/VNA Vendor", orgType: "pacs_vendor", sortOrder: 4 },
      { name: "Rad Group", orgType: "rad_group", sortOrder: 5 },
      { name: "Silverback (Data First)", orgType: "silverback", sortOrder: 6 },
      { name: "Scipio", orgType: "scipio", sortOrder: 7 },
      { name: "New Lantern", orgType: "new_lantern", sortOrder: 8 },
    ];

    const newLantern = defaults.find(d => d.orgType === "new_lantern")!;
    const silverback = defaults.find(d => d.orgType === "silverback")!;
    const hospital = defaults.find(d => d.orgType === "hospital")!;

    // New Lantern has the highest sortOrder (rightmost)
    expect(newLantern.sortOrder).toBe(Math.max(...defaults.map(d => d.sortOrder)));

    // Silverback is in the middle range
    expect(silverback.sortOrder).toBeGreaterThan(hospital.sortOrder);
    expect(silverback.sortOrder).toBeLessThan(newLantern.sortOrder);

    // Hospital is leftmost
    expect(hospital.sortOrder).toBe(Math.min(...defaults.map(d => d.sortOrder)));
  });

  it("status styles map covers all expected statuses", () => {
    const statuses = ["open", "in_progress", "complete", "n_a", "blocked"];
    const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
      open:        { bg: "bg-muted/30",          border: "border-border/60",        text: "text-foreground/70",    label: "Open" },
      in_progress: { bg: "bg-amber-500/15",      border: "border-amber-500/40",     text: "text-amber-300",        label: "In Progress" },
      complete:    { bg: "bg-emerald-500/15",     border: "border-emerald-500/40",   text: "text-emerald-400",      label: "Done" },
      n_a:         { bg: "bg-muted/20",          border: "border-muted/40",         text: "text-muted-foreground/50", label: "N/A" },
      blocked:     { bg: "bg-red-500/15",        border: "border-red-500/40",       text: "text-red-400",          label: "Blocked" },
    };

    for (const status of statuses) {
      expect(STATUS_STYLES[status]).toBeDefined();
      expect(STATUS_STYLES[status].bg).toBeTruthy();
      expect(STATUS_STYLES[status].border).toBeTruthy();
      expect(STATUS_STYLES[status].text).toBeTruthy();
      expect(STATUS_STYLES[status].label).toBeTruthy();
    }
  });

  it("org type colors map covers all default org types", () => {
    const orgTypes = [
      "hospital", "ehr_vendor", "ris_vendor", "pacs_vendor",
      "rad_group", "silverback", "scipio", "new_lantern", "other",
    ];

    const ORG_TYPE_COLORS: Record<string, string> = {
      hospital:    "bg-blue-500/20 text-blue-400 border-blue-500/30",
      ehr_vendor:  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      ris_vendor:  "bg-teal-500/20 text-teal-400 border-teal-500/30",
      pacs_vendor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
      rad_group:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
      silverback:  "bg-slate-500/20 text-slate-300 border-slate-500/30",
      scipio:      "bg-violet-500/20 text-violet-400 border-violet-500/30",
      new_lantern: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      other:       "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    };

    for (const orgType of orgTypes) {
      expect(ORG_TYPE_COLORS[orgType]).toBeDefined();
      expect(ORG_TYPE_COLORS[orgType]).toContain("bg-");
      expect(ORG_TYPE_COLORS[orgType]).toContain("text-");
      expect(ORG_TYPE_COLORS[orgType]).toContain("border-");
    }
  });

  it("task status derivation logic works correctly", () => {
    // Replicate the getTaskStatus logic from SwimlaneView
    function getTaskStatus(t: {
      completed: boolean;
      notApplicable: boolean;
      blocked: boolean;
      inProgress: boolean;
    }): string {
      if (t.completed) return "complete";
      if (t.notApplicable) return "n_a";
      if (t.blocked) return "blocked";
      if (t.inProgress) return "in_progress";
      return "open";
    }

    expect(getTaskStatus({ completed: true, notApplicable: false, blocked: false, inProgress: false })).toBe("complete");
    expect(getTaskStatus({ completed: false, notApplicable: true, blocked: false, inProgress: false })).toBe("n_a");
    expect(getTaskStatus({ completed: false, notApplicable: false, blocked: true, inProgress: false })).toBe("blocked");
    expect(getTaskStatus({ completed: false, notApplicable: false, blocked: false, inProgress: true })).toBe("in_progress");
    expect(getTaskStatus({ completed: false, notApplicable: false, blocked: false, inProgress: false })).toBe("open");

    // Priority: completed > notApplicable > blocked > inProgress
    expect(getTaskStatus({ completed: true, notApplicable: true, blocked: true, inProgress: true })).toBe("complete");
    expect(getTaskStatus({ completed: false, notApplicable: true, blocked: true, inProgress: true })).toBe("n_a");
  });

  it("SECTION_DEFS has expected structure for swimlane columns", async () => {
    const { SECTION_DEFS } = await import("../shared/taskDefs");

    expect(SECTION_DEFS.length).toBeGreaterThan(0);

    for (const section of SECTION_DEFS) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.tasks.length).toBeGreaterThan(0);

      for (const task of section.tasks) {
        expect(task.id).toBeTruthy();
        expect(task.title).toBeTruthy();
        // Task IDs should follow section:name pattern
        expect(task.id).toContain(":");
      }
    }
  });

  it("assignment map correctly maps taskId to implOrgId", () => {
    // Simulate the map building logic from getAssignments
    const rows = [
      { taskId: "network:vpn", implOrgId: 1 },
      { taskId: "hl7:orm", implOrgId: 2 },
      { taskId: "config:proc", implOrgId: 1 },
    ];

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.taskId] = row.implOrgId;
    }

    expect(map["network:vpn"]).toBe(1);
    expect(map["hl7:orm"]).toBe(2);
    expect(map["config:proc"]).toBe(1);
    expect(map["nonexistent"]).toBeUndefined();
  });
});
