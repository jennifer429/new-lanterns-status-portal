import { describe, it, expect } from "vitest";
import { getNotionClient } from "./notion";

describe("Notion Credentials", () => {
  it("should have valid Notion API credentials configured", async () => {
    const client = getNotionClient();
    
    // Check that client was created
    expect(client).toBeTruthy();
    expect(client).not.toBeNull();
    
    if (!client) {
      throw new Error("Notion client is null - credentials not configured");
    }

    // Test that we can access the Notion API with these credentials
    // Try to list databases (lightweight API call)
    try {
      const response = await client.search({
        filter: {
          property: "object",
          value: "page",
        },
        page_size: 1,
      });
      
      // If we get here without error, credentials are valid
      expect(response).toBeTruthy();
      console.log("✓ Notion API credentials are valid");
    } catch (error: any) {
      console.error("Notion API error:", error.message);
      throw new Error(`Notion API credentials are invalid: ${error.message}`);
    }
  });
});
