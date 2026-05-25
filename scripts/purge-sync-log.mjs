/**
 * One-time purge script: Archives noisy per-run Sync Log entries from Notion.
 * Keeps: reconciliation entries, hourly summaries (one per hour), and daily summaries.
 * Archives: duplicate per-5-minute "Sync YYYY-MM-DD HH:MM" entries.
 *
 * Usage: node scripts/purge-sync-log.mjs
 */

import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SYNC_LOG_DB_ID = process.env.NOTION_SYNC_LOG_DATASOURCE_ID || "7a409211-a784-4970-bd5a-5d243a4aa21f";

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY env var");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

async function getAllPages() {
  const pages = [];
  let cursor = undefined;
  let batch = 0;

  while (true) {
    batch++;
    console.log(`Fetching batch ${batch}...`);
    const response = await notion.dataSources.query({
      data_source_id: SYNC_LOG_DB_ID,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });

    pages.push(...response.results);
    if (!response.has_more) break;
    cursor = response.next_cursor;
  }

  return pages;
}

function getTitle(page) {
  const titleProp = page.properties?.Run;
  if (titleProp?.type === "title" && titleProp.title?.length > 0) {
    return titleProp.title.map(t => t.plain_text).join("");
  }
  return "";
}

function getStatus(page) {
  const statusProp = page.properties?.Status;
  if (statusProp?.type === "select" && statusProp.select) {
    return statusProp.select.name;
  }
  return "";
}

async function main() {
  console.log("Fetching all Sync Log entries...");
  const pages = await getAllPages();
  console.log(`Found ${pages.length} total entries.`);

  // Categorize pages
  const toKeep = [];
  const toArchive = [];
  const seenHours = new Set(); // Track "YYYY-MM-DD HH" to keep only one per hour

  for (const page of pages) {
    const title = getTitle(page);
    const status = getStatus(page);

    // Always keep reconciliation entries
    if (title.includes("Reconciliation") || title.includes("reconciliation")) {
      toKeep.push({ id: page.id, title, reason: "reconciliation" });
      continue;
    }

    // Always keep daily summaries
    if (title.includes("Daily") || title.includes("daily")) {
      toKeep.push({ id: page.id, title, reason: "daily summary" });
      continue;
    }

    // Always keep failed/partial entries
    if (status === "Failed" || status === "Partial") {
      toKeep.push({ id: page.id, title, reason: `status: ${status}` });
      continue;
    }

    // For "Sync YYYY-MM-DD HH:MM" entries, keep only one per hour
    const hourMatch = title.match(/Sync (\d{4}-\d{2}-\d{2} \d{2})/);
    if (hourMatch) {
      const hourKey = hourMatch[1];
      if (!seenHours.has(hourKey)) {
        seenHours.add(hourKey);
        toKeep.push({ id: page.id, title, reason: "hourly representative" });
      } else {
        toArchive.push({ id: page.id, title });
      }
      continue;
    }

    // Keep anything else we don't recognize
    toKeep.push({ id: page.id, title, reason: "unrecognized format" });
  }

  console.log(`\nKeeping: ${toKeep.length} entries`);
  console.log(`Archiving: ${toArchive.length} entries`);

  if (toArchive.length === 0) {
    console.log("Nothing to archive. Done.");
    return;
  }

  console.log("\nArchiving entries...");
  let archived = 0;
  let errors = 0;

  for (const page of toArchive) {
    try {
      await notion.pages.update({
        page_id: page.id,
        archived: true,
      });
      archived++;
      if (archived % 10 === 0) {
        console.log(`  Archived ${archived}/${toArchive.length}...`);
      }
      // Rate limit: Notion allows ~3 requests/sec
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      errors++;
      console.error(`  Failed to archive "${page.title}" (${page.id}): ${err.message}`);
    }
  }

  console.log(`\nDone! Archived: ${archived}, Errors: ${errors}, Kept: ${toKeep.length}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
