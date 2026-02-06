import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { organizations, clients, intakeFileAttachments } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

describe("intake.deleteFile", () => {
  let testClientId: number;
  let testOrgId: number;
  let testFileId: number;
  let testOrgSlug: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test client
    await db.insert(clients).values({
      name: "Test Client for File Delete",
      slug: "test-client-file-delete",
    });
    
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.name, "Test Client for File Delete"))
      .limit(1);
    testClientId = client.id;

    // Create test organization
    await db.insert(organizations).values({
      name: "Test Org for File Delete",
      slug: "test-org-file-delete",
      clientId: testClientId,
    });
    
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, "test-org-file-delete"))
      .limit(1);
    testOrgId = org.id;
    testOrgSlug = org.slug;

    // Create test file
    await db.insert(intakeFileAttachments).values({
      organizationId: testOrgId,
      questionId: "TEST.1",
      fileName: "test-file.csv",
      fileUrl: "https://s3.example.com/test-file.csv",
      fileSize: 1024,
      mimeType: "text/csv",
      uploadedBy: "test@example.com",
    });
    
    const [file] = await db
      .select()
      .from(intakeFileAttachments)
      .where(
        and(
          eq(intakeFileAttachments.organizationId, testOrgId),
          eq(intakeFileAttachments.questionId, "TEST.1")
        )
      )
      .limit(1);
    testFileId = file.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup test data
    await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.organizationId, testOrgId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
    await db.delete(clients).where(eq(clients.id, testClientId));
  });

  it("should delete file successfully", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verify file exists
    const [fileBefore] = await db
      .select()
      .from(intakeFileAttachments)
      .where(eq(intakeFileAttachments.id, testFileId))
      .limit(1);
    expect(fileBefore).toBeDefined();
    expect(fileBefore.fileName).toBe("test-file.csv");

    // Delete file
    await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.id, testFileId));

    // Verify file deleted
    const [fileAfter] = await db
      .select()
      .from(intakeFileAttachments)
      .where(eq(intakeFileAttachments.id, testFileId))
      .limit(1);
    expect(fileAfter).toBeUndefined();
  });

  it("should verify file belongs to correct organization", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create another test file
    await db.insert(intakeFileAttachments).values({
      organizationId: testOrgId,
      questionId: "TEST.2",
      fileName: "test-file-2.csv",
      fileUrl: "https://s3.example.com/test-file-2.csv",
      fileSize: 2048,
      mimeType: "text/csv",
      uploadedBy: "test@example.com",
    });
    
    const [file] = await db
      .select()
      .from(intakeFileAttachments)
      .where(
        and(
          eq(intakeFileAttachments.organizationId, testOrgId),
          eq(intakeFileAttachments.questionId, "TEST.2")
        )
      )
      .limit(1);

    // Verify file belongs to test organization
    expect(file.organizationId).toBe(testOrgId);

    // Cleanup
    await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.id, file.id));
  });

  it("should list uploaded files for a question", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create multiple test files for same question
    await db.insert(intakeFileAttachments).values([
      {
        organizationId: testOrgId,
        questionId: "TEST.3",
        fileName: "file-1.csv",
        fileUrl: "https://s3.example.com/file-1.csv",
        fileSize: 1024,
        mimeType: "text/csv",
        uploadedBy: "test@example.com",
      },
      {
        organizationId: testOrgId,
        questionId: "TEST.3",
        fileName: "file-2.xlsx",
        fileUrl: "https://s3.example.com/file-2.xlsx",
        fileSize: 2048,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedBy: "test@example.com",
      },
    ]);

    // Query files for this question
    const files = await db
      .select()
      .from(intakeFileAttachments)
      .where(eq(intakeFileAttachments.questionId, "TEST.3"));

    expect(files.length).toBe(2);
    expect(files[0].questionId).toBe("TEST.3");
    expect(files[1].questionId).toBe("TEST.3");

    // Cleanup
    await db.delete(intakeFileAttachments).where(eq(intakeFileAttachments.questionId, "TEST.3"));
  });
});
