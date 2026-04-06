/**
 * CreateOrganization — Partner Admin Tests
 *
 * Verifies the server-side behaviour that backs the CreateOrganization page
 * when used by a partner admin:
 *  - Partner admin can create an org under their own clientId
 *  - Partner admin cannot create an org under a different clientId
 *  - Platform admin can create orgs under any partner
 *  - Duplicate slugs are rejected
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { clients, organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";

function makeAdminCtx(user: User) {
  return { user, req: {} as any, res: {} as any };
}

function platformAdminUser(overrides: Partial<User> = {}): User {
  return {
    id: 998_001,
    openId: "plat-admin-co-openid",
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

describe("CreateOrganization — partner admin access", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let srvClientId: number;
  let radOneClientId: number;
  let srvAdminUser: User;
  const createdOrgSlugs: string[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    const [srvClient] = await db.select().from(clients).where(eq(clients.name, "SRV")).limit(1);
    if (!srvClient) throw new Error("SRV client not found");
    srvClientId = srvClient.id;

    const [radOneClient] = await db.select().from(clients).where(eq(clients.name, "RadOne")).limit(1);
    if (!radOneClient) throw new Error("RadOne client not found");
    radOneClientId = radOneClient.id;

    srvAdminUser = platformAdminUser({ id: 998_002, email: "admin@srv.com", clientId: srvClientId });
  });

  afterAll(async () => {
    if (!db) return;
    for (const slug of createdOrgSlugs) {
      await db.delete(organizations).where(eq(organizations.slug, slug));
    }
  });

  it("partner admin can create an org under their own clientId", async () => {
    const slug = `srv-partner-test-${Date.now()}`;
    createdOrgSlugs.push(slug);

    const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
    const result = await caller.admin.createOrganization({
      clientId: srvClientId,
      name: "SRV Test Hospital",
      slug,
      status: "active",
    });

    expect(result.success).toBe(true);

    const [org] = await db!.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    expect(org).toBeDefined();
    expect(org.clientId).toBe(srvClientId);
    expect(org.name).toBe("SRV Test Hospital");
  });

  it("partner admin passing a different clientId still creates org under their own partner", async () => {
    // The server forces partner admin's own clientId — input clientId is silently ignored.
    const slug = `srv-forced-client-test-${Date.now()}`;
    createdOrgSlugs.push(slug);

    const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
    const result = await caller.admin.createOrganization({
      clientId: radOneClientId, // will be overridden by server
      name: "Attempted Cross-Partner Hospital",
      slug,
      status: "active",
    });

    expect(result.success).toBe(true);

    // Org should exist but be assigned to SRV (not RadOne)
    const [org] = await db!.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    expect(org).toBeDefined();
    expect(org.clientId).toBe(srvClientId);    // forced to SRV
    expect(org.clientId).not.toBe(radOneClientId); // NOT RadOne
  });

  it("platform admin can create an org under any partner", async () => {
    const slug = `platform-created-org-${Date.now()}`;
    createdOrgSlugs.push(slug);

    const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
    const result = await caller.admin.createOrganization({
      clientId: radOneClientId,
      name: "RadOne Platform-Created Hospital",
      slug,
      status: "active",
    });

    expect(result.success).toBe(true);

    const [org] = await db!.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    expect(org).toBeDefined();
    expect(org.clientId).toBe(radOneClientId);
  });

  it("duplicate slug is rejected", async () => {
    const slug = `dup-slug-test-${Date.now()}`;
    createdOrgSlugs.push(slug);

    const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));

    // First creation should succeed
    await caller.admin.createOrganization({
      clientId: srvClientId,
      name: "First Hospital",
      slug,
      status: "active",
    });

    // Second creation with same slug should fail
    await expect(
      caller.admin.createOrganization({
        clientId: srvClientId,
        name: "Duplicate Hospital",
        slug,
        status: "active",
      }),
    ).rejects.toThrow();
  });

  it("non-admin user is rejected", async () => {
    const regularUser = platformAdminUser({ role: "user" });
    const caller = appRouter.createCaller(makeAdminCtx(regularUser));
    const slug = `non-admin-test-${Date.now()}`;

    await expect(
      caller.admin.createOrganization({
        clientId: srvClientId,
        name: "Should Fail",
        slug,
        status: "active",
      }),
    ).rejects.toThrow();
  });
});
