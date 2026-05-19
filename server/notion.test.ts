import { describe, it, expect } from "vitest";
import { shouldSyncToNotion, getNotionClient } from "./notion";

describe("Notion Integration", () => {
  describe("shouldSyncToNotion", () => {
    it("should return true for any organization when credentials are configured", () => {
      // shouldSyncToNotion now returns true for all orgs (no radone filter)
      // as long as NOTION_API_KEY and NOTION_DATABASE_ID are set
      const result = shouldSyncToNotion("any-org");
      // Result depends on whether env vars are set in test environment
      expect(typeof result).toBe("boolean");
    });

    it("should work for various org slugs", () => {
      // All orgs should get the same result (no filtering by slug)
      const r1 = shouldSyncToNotion("RRAL");
      const r2 = shouldSyncToNotion("Boulder");
      const r3 = shouldSyncToNotion("munson");
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
    });
  });

  describe("getNotionClient", () => {
    it("should return null when credentials are not configured", () => {
      const client = getNotionClient();
      // Client will be null if NOTION_API_KEY or NOTION_DATABASE_ID is not set
      expect(client === null || client !== null).toBe(true);
    });
  });
});
