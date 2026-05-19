/**
 * Backfill script: Add file attachment URLs to Notion questionnaire rows.
 * 
 * Strategy:
 * 1. Load all Notion rows into memory (grouped by slug+questionId)
 * 2. For each file attachment from MySQL:
 *    - If a Notion row exists for that slug+questionId → UPDATE its Files column
 *    - If no row exists → CREATE a new row with the file link
 * 3. Multiple files for the same question are combined into one Files array
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY || process.env.Notion_API_Key });
const QUESTIONNAIRE_DB_ID = "c16396a9-b4c9-48f0-9264-6e58f3742676";
const DATA_SOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

// Question ID → text mapping
const QUESTION_TEXT = {
  "CF.1": "Procedure code list",
  "CF.2": "User list",
  "CF.3": "Sample ORU report",
  "CF.4": "ORM/ORU specifications",
  "CF.5": "Sample ORM report",
  "CF.6": "Provider Directory",
  "CF.7": "Additional configuration file",
  "E.1": "VPN form exchange",
  "ARCH.diagram": "Architecture Diagram",
};

function getSection(questionId) {
  if (!questionId) return "Organization Info";
  if (questionId.startsWith("ARCH.")) return "Architecture";
  if (questionId.startsWith("E.") || questionId === "D.1") return "Connectivity";
  if (questionId.startsWith("CF.")) return "Configuration Files";
  return "Organization Info";
}

async function loadAllNotionRows() {
  // Load all rows from the questionnaire database, indexed by slug::questionId
  const index = new Map(); // key: "slug::questionId" → page_id
  let cursor = undefined;
  let total = 0;
  
  do {
    const result = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: cursor
    });
    
    for (const page of result.results) {
      const slug = page.properties?.Slug?.rich_text?.[0]?.plain_text || 
                   page.properties?.["Institution Group"]?.select?.name || "";
      const qid = page.properties?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
      if (slug && qid) {
        index.set(`${slug}::${qid}`, page.id);
      }
    }
    
    total += result.results.length;
    cursor = result.has_more ? result.next_cursor : undefined;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 350));
  } while (cursor);
  
  console.log(`Loaded ${total} Notion rows, indexed ${index.size} by slug::questionId`);
  return index;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Step 1: Load all Notion rows into an index
  console.log("Loading Notion index...");
  const notionIndex = await loadAllNotionRows();

  // Step 2: Get all file attachments from MySQL
  const [rows] = await conn.execute(`
    SELECT ifa.questionId, ifa.fileName, ifa.fileUrl, ifa.mimeType, o.slug
    FROM intakeFileAttachments ifa
    JOIN organizations o ON ifa.organizationId = o.id
    WHERE ifa.fileUrl IS NOT NULL AND ifa.fileUrl != ''
    ORDER BY o.slug, ifa.questionId
  `);

  console.log(`\nTotal file attachments: ${rows.length}`);

  // Group by slug+questionId
  const grouped = {};
  for (const row of rows) {
    const key = `${row.slug}::${row.questionId}`;
    if (!grouped[key]) grouped[key] = { slug: row.slug, questionId: row.questionId, files: [] };
    grouped[key].files.push({ name: row.fileName, url: row.fileUrl });
  }

  console.log(`Unique slug+questionId combos: ${Object.keys(grouped).length}`);

  let updated = 0;
  let created = 0;
  let errors = 0;

  for (const [key, data] of Object.entries(grouped)) {
    const filesPayload = data.files.map(f => ({
      type: "external",
      name: f.name,
      external: { url: f.url }
    }));

    const existingPageId = notionIndex.get(key);

    try {
      if (existingPageId) {
        // UPDATE existing row with Files
        await notion.pages.update({
          page_id: existingPageId,
          properties: {
            "Files": { files: filesPayload }
          }
        });
        updated++;
        console.log(`  UPDATED [${data.slug}] ${data.questionId} (${data.files.length} file(s))`);
      } else {
        // CREATE new row for this file-only question
        const questionText = QUESTION_TEXT[data.questionId] || data.questionId;
        const section = getSection(data.questionId);
        
        await notion.pages.create({
          parent: { database_id: QUESTIONNAIRE_DB_ID },
          properties: {
            "Question": { title: [{ text: { content: questionText } }] },
            "Question ID": { rich_text: [{ text: { content: data.questionId } }] },
            "Answer": { rich_text: [{ text: { content: "" } }] },
            "Section": { select: { name: section } },
            "Institution Group": { select: { name: data.slug } },
            "Slug": { rich_text: [{ text: { content: data.slug } }] },
            "Status": { select: { name: "Complete" } },
            "Updated By": { rich_text: [{ text: { content: "file-backfill" } }] },
            "Files": { files: filesPayload }
          }
        });
        created++;
        console.log(`  CREATED [${data.slug}] ${data.questionId} (${data.files.length} file(s))`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      errors++;
      console.log(`  ERROR [${data.slug}/${data.questionId}]: ${e.message}`);
      if (e.code === "rate_limited") {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  console.log(`\n=== File Backfill Complete ===`);
  console.log(`Updated existing rows: ${updated}`);
  console.log(`Created new rows: ${created}`);
  console.log(`Errors: ${errors}`);
  await conn.end();
}

main().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
