/**
 * Backfill the "Site" column for Task Completion Records and Validation Results
 * in Notion. Reads org names from MySQL and updates Notion pages that have an
 * Organization ID but no Site value.
 */
import "dotenv/config";
import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const TASK_COMPLETION_DS = "ddf65e15-4b76-459a-a0fc-15c0fab023b0";
const VALIDATION_RESULTS_DS = "2294cf68-e0b5-40b9-87d5-60c2da095926";

async function getOrgMap() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute("SELECT id, name FROM organizations");
  conn.end();
  const map = {};
  for (const row of rows) {
    map[row.id] = row.name;
  }
  return map;
}

async function backfillDatabase(dataSourceId, dbName, orgMap) {
  console.log(`\n--- Backfilling ${dbName} ---`);
  let cursor = undefined;
  let updated = 0;
  let checked = 0;

  while (true) {
    const params = {
      data_source_id: dataSourceId,
      page_size: 100,
      filter: {
        and: [
          { property: "Organization ID", number: { is_not_empty: true } },
          { property: "Site", rich_text: { is_empty: true } },
        ],
      },
    };
    if (cursor) params.start_cursor = cursor;

    const response = await notion.dataSources.query(params);
    const pages = response.results;
    checked += pages.length;

    for (const page of pages) {
      const orgId = page.properties["Organization ID"]?.number;
      if (!orgId) continue;

      const siteName = orgMap[orgId];
      if (!siteName) continue;

      try {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            Site: { rich_text: [{ text: { content: siteName } }] },
          },
        });
        updated++;
      } catch (err) {
        console.error(`  Failed to update page ${page.id}: ${err.message}`);
      }

      // Rate limit: ~3 req/s
      if (updated % 10 === 0 && updated > 0) {
        console.log(`  Updated ${updated} so far...`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!response.has_more) break;
    cursor = response.next_cursor;
  }

  console.log(`  Done. Checked ${checked} pages, updated ${updated} with Site name.`);
  return updated;
}

async function main() {
  const orgMap = await getOrgMap();
  console.log(`Loaded ${Object.keys(orgMap).length} organizations.`);

  await backfillDatabase(TASK_COMPLETION_DS, "Task Completion Records", orgMap);
  await backfillDatabase(VALIDATION_RESULTS_DS, "Validation Results", orgMap);

  console.log("\nAll done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
