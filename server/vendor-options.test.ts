import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@newlantern.ai",
    name: "Admin User",
    loginMethod: "email",
    role: "admin",
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createRegularUserContext(): TrpcContext {
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Vendor Options - Admin CRUD", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);

  it("getSystemVendorOptions returns an array", async () => {
    const result = await adminCaller.admin.getSystemVendorOptions();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getSystemVendorOptions returns objects with expected fields", async () => {
    const result = await adminCaller.admin.getSystemVendorOptions();
    if (result.length > 0) {
      const first = result[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("systemType");
      expect(first).toHaveProperty("vendorName");
      expect(first).toHaveProperty("isActive");
      expect(first).toHaveProperty("displayOrder");
    }
  });

  it("addVendorOption creates a new vendor and it appears in the list", async () => {
    const testSystemType = "TestSystem_" + Date.now();
    const testVendorName = "TestVendor_" + Date.now();

    const addResult = await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName: testVendorName,
    });
    expect(addResult).toEqual({ success: true });

    // Verify it appears in the list
    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const found = allOptions.find(
      (o) => o.systemType === testSystemType && o.vendorName === testVendorName
    );
    expect(found).toBeDefined();
    expect(found!.isActive).toBe(1);

    // Clean up
    await adminCaller.admin.deleteVendorOption({ id: found!.id });
  });

  it("updateVendorOption renames a vendor", async () => {
    const testSystemType = "UpdateTest_" + Date.now();
    const originalName = "OriginalVendor_" + Date.now();
    const updatedName = "UpdatedVendor_" + Date.now();

    // Create
    await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName: originalName,
    });

    // Find it
    let allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find(
      (o) => o.systemType === testSystemType && o.vendorName === originalName
    );
    expect(created).toBeDefined();

    // Update
    const updateResult = await adminCaller.admin.updateVendorOption({
      id: created!.id,
      vendorName: updatedName,
    });
    expect(updateResult).toEqual({ success: true });

    // Verify
    allOptions = await adminCaller.admin.getSystemVendorOptions();
    const updated = allOptions.find((o) => o.id === created!.id);
    expect(updated?.vendorName).toBe(updatedName);

    // Clean up
    await adminCaller.admin.deleteVendorOption({ id: created!.id });
  });

  it("toggleVendorOption deactivates and reactivates a vendor", async () => {
    const testSystemType = "ToggleTest_" + Date.now();
    const vendorName = "ToggleVendor_" + Date.now();

    // Create
    await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName,
    });

    let allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find(
      (o) => o.systemType === testSystemType && o.vendorName === vendorName
    );
    expect(created).toBeDefined();
    expect(created!.isActive).toBe(1);

    // Deactivate
    await adminCaller.admin.toggleVendorOption({ id: created!.id, isActive: 0 });
    allOptions = await adminCaller.admin.getSystemVendorOptions();
    const deactivated = allOptions.find((o) => o.id === created!.id);
    expect(deactivated?.isActive).toBe(0);

    // Reactivate
    await adminCaller.admin.toggleVendorOption({ id: created!.id, isActive: 1 });
    allOptions = await adminCaller.admin.getSystemVendorOptions();
    const reactivated = allOptions.find((o) => o.id === created!.id);
    expect(reactivated?.isActive).toBe(1);

    // Clean up
    await adminCaller.admin.deleteVendorOption({ id: created!.id });
  });

  it("deleteVendorOption removes a vendor", async () => {
    const testSystemType = "DeleteTest_" + Date.now();
    const vendorName = "DeleteVendor_" + Date.now();

    // Create
    await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName,
    });

    let allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find(
      (o) => o.systemType === testSystemType && o.vendorName === vendorName
    );
    expect(created).toBeDefined();

    // Delete
    const deleteResult = await adminCaller.admin.deleteVendorOption({ id: created!.id });
    expect(deleteResult).toEqual({ success: true });

    // Verify it's gone
    allOptions = await adminCaller.admin.getSystemVendorOptions();
    const deleted = allOptions.find((o) => o.id === created!.id);
    expect(deleted).toBeUndefined();
  });

  it("addSystemType creates multiple vendors for a new system type", async () => {
    const testSystemType = "BulkTest_" + Date.now();
    const vendors = ["VendorA", "VendorB", "VendorC"];

    const result = await adminCaller.admin.addSystemType({
      systemType: testSystemType,
      vendors,
    });
    expect(result).toEqual({ success: true });

    // Verify all three appear
    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.filter((o) => o.systemType === testSystemType);
    expect(created.length).toBe(3);
    expect(created.map((c) => c.vendorName).sort()).toEqual(vendors.sort());

    // Clean up
    for (const c of created) {
      await adminCaller.admin.deleteVendorOption({ id: c.id });
    }
  });
});

describe("Vendor Options - Access Control", () => {
  it("regular user cannot access getSystemVendorOptions (admin-only)", async () => {
    const userCtx = createRegularUserContext();
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.admin.getSystemVendorOptions()
    ).rejects.toThrow("Admin access required");
  });

  it("regular user cannot add vendor options", async () => {
    const userCtx = createRegularUserContext();
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.admin.addVendorOption({
        systemType: "PACS",
        vendorName: "HackerVendor",
      })
    ).rejects.toThrow("Admin access required");
  });
});

describe("Vendor Options - Public Intake Endpoint", () => {
  it("getActiveVendorOptions returns grouped vendor options", async () => {
    const adminCtx = createAdminContext();
    const caller = appRouter.createCaller(adminCtx);

    const result = await caller.intake.getActiveVendorOptions();
    expect(typeof result).toBe("object");

    // If there are seeded options, verify structure
    for (const [systemType, vendors] of Object.entries(result)) {
      expect(typeof systemType).toBe("string");
      expect(Array.isArray(vendors)).toBe(true);
      for (const v of vendors) {
        expect(typeof v).toBe("string");
      }
    }
  });

  it("getActiveVendorOptions is accessible to unauthenticated users", async () => {
    const publicCtx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: vi.fn(),
      } as unknown as TrpcContext["res"],
    };
    const publicCaller = appRouter.createCaller(publicCtx);

    // Should not throw - it's a public procedure
    const result = await publicCaller.intake.getActiveVendorOptions();
    expect(typeof result).toBe("object");
  });

  it("getActiveVendorOptions only returns active vendors", async () => {
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);

    const testSystemType = "ActiveTest_" + Date.now();

    // Add two vendors, one active and one deactivated
    await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName: "ActiveVendor",
    });
    await adminCaller.admin.addVendorOption({
      systemType: testSystemType,
      vendorName: "InactiveVendor",
    });

    // Find and deactivate the second one
    let allOptions = await adminCaller.admin.getSystemVendorOptions();
    const inactive = allOptions.find(
      (o) => o.systemType === testSystemType && o.vendorName === "InactiveVendor"
    );
    expect(inactive).toBeDefined();
    await adminCaller.admin.toggleVendorOption({ id: inactive!.id, isActive: 0 });

    // Check public endpoint
    const publicResult = await adminCaller.intake.getActiveVendorOptions();
    const vendors = publicResult[testSystemType] || [];
    expect(vendors).toContain("ActiveVendor");
    expect(vendors).not.toContain("InactiveVendor");

    // Clean up
    allOptions = await adminCaller.admin.getSystemVendorOptions();
    const toClean = allOptions.filter((o) => o.systemType === testSystemType);
    for (const c of toClean) {
      await adminCaller.admin.deleteVendorOption({ id: c.id });
    }
  });

  it("getActiveVendorOptions returns vendors alphabetized with Other last", async () => {
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);

    const testSystemType = "AlphaTest_" + Date.now();

    // Add vendors in non-alphabetical order, including "Other"
    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName: "Zebra" });
    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName: "Alpha" });
    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName: "Other" });
    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName: "Middle" });

    const result = await adminCaller.intake.getActiveVendorOptions();
    const vendors = result[testSystemType];
    expect(vendors).toBeDefined();
    expect(vendors!.length).toBe(4);

    // Should be alphabetized with Other last
    expect(vendors![0]).toBe("Alpha");
    expect(vendors![1]).toBe("Middle");
    expect(vendors![2]).toBe("Zebra");
    expect(vendors![3]).toBe("Other");

    // Clean up
    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const toClean = allOptions.filter((o) => o.systemType === testSystemType);
    for (const c of toClean) {
      await adminCaller.admin.deleteVendorOption({ id: c.id });
    }
  });
});

describe("Vendor Options - Audit Log", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);

  it("getVendorAuditLog returns an array of log entries", async () => {
    const result = await adminCaller.admin.getVendorAuditLog({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("addVendorOption creates an audit log entry", async () => {
    const testSystemType = "AuditAdd_" + Date.now();
    const vendorName = "AuditTestVendor_" + Date.now();

    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName });

    const logs = await adminCaller.admin.getVendorAuditLog({ limit: 5 });
    const addLog = logs.find(
      (l) => l.action === "add" && l.systemType === testSystemType && l.vendorName === vendorName
    );
    expect(addLog).toBeDefined();
    expect(addLog!.performedBy).toBe("admin@newlantern.ai");
    expect(addLog!.newValue).toBe(vendorName);

    // Clean up
    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find((o) => o.systemType === testSystemType && o.vendorName === vendorName);
    if (created) await adminCaller.admin.deleteVendorOption({ id: created.id });
  });

  it("updateVendorOption creates an audit log entry with before/after", async () => {
    const testSystemType = "AuditUpdate_" + Date.now();
    const originalName = "OrigName_" + Date.now();
    const newName = "NewName_" + Date.now();

    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName: originalName });

    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find((o) => o.systemType === testSystemType && o.vendorName === originalName);
    expect(created).toBeDefined();

    await adminCaller.admin.updateVendorOption({ id: created!.id, vendorName: newName });

    const logs = await adminCaller.admin.getVendorAuditLog({ limit: 5 });
    const updateLog = logs.find(
      (l) => l.action === "update" && l.systemType === testSystemType
    );
    expect(updateLog).toBeDefined();
    expect(updateLog!.previousValue).toBe(originalName);
    expect(updateLog!.newValue).toBe(newName);

    // Clean up
    await adminCaller.admin.deleteVendorOption({ id: created!.id });
  });

  it("toggleVendorOption creates an audit log entry", async () => {
    const testSystemType = "AuditToggle_" + Date.now();
    const vendorName = "ToggleAudit_" + Date.now();

    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName });

    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find((o) => o.systemType === testSystemType && o.vendorName === vendorName);
    expect(created).toBeDefined();

    await adminCaller.admin.toggleVendorOption({ id: created!.id, isActive: 0 });

    const logs = await adminCaller.admin.getVendorAuditLog({ limit: 5 });
    const toggleLog = logs.find(
      (l) => l.action === "toggle" && l.systemType === testSystemType && l.vendorName === vendorName
    );
    expect(toggleLog).toBeDefined();
    expect(toggleLog!.previousValue).toBe("active");
    expect(toggleLog!.newValue).toBe("inactive");

    // Clean up
    await adminCaller.admin.deleteVendorOption({ id: created!.id });
  });

  it("deleteVendorOption creates an audit log entry", async () => {
    const testSystemType = "AuditDelete_" + Date.now();
    const vendorName = "DeleteAudit_" + Date.now();

    await adminCaller.admin.addVendorOption({ systemType: testSystemType, vendorName });

    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const created = allOptions.find((o) => o.systemType === testSystemType && o.vendorName === vendorName);
    expect(created).toBeDefined();

    await adminCaller.admin.deleteVendorOption({ id: created!.id });

    const logs = await adminCaller.admin.getVendorAuditLog({ limit: 5 });
    const deleteLog = logs.find(
      (l) => l.action === "delete" && l.systemType === testSystemType && l.vendorName === vendorName
    );
    expect(deleteLog).toBeDefined();
    expect(deleteLog!.previousValue).toBe(vendorName);
  });

  it("addSystemType creates an audit log entry", async () => {
    const testSystemType = "AuditBulk_" + Date.now();
    const vendors = ["V1", "V2", "V3"];

    await adminCaller.admin.addSystemType({ systemType: testSystemType, vendors });

    const logs = await adminCaller.admin.getVendorAuditLog({ limit: 5 });
    const bulkLog = logs.find(
      (l) => l.action === "add_system_type" && l.systemType === testSystemType
    );
    expect(bulkLog).toBeDefined();
    expect(bulkLog!.newValue).toBe(JSON.stringify(vendors));

    // Clean up
    const allOptions = await adminCaller.admin.getSystemVendorOptions();
    const toClean = allOptions.filter((o) => o.systemType === testSystemType);
    for (const c of toClean) {
      await adminCaller.admin.deleteVendorOption({ id: c.id });
    }
  });

  it("regular user cannot access audit log", async () => {
    const userCtx = createRegularUserContext();
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.admin.getVendorAuditLog({ limit: 10 })
    ).rejects.toThrow("Admin access required");
  });
});
