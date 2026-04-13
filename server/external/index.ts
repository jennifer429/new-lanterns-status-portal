/**
 * External API Router
 * 
 * REST endpoints for automation (Claude, scheduled jobs, etc.).
 * All routes are under /api/external/* and gated by bearer token auth.
 * 
 * Current endpoints:
 *   GET  /api/external/invites/pending    — Users who haven't been invited yet
 *   POST /api/external/invites/mark-sent  — Mark users as invited
 * 
 * Future endpoints (designed for):
 *   GET  /api/external/orgs                        — List all orgs with status
 *   GET  /api/external/orgs/:slug/questionnaire    — Download questionnaire responses
 *   POST /api/external/orgs/:slug/questionnaire    — Upload questionnaire data
 *   GET  /api/external/orgs/:slug/tasks            — Download task list with completion
 *   GET  /api/external/orgs/:slug/validation       — Download test steps/results
 *   POST /api/external/orgs/:slug/files            — Upload files to an org
 * 
 * Public (no API key):
 *   POST /api/external/set-password                — User sets password via invite token
 */

import { Router } from "express";
import { requireApiKey } from "./auth";
import { getDb } from "../db";
import { users, organizations, clients } from "../../drizzle/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { ENV } from "../_core/env";

const router = Router();

// ============================================================================
// SITE BASE URL — used to construct dashboard links
// ============================================================================
const SITE_BASE_URL = ENV.siteBaseUrl;

// ============================================================================
// INVITE ENDPOINTS (API-key protected)
// ============================================================================

/**
 * GET /api/external/invites/pending
 * 
 * Returns users who have been created but not yet invited (invitedAt is null).
 * Each result includes the user's name, email, org name, and a direct
 * dashboard URL with a set-password token link.
 * 
 * Response:
 * {
 *   pendingInvites: [{
 *     userId: number,
 *     name: string,
 *     email: string,
 *     role: string,
 *     orgName: string | null,
 *     orgSlug: string | null,
 *     partnerName: string | null,
 *     dashboardUrl: string,
 *     setPasswordUrl: string,
 *     createdAt: string
 *   }]
 * }
 */
router.get("/invites/pending", requireApiKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Get users who haven't been invited yet and are active
    const uninvitedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        organizationId: users.organizationId,
        clientId: users.clientId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          isNull(users.invitedAt),
          eq(users.isActive, 1),
          isNotNull(users.email)
        )
      );

    if (uninvitedUsers.length === 0) {
      return res.json({ pendingInvites: [] });
    }

    // Collect all org IDs and client IDs we need to look up
    const orgIds = Array.from(new Set(uninvitedUsers.map(u => u.organizationId).filter(Boolean))) as number[];
    const clientIds = Array.from(new Set(uninvitedUsers.map(u => u.clientId).filter(Boolean))) as number[];

    // Batch-fetch orgs and clients
    const orgMap = new Map<number, { name: string; slug: string }>();
    if (orgIds.length > 0) {
      const orgs = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations);
      for (const org of orgs) {
        orgMap.set(org.id, { name: org.name, slug: org.slug });
      }
    }

    const clientMap = new Map<number, { name: string; slug: string }>();
    if (clientIds.length > 0) {
      const allClients = await db.select({ id: clients.id, name: clients.name, slug: clients.slug }).from(clients);
      for (const c of allClients) {
        clientMap.set(c.id, { name: c.name, slug: c.slug });
      }
    }

    // Generate invite tokens and build response
    const pendingInvites = [];

    for (const user of uninvitedUsers) {
      // Generate a one-time invite token
      const inviteToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Save token to DB
      await db
        .update(users)
        .set({ inviteToken, inviteTokenExpiresAt: expiresAt })
        .where(eq(users.id, user.id));

      // Build dashboard URL based on user type
      let dashboardUrl: string;
      let orgName: string | null = null;
      let partnerName: string | null = null;

      if (user.organizationId) {
        const org = orgMap.get(user.organizationId);
        if (org) {
          dashboardUrl = `${SITE_BASE_URL}/org/${org.slug}`;
          orgName = org.name;
        } else {
          dashboardUrl = `${SITE_BASE_URL}/login`;
        }
      } else if (user.clientId) {
        const client = clientMap.get(user.clientId);
        if (client) {
          dashboardUrl = `${SITE_BASE_URL}/org/${client.slug}/admin`;
          partnerName = client.name;
        } else {
          dashboardUrl = `${SITE_BASE_URL}/org/admin`;
        }
      } else {
        dashboardUrl = `${SITE_BASE_URL}/org/admin`;
      }

      const setPasswordUrl = `${SITE_BASE_URL}/set-password?token=${inviteToken}`;

      pendingInvites.push({
        userId: user.id,
        name: user.name || "New User",
        email: user.email,
        role: user.role,
        orgName,
        partnerName,
        dashboardUrl,
        setPasswordUrl,
        createdAt: user.createdAt.toISOString(),
      });
    }

    return res.json({ pendingInvites });
  } catch (error) {
    console.error("[External API] Error fetching pending invites:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/external/invites/mark-sent
 * 
 * Marks one or more users as invited (sets invitedAt timestamp).
 * Call this after successfully sending the invite emails.
 * 
 * Body: { userIds: number[] }
 * Response: { marked: number }
 */
router.post("/invites/mark-sent", requireApiKey, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds must be a non-empty array of numbers" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const now = new Date();
    let marked = 0;

    for (const userId of userIds) {
      if (typeof userId !== "number") continue;
      const result = await db
        .update(users)
        .set({ invitedAt: now })
        .where(eq(users.id, userId));
      marked++;
    }

    return res.json({ marked });
  } catch (error) {
    console.error("[External API] Error marking invites:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// SET PASSWORD (Public — no API key, token-gated)
// ============================================================================

/**
 * POST /api/external/set-password
 * 
 * Allows a user to set their password using an invite token.
 * The token was generated when /invites/pending was called and
 * included in the invite email as a link.
 * 
 * Body: { token: string, password: string }
 * Response: { success: true, loginUrl: string }
 */
router.post("/set-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Find user by invite token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.inviteToken, token))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Invalid or expired invite link" });
    }

    // Check token expiry
    if (user.inviteTokenExpiresAt && user.inviteTokenExpiresAt < new Date()) {
      return res.status(410).json({ error: "This invite link has expired. Please contact your administrator." });
    }

    // Hash the new password and clear the token
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(users)
      .set({
        passwordHash,
        inviteToken: null,
        inviteTokenExpiresAt: null,
        loginMethod: "email",
      })
      .where(eq(users.id, user.id));

    return res.json({
      success: true,
      loginUrl: `${SITE_BASE_URL}/login`,
    });
  } catch (error) {
    console.error("[External API] Error setting password:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// ORG LISTING (API-key protected) — foundation for future file endpoints
// ============================================================================

/**
 * GET /api/external/orgs
 * 
 * Lists all organizations with their status, slug, and contact info.
 * This is the entry point for future per-org file download/upload APIs.
 * 
 * Response:
 * {
 *   organizations: [{
 *     id: number,
 *     name: string,
 *     slug: string,
 *     status: string,
 *     contactName: string | null,
 *     contactEmail: string | null,
 *     partnerName: string | null,
 *     dashboardUrl: string
 *   }]
 * }
 */
router.get("/orgs", requireApiKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        contactName: organizations.contactName,
        contactEmail: organizations.contactEmail,
        clientId: organizations.clientId,
      })
      .from(organizations);

    // Fetch clients for partner names
    const allClients = await db.select({ id: clients.id, name: clients.name }).from(clients);
    const clientMap = new Map(allClients.map(c => [c.id, c.name]));

    const result = allOrgs.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      contactName: org.contactName,
      contactEmail: org.contactEmail,
      partnerName: org.clientId ? clientMap.get(org.clientId) || null : null,
      dashboardUrl: `${SITE_BASE_URL}/org/${org.slug}`,
    }));

    return res.json({ organizations: result });
  } catch (error) {
    console.error("[External API] Error listing orgs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export function registerExternalApi(app: import("express").Express) {
  app.use("/api/external", router);
}
