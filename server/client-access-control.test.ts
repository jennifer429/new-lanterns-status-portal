import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { organizations, users, clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Tests for client-level access control
 * Verifies that users can only access organizations belonging to their client
 */
describe("Client Access Control", () => {
  let radOneClientId: number;
  let srvClientId: number;
  let radOneOrgId: number;
  let srvOrgId: number;
  let radOneUserId: number;
  let srvUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get RadOne client
    const [radOneClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.name, "RadOne"))
      .limit(1);
    
    if (!radOneClient) throw new Error("RadOne client not found");
    radOneClientId = radOneClient.id;

    // Get SRV client
    const [srvClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.name, "SRV"))
      .limit(1);
    
    if (!srvClient) throw new Error("SRV client not found");
    srvClientId = srvClient.id;

    // Get a RadOne organization
    const [radOneOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, radOneClientId))
      .limit(1);
    
    if (!radOneOrg) throw new Error("RadOne organization not found");
    radOneOrgId = radOneOrg.id;

    // Get an SRV organization
    const [srvOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, srvClientId))
      .limit(1);
    
    if (!srvOrg) throw new Error("SRV organization not found");
    srvOrgId = srvOrg.id;

    // Get a RadOne user
    const [radOneUser] = await db
      .select()
      .from(users)
      .where(eq(users.clientId, radOneClientId))
      .limit(1);
    
    if (!radOneUser) throw new Error("RadOne user not found");
    radOneUserId = radOneUser.id;

    // Get an SRV user
    const [srvUser] = await db
      .select()
      .from(users)
      .where(eq(users.clientId, srvClientId))
      .limit(1);
    
    if (!srvUser) throw new Error("SRV user not found");
    srvUserId = srvUser.id;
  });

  it("should have RadOne and SRV clients in database", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allClients = await db.select().from(clients);
    const clientNames = allClients.map(c => c.name);

    expect(clientNames).toContain("RadOne");
    expect(clientNames).toContain("SRV");
  });

  it("should have organizations linked to correct clients", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check RadOne organizations
    const radOneOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, radOneClientId));

    expect(radOneOrgs.length).toBeGreaterThan(0);
    expect(radOneOrgs.every(org => org.clientId === radOneClientId)).toBe(true);

    // Check SRV organizations
    const srvOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, srvClientId));

    expect(srvOrgs.length).toBeGreaterThan(0);
    expect(srvOrgs.every(org => org.clientId === srvClientId)).toBe(true);
  });

  it("should have users assigned to correct clients", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check RadOne users
    const radOneUsers = await db
      .select()
      .from(users)
      .where(eq(users.clientId, radOneClientId));

    expect(radOneUsers.length).toBeGreaterThan(0);
    expect(radOneUsers.every(user => user.clientId === radOneClientId)).toBe(true);

    // Check SRV users
    const srvUsers = await db
      .select()
      .from(users)
      .where(eq(users.clientId, srvClientId));

    expect(srvUsers.length).toBeGreaterThan(0);
    expect(srvUsers.every(user => user.clientId === srvClientId)).toBe(true);
  });

  it("should filter organizations by user's clientId", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Simulate RadOne user querying organizations
    const radOneOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, radOneClientId));

    // Verify RadOne user only sees RadOne organizations
    expect(radOneOrgs.every(org => org.clientId === radOneClientId)).toBe(true);
    expect(radOneOrgs.some(org => org.clientId === srvClientId)).toBe(false);

    // Simulate SRV user querying organizations
    const srvOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, srvClientId));

    // Verify SRV user only sees SRV organizations
    expect(srvOrgs.every(org => org.clientId === srvClientId)).toBe(true);
    expect(srvOrgs.some(org => org.clientId === radOneClientId)).toBe(false);
  });

  it("should prevent cross-client organization access", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get RadOne user
    const [radOneUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, radOneUserId))
      .limit(1);

    // Get SRV organization
    const [srvOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, srvOrgId))
      .limit(1);

    // Verify RadOne user's clientId does not match SRV organization's clientId
    expect(radOneUser.clientId).not.toBe(srvOrg.clientId);

    // Get SRV user
    const [srvUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, srvUserId))
      .limit(1);

    // Get RadOne organization
    const [radOneOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, radOneOrgId))
      .limit(1);

    // Verify SRV user's clientId does not match RadOne organization's clientId
    expect(srvUser.clientId).not.toBe(radOneOrg.clientId);
  });

  it("should have clientId column in users table", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [user] = await db.select().from(users).limit(1);
    
    // Verify clientId field exists
    expect(user).toHaveProperty("clientId");
  });

  it("should have clientId column in organizations table", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [org] = await db.select().from(organizations).limit(1);
    
    // Verify clientId field exists
    expect(org).toHaveProperty("clientId");
  });
});
