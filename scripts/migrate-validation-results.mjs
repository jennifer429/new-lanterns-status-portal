/**
 * Migration: Validation Results → Notion (only)
 * Task Completion already migrated (311/311 success).
 * This script handles the remaining validation results.
 */
import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const VALIDATION_RESULTS_DB_ID = "17813c6e-932c-4b1f-9c60-c4645f9cfbbb";

async function main() {
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    connectTimeout: 30000,
  });

  // Get org names
  const [orgs] = await conn.query("SELECT id, name FROM organizations");
  const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));

  // Migrate Validation Results
  console.log("=== Migrating Validation Results ===");
  const [valRows] = await conn.query("SELECT * FROM validationResults ORDER BY organizationId, testKey");
  console.log(`Found ${valRows.length} validation result rows to migrate`);

  await conn.end(); // Close connection early — we only needed the data

  let valSuccess = 0;
  let valFailed = 0;

  for (let i = 0; i < valRows.length; i++) {
    const row = valRows[i];
    const orgName = orgMap[row.organizationId] || `Org ${row.organizationId}`;

    const properties = {
      Name: { title: [{ text: { content: `${orgName} — ${row.testKey}` } }] },
      Site: { rich_text: [{ text: { content: orgName } }] },
      "Organization ID": { number: row.organizationId },
      "Test Key": { rich_text: [{ text: { content: row.testKey } }] },
      Status: { select: { name: row.status || "Not Tested" } },
      Actual: { rich_text: row.actual ? [{ text: { content: row.actual.substring(0, 2000) } }] : [] },
      "Sign Off": { rich_text: row.signOff ? [{ text: { content: row.signOff } }] : [] },
      Notes: { rich_text: row.notes ? [{ text: { content: row.notes.substring(0, 2000) } }] : [] },
      "Tested Date": { rich_text: row.testedDate ? [{ text: { content: row.testedDate } }] : [] },
      "Updated By": { rich_text: row.updatedBy ? [{ text: { content: row.updatedBy } }] : [] },
    };

    try {
      await notion.pages.create({ parent: { database_id: VALIDATION_RESULTS_DB_ID }, properties });
      valSuccess++;
      if ((i + 1) % 25 === 0) console.log(`  Validation: ${i + 1}/${valRows.length} processed (${valSuccess} ok, ${valFailed} failed)`);
    } catch (err) {
      valFailed++;
      console.error(`  FAILED validation row ${row.id} (${orgName} — ${row.testKey}): ${err.message}`);
    }

    // Rate limit: ~3 requests/sec
    if ((i + 1) % 3 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n=== VALIDATION MIGRATION COMPLETE ===`);
  console.log(`Validation Results: ${valSuccess} migrated, ${valFailed} failed`);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
