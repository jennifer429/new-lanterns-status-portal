import { describe, it, expect } from "vitest";

/**
 * Validates that all Notion env vars point to accessible databases.
 * This test makes lightweight API calls to verify the IDs are correct.
 */
describe("Notion environment variables", () => {
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
  const NOTION_DATASOURCE_ID = process.env.NOTION_DATASOURCE_ID;
  const NOTION_SYNC_LOG_DATASOURCE_ID = process.env.NOTION_SYNC_LOG_DATASOURCE_ID;
  const NOTION_CONTACTS_DATABASE_ID = process.env.NOTION_CONTACTS_DATABASE_ID;
  const NOTION_SYSTEMS_DATABASE_ID = process.env.NOTION_SYSTEMS_DATABASE_ID;

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
    if (!NOTION_API_KEY || !NOTION_DATASOURCE_ID) return;
    // dataSources.query uses the same endpoint as databases.query in the REST API
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATASOURCE_ID}/query`, {
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
