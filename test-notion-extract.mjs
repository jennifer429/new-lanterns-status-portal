import { Client } from "@notionhq/client";

const client = new Client({
  auth: process.env.NOTION_API_KEY,
});

const QUESTIONNAIRE_DATA_SOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

async function testExtract() {
  try {
    console.log("Fetching first 5 rows from Notion...\n");
    const response = await client.dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      page_size: 5,
    });

    console.log("Got", response.results.length, "results\n");

    for (let i = 0; i < response.results.length; i++) {
      const page = response.results[i];
      console.log(`\n--- Row ${i + 1} ---`);
      console.log("Page ID:", page.id);
      console.log("Last edited:", page.last_edited_time);
      
      if (page.properties) {
        console.log("Properties available:");
        for (const [key, value] of Object.entries(page.properties)) {
          console.log(`  - ${key}:`, value.type);
        }
        
        // Try to extract key fields
        const props = page.properties;
        console.log("\nExtracted values:");
        console.log("  Slug:", props.Slug?.rich_text?.[0]?.plain_text || props.Slug?.text || "MISSING");
        console.log("  Question ID:", props["Question ID"]?.rich_text?.[0]?.plain_text || props["Question ID"]?.text || "MISSING");
        console.log("  Answer:", props.Answer?.rich_text?.[0]?.plain_text || props.Answer?.text || "MISSING");
        console.log("  Institution Group:", props["Institution Group"]?.select?.name || "MISSING");
      } else {
        console.log("NO PROPERTIES!");
      }
    }
  } catch (error) {
    console.error("Error:", error.message || error);
  }
}

testExtract();
