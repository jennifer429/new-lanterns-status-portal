/**
 * Create task-sync-state and validation-sync-state pages in the
 * Questionnaire Sync Config database using the server's Notion API key.
 *
 * This ensures the pages are accessible to the "Implementations-Updates" integration.
 */
import "dotenv/config";
import { Client } from "@notionhq/client";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SYNC_CONFIG_DATASOURCE_ID = process.env.NOTION_SYNC_CONFIG_DATASOURCE_ID;

if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY not set");
  process.exit(1);
}
if (!SYNC_CONFIG_DATASOURCE_ID) {
  console.error("NOTION_SYNC_CONFIG_DATASOURCE_ID not set");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

async function createConfigPage(title, key) {
  try {
    const page = await notion.pages.create({
      parent: { database_id: SYNC_CONFIG_DATASOURCE_ID },
      properties: {
        "Key": { title: [{ text: { content: title } }] },
        "Enabled": { checkbox: true },
        "Consecutive Failures": { number: 0 },
        "Last Successful Sync": { date: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
      },
    });
    console.log(`Created "${title}" → page ID: ${page.id}`);
    return page.id;
  } catch (err) {
    console.error(`Failed to create "${title}":`, err.message);
    return null;
  }
}

async function main() {
  console.log("Creating sync config pages using server's Notion API key...");
  console.log(`Database/DataSource ID: ${SYNC_CONFIG_DATASOURCE_ID}`);
  console.log();

  const taskPageId = await createConfigPage("task-sync-state", "task-sync-state");
  const validationPageId = await createConfigPage("validation-sync-state", "validation-sync-state");

  if (taskPageId && validationPageId) {
    console.log("\n✓ Both pages created successfully!");
    console.log(`\nUpdate notionSyncBackTasks.ts with these IDs:`);
    console.log(`  TASK_SYNC_CONFIG_PAGE_ID = "${taskPageId}";`);
    console.log(`  VALIDATION_SYNC_CONFIG_PAGE_ID = "${validationPageId}";`);
  }
}

main();
