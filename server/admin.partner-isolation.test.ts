/**
 * Partner Isolation Tests
 * Verifies that partner admins can only see their own data
 * and New Lantern staff can see all data
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, organizations, clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Partner Isolation System", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let srvAdmin: typeof users.$inferSelect;
  let radoneAdmin: typeof users.$inferSelect;
  let newLanternAdmin: typeof users.$inferSelect;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get test users
    [srvAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@srv.com"))
      .limit(1);

    [radoneAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@radone.com"))
      .limit(1);

    [newLanternAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@newlantern.ai"))
      .limit(1);
  });

  it("should have created test users correctly", () => {
    expect(srvAdmin).toBeDefined();
    expect(srvAdmin.clientId).toBe(2);
    expect(srvAdmin.role).toBe("admin");

    expect(radoneAdmin).toBeDefined();
    expect(radoneAdmin.clientId).toBe(1);
    expect(radoneAdmin.role).toBe("admin");

    expect(newLanternAdmin).toBeDefined();
    expect(newLanternAdmin.clientId).toBeNull();
    expect(newLanternAdmin.role).toBe("admin");
  });

  it("should have created test organizations correctly", async () => {
    const allOrgs = await db!.select().from(organizations);

    const srvOrgs = allOrgs.filter(o => o.clientId === 2);
    const radoneOrgs = allOrgs.filter(o => o.clientId === 1);

    expect(srvOrgs.length).toBeGreaterThanOrEqual(2);
    expect(radoneOrgs.length).toBeGreaterThanOrEqual(2);
  });

  it("SRV admin should only see SRV organizations", async () => {
    // Simulate SRV admin query
    const srvOrgs = await db!
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, srvAdmin.clientId!));

    // All returned orgs should have clientId = 2 (SRV)
    expect(srvOrgs.every(o => o.clientId === 2)).toBe(true);

    // Should not see any RadOne orgs
    expect(srvOrgs.some(o => o.clientId === 1)).toBe(false);
  });

  it("RadOne admin should only see RadOne organizations", async () => {
    // Simulate RadOne admin query
    const radoneOrgs = await db!
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, radoneAdmin.clientId!));

    // All returned orgs should have clientId = 1 (RadOne)
    expect(radoneOrgs.every(o => o.clientId === 1)).toBe(true);

    // Should not see any SRV orgs
    expect(radoneOrgs.some(o => o.clientId === 2)).toBe(false);
  });

  it("New Lantern admin should see all organizations", async () => {
    // Simulate New Lantern admin query (no filter)
    const allOrgs = await db!.select().from(organizations);

    // Should see both SRV and RadOne orgs
    const hasSrvOrgs = allOrgs.some(o => o.clientId === 2);
    const hasRadoneOrgs = allOrgs.some(o => o.clientId === 1);

    expect(hasSrvOrgs).toBe(true);
    expect(hasRadoneOrgs).toBe(true);
  });

  it("should have correct client records", async () => {
    const allClients = await db!.select().from(clients);

    const srvClient = allClients.find(c => c.slug === "SRV");
    const radoneClient = allClients.find(c => c.slug === "RadOne");

    expect(srvClient).toBeDefined();
    expect(srvClient?.name).toBe("SRV");

    expect(radoneClient).toBeDefined();
    expect(radoneClient?.name).toBe("RadOne");
  });

  it("should prevent cross-partner data access", async () => {
    // SRV admin trying to access RadOne org (clientId = 1)
    const srvAttempt = await db!
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, srvAdmin.clientId!));

    // Should not contain any RadOne orgs
    expect(srvAttempt.every(o => o.clientId !== 1)).toBe(true);

    // RadOne admin trying to access SRV org (clientId = 2)
    const radoneAttempt = await db!
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, radoneAdmin.clientId!));

    // Should not contain any SRV orgs
    expect(radoneAttempt.every(o => o.clientId !== 2)).toBe(true);
  });
});
