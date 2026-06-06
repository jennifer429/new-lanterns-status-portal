/**
 * Phase 3 (foreign-key constraints) — graceful-rejection tests.
 *
 * After Phase 3 added FK constraints to child tables, a write that references a
 * parent row which no longer exists is rejected by MySQL (errno 1452) instead
 * of silently succeeding. These tests prove:
 *
 *   1. isForeignKeyViolation() recognizes the rejection across the shapes it can
 *      arrive in (errno, code, message, wrapped cause).
 *   2. The intake save ("import"/write) paths translate that rejection into a
 *      clean 404 instead of leaking a raw 500.
 *
 * Note on the cron sync-back path: notionSyncBack resolves the org id from the
 * slug *before* upserting and processes rows inside a per-row try/catch, so an
 * FK rejection there is already contained to a single row (rowsFailed++) and
 * cannot sink the batch — covered structurally rather than re-tested here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isForeignKeyViolation,
  ER_NO_REFERENCED_ROW,
  ER_ROW_IS_REFERENCED,
} from "./dbErrors";

// ---------------------------------------------------------------------------
// 1. isForeignKeyViolation
// ---------------------------------------------------------------------------

describe("isForeignKeyViolation", () => {
  it("detects by mysql errno (1452 child, 1451 parent)", () => {
    expect(isForeignKeyViolation({ errno: ER_NO_REFERENCED_ROW })).toBe(true);
    expect(isForeignKeyViolation({ errno: ER_ROW_IS_REFERENCED })).toBe(true);
  });

  it("detects by mysql error code", () => {
    expect(isForeignKeyViolation({ code: "ER_NO_REFERENCED_ROW_2" })).toBe(true);
    expect(isForeignKeyViolation({ code: "ER_ROW_IS_REFERENCED_2" })).toBe(true);
  });

  it("detects by message text when errno/code are absent", () => {
    expect(
      isForeignKeyViolation(new Error("Cannot add or update a child row: a foreign key constraint fails"))
    ).toBe(true);
    expect(isForeignKeyViolation("a foreign key constraint fails (`db`.`x`)")).toBe(true);
  });

  it("unwraps a nested cause", () => {
    const wrapped = new Error("query failed");
    (wrapped as any).cause = { errno: ER_NO_REFERENCED_ROW };
    expect(isForeignKeyViolation(wrapped)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isForeignKeyViolation(new Error("connection reset"))).toBe(false);
    expect(isForeignKeyViolation({ errno: 1062, code: "ER_DUP_ENTRY" })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. intake save paths translate FK rejection → NOT_FOUND
// ---------------------------------------------------------------------------

const RMCA_ORG = {
  id: 7,
  name: "Rocky Mountain Cancer Associates",
  slug: "RMCA",
  clientId: 1,
};

// Chainable mock matching resolveOrgByIdentifier's select().from().where().limit()
// and an execute() whose behavior each test sets.
let executeImpl: () => Promise<unknown> = async () => undefined;

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [RMCA_ORG],
      }),
    }),
  }),
  execute: vi.fn(async () => executeImpl()),
};

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getDb: vi.fn(async () => mockDb),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxForUser(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "fk-test-user",
      email: "fk-test@newlantern.ai",
      name: "FK Test",
      loginMethod: "password",
      role: "admin",
      clientId: null, // platform admin → passes the org access check
      organizationId: null,
      isActive: 1,
      passwordHash: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const fkError = Object.assign(
  new Error("Cannot add or update a child row: a foreign key constraint fails"),
  { errno: ER_NO_REFERENCED_ROW, code: "ER_NO_REFERENCED_ROW_2" }
);

describe("intake.saveResponse — FK rejection handling", () => {
  beforeEach(() => {
    mockDb.execute.mockClear();
    executeImpl = async () => undefined;
  });

  it("translates an FK rejection into NOT_FOUND", async () => {
    executeImpl = async () => { throw fkError; };
    const caller = appRouter.createCaller(ctxForUser());

    await expect(
      caller.intake.saveResponse({
        organizationSlug: "RMCA",
        questionId: "IW.orders_description",
        response: "Orders flow from Epic",
        userEmail: "fk-test@newlantern.ai",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("re-throws a non-FK database error unchanged", async () => {
    executeImpl = async () => { throw new Error("connection reset"); };
    const caller = appRouter.createCaller(ctxForUser());

    await expect(
      caller.intake.saveResponse({
        organizationSlug: "RMCA",
        questionId: "IW.orders_description",
        response: "x",
        userEmail: "fk-test@newlantern.ai",
      })
    ).rejects.toThrow(/connection reset/);
  });
});

describe("intake.saveResponses — FK rejection handling", () => {
  beforeEach(() => {
    mockDb.execute.mockClear();
    executeImpl = async () => undefined;
  });

  it("translates an FK rejection in the batch into NOT_FOUND", async () => {
    executeImpl = async () => { throw fkError; };
    const caller = appRouter.createCaller(ctxForUser());

    await expect(
      caller.intake.saveResponses({
        organizationSlug: "RMCA",
        responses: { "IW.orders_description": "a", "IW.reports_description": "b" },
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
