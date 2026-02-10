/**
 * User Management Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("User Management", () => {
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = "testpass123";

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Clean up test user if exists
    await db.delete(users).where(eq(users.email, testEmail));
  });

  it("should create a new user", async () => {
    const caller = appRouter.createCaller({} as any);

    const result = await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("User created successfully");

    // Verify user was created
    const db = await getDb();
    const [user] = await db!.select().from(users).where(eq(users.email, testEmail)).limit(1);
    expect(user).toBeDefined();
    expect(user.name).toBe("Test User");
    expect(user.role).toBe("user");
  });

  it("should reject duplicate email", async () => {
    const caller = appRouter.createCaller({} as any);

    // Create first user
    await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    // Try to create duplicate
    await expect(
      caller.users.create({
        email: testEmail,
        password: testPassword,
        name: "Test User 2",
        role: "user",
        organizationId: null,
      })
    ).rejects.toThrow("A user with this email already exists");
  });

  it("should list all users", async () => {
    const caller = appRouter.createCaller({} as any);

    // Create test user
    await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    // List users
    const userList = await caller.users.list();

    expect(Array.isArray(userList)).toBe(true);
    expect(userList.length).toBeGreaterThan(0);
    
    const testUser = userList.find(u => u.email === testEmail);
    expect(testUser).toBeDefined();
    expect(testUser?.name).toBe("Test User");
  });

  it("should update user information", async () => {
    const caller = appRouter.createCaller({} as any);

    // Create test user
    await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    // Get user ID
    const db = await getDb();
    const [user] = await db!.select().from(users).where(eq(users.email, testEmail)).limit(1);

    // Update user
    const result = await caller.users.update({
      id: user.id,
      name: "Updated Name",
      role: "admin",
    });

    expect(result.success).toBe(true);

    // Verify update
    const [updatedUser] = await db!.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(updatedUser.name).toBe("Updated Name");
    expect(updatedUser.role).toBe("admin");
  });

  it("should update user password", async () => {
    const caller = appRouter.createCaller({} as any);

    // Create test user
    await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    // Get user ID
    const db = await getDb();
    const [user] = await db!.select().from(users).where(eq(users.email, testEmail)).limit(1);
    const oldPasswordHash = user.passwordHash;

    // Update password
    const newPassword = "newpassword456";
    await caller.users.update({
      id: user.id,
      password: newPassword,
    });

    // Verify password was changed
    const [updatedUser] = await db!.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(updatedUser.passwordHash).not.toBe(oldPasswordHash);
    
    // Verify new password works
    const passwordMatch = await bcrypt.compare(newPassword, updatedUser.passwordHash!);
    expect(passwordMatch).toBe(true);
  });

  it("should delete user", async () => {
    const caller = appRouter.createCaller({} as any);

    // Create test user
    await caller.users.create({
      email: testEmail,
      password: testPassword,
      name: "Test User",
      role: "user",
      organizationId: null,
    });

    // Get user ID
    const db = await getDb();
    const [user] = await db!.select().from(users).where(eq(users.email, testEmail)).limit(1);

    // Delete user
    const result = await caller.users.delete({ id: user.id });
    expect(result.success).toBe(true);

    // Verify user was deleted
    const [deletedUser] = await db!.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(deletedUser).toBeUndefined();
  });

  it("should reject deleting non-existent user", async () => {
    const caller = appRouter.createCaller({} as any);

    await expect(
      caller.users.delete({ id: 999999 })
    ).rejects.toThrow("User not found");
  });
});
