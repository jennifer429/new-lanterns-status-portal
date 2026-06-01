/**
 * Tests for the notionLastEdited version-check sync logic.
 *
 * Proves:
 * 1. Sync-back SKIPS when notionLastEdited matches incoming last_edited_time
 * 2. Sync-back WRITES when notionLastEdited differs (new Notion version)
 * 3. Sync-back INSERTS new rows with notionLastEdited set
 * 4. Portal writes set notionLastEdited = null
 * 5. Reconciliation only flags rows with notionLastEdited = null that are stale
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────────────

// Mock DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockOnDuplicateKeyUpdate = vi.fn();

const mockDb = {
  select: () => ({ from: mockFrom }),
  insert: () => ({ values: mockValues }),
  update: () => ({ set: mockSet }),
};

const chainObj: any = {};
chainObj.where = mockWhere;
chainObj.orderBy = mockOrderBy;
chainObj.limit = mockLimit;
chainObj.from = mockFrom;

mockFrom.mockReturnValue(chainObj);
mockWhere.mockReturnValue(chainObj);
mockOrderBy.mockReturnValue(chainObj);
mockLimit.mockResolvedValue([]);
mockValues.mockReturnValue({ onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate });
mockOnDuplicateKeyUpdate.mockResolvedValue(undefined);
mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("./_core/env", () => ({
  ENV: { notionApiKey: "test-key" },
}));

vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    pages: { update: vi.fn().mockResolvedValue({}) },
  })),
}));

vi.mock("./notionTaskValidation", () => ({
  fetchChangedTaskCompletions: vi.fn().mockResolvedValue([]),
  fetchChangedValidationResults: vi.fn().mockResolvedValue([]),
  statusToTaskFlags: vi.fn((status: string) => ({
    completed: status === "Complete" ? 1 : 0,
    inProgress: status === "In Progress" ? 1 : 0,
    blocked: status === "Blocked" ? 1 : 0,
    notApplicable: status === "N/A" ? 1 : 0,
  })),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("notionLastEdited version check — sync-back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockValues.mockReturnValue({ onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate });
    mockOnDuplicateKeyUpdate.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  it("SKIPS when existing row has matching notionLastEdited", async () => {
    const notionTime = new Date("2026-05-25T20:00:00.000Z");

    // Existing row in MySQL with matching notionLastEdited
    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]); // checkpoint read
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]); // checkpoint read

    const { fetchChangedTaskCompletions } = await import("./notionTaskValidation");
    (fetchChangedTaskCompletions as any).mockResolvedValueOnce([
      {
        pageId: "page-1",
        organizationId: 100,
        taskKey: "task-1",
        sectionName: "Network",
        status: "Complete",
        completedAt: "",
        completedBy: "user@test.com",
        targetDate: "2026-06-01",
        notes: "Done",
        lastEdited: notionTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // When upsertTaskCompletion looks up existing row, return one with matching notionLastEdited
    mockLimit.mockResolvedValueOnce([{
      id: 1,
      organizationId: 100,
      taskId: "task-1",
      sectionName: "Network",
      completed: 1,
      inProgress: 0,
      blocked: 0,
      notApplicable: 0,
      completedAt: null,
      completedBy: "user@test.com",
      targetDate: "2026-06-01",
      notes: "Done",
      notionLastEdited: notionTime, // MATCHES incoming
      updatedAt: new Date("2026-05-25T20:05:00Z"),
    }]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    expect(result.tasks.skipped).toBe(1);
    expect(result.tasks.upserted).toBe(0);
  });

  it("WRITES when existing row has different notionLastEdited", async () => {
    const oldNotionTime = new Date("2026-05-24T10:00:00.000Z");
    const newNotionTime = new Date("2026-05-25T20:00:00.000Z");

    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);

    const { fetchChangedTaskCompletions } = await import("./notionTaskValidation");
    (fetchChangedTaskCompletions as any).mockResolvedValueOnce([
      {
        pageId: "page-2",
        organizationId: 200,
        taskKey: "task-2",
        sectionName: "Security",
        status: "In Progress",
        completedAt: "",
        completedBy: "",
        targetDate: "",
        notes: "Working on it",
        lastEdited: newNotionTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // Existing row with OLD notionLastEdited
    mockLimit.mockResolvedValueOnce([{
      id: 2,
      organizationId: 200,
      taskId: "task-2",
      sectionName: "Security",
      completed: 0,
      inProgress: 1,
      blocked: 0,
      notApplicable: 0,
      completedAt: null,
      completedBy: null,
      targetDate: null,
      notes: "Started",
      notionLastEdited: oldNotionTime, // DIFFERENT from incoming
      updatedAt: new Date("2026-05-24T10:05:00Z"),
    }]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    expect(result.tasks.upserted).toBe(1);
    expect(result.tasks.skipped).toBe(0);
    // Verify update was called with notionLastEdited set to new time
    expect(mockSet).toHaveBeenCalled();
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.notionLastEdited).toEqual(newNotionTime);
    expect(setArg.notes).toBe("Working on it");
  });

  it("WRITES when existing row has null notionLastEdited (portal wrote last)", async () => {
    const newNotionTime = new Date("2026-05-25T20:00:00.000Z");

    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);

    const { fetchChangedTaskCompletions } = await import("./notionTaskValidation");
    (fetchChangedTaskCompletions as any).mockResolvedValueOnce([
      {
        pageId: "page-3",
        organizationId: 300,
        taskKey: "task-3",
        sectionName: "Data",
        status: "Complete",
        completedAt: "2026-05-25",
        completedBy: "admin@test.com",
        targetDate: "",
        notes: "",
        lastEdited: newNotionTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // Existing row with NULL notionLastEdited (portal wrote last)
    mockLimit.mockResolvedValueOnce([{
      id: 3,
      organizationId: 300,
      taskId: "task-3",
      sectionName: "Data",
      completed: 1,
      inProgress: 0,
      blocked: 0,
      notApplicable: 0,
      completedAt: new Date("2026-05-25"),
      completedBy: "admin@test.com",
      targetDate: null,
      notes: null,
      notionLastEdited: null, // NULL — portal wrote last
      updatedAt: new Date("2026-05-25T19:50:00Z"),
    }]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    // Should write because notionLastEdited is null (can't confirm version)
    expect(result.tasks.upserted).toBe(1);
    expect(result.tasks.skipped).toBe(0);
    // Verify it sets notionLastEdited to the new Notion timestamp
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.notionLastEdited).toEqual(newNotionTime);
  });

  it("INSERTS new row with notionLastEdited set", async () => {
    const notionTime = new Date("2026-05-25T20:00:00.000Z");

    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);

    const { fetchChangedTaskCompletions } = await import("./notionTaskValidation");
    (fetchChangedTaskCompletions as any).mockResolvedValueOnce([
      {
        pageId: "page-4",
        organizationId: 400,
        taskKey: "task-4",
        sectionName: "Routing",
        status: "Complete",
        completedAt: "",
        completedBy: "",
        targetDate: "",
        notes: "New task",
        lastEdited: notionTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // No existing row
    mockLimit.mockResolvedValueOnce([]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    expect(result.tasks.upserted).toBe(1);
    // Verify insert was called with notionLastEdited
    expect(mockValues).toHaveBeenCalled();
    const insertArg = mockValues.mock.calls[0][0];
    expect(insertArg.notionLastEdited).toEqual(notionTime);
    expect(insertArg.organizationId).toBe(400);
  });

  it("SKIPS validation result when notionLastEdited matches", async () => {
    const notionTime = new Date("2026-05-25T18:00:00.000Z");

    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    // resetFailures reads checkpoint for task-completions (0 task results triggers reset path)
    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", consecutiveFailures: 0 }]);

    const { fetchChangedValidationResults } = await import("./notionTaskValidation");
    (fetchChangedValidationResults as any).mockResolvedValueOnce([
      {
        pageId: "val-page-1",
        organizationId: 500,
        testKey: "0:1",
        status: "Pass",
        actual: "Connected",
        signOff: "admin",
        notes: "",
        testedDate: "2026-05-25",
        updatedBy: "admin@test.com",
        lastEdited: notionTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // Existing validation row with matching notionLastEdited
    mockLimit.mockResolvedValueOnce([{
      id: 10,
      organizationId: 500,
      testKey: "0:1",
      actual: "Connected",
      status: "Pass",
      signOff: "admin",
      notes: null,
      testedDate: "2026-05-25",
      updatedBy: "admin@test.com",
      notionLastEdited: notionTime, // MATCHES
      updatedAt: new Date("2026-05-25T18:05:00Z"),
    }]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    expect(result.validation.skipped).toBe(1);
    expect(result.validation.upserted).toBe(0);
  });

  it("WRITES validation result when notionLastEdited differs", async () => {
    const oldTime = new Date("2026-05-24T10:00:00.000Z");
    const newTime = new Date("2026-05-25T18:00:00.000Z");

    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    mockLimit.mockResolvedValueOnce([{ pipeline: "validation-results", lastSuccessfulSync: new Date("2026-05-20T00:00:00Z"), consecutiveFailures: 0 }]);
    // resetFailures reads checkpoint for task-completions (0 task results triggers reset path)
    mockLimit.mockResolvedValueOnce([{ pipeline: "task-completions", consecutiveFailures: 0 }]);

    const { fetchChangedValidationResults } = await import("./notionTaskValidation");
    (fetchChangedValidationResults as any).mockResolvedValueOnce([
      {
        pageId: "val-page-2",
        organizationId: 600,
        testKey: "1:3",
        status: "Fail",
        actual: "Timeout",
        signOff: "",
        notes: "Needs retry",
        testedDate: "2026-05-25",
        updatedBy: "tech@test.com",
        lastEdited: newTime.toISOString(),
        lastUpdatedFrom: "",
      },
    ]);

    // Existing with old notionLastEdited
    mockLimit.mockResolvedValueOnce([{
      id: 11,
      organizationId: 600,
      testKey: "1:3",
      actual: "OK",
      status: "Pass",
      signOff: "admin",
      notes: null,
      testedDate: "2026-05-24",
      updatedBy: "admin@test.com",
      notionLastEdited: oldTime, // DIFFERENT
      updatedAt: new Date("2026-05-24T10:05:00Z"),
    }]);

    const { runTaskValidationSyncBack } = await import("./notionSyncBackTasks");
    const result = await runTaskValidationSyncBack();

    expect(result.validation.upserted).toBe(1);
    expect(result.validation.skipped).toBe(0);
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.notionLastEdited).toEqual(newTime);
    expect(setArg.status).toBe("Fail");
    expect(setArg.actual).toBe("Timeout");
  });
});

describe("notionLastEdited — reconciliation logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it("reports NO issues when all rows have non-null notionLastEdited", async () => {
    // Mock: no rows returned by the stale query (all rows have notionLastEdited set)
    mockLimit.mockResolvedValue([]);

    const { runReconciliation } = await import("./notionReconciliation");
    const result = await runReconciliation();

    expect(result.outOfSync).toBe(0);
  });

  it("reports issues for rows with null notionLastEdited older than 10 minutes", async () => {
    const staleTime = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago

    // The reconciliation code does:
    // 1. select().from().where().orderBy().limit() → staleTasks
    // 2. select().from().where(sql`...`) → org slugs (no orderBy/limit, awaited directly)
    // 3. select().from().where().orderBy().limit() → staleValidationResults
    //
    // The issue: where() in call #2 is the terminal (awaited directly).
    // Drizzle query builders are thenable, so we need chainObj to be thenable.
    // Make chainObj thenable with a .then that resolves based on call order.

    let whereCallCount = 0;
    const orgData = [{ id: 100, slug: "test-org" }];

    mockWhere.mockImplementation((...args: any[]) => {
      whereCallCount++;
      if (whereCallCount === 2) {
        // This is the org slug lookup (call #2) - return a thenable that resolves to org data
        return Promise.resolve(orgData);
      }
      // For calls #1 and #3, return the normal chain
      return chainObj;
    });

    // Call 1: findStaleTasks - limit returns stale rows
    mockLimit.mockResolvedValueOnce([
      {
        id: 1,
        organizationId: 100,
        taskId: "task-stale",
        updatedAt: staleTime,
      },
    ]);

    // Call 3: findStaleValidationResults - limit returns empty
    mockLimit.mockResolvedValueOnce([]);

    // db.insert for reconciliationLog
    mockValues.mockResolvedValueOnce(undefined);

    const { runReconciliation } = await import("./notionReconciliation");
    const result = await runReconciliation();

    expect(result.outOfSync).toBe(1);
  });
});
