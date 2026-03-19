import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("Notion Connectivity Configuration", () => {
  it("should have NOTION_CONNECTIVITY_DATASOURCE_ID set", () => {
    expect(ENV.notionConnectivityDataSourceId).toBeTruthy();
    expect(ENV.notionConnectivityDataSourceId.length).toBeGreaterThan(10);
  });

  it("should have NOTION_API_KEY set", () => {
    expect(ENV.notionApiKey).toBeTruthy();
    expect(ENV.notionApiKey.startsWith("ntn_")).toBe(true);
  });

  it("should have a valid connectivity database ID", () => {
    expect(ENV.notionConnectivityDbId).toBeTruthy();
  });

  it("should be able to query the Notion data source", async () => {
    const { Client } = await import("@notionhq/client");
    const client = new Client({ auth: ENV.notionApiKey });

    const response = await (client as any).dataSources.query({
      data_source_id: ENV.notionConnectivityDataSourceId,
      page_size: 1,
    });

    expect(response).toBeDefined();
    expect(response.results).toBeDefined();
    expect(Array.isArray(response.results)).toBe(true);
  });
});
