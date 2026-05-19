import { describe, it, expect } from "vitest";
import { Client } from "@notionhq/client";

describe("Notion Connectivity Environment", () => {
  it("should have valid NOTION_CONNECTIVITY_DATASOURCE_ID and be able to query the database", async () => {
    const apiKey = process.env.NOTION_API_KEY;
    const dsId = process.env.NOTION_CONNECTIVITY_DATASOURCE_ID;
    const dbId = process.env.NOTION_CONNECTIVITY_DATABASE_ID;

    expect(apiKey).toBeTruthy();
    expect(dsId).toBeTruthy();
    expect(dbId).toBeTruthy();

    const client = new Client({ auth: apiKey });

    // Verify we can retrieve the database schema
    const db = await client.databases.retrieve({ database_id: dbId! });
    expect(db).toBeTruthy();
    expect((db as any).title).toBeTruthy();

    // Verify we can query the data source
    const response = await (client as any).dataSources.query({
      data_source_id: dsId,
      page_size: 1,
    });
    expect(response).toBeTruthy();
    expect(response.results).toBeDefined();
  }, 15000);
});
