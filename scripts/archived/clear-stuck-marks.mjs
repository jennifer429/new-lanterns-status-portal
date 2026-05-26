/**
 * One-time script: Clear "Last Updated From" on stuck validation rows
 * so they get re-processed by the sync-back on next tick.
 *
 * These rows were marked "Notion" by the dev server's sync-back,
 * but MySQL was never actually updated (no-op upsert bug).
 */
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.Notion_API_Key || process.env.NOTION_API_KEY;
const VALIDATION_DS_ID = process.env.NOTION_VALIDATION_RESULTS_DATASOURCE_ID || "2294cf68-e0b5-40b9-87d5-60c2da095926";

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY");
  process.exit(1);
}

const client = new Client({ auth: NOTION_API_KEY });

// Find all validation rows where "Last Updated From" = "Notion"
// that were edited on May 25 (the dev server's erroneous mark)
async function main() {
  console.log("Querying validation results with Last Updated From = Notion...");
  
  const response = await client.dataSources.query({
    data_source_id: VALIDATION_DS_ID,
    filter: {
      property: "Last Updated From",
      rich_text: { equals: "Notion" },
    },
    page_size: 100,
  });

  const pages = response.results;
  console.log(`Found ${pages.length} rows marked "Notion"`);

  let cleared = 0;
  for (const page of pages) {
    const orgId = page.properties?.["Organization ID"]?.number;
    const testKey = page.properties?.["Test Key"]?.rich_text?.[0]?.plain_text || "";
    
    try {
      await client.pages.update({
        page_id: page.id,
        properties: {
          "Last Updated From": { rich_text: [{ text: { content: "" } }] },
        },
      });
      cleared++;
      console.log(`  Cleared: org=${orgId} test=${testKey}`);
    } catch (err) {
      console.error(`  Failed: org=${orgId} test=${testKey}:`, err.message);
    }
  }

  console.log(`\nDone. Cleared ${cleared}/${pages.length} rows.`);
  console.log("These rows will be re-processed on the next sync-back tick.");
}

main().catch(console.error);
