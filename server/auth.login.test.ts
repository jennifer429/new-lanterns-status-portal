/**
 * Test login session creation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { organizations, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("Login Session Creation", () => {
  let testOrgId: number;
  const testOrgSlug = `test-login-${Date.now()}`;
  const testEmail = `testuser-${Date.now()}@login.com`;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test organization
    const [org] = await db.insert(organizations).values({
      name: "Test Login Org",
      slug: testOrgSlug,
      contactEmail: "test@login.com",
    });
    testOrgId = org.insertId;

    // Create test user
    const hashedPassword = await bcrypt.hash("testpass123", 10);
    await db.insert(users).values({
      openId: `test-login-${Date.now()}`,
      email: testEmail,
      passwordHash: hashedPassword,
      name: "Test User",
      organizationId: testOrgId,
      role: "user",
    });
  });

  it("should verify password correctly", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.passwordHash).toBeDefined();

    // Verify correct password
    const isValid = await bcrypt.compare("testpass123", user.passwordHash!);
    expect(isValid).toBe(true);

    // Verify incorrect password fails
    const isInvalid = await bcrypt.compare("wrongpassword", user.passwordHash!);
    expect(isInvalid).toBe(false);
  });

  it("should have openId for session token creation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.openId).toBeDefined();
    expect(typeof user.openId).toBe("string");
    expect(user.openId.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(users).where(eq(users.organizationId, testOrgId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });
});
