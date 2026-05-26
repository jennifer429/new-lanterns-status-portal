import { Client } from "@notionhq/client";

const client = new Client({ auth: process.env.NOTION_API_KEY || process.env.Notion_API_Key });
const pageId = "36685719-79e7-818d-a7dc-f67fb0ecc421";

try {
  await client.pages.update({ page_id: pageId, archived: false });
  console.log("Sync Config page unarchived successfully");
  
  // Verify
  const page = await client.pages.retrieve({ page_id: pageId });
  console.log("Page archived status:", page.archived);
} catch (e) {
  console.error("Error:", e.message);
  
  // If parent is archived, we need to check the parent database
  if (e.message.includes("archived ancestor")) {
    console.log("\nThe parent database/page is also archived.");
    console.log("Parent data_source_id: abfbb256-fb48-4618-9ba5-080247643ce6");
    console.log("Parent database_id: bdd872a8-2657-49ae-bcb8-02e5361065eb");
    console.log("\nTrying to unarchive parent database...");
    
    try {
      // Try to query the parent to see its status
      const db = await client.databases.retrieve({ database_id: "bdd872a8-2657-49ae-bcb8-02e5361065eb" });
      console.log("Parent DB archived:", db.archived);
    } catch (e2) {
      console.error("Parent DB error:", e2.message);
    }
  }
}
