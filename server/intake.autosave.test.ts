/**
 * Test auto-save functionality for intake wizard
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { organizations, intakeResponses, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

describe("Intake Auto-Save", () => {
  let testOrgId: number;
  const testOrgSlug = `test-autosave-${Date.now()}`;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test organization
    const [org] = await db.insert(organizations).values({
      name: "Test AutoSave Org",
      slug: testOrgSlug,
      contactEmail: "test@autosave.com",
    });
    testOrgId = org.insertId;

    // Create test user
    const hashedPassword = await bcrypt.hash("testpass", 10);
    await db.insert(users).values({
      openId: `test-autosave-${Date.now()}`,
      email: "testuser@autosave.com",
      passwordHash: hashedPassword,
      name: "Test User",
      organizationId: testOrgId,
      role: "user",
    });
  });

  it("should save a new response", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Save a response
    const [result] = await db.insert(intakeResponses).values({
      organizationId: testOrgId,
      questionId: "q1_org_name",
      section: "Basics",
      response: "Test Organization Name",
      status: "complete",
    });

    // Verify it was saved by ID
    const [saved] = await db
      .select()
      .from(intakeResponses)
      .where(eq(intakeResponses.id, result.insertId))
      .limit(1);

    expect(saved).toBeDefined();
    expect(saved.response).toBe("Test Organization Name");
    expect(saved.status).toBe("complete");
  });

  it("should update an existing response", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get the existing response
    const [existing] = await db
      .select()
      .from(intakeResponses)
      .where(eq(intakeResponses.questionId, "q1_org_name"))
      .limit(1);

    // Update it
    await db
      .update(intakeResponses)
      .set({
        response: "Updated Organization Name",
        updatedAt: new Date(),
      })
      .where(eq(intakeResponses.id, existing.id));

    // Verify the update
    const [updated] = await db
      .select()
      .from(intakeResponses)
      .where(eq(intakeResponses.id, existing.id))
      .limit(1);

    expect(updated.response).toBe("Updated Organization Name");
  });

  it("should load all responses for an organization", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Add multiple responses
    await db.insert(intakeResponses).values([
      {
        organizationId: testOrgId,
        questionId: "q2_has_pacs",
        section: "Systems",
        response: "yes",
        status: "complete",
      },
      {
        organizationId: testOrgId,
        questionId: "q3_pacs_vendor",
        section: "Systems",
        response: "GE Healthcare",
        status: "complete",
      },
    ]);

    // Load all responses
    const responses = await db
      .select()
      .from(intakeResponses)
      .where(eq(intakeResponses.organizationId, testOrgId));

    expect(responses.length).toBeGreaterThanOrEqual(3);
  });

  it("should track response timestamps", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const beforeSave = new Date();

    // Save a new response
    const [result] = await db.insert(intakeResponses).values({
      organizationId: testOrgId,
      questionId: "q4_timestamp_test",
      section: "Test",
      response: "Testing timestamps",
      status: "complete",
    });

    // Retrieve it
    const [saved] = await db
      .select()
      .from(intakeResponses)
      .where(eq(intakeResponses.id, result.insertId))
      .limit(1);

    const afterSave = new Date();

    expect(saved.createdAt).toBeDefined();
    // Allow 1 second tolerance for timestamp comparison
    const createdTime = new Date(saved.createdAt!).getTime();
    expect(createdTime).toBeGreaterThanOrEqual(beforeSave.getTime() - 1000);
    expect(createdTime).toBeLessThanOrEqual(afterSave.getTime() + 1000);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(intakeResponses).where(eq(intakeResponses.organizationId, testOrgId));
    await db.delete(users).where(eq(users.organizationId, testOrgId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });
});
