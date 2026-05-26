import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the dirty-check logic in notionSyncBackTasks.
 *
 * We mock the DB to control what "existing" looks like, then verify:
 * 1. Identical data → skipped (no DB write, no timestamp advance)
 * 2. Changed data → updated (DB write happens)
 * 3. New row (no existing) → inserted
 */

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockResolvedValue(undefined);

let mockSelectResult: any[] = [];

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult)),
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
  }),
};

vi.mock("./db", () => ({
  requireDb: vi.fn().mockImplementation(async () => mockDb),
}));

// Mock the Notion client (not needed for dirty-check tests)
vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    pages: { update: vi.fn().mockResolvedValue({}) },
  })),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    notionApiKey: "test-key",
    notionTaskCompletionDataSourceId: "test-ds",
    notionValidationResultsDataSourceId: "test-ds",
  },
}));

vi.mock("./notionTaskValidation", async () => {
  const actual = await vi.importActual("./notionTaskValidation");
  return {
    ...actual,
    fetchChangedTaskCompletions: vi.fn().mockResolvedValue([]),
    fetchChangedValidationResults: vi.fn().mockResolvedValue([]),
  };
});

// ─── Import after mocks ────────────────────────────────────────────────────────

// We need to test the internal upsert functions. Since they're not exported,
// we test through the main runTaskValidationSyncBack function by mocking the
// fetch functions to return controlled data.

import { runTaskValidationSyncBack } from "./notionSyncBackTasks";
import { fetchChangedTaskCompletions, fetchChangedValidationResults } from "./notionTaskValidation";

const mockFetchTasks = vi.mocked(fetchChangedTaskCompletions);
const mockFetchValidation = vi.mocked(fetchChangedValidationResults);

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectResult = [];
});

// ─── Task Completion Dirty Check ──────────────────────────────────────────────

describe("Task Completion Dirty Check", () => {
  const baseTaskRow = {
    pageId: "page-1",
    organizationId: 60001,
    taskKey: "network:vpn",
    sectionName: "Network & Connectivity",
    status: "Complete",
    completedBy: "john@hospital.org",
    targetDate: "2026-03-01",
    notes: "VPN configured",
    completedAt: "2026-02-15T10:00:00.000Z",
    lastEdited: "2026-05-25T20:00:00.000Z",
    lastUpdatedFrom: "Portal",
  };

  const existingTaskRow = {
    id: 42,
    organizationId: 60001,
    taskId: "network:vpn",
    sectionName: "Network & Connectivity",
    completed: 1,
    inProgress: 0,
    blocked: 0,
    notApplicable: 0,
    completedBy: "john@hospital.org",
    targetDate: "2026-03-01",
    notes: "VPN configured",
    completedAt: new Date("2026-02-15T10:00:00.000Z"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-20"),
  };

  it("SKIPS when Notion data matches MySQL exactly", async () => {
    mockSelectResult = [existingTaskRow];
    mockFetchTasks.mockResolvedValueOnce([baseTaskRow]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.fetched).toBe(1);
    expect(result.tasks.skipped).toBe(1);
    expect(result.tasks.upserted).toBe(0);
    // The DB update should NOT have been called
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("WRITES when status changes from Complete to In Progress", async () => {
    mockSelectResult = [existingTaskRow];
    const changedRow = { ...baseTaskRow, status: "In Progress" };
    mockFetchTasks.mockResolvedValueOnce([changedRow]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.fetched).toBe(1);
    expect(result.tasks.skipped).toBe(0);
    expect(result.tasks.upserted).toBe(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("WRITES when notes change", async () => {
    mockSelectResult = [existingTaskRow];
    const changedRow = { ...baseTaskRow, notes: "VPN configured and tested" };
    mockFetchTasks.mockResolvedValueOnce([changedRow]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.skipped).toBe(0);
    expect(result.tasks.upserted).toBe(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("INSERTS when no existing row found (new task)", async () => {
    mockSelectResult = []; // No existing row
    mockFetchTasks.mockResolvedValueOnce([baseTaskRow]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.fetched).toBe(1);
    expect(result.tasks.skipped).toBe(0);
    expect(result.tasks.upserted).toBe(1);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("SKIPS when completedBy is empty string in both (null normalization)", async () => {
    // Notion sends "" for empty, MySQL stores null
    const existingWithNulls = { ...existingTaskRow, completedBy: null, notes: null, targetDate: null };
    const notionRowWithEmpty = { ...baseTaskRow, completedBy: "", notes: "", targetDate: "", status: "Complete" };
    mockSelectResult = [existingWithNulls];
    mockFetchTasks.mockResolvedValueOnce([notionRowWithEmpty]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.skipped).toBe(1);
    expect(result.tasks.upserted).toBe(0);
  });
});

// ─── Validation Result Dirty Check ────────────────────────────────────────────

describe("Validation Result Dirty Check", () => {
  const baseValRow = {
    pageId: "page-2",
    organizationId: 60008,
    testKey: "3:2",
    status: "Not Tested",
    actual: "",
    signOff: "",
    notes: "",
    testedDate: "",
    updatedBy: "",
    lastEdited: "2026-05-25T20:56:00.000Z",
    lastUpdatedFrom: "Notion",
  };

  const existingValRow = {
    id: 99,
    organizationId: 60008,
    testKey: "3:2",
    actual: null,
    status: "Not Tested",
    signOff: null,
    notes: null,
    testedDate: null,
    updatedBy: null,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-25T22:03:06.000Z"),
  };

  it("SKIPS when Notion data matches MySQL (null vs empty string normalization)", async () => {
    mockSelectResult = [existingValRow];
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([baseValRow]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.fetched).toBe(1);
    expect(result.validation.skipped).toBe(1);
    expect(result.validation.upserted).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("WRITES when status changes from Not Tested to Pass", async () => {
    mockSelectResult = [existingValRow];
    const changedRow = { ...baseValRow, status: "Pass" };
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([changedRow]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.skipped).toBe(0);
    expect(result.validation.upserted).toBe(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("WRITES when actual field gets populated", async () => {
    mockSelectResult = [existingValRow];
    const changedRow = { ...baseValRow, actual: "DICOM connectivity verified at 10.0.0.5:104" };
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([changedRow]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.skipped).toBe(0);
    expect(result.validation.upserted).toBe(1);
  });

  it("WRITES when notes change", async () => {
    mockSelectResult = [existingValRow];
    const changedRow = { ...baseValRow, notes: "Needs re-test after firewall change" };
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([changedRow]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.skipped).toBe(0);
    expect(result.validation.upserted).toBe(1);
  });

  it("INSERTS when no existing row found (new validation result)", async () => {
    mockSelectResult = [];
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([baseValRow]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.skipped).toBe(0);
    expect(result.validation.upserted).toBe(1);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("SKIPS multiple identical rows in same batch", async () => {
    const row2 = { ...baseValRow, testKey: "3:3", pageId: "page-3" };
    const existing2 = { ...existingValRow, id: 100, testKey: "3:3" };

    // Mock: first call returns existingValRow, second returns existing2
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            callCount++;
            return Promise.resolve(callCount === 1 ? [existingValRow] : [existing2]);
          },
        }),
      }),
    }));

    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([baseValRow, row2]);

    const result = await runTaskValidationSyncBack();

    expect(result.validation.fetched).toBe(2);
    expect(result.validation.skipped).toBe(2);
    expect(result.validation.upserted).toBe(0);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("Dirty Check Edge Cases", () => {
  it("handles mixed batch: some skipped, some written", async () => {
    const existingTask = {
      id: 1,
      organizationId: 60001,
      taskId: "network:vpn",
      sectionName: "Network & Connectivity",
      completed: 1,
      inProgress: 0,
      blocked: 0,
      notApplicable: 0,
      completedBy: null,
      targetDate: null,
      notes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First task: identical (should skip)
    const identicalTask = {
      pageId: "p1",
      organizationId: 60001,
      taskKey: "network:vpn",
      sectionName: "Network & Connectivity",
      status: "Complete",
      completedBy: "",
      targetDate: "",
      notes: "",
      completedAt: "",
      lastEdited: "2026-05-25T20:00:00.000Z",
      lastUpdatedFrom: "Portal",
    };

    // Second task: changed (should write)
    const changedTask = {
      pageId: "p2",
      organizationId: 60001,
      taskKey: "network:firewall",
      sectionName: "Network & Connectivity",
      status: "In Progress",
      completedBy: "",
      targetDate: "",
      notes: "Firewall rules pending",
      completedAt: "",
      lastEdited: "2026-05-25T20:00:00.000Z",
      lastUpdatedFrom: "Portal",
    };

    const existingFirewall = {
      ...existingTask,
      id: 2,
      taskId: "network:firewall",
      completed: 0,
      inProgress: 1,
      notes: null, // Different from "Firewall rules pending"
    };

    // readSyncCheckpoint calls db.select twice (once for tasks, once for validation)
    // then upsertTaskCompletion calls it once per row
    // So calls 1-2 are checkpoint reads, 3 is first task lookup, 4 is second task lookup
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            callCount++;
            // Calls 1-2: readSyncCheckpoint (return empty to use fallback)
            if (callCount <= 2) return Promise.resolve([]);
            // Call 3: first task lookup (identical)
            if (callCount === 3) return Promise.resolve([existingTask]);
            // Call 4: second task lookup (changed)
            return Promise.resolve([existingFirewall]);
          },
        }),
      }),
    }));

    mockFetchTasks.mockResolvedValueOnce([identicalTask, changedTask]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.fetched).toBe(2);
    expect(result.tasks.skipped).toBe(1);
    expect(result.tasks.upserted).toBe(1);
  });

  it("zero fetched rows results in zero skipped and zero upserted", async () => {
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchValidation.mockResolvedValueOnce([]);

    const result = await runTaskValidationSyncBack();

    expect(result.tasks.fetched).toBe(0);
    expect(result.tasks.skipped).toBe(0);
    expect(result.tasks.upserted).toBe(0);
    expect(result.validation.fetched).toBe(0);
    expect(result.validation.skipped).toBe(0);
    expect(result.validation.upserted).toBe(0);
  });
});
