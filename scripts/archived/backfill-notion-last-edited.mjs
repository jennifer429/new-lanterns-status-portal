/**
 * One-time backfill script: sets notionLastEdited on all existing task completions
 * and validation results by querying Notion for each row's last_edited_time.
 *
 * Usage: node scripts/backfill-notion-last-edited.mjs
 *
 * This script runs against the production database and Notion API.
 * It's safe to re-run — it only updates rows where notionLastEdited is NULL.
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
const TASK_COMPLETION_DS = process.env.NOTION_TASK_COMPLETION_DATASOURCE_ID || process.env.NOTION_TASK_COMPLETION_DATABASE_ID;
const VALIDATION_RESULTS_DS = process.env.NOTION_VALIDATION_RESULTS_DATASOURCE_ID || process.env.NOTION_VALIDATION_RESULTS_DATABASE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!NOTION_API_KEY || !DATABASE_URL) {
  console.error("Missing NOTION_API_KEY or DATABASE_URL");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

async function getConnection() {
  return mysql.createConnection(DATABASE_URL);
}

async function backfillTaskCompletions(conn) {
  if (!TASK_COMPLETION_DS) {
    console.log("[backfill] No NOTION_TASK_COMPLETION_DATABASE_ID — skipping tasks");
    return;
  }

  // Get all task completions with null notionLastEdited
  const [rows] = await conn.execute(
    "SELECT id, organizationId, taskId FROM taskCompletion WHERE notionLastEdited IS NULL"
  );
  console.log(`[backfill] Found ${rows.length} task completions to backfill`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const result = await notion.dataSources.query({
        data_source_id: TASK_COMPLETION_DS,
        filter: {
          and: [
            { property: "Organization ID", number: { equals: row.organizationId } },
            { property: "Task Key", rich_text: { equals: row.taskId } },
          ],
        },
        page_size: 1,
      });

      const page = result.results?.[0];
      if (!page) {
        notFound++;
        continue;
      }

      const lastEdited = new Date(page.last_edited_time);
      await conn.execute(
        "UPDATE taskCompletion SET notionLastEdited = ? WHERE id = ?",
        [lastEdited, row.id]
      );
      updated++;

      // Rate limit: ~5 requests per second
      if (updated % 5 === 0) await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      errors++;
      console.error(`[backfill] Error for task ${row.organizationId}/${row.taskId}:`, err.message);
    }
  }

  console.log(`[backfill] Tasks: ${updated} updated, ${notFound} not in Notion, ${errors} errors`);
}

async function backfillValidationResults(conn) {
  if (!VALIDATION_RESULTS_DS) {
    console.log("[backfill] No NOTION_VALIDATION_RESULTS_DATABASE_ID — skipping validation");
    return;
  }

  // Get all validation results with null notionLastEdited
  const [rows] = await conn.execute(
    "SELECT id, organizationId, testKey FROM validationResults WHERE notionLastEdited IS NULL"
  );
  console.log(`[backfill] Found ${rows.length} validation results to backfill`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const result = await notion.dataSources.query({
        data_source_id: VALIDATION_RESULTS_DS,
        filter: {
          and: [
            { property: "Organization ID", number: { equals: row.organizationId } },
            { property: "Test Key", rich_text: { equals: row.testKey } },
          ],
        },
        page_size: 1,
      });

      const page = result.results?.[0];
      if (!page) {
        notFound++;
        continue;
      }

      const lastEdited = new Date(page.last_edited_time);
      await conn.execute(
        "UPDATE validationResults SET notionLastEdited = ? WHERE id = ?",
        [lastEdited, row.id]
      );
      updated++;

      // Rate limit
      if (updated % 5 === 0) await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      errors++;
      console.error(`[backfill] Error for validation ${row.organizationId}/${row.testKey}:`, err.message);
    }
  }

  console.log(`[backfill] Validation: ${updated} updated, ${notFound} not in Notion, ${errors} errors`);
}

async function main() {
  console.log("[backfill] Starting notionLastEdited backfill...");
  const conn = await getConnection();

  try {
    await backfillTaskCompletions(conn);
    await backfillValidationResults(conn);
    console.log("[backfill] Done!");
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
