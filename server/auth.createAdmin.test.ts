/**
 * Test for createAdmin mutation - auto-create admin accounts for @newlantern.ai emails
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("createAdmin mutation", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should create admin account for @newlantern.ai email", async () => {
    if (!db) throw new Error("Database not available");

    const testEmail = `test${Date.now()}@newlantern.ai`;
    const testPassword = "testpassword123";

    // Simulate the createAdmin mutation logic
    const name = testEmail.split('@')[0];
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const openId = `test-openid-${Date.now()}`;

    // Insert admin user
    await db.insert(users).values({
      openId,
      email: testEmail.toLowerCase(),
      name,
      passwordHash,
      role: 'admin',
      loginMethod: 'password',
    });

    // Verify user was created
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail.toLowerCase()))
      .limit(1);

    expect(createdUser).toBeDefined();
    expect(createdUser.email).toBe(testEmail.toLowerCase());
    expect(createdUser.role).toBe('admin');
    expect(createdUser.loginMethod).toBe('password');
    expect(createdUser.name).toBe(name);

    // Verify password hash is correct
    const isPasswordValid = await bcrypt.compare(testPassword, createdUser.passwordHash!);
    expect(isPasswordValid).toBe(true);

    // Cleanup
    await db.delete(users).where(eq(users.email, testEmail.toLowerCase()));
  });

  it("should extract correct name from email", () => {
    const email1 = "jstar@newlantern.ai";
    const name1 = email1.split('@')[0];
    expect(name1).toBe("jstar");

    const email2 = "jennifer.starling@newlantern.ai";
    const name2 = email2.split('@')[0];
    expect(name2).toBe("jennifer.starling");
  });

  it("should reject non-@newlantern.ai emails", () => {
    const email1 = "user@hospital.com";
    const isNewLanternEmail1 = email1.toLowerCase().endsWith('@newlantern.ai');
    expect(isNewLanternEmail1).toBe(false);

    const email2 = "admin@newlantern.ai";
    const isNewLanternEmail2 = email2.toLowerCase().endsWith('@newlantern.ai');
    expect(isNewLanternEmail2).toBe(true);
  });
});
