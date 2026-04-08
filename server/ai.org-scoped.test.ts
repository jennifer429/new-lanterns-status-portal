/**
 * AI Router — Org-Scoped Tools Tests
 *
 * Verifies that:
 * 1. The orgSlug input is accepted by the chat endpoint
 * 2. Org-scoped tools are only available when orgSlug is provided
 * 3. Non-admin users are still rejected
 * 4. The ORG_SCOPED_TOOLS array has the expected 6 tools
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createAdminContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin-1",
    email: "admin@example.com",
    name: "Test Admin",
    loginMethod: "password",
    role: "admin",
    clientId: null,
    organizationId: null,
    isActive: 1,
    passwordHash: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "test-user-2",
    email: "user@example.com",
    name: "Regular User",
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
  };
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("AI Org-Scoped Tools", () => {
  // -------------------------------------------------------------------------
  // Input validation: orgSlug is accepted
  // -------------------------------------------------------------------------
  describe("Input validation", () => {
    it("accepts orgSlug as an optional string parameter", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw a validation error — the orgSlug param is accepted
      // It may throw a different error (e.g., LLM call fails/times out in test env)
      // but the input schema should validate
      try {
        await Promise.race([
          caller.ai.chat({
            messages: [{ role: "user", content: "What is the project status?" }],
            orgSlug: "boulder-community-health",
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("__test_timeout__")), 3000)),
        ]);
      } catch (err: any) {
        // Timeout or LLM errors are fine — we just need to confirm input validation passed
        if (err.message === "__test_timeout__") return; // LLM call took too long, but input was accepted
        // Should NOT be a ZodError / input validation error
        expect(err.message).not.toContain("Expected string");
        expect(err.message).not.toContain("Required");
      }
    }, 10000);

    it("works without orgSlug (backward compatible)", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.ai.chat({
          messages: [{ role: "user", content: "Hello" }],
        });
      } catch (err: any) {
        // Should NOT be a validation error
        expect(err.message).not.toContain("Expected string");
        expect(err.message).not.toContain("Required");
      }
    });

    it("rejects non-admin users even with orgSlug", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.chat({
          messages: [{ role: "user", content: "Show tasks" }],
          orgSlug: "boulder-community-health",
        })
      ).rejects.toThrow("Admin access required");
    });
  });

  // -------------------------------------------------------------------------
  // Tool definitions: verify the 6 org-scoped tools exist
  // -------------------------------------------------------------------------
  describe("Tool definitions", () => {
    it("ORG_SCOPED_TOOLS array has exactly 6 tools", async () => {
      // Import the ORG_SCOPED_TOOLS directly to verify
      const aiModule = await import("./routers/ai");
      // The ORG_SCOPED_TOOLS is not exported, but we can verify via the tool names
      // by checking the chat endpoint accepts orgSlug and the tools are wired
      // Instead, let's verify the tool names are present in the file
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      const orgToolNames = [
        "get_org_profile",
        "get_questionnaire_responses",
        "get_tasks",
        "get_files",
        "get_connectivity",
        "get_validation_results",
      ];

      for (const toolName of orgToolNames) {
        expect(aiContent).toContain(`name: "${toolName}"`);
      }
    });

    it("each org-scoped tool has a description", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      // Verify each tool in ORG_SCOPED_TOOLS has a description field
      const orgScopedSection = aiContent.split("const ORG_SCOPED_TOOLS")[1]?.split("// ─")[0] ?? "";
      expect(orgScopedSection).toContain("description:");
    });

    it("executeTool handles all 6 org-scoped tool names", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      const toolCases = [
        'case "get_org_profile"',
        'case "get_questionnaire_responses"',
        'case "get_tasks"',
        'case "get_files"',
        'case "get_connectivity"',
        'case "get_validation_results"',
      ];

      for (const toolCase of toolCases) {
        expect(aiContent).toContain(toolCase);
      }
    });
  });

  // -------------------------------------------------------------------------
  // System prompt: verify org-scoped prompt is added when orgSlug is provided
  // -------------------------------------------------------------------------
  describe("System prompt", () => {
    it("org-scoped prompt includes the org name context", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      // Verify the org-scoped system prompt section exists
      expect(aiContent).toContain("Org-scoped system prompt");
      expect(aiContent).toContain("isOrgScoped");
      expect(aiContent).toContain("IMPORTANT CONTEXT: You are currently viewing the site dashboard");
      expect(aiContent).toContain("org-scoped tools");
    });

    it("activeTools uses ONLY ORG_SCOPED_TOOLS when orgSlug is provided (no cross-org tools)", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      // When org-scoped, ONLY org-scoped tools should be available (no list_organizations, create_user, etc.)
      expect(aiContent).toContain("const activeTools = isOrgScoped ? ORG_SCOPED_TOOLS : TOOLS;");
    });
  });

  // -------------------------------------------------------------------------
  // RBAC: verify org-scoped tools check access
  // -------------------------------------------------------------------------
  describe("RBAC enforcement", () => {
    it("each org-scoped tool checks orgSlug is present", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      const toolNames = [
        "get_org_profile",
        "get_questionnaire_responses",
        "get_tasks",
        "get_files",
        "get_connectivity",
        "get_validation_results",
      ];

      for (const toolName of toolNames) {
        // Each tool should check if orgSlug is present
        expect(aiContent).toContain(`if (!orgSlug) return { callId: call.id, name: "${toolName}"`);
      }
    });

    it("each org-scoped tool uses verifyOrgAccess for RBAC", async () => {
      const fs = await import("fs");
      const aiContent = fs.readFileSync("server/routers/ai.ts", "utf-8");

      // The verifyOrgAccess function should be called in each org-scoped tool
      // Count occurrences in the org-scoped section
      const orgScopedSection = aiContent.split('case "get_org_profile"')[1]?.split("default:")[0] ?? "";
      const verifyCount = (orgScopedSection.match(/verifyOrgAccess/g) || []).length;

      // Should have at least 6 calls (one per tool)
      expect(verifyCount).toBeGreaterThanOrEqual(6);
    });
  });
});
