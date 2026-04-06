/**
 * Task Template Tests
 *
 * Tests for the partner task template system:
 * - CRUD via tRPC (createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, getTaskTemplates)
 * - Partner isolation (partner admin can only see/modify their own tasks)
 * - getTaskTemplatesForOrg returns correct tasks via org slug → clientId lookup
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { clients, organizations, partnerTaskTemplates, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "../drizzle/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminCtx(user: User) {
  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

// Build a minimal User-shaped object for a platform admin (no clientId)
function platformAdminUser(overrides: Partial<User> = {}): User {
  return {
    id: 999_001,
    openId: "platform-admin-openid",
    email: "admin@newlantern.ai",
    name: "Platform Admin",
    role: "admin",
    clientId: null,
    organizationId: null,
    passwordHash: null,
    loginMethod: "password",
    isActive: 1,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Partner Task Templates", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let srvClientId: number;
  let radOneClientId: number;
  let srvAdminUser: User;
  let radOneAdminUser: User;
  let testOrgSlug: string;
  let testOrgId: number;
  const createdTaskIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Look up real partner clients
    const [srvClient] = await db.select().from(clients).where(eq(clients.name, "SRV")).limit(1);
    if (!srvClient) throw new Error("SRV client not found in DB – run seed first");
    srvClientId = srvClient.id;

    const [radOneClient] = await db.select().from(clients).where(eq(clients.name, "RadOne")).limit(1);
    if (!radOneClient) throw new Error("RadOne client not found in DB – run seed first");
    radOneClientId = radOneClient.id;

    // Build fake admin user objects (we don't need DB rows for caller context)
    srvAdminUser = platformAdminUser({ id: 999_002, email: "admin@srv.com", clientId: srvClientId });
    radOneAdminUser = platformAdminUser({ id: 999_003, email: "admin@radone.com", clientId: radOneClientId });

    // Create a test organization under SRV for the getTaskTemplatesForOrg test
    testOrgSlug = `test-tasks-org-${Date.now()}`;
    const [insertResult] = await db.insert(organizations).values({
      name: "Test Tasks Org",
      slug: testOrgSlug,
      clientId: srvClientId,
      status: "active",
    });
    testOrgId = insertResult.insertId;
  });

  afterAll(async () => {
    if (!db) return;

    // Clean up tasks created during tests
    for (const id of createdTaskIds) {
      await db.delete(partnerTaskTemplates).where(eq(partnerTaskTemplates.id, id));
    }

    // Remove test org
    if (testOrgId) {
      await db.delete(organizations).where(eq(organizations.id, testOrgId));
    }
  });

  // -------------------------------------------------------------------------
  // createTaskTemplate
  // -------------------------------------------------------------------------

  describe("createTaskTemplate", () => {
    it("platform admin can create a task for any partner", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));

      const result = await caller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Upload network diagram",
        description: "Provide a diagram showing your network topology",
        type: "upload",
        section: "Security & Permissions",
        sortOrder: 1,
      });

      expect(result.success).toBe(true);

      // Verify it's in the DB
      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(and(
          eq(partnerTaskTemplates.clientId, srvClientId),
          eq(partnerTaskTemplates.title, "Upload network diagram"),
        ))
        .limit(1);

      expect(task).toBeDefined();
      expect(task.type).toBe("upload");
      expect(task.section).toBe("Security & Permissions");
      expect(task.isActive).toBe(1);

      createdTaskIds.push(task.id);
    });

    it("partner admin can create a task for their own partner", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));

      const result = await caller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Schedule kick-off call",
        type: "schedule",
        section: "Onboarding",
        sortOrder: 2,
      });

      expect(result.success).toBe(true);

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(and(
          eq(partnerTaskTemplates.clientId, srvClientId),
          eq(partnerTaskTemplates.title, "Schedule kick-off call"),
        ))
        .limit(1);

      expect(task).toBeDefined();
      createdTaskIds.push(task.id);
    });

    it("partner admin cannot create a task for a different partner", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));

      await expect(
        caller.admin.createTaskTemplate({
          clientId: radOneClientId, // different partner!
          title: "Sneaky task",
          type: "review",
        }),
      ).rejects.toThrow("Cannot create tasks for a different partner");
    });

    it("non-admin user is rejected", async () => {
      const regularUser = platformAdminUser({ role: "user" });
      const caller = appRouter.createCaller(makeAdminCtx(regularUser));

      await expect(
        caller.admin.createTaskTemplate({
          clientId: srvClientId,
          title: "Unauthorized task",
          type: "review",
        }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getTaskTemplates
  // -------------------------------------------------------------------------

  describe("getTaskTemplates", () => {
    it("platform admin sees tasks from all partners", async () => {
      // Create one task for each partner
      const srvCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      const radOneCaller = appRouter.createCaller(makeAdminCtx(radOneAdminUser));

      const r1 = await srvCaller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: `SRV task ${Date.now()}`,
        type: "form",
      });
      expect(r1.success).toBe(true);

      const r2 = await radOneCaller.admin.createTaskTemplate({
        clientId: radOneClientId,
        title: `RadOne task ${Date.now()}`,
        type: "review",
      });
      expect(r2.success).toBe(true);

      const platformCaller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
      const tasks = await platformCaller.admin.getTaskTemplates();

      const hasSrv = tasks.some(t => t.clientId === srvClientId);
      const hasRadOne = tasks.some(t => t.clientId === radOneClientId);

      expect(hasSrv).toBe(true);
      expect(hasRadOne).toBe(true);

      // Track for cleanup
      for (const t of tasks) {
        if (
          (t.clientId === srvClientId || t.clientId === radOneClientId) &&
          !createdTaskIds.includes(t.id)
        ) {
          createdTaskIds.push(t.id);
        }
      }
    });

    it("SRV partner admin only sees SRV tasks", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      const tasks = await caller.admin.getTaskTemplates();

      expect(tasks.every(t => t.clientId === srvClientId)).toBe(true);
      expect(tasks.some(t => t.clientId === radOneClientId)).toBe(false);
    });

    it("RadOne partner admin only sees RadOne tasks", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(radOneAdminUser));
      const tasks = await caller.admin.getTaskTemplates();

      expect(tasks.every(t => t.clientId === radOneClientId)).toBe(true);
      expect(tasks.some(t => t.clientId === srvClientId)).toBe(false);
    });

    it("returned tasks include clientName", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
      const tasks = await caller.admin.getTaskTemplates();

      const srvTask = tasks.find(t => t.clientId === srvClientId);
      expect(srvTask?.clientName).toBe("SRV");
    });
  });

  // -------------------------------------------------------------------------
  // updateTaskTemplate
  // -------------------------------------------------------------------------

  describe("updateTaskTemplate", () => {
    let taskToUpdate: number;

    beforeAll(async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await caller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Task to be updated",
        type: "review",
        section: "Old Section",
        sortOrder: 10,
      });

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Task to be updated"))
        .limit(1);

      taskToUpdate = task.id;
      createdTaskIds.push(task.id);
    });

    it("partner admin can update their own task", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));

      const result = await caller.admin.updateTaskTemplate({
        id: taskToUpdate,
        title: "Updated task title",
        section: "New Section",
        sortOrder: 5,
      });

      expect(result.success).toBe(true);

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.id, taskToUpdate))
        .limit(1);

      expect(task.title).toBe("Updated task title");
      expect(task.section).toBe("New Section");
      expect(task.sortOrder).toBe(5);
    });

    it("partner admin cannot update a different partner's task", async () => {
      // Create a RadOne task
      const radCaller = appRouter.createCaller(makeAdminCtx(radOneAdminUser));
      await radCaller.admin.createTaskTemplate({
        clientId: radOneClientId,
        title: "RadOne task to protect",
        type: "review",
      });

      const [radTask] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "RadOne task to protect"))
        .limit(1);

      createdTaskIds.push(radTask.id);

      // SRV admin tries to update it
      const srvCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await expect(
        srvCaller.admin.updateTaskTemplate({
          id: radTask.id,
          title: "Hijacked title",
        }),
      ).rejects.toThrow("Cannot update tasks for a different partner");
    });

    it("returns NOT_FOUND for non-existent task", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
      await expect(
        caller.admin.updateTaskTemplate({ id: 999_999_999, title: "Ghost" }),
      ).rejects.toThrow("Task template not found");
    });
  });

  // -------------------------------------------------------------------------
  // deleteTaskTemplate
  // -------------------------------------------------------------------------

  describe("deleteTaskTemplate", () => {
    it("partner admin can soft-delete their own task", async () => {
      // Create a task to delete
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await caller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Task to delete",
        type: "review",
      });

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Task to delete"))
        .limit(1);

      createdTaskIds.push(task.id);

      const result = await caller.admin.deleteTaskTemplate({ id: task.id });
      expect(result.success).toBe(true);

      // Task should still exist in DB but isActive = 0
      const [deleted] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.id, task.id))
        .limit(1);

      expect(deleted).toBeDefined();
      expect(deleted.isActive).toBe(0);
    });

    it("deleted tasks do not appear in getTaskTemplates", async () => {
      const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));

      // Create then delete a task
      await caller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Temporary task for delete test",
        type: "form",
      });

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Temporary task for delete test"))
        .limit(1);

      createdTaskIds.push(task.id);
      await caller.admin.deleteTaskTemplate({ id: task.id });

      const tasks = await caller.admin.getTaskTemplates();
      expect(tasks.some(t => t.id === task.id)).toBe(false);
    });

    it("partner admin cannot delete a different partner's task", async () => {
      // Create a RadOne task
      const radCaller = appRouter.createCaller(makeAdminCtx(radOneAdminUser));
      await radCaller.admin.createTaskTemplate({
        clientId: radOneClientId,
        title: "Protected RadOne task",
        type: "review",
      });

      const [radTask] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Protected RadOne task"))
        .limit(1);

      createdTaskIds.push(radTask.id);

      // SRV admin tries to delete it
      const srvCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await expect(
        srvCaller.admin.deleteTaskTemplate({ id: radTask.id }),
      ).rejects.toThrow("Cannot delete tasks for a different partner");
    });
  });

  // -------------------------------------------------------------------------
  // getTaskTemplatesForOrg (public intake endpoint)
  // -------------------------------------------------------------------------

  describe("getTaskTemplatesForOrg", () => {
    it("returns tasks for an org's partner", async () => {
      // Create a task for SRV (testOrg belongs to SRV)
      const adminCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await adminCaller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Org-specific task check",
        description: "Should appear on the tasks page",
        type: "upload",
        section: "Integration",
        sortOrder: 1,
      });

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Org-specific task check"))
        .limit(1);
      createdTaskIds.push(task.id);

      // Fetch via public intake endpoint using the org slug
      const publicCaller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const tasks = await publicCaller.intake.getTaskTemplatesForOrg({
        organizationSlug: testOrgSlug,
      });

      expect(Array.isArray(tasks)).toBe(true);
      const found = tasks.find(t => t.title === "Org-specific task check");
      expect(found).toBeDefined();
      expect(found?.type).toBe("upload");
      expect(found?.section).toBe("Integration");
    });

    it("returns empty array for unknown org slug", async () => {
      const publicCaller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const tasks = await publicCaller.intake.getTaskTemplatesForOrg({
        organizationSlug: "definitely-does-not-exist-xyz-999",
      });

      expect(tasks).toEqual([]);
    });

    it("does not return soft-deleted tasks", async () => {
      // Create then delete a task for SRV
      const adminCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
      await adminCaller.admin.createTaskTemplate({
        clientId: srvClientId,
        title: "Task that gets deleted",
        type: "review",
      });

      const [task] = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(eq(partnerTaskTemplates.title, "Task that gets deleted"))
        .limit(1);
      createdTaskIds.push(task.id);

      await adminCaller.admin.deleteTaskTemplate({ id: task.id });

      const publicCaller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const tasks = await publicCaller.intake.getTaskTemplatesForOrg({
        organizationSlug: testOrgSlug,
      });

      expect(tasks.some(t => t.id === task.id)).toBe(false);
    });

    it("tasks are ordered by sortOrder", async () => {
      const adminCaller = appRouter.createCaller(makeAdminCtx(srvAdminUser));

      // Create tasks out of order
      await adminCaller.admin.createTaskTemplate({ clientId: srvClientId, title: "Order C", type: "review", sortOrder: 30 });
      await adminCaller.admin.createTaskTemplate({ clientId: srvClientId, title: "Order A", type: "review", sortOrder: 10 });
      await adminCaller.admin.createTaskTemplate({ clientId: srvClientId, title: "Order B", type: "review", sortOrder: 20 });

      const orderTasks = await db!
        .select()
        .from(partnerTaskTemplates)
        .where(and(
          eq(partnerTaskTemplates.clientId, srvClientId),
          eq(partnerTaskTemplates.isActive, 1),
        ));

      for (const t of orderTasks) {
        if (["Order A", "Order B", "Order C"].includes(t.title)) {
          createdTaskIds.push(t.id);
        }
      }

      const publicCaller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const tasks = await publicCaller.intake.getTaskTemplatesForOrg({
        organizationSlug: testOrgSlug,
      });

      const indices = ["Order A", "Order B", "Order C"].map(title =>
        tasks.findIndex(t => t.title === title)
      );

      // A (sortOrder 10) should come before B (20), B before C (30)
      expect(indices[0]).toBeLessThan(indices[1]);
      expect(indices[1]).toBeLessThan(indices[2]);
    });
  });
});
