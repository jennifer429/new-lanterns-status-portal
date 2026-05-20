import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the Notion sync-back module.
 * Validates that env vars are set and the sync health function works.
 */

describe("Notion Sync-Back", () => {
  it("should have NOTION_SYNC_LOG_DATASOURCE_ID configured", () => {
    const val = process.env.NOTION_SYNC_LOG_DATASOURCE_ID;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should have NOTION_SYNC_CONFIG_DATASOURCE_ID configured", () => {
    const val = process.env.NOTION_SYNC_CONFIG_DATASOURCE_ID;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should have NOTION_SYNC_CONFIG_PAGE_ID configured", () => {
    const val = process.env.NOTION_SYNC_CONFIG_PAGE_ID;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should export getSyncHealth function", async () => {
    const { getSyncHealth } = await import("./notionSyncBack");
    expect(typeof getSyncHealth).toBe("function");
  });

  it("getSyncHealth returns expected shape", async () => {
    const { getSyncHealth } = await import("./notionSyncBack");
    const health = await getSyncHealth();
    expect(health).toHaveProperty("enabled");
    expect(health).toHaveProperty("lastSuccessfulSync");
    expect(health).toHaveProperty("consecutiveFailures");
    expect(health).toHaveProperty("isHealthy");
    expect(typeof health.enabled).toBe("boolean");
    expect(typeof health.consecutiveFailures).toBe("number");
    expect(typeof health.isHealthy).toBe("boolean");
  });
});
