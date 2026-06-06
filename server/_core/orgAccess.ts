import { TRPCError } from "@trpc/server";

/** Minimal shape of the authenticated user needed for org-scoped access checks. */
type AccessUser = {
  role: string;
  clientId: number | null;
  organizationId: number | null;
};

/** Minimal shape of the organization being accessed. */
type AccessOrg = {
  id: number;
  clientId: number | null;
};

/**
 * Assert that `user` is allowed to read or write data belonging to `org`.
 *
 * Access rules (mirrors the role model documented in CLAUDE.md):
 *   - Platform admin  (role 'admin', no clientId) → any org.
 *   - Partner admin / partner-scoped user (clientId set) → only orgs whose
 *     clientId matches the user's clientId.
 *   - Org user (organizationId set, no clientId) → only their own org.
 *
 * Throws FORBIDDEN for anyone who doesn't fit one of the allowed cases.
 */
export function assertOrgAccess(user: AccessUser, org: AccessOrg): void {
  // Platform admins are not scoped to a partner and can access every org.
  if (user.role === "admin" && user.clientId == null) return;

  // Partner-scoped users: the org must belong to the same client.
  if (user.clientId != null) {
    if (org.clientId != null && org.clientId === user.clientId) return;
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }

  // Org users: only their own organization.
  if (user.organizationId != null && user.organizationId === org.id) return;

  throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}
