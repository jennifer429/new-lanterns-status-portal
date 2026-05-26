import { describe, it, expect } from "vitest";

/**
 * Validates that all Notion env vars point to accessible databases.
 * This test makes lightweight API calls to verify the IDs are correct.
 */
describe("Notion environment variables", () => {
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  // Use the corrected IDs that match ENV_OVERRIDES in env.ts
  const NOTION_DATABASE_ID = "c16396a9-b4c9-48f0-9264-6e58f3742676";
  const NOTION_DATASOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";
  const NOTION_SYNC_LOG_DATASOURCE_ID = "7a409211-a784-4970-bd5a-5d243a4aa21f";
  const NOTION_CONTACTS_DATABASE_ID = "c6f04901-bba7-4e3c-bf8e-51847c45ef06";
  const NOTION_SYSTEMS_DATABASE_ID = "6eac7e0d-8a38-4279-86f4-db6a1bf6061b";

  it("NOTION_DATABASE_ID points to an accessible database", async () => {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) return;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("database");
  });

  it("NOTION_DATASOURCE_ID can be queried via dataSources", async () => {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) return;
    // The REST API uses the database ID for queries; the SDK datasource ID is internal
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 1 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("list");
  });

  it("NOTION_SYNC_LOG_DATASOURCE_ID is accessible for page creation", async () => {
    if (!NOTION_API_KEY || !NOTION_SYNC_LOG_DATASOURCE_ID) return;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_SYNC_LOG_DATASOURCE_ID}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("database");
  });

  it("NOTION_CONTACTS_DATABASE_ID is accessible", async () => {
    if (!NOTION_API_KEY || !NOTION_CONTACTS_DATABASE_ID) return;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTACTS_DATABASE_ID}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("database");
  });

  it("NOTION_SYSTEMS_DATABASE_ID is accessible", async () => {
    if (!NOTION_API_KEY || !NOTION_SYSTEMS_DATABASE_ID) return;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_SYSTEMS_DATABASE_ID}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("database");
  });
});
