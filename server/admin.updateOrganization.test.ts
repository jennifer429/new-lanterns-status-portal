/**
 * admin.updateOrganization — Partner Isolation / IDOR Tests
 *
 * Guards against an insecure-direct-object-reference (IDOR) bug where a partner
 * admin could update — or reassign the clientId of — an organization belonging
 * to a different partner.
 *
 *  - Partner admin can update their own partner's org
 *  - Partner admin CANNOT update another partner's org (FORBIDDEN)
 *  - Partner admin CANNOT move their org to another partner via clientId (FORBIDDEN)
 *  - Platform admin can update any org and reassign clientId freely
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
    id: 997_001,
    openId: "plat-admin-upd-openid",
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

describe("admin.updateOrganization — partner isolation", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let srvClientId: number;
  let radOneClientId: number;
  let srvAdminUser: User;
  let radOneOrgId: number;
  let srvOrgId: number;
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

    srvAdminUser = platformAdminUser({ id: 997_002, email: "admin@srv.com", clientId: srvClientId });

    // Seed one org per partner to act on.
    const srvSlug = `srv-upd-test-${Date.now()}`;
    const radSlug = `rad-upd-test-${Date.now()}`;
    createdOrgSlugs.push(srvSlug, radSlug);

    const platform = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
    await platform.admin.createOrganization({ clientId: srvClientId, name: "SRV Upd Org", slug: srvSlug, status: "active" });
    await platform.admin.createOrganization({ clientId: radOneClientId, name: "RadOne Upd Org", slug: radSlug, status: "active" });

    [{ id: srvOrgId }] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, srvSlug)).limit(1);
    [{ id: radOneOrgId }] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, radSlug)).limit(1);
  });

  afterAll(async () => {
    if (!db) return;
    for (const slug of createdOrgSlugs) {
      await db.delete(organizations).where(eq(organizations.slug, slug));
    }
  });

  it("partner admin can update their own partner's organization", async () => {
    const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
    const result = await caller.admin.updateOrganization({ id: srvOrgId, name: "SRV Upd Org Renamed" });
    expect(result.success).toBe(true);

    const [org] = await db!.select().from(organizations).where(eq(organizations.id, srvOrgId)).limit(1);
    expect(org.name).toBe("SRV Upd Org Renamed");
    expect(org.clientId).toBe(srvClientId);
  });

  it("partner admin CANNOT update another partner's organization", async () => {
    const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
    await expect(
      caller.admin.updateOrganization({ id: radOneOrgId, name: "Hijacked" }),
    ).rejects.toThrow();

    // RadOne org must be untouched.
    const [org] = await db!.select().from(organizations).where(eq(organizations.id, radOneOrgId)).limit(1);
    expect(org.name).toBe("RadOne Upd Org");
    expect(org.clientId).toBe(radOneClientId);
  });

  it("partner admin CANNOT reassign their org to another partner via clientId", async () => {
    const caller = appRouter.createCaller(makeAdminCtx(srvAdminUser));
    await expect(
      caller.admin.updateOrganization({ id: srvOrgId, clientId: radOneClientId }),
    ).rejects.toThrow();

    // Org must remain with SRV.
    const [org] = await db!.select().from(organizations).where(eq(organizations.id, srvOrgId)).limit(1);
    expect(org.clientId).toBe(srvClientId);
  });

  it("platform admin can update any org and reassign clientId", async () => {
    const caller = appRouter.createCaller(makeAdminCtx(platformAdminUser()));
    const result = await caller.admin.updateOrganization({ id: srvOrgId, clientId: radOneClientId });
    expect(result.success).toBe(true);

    const [org] = await db!.select().from(organizations).where(eq(organizations.id, srvOrgId)).limit(1);
    expect(org.clientId).toBe(radOneClientId);

    // Restore so afterAll cleanup (by slug) still removes it cleanly.
    await caller.admin.updateOrganization({ id: srvOrgId, clientId: srvClientId });
  });
});
