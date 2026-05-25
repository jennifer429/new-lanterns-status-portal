import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@newlantern.com",
    name: "Admin User",
    loginMethod: "email",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@hospital.org",
    name: "Regular User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// Mock the sync modules so tests don't hit real Notion/MySQL
vi.mock("./notionSyncBack", () => ({
  runNotionSyncBack: vi.fn().mockResolvedValue({
    status: "Success",
    rowsFetched: 5,
    rowsUpdated: 3,
    rowsFailed: 0,
    rowsSkipped: 2,
    durationMs: 150,
    errorDetails: "",
  }),
  getSyncHealth: vi.fn().mockResolvedValue({
    enabled: true,
    lastSuccessfulSync: "2026-05-20T03:00:00.000Z",
    consecutiveFailures: 0,
    isHealthy: true,
  }),
}));

vi.mock("./notionSyncContacts", () => ({
  runContactsSystemsSync: vi.fn().mockResolvedValue({
    contacts: { fetched: 10, upserted: 8, archived: 1, failed: 1, errors: ["test error"] },
    systems: { fetched: 15, upserted: 14, archived: 0, failed: 1, errors: ["test error 2"] },
  }),
}));

vi.mock("./notionSyncBackTasks", () => ({
  runTaskValidationSyncBack: vi.fn().mockResolvedValue({
    tasks: { fetched: 5, upserted: 4, failed: 0, errors: [] },
    validation: { fetched: 3, upserted: 3, failed: 0, errors: [] },
    durationMs: 200,
  }),
}));

describe("syncHealth router", () => {
  describe("status (public)", () => {
    it("returns sync health status without auth", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);
      const result = await caller.syncHealth.status();

      expect(result).toHaveProperty("enabled");
      expect(result).toHaveProperty("lastSuccessfulSync");
      expect(result).toHaveProperty("consecutiveFailures");
      expect(result).toHaveProperty("isHealthy");
      expect(result.enabled).toBe(true);
      expect(result.isHealthy).toBe(true);
    });
  });

  describe("triggerSync (admin only)", () => {
    it("succeeds for admin users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.syncHealth.triggerSync();

      expect(result.status).toBe("Success");
      expect(result.rowsFetched).toBe(5);
      expect(result.rowsUpdated).toBe(3);
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.syncHealth.triggerSync()).rejects.toThrow(
        /admin/i
      );
    });
  });

  describe("triggerContactsSystemsSync (admin only)", () => {
    it("succeeds for admin users and returns per-table stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.syncHealth.triggerContactsSystemsSync();

      expect(result.contacts.fetched).toBe(10);
      expect(result.contacts.upserted).toBe(8);
      expect(result.contacts.failed).toBe(1);
      expect(result.systems.fetched).toBe(15);
      expect(result.systems.upserted).toBe(14);
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.syncHealth.triggerContactsSystemsSync()).rejects.toThrow(
        /admin/i
      );
    });
  });

  describe("triggerFullSync (admin only)", () => {
    it("runs all syncs in parallel and returns combined results", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.syncHealth.triggerFullSync();

      // Should have all three sections
      expect(result).toHaveProperty("durationMs");
      expect(result).toHaveProperty("questionnaire");
      expect(result).toHaveProperty("contacts");
      expect(result).toHaveProperty("systems");

      // Questionnaire result
      expect(result.questionnaire.status).toBe("Success");
      expect(result.questionnaire.rowsUpdated).toBe(3);

      // Contacts result
      expect(result.contacts.upserted).toBe(8);
      expect(result.contacts.failed).toBe(1);

      // Systems result
      expect(result.systems.upserted).toBe(14);
      expect(result.systems.failed).toBe(1);

      // Duration should be a positive number
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.syncHealth.triggerFullSync()).rejects.toThrow(
        /admin/i
      );
    });
  });
});
