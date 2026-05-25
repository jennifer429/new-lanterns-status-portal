/**
 * Migration: Task Completion + Validation Results → Notion
 * 
 * Databases already created via MCP and shared with "Implementations-Updates":
 * 1. Task Completion Records: bf0d616d-9f92-42b9-86a3-497814b14e46
 * 2. Validation Results: 17813c6e-932c-4b1f-9c60-c4645f9cfbbb
 * 
 * This script migrates all existing MySQL data into them.
 */
import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const TASK_COMPLETION_DB_ID = "bf0d616d-9f92-42b9-86a3-497814b14e46";
const VALIDATION_RESULTS_DB_ID = "17813c6e-932c-4b1f-9c60-c4645f9cfbbb";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // ─── Step 1: Get org names for readable titles ───
  const [orgs] = await conn.query("SELECT id, name FROM organizations");
  const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));

  // ─── Step 2: Migrate Task Completion ───
  console.log("\n=== Migrating Task Completion ===");
  const [taskRows] = await conn.query("SELECT * FROM taskCompletion ORDER BY organizationId, taskId");
  console.log(`Found ${taskRows.length} task completion rows to migrate`);

  let taskSuccess = 0;
  let taskFailed = 0;

  for (let i = 0; i < taskRows.length; i++) {
    const row = taskRows[i];
    const orgName = orgMap[row.organizationId] || `Org ${row.organizationId}`;

    // Determine status
    let status = "Not Started";
    if (row.completed === 1) status = "Complete";
    else if (row.blocked === 1) status = "Blocked";
    else if (row.inProgress === 1) status = "In Progress";
    else if (row.notApplicable === 1) status = "N/A";

    const properties = {
      Name: { title: [{ text: { content: `${orgName} — ${row.taskId}` } }] },
      Site: { rich_text: [{ text: { content: orgName } }] },
      "Organization ID": { number: row.organizationId },
      "Task Key": { rich_text: [{ text: { content: row.taskId } }] },
      Status: { select: { name: status } },
      "Section Name": { rich_text: row.sectionName ? [{ text: { content: row.sectionName } }] : [] },
      "Target Date": { rich_text: row.targetDate ? [{ text: { content: row.targetDate } }] : [] },
      Notes: { rich_text: row.notes ? [{ text: { content: row.notes.substring(0, 2000) } }] : [] },
      "Completed By": { rich_text: row.completedBy ? [{ text: { content: row.completedBy } }] : [] },
      "Completed At": { rich_text: row.completedAt ? [{ text: { content: row.completedAt.toISOString() } }] : [] },
    };

    try {
      await notion.pages.create({ parent: { database_id: TASK_COMPLETION_DB_ID }, properties });
      taskSuccess++;
      if ((i + 1) % 25 === 0) console.log(`  Tasks: ${i + 1}/${taskRows.length} processed (${taskSuccess} ok, ${taskFailed} failed)`);
    } catch (err) {
      taskFailed++;
      console.error(`  FAILED task row ${row.id} (${orgName} — ${row.taskId}): ${err.message}`);
    }

    // Rate limit: ~3 requests/sec
    if ((i + 1) % 3 === 0) await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\nTask Completion: ${taskSuccess} migrated, ${taskFailed} failed`);

  // ─── Step 3: Migrate Validation Results ───
  console.log("\n=== Migrating Validation Results ===");
  const [valRows] = await conn.query("SELECT * FROM validationResults ORDER BY organizationId, testKey");
  console.log(`Found ${valRows.length} validation result rows to migrate`);

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
  console.log(`\nValidation Results: ${valSuccess} migrated, ${valFailed} failed`);

  // ─── Summary ───
  console.log("\n=== MIGRATION COMPLETE ===");
  console.log(`Task Completion DB: ${TASK_COMPLETION_DB_ID}`);
  console.log(`Validation Results DB: ${VALIDATION_RESULTS_DB_ID}`);
  console.log(`Tasks: ${taskSuccess} success / ${taskFailed} failed`);
  console.log(`Validation: ${valSuccess} success / ${valFailed} failed`);

  await conn.end();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
