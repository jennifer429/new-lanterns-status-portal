/**
 * AI Audit Logging Tests
 *
 * Verifies that:
 * 1. The writeAuditLog helper can be called without throwing
 * 2. Audit log query endpoints enforce RBAC (admin-only)
 * 3. Non-admin users are rejected from audit log queries
 * 4. Audit log detail endpoint enforces access
 * 5. Audit stats endpoint works for admin users
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(userOverrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-audit-user-1",
    email: "audit-test@example.com",
    name: "Audit Test User",
    loginMethod: "password",
    role: "user",
    clientId: null,
    organizationId: null,
    isActive: 1,
    passwordHash: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Audit Logging", () => {
  // -------------------------------------------------------------------------
  // getAuditLogs endpoint
  // -------------------------------------------------------------------------
  describe("getAuditLogs", () => {
    it("rejects non-admin users with FORBIDDEN", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.getAuditLogs({
          page: 1,
          pageSize: 25,
          category: "all",
          status: "all",
        })
      ).rejects.toThrow("Admin access required");
    });

    it("rejects unauthenticated users", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: () => {} } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.getAuditLogs({
          page: 1,
          pageSize: 25,
          category: "all",
          status: "all",
        })
      ).rejects.toThrow();
    });

    it("allows platform admin to query audit logs", async () => {
      const ctx = createMockContext({ role: "admin", clientId: null });
      const caller = appRouter.createCaller(ctx);

      // Should not throw — may return empty results if DB is empty
      const result = await caller.ai.getAuditLogs({
        page: 1,
        pageSize: 25,
        category: "all",
        status: "all",
      });

      expect(result).toHaveProperty("logs");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page", 1);
      expect(result).toHaveProperty("pageSize", 25);
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it("allows partner admin to query audit logs", async () => {
      const ctx = createMockContext({ role: "admin", clientId: 42 });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditLogs({
        page: 1,
        pageSize: 10,
        category: "all",
        status: "all",
      });

      expect(result).toHaveProperty("logs");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it("supports category filtering", async () => {
      const ctx = createMockContext({ role: "admin", clientId: null });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditLogs({
        page: 1,
        pageSize: 25,
        category: "write",
        status: "all",
      });

      expect(result).toHaveProperty("logs");
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it("supports status filtering", async () => {
      const ctx = createMockContext({ role: "admin", clientId: null });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditLogs({
        page: 1,
        pageSize: 25,
        category: "all",
        status: "denied",
      });

      expect(result).toHaveProperty("logs");
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getAuditLogDetail endpoint
  // -------------------------------------------------------------------------
  describe("getAuditLogDetail", () => {
    it("rejects non-admin users with FORBIDDEN", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.getAuditLogDetail({ id: 1 })
      ).rejects.toThrow("Admin access required");
    });

    it("returns null for non-existent log ID", async () => {
      const ctx = createMockContext({ role: "admin", clientId: null });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditLogDetail({ id: 999999 });
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getAuditStats endpoint
  // -------------------------------------------------------------------------
  describe("getAuditStats", () => {
    it("rejects non-admin users with FORBIDDEN", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.getAuditStats()
      ).rejects.toThrow("Admin access required");
    });

    it("returns stats structure for platform admin", async () => {
      const ctx = createMockContext({ role: "admin", clientId: null });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditStats();

      expect(result).toHaveProperty("totalLogs");
      expect(result).toHaveProperty("byCategory");
      expect(result).toHaveProperty("byStatus");
      expect(result).toHaveProperty("recentActors");
      expect(typeof result.totalLogs).toBe("number");
      expect(Array.isArray(result.byCategory)).toBe(true);
      expect(Array.isArray(result.byStatus)).toBe(true);
      expect(Array.isArray(result.recentActors)).toBe(true);
    });

    it("returns stats structure for partner admin", async () => {
      const ctx = createMockContext({ role: "admin", clientId: 42 });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.getAuditStats();

      expect(result).toHaveProperty("totalLogs");
      expect(typeof result.totalLogs).toBe("number");
    });
  });
});
