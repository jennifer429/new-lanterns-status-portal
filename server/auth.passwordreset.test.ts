/**
 * Password Reset Flow Tests
 * Tests the simplified password reset flow: check email -> redirect or show support message
 */

import { describe, it, expect, beforeAll } from "vitest";
import { authRouter } from "./routers/auth";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("Password Reset Flow", () => {
  const testEmail = "test-reset@example.com";
  const testPassword = "TestPass123!";
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Clean up any existing test user
    await db.delete(users).where(eq(users.email, testEmail));

    // Create test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    await db
      .insert(users)
      .values({
        openId: `test-openid-${Date.now()}`,
        email: testEmail,
        name: "Test User",
        role: "user",
        passwordHash,
        organizationId: null,
      });

    // Get the created user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    testUserId = user.id;
  });

  it("should return exists=true for valid email", async () => {
    const caller = authRouter.createCaller({ user: null });
    const result = await caller.checkEmail({ email: testEmail });

    expect(result.exists).toBe(true);
    expect(result.email).toBe(testEmail);
  });

  it("should return exists=false for non-existent email", async () => {
    const caller = authRouter.createCaller({ user: null });
    const result = await caller.checkEmail({ email: "nonexistent@example.com" });

    expect(result.exists).toBe(false);
    expect(result.email).toBe("nonexistent@example.com");
  });

  it("should reset password for valid email", async () => {
    const caller = authRouter.createCaller({ user: null });
    const newPassword = "NewPassword456!";

    const result = await caller.resetPasswordDirect({
      email: testEmail,
      newPassword,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("successfully");

    // Verify password was actually changed
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.passwordHash).toBeDefined();

    // Verify new password works
    const isValid = await bcrypt.compare(newPassword, user.passwordHash!);
    expect(isValid).toBe(true);

    // Verify old password no longer works
    const isOldValid = await bcrypt.compare(testPassword, user.passwordHash!);
    expect(isOldValid).toBe(false);
  });

  it("should reject password reset for non-existent email", async () => {
    const caller = authRouter.createCaller({ user: null });

    await expect(
      caller.resetPasswordDirect({
        email: "nonexistent@example.com",
        newPassword: "NewPassword789!",
      })
    ).rejects.toThrow("Please contact New Lantern support");
  });

  it("should enforce minimum password length", async () => {
    const caller = authRouter.createCaller({ user: null });

    // This should be caught by zod validation
    await expect(
      caller.resetPasswordDirect({
        email: testEmail,
        newPassword: "short",
      })
    ).rejects.toThrow();
  });
});
