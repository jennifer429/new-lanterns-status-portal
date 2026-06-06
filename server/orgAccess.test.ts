import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertOrgAccess } from "./_core/orgAccess";

/**
 * Unit tests for the org-membership access helper that backs the auth lockdown
 * on the swimlane, connectivity, validation, and implementation routers.
 */

const platformAdmin = { role: "admin", clientId: null, organizationId: null };
const partnerAdminA = { role: "admin", clientId: 10, organizationId: null };
const partnerAdminB = { role: "admin", clientId: 20, organizationId: null };
const orgUserA = { role: "user", clientId: null, organizationId: 100 };

const orgUnderClientA = { id: 100, clientId: 10 };
const orgUnderClientB = { id: 200, clientId: 20 };
const orgWithNoClient = { id: 300, clientId: null };

function denied(user: any, org: any) {
  try {
    assertOrgAccess(user, org);
    return false;
  } catch (err) {
    return err instanceof TRPCError && err.code === "FORBIDDEN";
  }
}

describe("assertOrgAccess", () => {
  it("lets a platform admin access any org", () => {
    expect(() => assertOrgAccess(platformAdmin, orgUnderClientA)).not.toThrow();
    expect(() => assertOrgAccess(platformAdmin, orgUnderClientB)).not.toThrow();
    expect(() => assertOrgAccess(platformAdmin, orgWithNoClient)).not.toThrow();
  });

  it("lets a partner admin access orgs in their own client", () => {
    expect(() => assertOrgAccess(partnerAdminA, orgUnderClientA)).not.toThrow();
  });

  it("blocks a partner admin from another client's org", () => {
    expect(denied(partnerAdminA, orgUnderClientB)).toBe(true);
    expect(denied(partnerAdminB, orgUnderClientA)).toBe(true);
  });

  it("blocks a partner admin from an unowned (null-client) org", () => {
    expect(denied(partnerAdminA, orgWithNoClient)).toBe(true);
  });

  it("lets an org user access only their own org", () => {
    expect(() => assertOrgAccess(orgUserA, orgUnderClientA)).not.toThrow();
  });

  it("blocks an org user from a different org", () => {
    expect(denied(orgUserA, orgUnderClientB)).toBe(true);
  });

  it("blocks a user with neither clientId nor matching organizationId", () => {
    const stray = { role: "user", clientId: null, organizationId: null };
    expect(denied(stray, orgUnderClientA)).toBe(true);
  });
});
