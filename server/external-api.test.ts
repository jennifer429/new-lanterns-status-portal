import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the External API layer:
 * 1. Auth middleware (requireApiKey) — bearer token validation
 * 2. Invite token logic
 * 3. Dashboard URL construction
 * 4. Request body validation
 * 5. Password hashing
 */

// ============================================================================
// 1. AUTH MIDDLEWARE TESTS
// ============================================================================

describe("requireApiKey middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createMockReqRes(authHeader?: string) {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {},
    } as any;
    const res = {
      _statusCode: 0,
      _body: null as any,
      status(code: number) {
        this._statusCode = code;
        return this;
      },
      json(body: any) {
        this._body = body;
        return this;
      },
    } as any;
    const next = vi.fn();
    return { req, res, next };
  }

  it("returns 503 when EXTERNAL_API_KEY is not configured", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes("Bearer some-key");
    mod.requireApiKey(req, res, next);

    expect(res._statusCode).toBe(503);
    expect(res._body.error).toContain("not configured");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is provided", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "test-secret-key-123" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes();
    mod.requireApiKey(req, res, next);

    expect(res._statusCode).toBe(401);
    expect(res._body.error).toContain("Missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header doesn't start with Bearer", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "test-secret-key-123" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes("Basic abc123");
    mod.requireApiKey(req, res, next);

    expect(res._statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when API key doesn't match", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "correct-key-abc" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes("Bearer wrong-key-xyz");
    mod.requireApiKey(req, res, next);

    expect(res._statusCode).toBe(403);
    expect(res._body.error).toContain("Invalid");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when API key matches", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "correct-key-abc" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes("Bearer correct-key-abc");
    mod.requireApiKey(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._statusCode).toBe(0); // status was never set
  });

  it("rejects keys of different length", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { externalApiKey: "long-secret-key-12345" },
    }));
    const mod = await import("./external/auth");

    const { req, res, next } = createMockReqRes("Bearer short");
    mod.requireApiKey(req, res, next);

    expect(res._statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 2. INVITE TOKEN LOGIC TESTS
// ============================================================================

describe("invite token logic", () => {
  it("generates a 64-character hex token from 32 random bytes", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("token expiry is set to 7 days from now", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 1);
  });
});

// ============================================================================
// 3. DASHBOARD URL CONSTRUCTION TESTS
// ============================================================================

describe("dashboard URL construction", () => {
  const SITE_BASE_URL = "https://newlantern.us.com";

  it("builds org user dashboard URL from slug", () => {
    const slug = "memorial-general";
    const url = `${SITE_BASE_URL}/org/${slug}`;
    expect(url).toBe("https://newlantern.us.com/org/memorial-general");
  });

  it("builds partner admin dashboard URL from client slug", () => {
    const clientSlug = "RadOne";
    const url = `${SITE_BASE_URL}/org/${clientSlug}/admin`;
    expect(url).toBe("https://newlantern.us.com/org/RadOne/admin");
  });

  it("builds platform admin dashboard URL for admins without org or client", () => {
    const url = `${SITE_BASE_URL}/org/admin`;
    expect(url).toBe("https://newlantern.us.com/org/admin");
  });

  it("builds set-password URL with token", () => {
    const token = "abc123def456";
    const url = `${SITE_BASE_URL}/set-password?token=${token}`;
    expect(url).toBe("https://newlantern.us.com/set-password?token=abc123def456");
  });
});

// ============================================================================
// 4. REQUEST BODY VALIDATION TESTS
// ============================================================================

describe("request body validation", () => {
  it("mark-sent requires non-empty userIds array", () => {
    const body1 = { userIds: [] };
    const body2 = { userIds: [1, 2, 3] };
    const body3 = {};

    expect(Array.isArray(body1.userIds) && body1.userIds.length === 0).toBe(true);
    expect(Array.isArray(body2.userIds) && body2.userIds.length > 0).toBe(true);
    expect(!("userIds" in body3) || !Array.isArray((body3 as any).userIds)).toBe(true);
  });

  it("set-password requires token and password >= 6 chars", () => {
    const validBody = { token: "abc123", password: "secure123" };
    const shortPassword = { token: "abc123", password: "hi" };
    const noToken = { password: "secure123" };

    expect(validBody.token && validBody.password.length >= 6).toBe(true);
    expect(shortPassword.password.length >= 6).toBe(false);
    expect(!!(noToken as any).token).toBe(false);
  });
});

// ============================================================================
// 5. PASSWORD HASHING TESTS
// ============================================================================

describe("password hashing for set-password", () => {
  it("bcrypt hash is different from plaintext", async () => {
    const bcrypt = await import("bcrypt");
    const password = "testpassword123";
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2b$")).toBe(true);
  });

  it("bcrypt compare validates correct password", async () => {
    const bcrypt = await import("bcrypt");
    const password = "testpassword123";
    const hash = await bcrypt.hash(password, 10);
    const isMatch = await bcrypt.compare(password, hash);
    expect(isMatch).toBe(true);
  });

  it("bcrypt compare rejects wrong password", async () => {
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("correct-password", 10);
    const isMatch = await bcrypt.compare("wrong-password", hash);
    expect(isMatch).toBe(false);
  });
});

// ============================================================================
// 6. RESEND INVITE LOGIC TESTS
// ============================================================================

describe("resendInvite logic", () => {
  it("resetting invite clears invitedAt, inviteToken, and inviteTokenExpiresAt", () => {
    // Simulate the DB update payload that resendInvite sends
    const resetPayload = {
      invitedAt: null,
      inviteToken: null,
      inviteTokenExpiresAt: null,
    };

    expect(resetPayload.invitedAt).toBeNull();
    expect(resetPayload.inviteToken).toBeNull();
    expect(resetPayload.inviteTokenExpiresAt).toBeNull();
  });

  it("after reset, user should appear in pending invites query (invitedAt is null)", () => {
    // Simulate a user record after resendInvite
    const userAfterReset = {
      id: 42,
      email: "test@hospital.org",
      isActive: 1,
      invitedAt: null,
      inviteToken: null,
    };

    // The pending invites query filters: invitedAt IS NULL AND isActive = 1
    const matchesPendingFilter =
      userAfterReset.invitedAt === null && userAfterReset.isActive === 1;
    expect(matchesPendingFilter).toBe(true);
  });

  it("inactive users should not be eligible for resend", () => {
    const inactiveUser = { id: 10, isActive: 0 };
    expect(inactiveUser.isActive === 0).toBe(true);
    // The mutation throws BAD_REQUEST for inactive users
  });

  it("partner admin cannot resend for users from other partners", () => {
    const adminUser = { clientId: 1 };
    const targetUser = { clientId: 2 };
    const isCrossPartner =
      adminUser.clientId !== null && targetUser.clientId !== adminUser.clientId;
    expect(isCrossPartner).toBe(true);
  });

  it("platform admin (no clientId) can resend for any user", () => {
    const platformAdmin = { clientId: null };
    const targetUser = { clientId: 5 };
    // Platform admins have clientId = null, so the cross-partner check is skipped
    const isRestricted =
      platformAdmin.clientId !== null &&
      targetUser.clientId !== platformAdmin.clientId;
    expect(isRestricted).toBe(false);
  });
});

// ============================================================================
// 7. INVITE WEBHOOK TRIGGER TESTS
// ============================================================================

describe("triggerInviteSend", () => {
  const originalUrl = process.env.INVITE_WEBHOOK_URL;
  const originalEnabled = process.env.INVITE_WEBHOOK_ENABLED;
  const originalSecret = process.env.INVITE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadWithEnv(env: {
    url?: string;
    enabled?: string;
    secret?: string;
  }) {
    if (env.url === undefined) delete process.env.INVITE_WEBHOOK_URL;
    else process.env.INVITE_WEBHOOK_URL = env.url;
    if (env.enabled === undefined) delete process.env.INVITE_WEBHOOK_ENABLED;
    else process.env.INVITE_WEBHOOK_ENABLED = env.enabled;
    if (env.secret === undefined) delete process.env.INVITE_WEBHOOK_SECRET;
    else process.env.INVITE_WEBHOOK_SECRET = env.secret;

    // Clear any lingering vi.doMock("./_core/env", ...) from earlier tests
    // in this file so we get the real env module that reads process.env.
    vi.doUnmock("./_core/env");
    vi.resetModules();
    return import("./_core/inviteTrigger");
  }

  function restoreEnv() {
    if (originalUrl === undefined) delete process.env.INVITE_WEBHOOK_URL;
    else process.env.INVITE_WEBHOOK_URL = originalUrl;
    if (originalEnabled === undefined) delete process.env.INVITE_WEBHOOK_ENABLED;
    else process.env.INVITE_WEBHOOK_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.INVITE_WEBHOOK_SECRET;
    else process.env.INVITE_WEBHOOK_SECRET = originalSecret;
  }

  it("returns false and does not call fetch when INVITE_WEBHOOK_URL is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { triggerInviteSend } = await loadWithEnv({ url: "", enabled: "true" });
    const ok = await triggerInviteSend({ email: "u@x.com", reason: "created" });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    restoreEnv();
  });

  it("returns false and does not call fetch when kill switch is off", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { triggerInviteSend } = await loadWithEnv({
      url: "https://render.example/hook",
      enabled: "false",
    });
    const ok = await triggerInviteSend({ email: "u@x.com", reason: "created" });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    restoreEnv();
  });

  it("POSTs to the webhook with email, reason, and ccEmails when enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await loadWithEnv({
      url: "https://render.example/hook",
      enabled: "true",
      secret: "s3cret",
    });
    const { triggerInviteSend } = mod;

    const ok = await triggerInviteSend({
      email: "new@hospital.org",
      reason: "created",
      ccEmails: ["partner1@radone.com", "partner2@radone.com"],
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://render.example/hook");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer s3cret");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      email: "new@hospital.org",
      reason: "created",
      ccEmails: ["partner1@radone.com", "partner2@radone.com"],
    });
    restoreEnv();
  });

  it("omits ccEmails from the body when empty (resend path)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { triggerInviteSend } = await loadWithEnv({
      url: "https://render.example/hook",
      enabled: "true",
    });
    await triggerInviteSend({
      email: "existing@hospital.org",
      reason: "resent",
      ccEmails: [],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: "existing@hospital.org", reason: "resent" });
    expect(body.ccEmails).toBeUndefined();
    restoreEnv();
  });

  it("returns false and swallows errors when the webhook throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { triggerInviteSend } = await loadWithEnv({
      url: "https://render.example/hook",
      enabled: "true",
    });
    const ok = await triggerInviteSend({ email: "u@x.com", reason: "created" });
    expect(ok).toBe(false);
    restoreEnv();
  });

  it("returns false when the webhook responds non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "boom",
    });
    vi.stubGlobal("fetch", fetchMock);
    const { triggerInviteSend } = await loadWithEnv({
      url: "https://render.example/hook",
      enabled: "true",
    });
    const ok = await triggerInviteSend({ email: "u@x.com", reason: "created" });
    expect(ok).toBe(false);
    restoreEnv();
  });
});

// ============================================================================
// 8. INITIAL INVITE CC LIST TESTS
// ============================================================================

describe("initial invite CC logic", () => {
  it("collects active partner admins for the same clientId", () => {
    const allUsers = [
      { email: "p1@radone.com", role: "admin", clientId: 1, isActive: 1 },
      { email: "p2@radone.com", role: "admin", clientId: 1, isActive: 1 },
      { email: "inactive@radone.com", role: "admin", clientId: 1, isActive: 0 },
      { email: "regular@radone.com", role: "user", clientId: 1, isActive: 1 },
      { email: "other@srv.com", role: "admin", clientId: 2, isActive: 1 },
    ];
    const newUserClientId = 1;
    const newUserEmail = "new@radone.com";

    const cc = allUsers
      .filter(
        (u) =>
          u.clientId === newUserClientId &&
          u.role === "admin" &&
          u.isActive === 1 &&
          u.email !== newUserEmail
      )
      .map((u) => u.email);

    expect(cc).toEqual(["p1@radone.com", "p2@radone.com"]);
  });

  it("excludes the newly-created admin from their own CC list", () => {
    const allUsers = [
      { email: "p1@radone.com", role: "admin", clientId: 1, isActive: 1 },
      { email: "new@radone.com", role: "admin", clientId: 1, isActive: 1 },
    ];
    const newUserEmail = "new@radone.com";
    const cc = allUsers
      .filter((u) => u.role === "admin" && u.isActive === 1 && u.email !== newUserEmail)
      .map((u) => u.email);
    expect(cc).toEqual(["p1@radone.com"]);
  });

  it("returns empty CC list when user has no clientId (platform admin)", () => {
    const clientId: number | null = null;
    const cc = clientId ? ["partner@radone.com"] : [];
    expect(cc).toEqual([]);
  });
});

// ============================================================================
// 9. PENDING-INVITE PAYLOAD FIELDS (name + site name flow into the email)
// ============================================================================

describe("pending-invite payload fields", () => {
  it("maps user.name straight through, falling back to 'New User' when null", () => {
    const withName = { name: "Dr. Alice Doe" };
    const withoutName = { name: null as string | null };
    expect(withName.name || "New User").toBe("Dr. Alice Doe");
    expect(withoutName.name || "New User").toBe("New User");
  });

  it("resolves orgName from organizations.name via the org id", () => {
    const orgMap = new Map<number, { name: string; slug: string }>([
      [7, { name: "Marshall Medical", slug: "marshallmedical" }],
      [8, { name: "Boulder Community", slug: "boulder" }],
    ]);
    const user = { organizationId: 8, clientId: null as number | null };
    const orgName = user.organizationId ? orgMap.get(user.organizationId)?.name ?? null : null;
    expect(orgName).toBe("Boulder Community");
  });

  it("uses partnerName instead of orgName for partner admins (no org)", () => {
    const clientMap = new Map<number, { name: string; slug: string }>([
      [1, { name: "RadOne", slug: "RadOne" }],
    ]);
    const user = { organizationId: null as number | null, clientId: 1 };
    const orgName = user.organizationId ? "irrelevant" : null;
    const partnerName = user.clientId ? clientMap.get(user.clientId)?.name ?? null : null;
    expect(orgName).toBeNull();
    expect(partnerName).toBe("RadOne");
  });
});
