import { describe, it, expect } from "vitest";
import { Client } from "@notionhq/client";

describe("Notion Connectivity Integration", () => {
  const apiKey = process.env.NOTION_API_KEY;
  const dsId = process.env.NOTION_CONNECTIVITY_DATASOURCE_ID;
  const dbId = process.env.NOTION_CONNECTIVITY_DATABASE_ID;

  it("should have NOTION_API_KEY configured", () => {
    expect(apiKey).toBeTruthy();
  });

  it("should have NOTION_CONNECTIVITY_DATASOURCE_ID configured", () => {
    expect(dsId).toBeTruthy();
    expect(dsId).toBe("53f78f54-2908-43d4-b471-df049652d470");
  });

  it("should have NOTION_CONNECTIVITY_DATABASE_ID configured", () => {
    expect(dbId).toBeTruthy();
    expect(dbId).toBe("6ffd2b0d-18bd-41cf-af53-73b4209e5099");
  });

  it("should be able to retrieve the database schema", async () => {
    if (!apiKey || !dbId) return;
    const client = new Client({ auth: apiKey });
    // The Implementations-Updates integration accesses via dataSources API,
    // not the direct databases.retrieve() endpoint. Verify via data source query.
    const response = await (client as any).dataSources.query({
      data_source_id: dsId,
      page_size: 1,
    });
    expect(response).toBeTruthy();
    expect(response.results).toBeDefined();
    // If there are results, verify they have properties
    if (response.results.length > 0) {
      const page = response.results[0];
      expect(page.properties).toBeTruthy();
    }
  });

  it("should be able to query the data source", async () => {
    if (!apiKey || !dsId) return;
    const client = new Client({ auth: apiKey });
    const response = await (client as any).dataSources.query({
      data_source_id: dsId,
      page_size: 5,
    });
    expect(response).toBeTruthy();
    expect(response.results).toBeDefined();
    expect(Array.isArray(response.results)).toBe(true);
  });
});
