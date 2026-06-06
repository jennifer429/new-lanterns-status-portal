/**
 * RMCA questionnaire read-path test.
 *
 * Reproduces the scenario behind the "RMCA workflow descriptions disappeared"
 * bug from the *viewing* side: an RMCA hospital user opens the questionnaire and
 * `intake.getResponses` must return all three Integration-Workflow descriptions
 * (orders / reports / priors) that the sync restored into `intakeResponses`.
 *
 * Pure unit test — `./db` is mocked so it runs without a live MySQL.
 */

import { describe, it, expect, vi } from "vitest";
import { organizations, intakeResponses } from "../drizzle/schema";

const RMCA_ORG = {
  id: 7,
  name: "Rocky Mountain Cancer Associates",
  slug: "RMCA",
  clientId: 1,
};

// The three workflow-description rows, plus an unrelated answer, as they'd live
// in intakeResponses after the sync/reconciliation restored them.
const RMCA_RESPONSES = [
  { id: 1, organizationId: 7, questionId: "IW.orders_description", response: "Orders flow from Epic via HL7 ORM.", fileUrl: null, updatedBy: "notion-sync@system", createdAt: new Date(), updatedAt: new Date() },
  { id: 2, organizationId: 7, questionId: "IW.reports_description", response: "Reports return as HL7 ORU to Epic.", fileUrl: null, updatedBy: "notion-sync@system", createdAt: new Date(), updatedAt: new Date() },
  { id: 3, organizationId: 7, questionId: "IW.priors_description", response: "Priors retrieved from the VNA on demand.", fileUrl: null, updatedBy: "notion-sync@system", createdAt: new Date(), updatedAt: new Date() },
  { id: 4, organizationId: 7, questionId: "H.1", response: "RMCA", fileUrl: null, updatedBy: "user@rmca.org", createdAt: new Date(), updatedAt: new Date() },
];

// A builder that is both awaitable (resolves to `rows`) and chainable via
// `.limit()` (resolveOrgByIdentifier calls `.where(...).limit(2)`; getResponses
// awaits `.where(...)` directly).
function builder(rows: any[]) {
  return {
    then: (resolve: (v: any[]) => unknown) => resolve(rows),
    limit: async () => rows,
  };
}

const mockDb = {
  select: (_projection?: unknown) => ({
    from: (table: unknown) => {
      const rows = table === organizations ? [RMCA_ORG] : table === intakeResponses ? RMCA_RESPONSES : [];
      return { where: () => builder(rows) };
    },
  }),
};

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getDb: vi.fn(async () => mockDb),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// An RMCA hospital user (clientId matches the org's clientId so the access check passes).
function rmcaUserCtx(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "rmca-user",
      email: "user@rmca.org",
      name: "RMCA User",
      loginMethod: "password",
      role: "user",
      clientId: 1,
      organizationId: 7,
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

describe("RMCA user viewing the questionnaire", () => {
  it("returns all three Integration-Workflow descriptions", async () => {
    const caller = appRouter.createCaller(rmcaUserCtx());
    const responses = await caller.intake.getResponses({ organizationSlug: "RMCA" });

    const byQuestion = new Map(responses.map((r) => [r.questionId, r.response]));
    expect(byQuestion.get("IW.orders_description")).toMatch(/Orders flow from Epic/);
    expect(byQuestion.get("IW.reports_description")).toMatch(/Reports return as HL7 ORU/);
    expect(byQuestion.get("IW.priors_description")).toMatch(/Priors retrieved from the VNA/);
  });

  it("tags every row with the RMCA org name and slug", async () => {
    const caller = appRouter.createCaller(rmcaUserCtx());
    const responses = await caller.intake.getResponses({ organizationSlug: "RMCA" });

    expect(responses).toHaveLength(RMCA_RESPONSES.length);
    expect(responses.every((r) => r.organizationName === RMCA_ORG.name)).toBe(true);
    expect(responses.every((r) => r.organizationSlug === "RMCA")).toBe(true);
  });
});
