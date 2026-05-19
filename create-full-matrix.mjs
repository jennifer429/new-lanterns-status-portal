/**
 * Create the full site × question matrix in Notion.
 * For every org × every question, if a row doesn't already exist, create a blank one.
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY || process.env.Notion_API_Key });
const QUESTIONNAIRE_DB_ID = "c16396a9-b4c9-48f0-9264-6e58f3742676";
const DATA_SOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

// All 45 questions with their text and section
const ALL_QUESTIONS = [
  { id: "H.1", text: "Hospital/Organization Name", section: "Organization Info" },
  { id: "H.2", text: "Primary Contact Name", section: "Organization Info" },
  { id: "H.3", text: "Primary Contact Email", section: "Organization Info" },
  { id: "A.contacts", text: "Key Contacts", section: "Organization Info" },
  { id: "A.6", text: "PACS Vendor", section: "Architecture" },
  { id: "A.6.1", text: "PACS Version", section: "Architecture" },
  { id: "L.2", text: "Go-live date", section: "Launch Planning" },
  { id: "L.3", text: "Training date", section: "Launch Planning" },
  { id: "L.4", text: "Parallel read period", section: "Launch Planning" },
  { id: "L.8", text: "Cutover plan", section: "Launch Planning" },
  { id: "L.9", text: "Post go-live monitoring requirements", section: "Launch Planning" },
  { id: "L.10", text: "Rollback plan", section: "Launch Planning" },
  { id: "L.11", text: "Success criteria", section: "Launch Planning" },
  { id: "ARCH.diagram", text: "Architecture Diagram", section: "Architecture" },
  { id: "ARCH.systems", text: "Systems involved", section: "Architecture" },
  { id: "ARCH.1", text: "Current PACS architecture", section: "Architecture" },
  { id: "ARCH.2", text: "RIS integration points", section: "Architecture" },
  { id: "ARCH.3", text: "Network topology", section: "Architecture" },
  { id: "ARCH.4", text: "Disaster recovery plan", section: "Architecture" },
  { id: "ARCH.5", text: "High availability requirements", section: "Architecture" },
  { id: "IW.orders_description", text: "Orders workflow description", section: "Integration Workflows" },
  { id: "IW.images_description", text: "Images workflow description", section: "Integration Workflows" },
  { id: "IW.priors_description", text: "Priors workflow description", section: "Integration Workflows" },
  { id: "IW.reports_description", text: "Reports workflow description", section: "Integration Workflows" },
  { id: "D.1", text: "VPN connectivity requirements", section: "Connectivity" },
  { id: "E.1", text: "VPN form exchange", section: "Connectivity" },
  { id: "CF.1", text: "Procedure code list", section: "Configuration Files" },
  { id: "CF.2", text: "User list", section: "Configuration Files" },
  { id: "CF.3", text: "Sample ORU report", section: "Configuration Files" },
  { id: "CF.4", text: "ORM/ORU specifications", section: "Configuration Files" },
  { id: "CF.5", text: "Sample ORM report", section: "Configuration Files" },
  { id: "CF.6", text: "Provider Directory", section: "Configuration Files" },
  { id: "D.2", text: "Firewall rules needed", section: "Connectivity" },
  { id: "D.3", text: "IP addressing scheme", section: "Connectivity" },
  { id: "D.4", text: "Port requirements", section: "Connectivity" },
  { id: "D.9", text: "Network bandwidth requirements", section: "Connectivity" },
  { id: "D.10", text: "SSL/TLS requirements", section: "Connectivity" },
  { id: "D.11", text: "DNS configuration", section: "Connectivity" },
  { id: "D.12", text: "Proxy configuration", section: "Connectivity" },
  { id: "D.13", text: "Network monitoring", section: "Connectivity" },
  { id: "G.3", text: "User authentication method", section: "Security & Access" },
  { id: "G.4", text: "Password policy", section: "Security & Access" },
  { id: "G.5", text: "Role-based access requirements", section: "Security & Access" },
  { id: "G.6", text: "Audit logging requirements", section: "Security & Access" },
  { id: "G.7", text: "Data encryption requirements", section: "Security & Access" },
];

async function loadExistingNotionRows() {
  const existing = new Set(); // "slug::questionId"
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
        existing.add(`${slug}::${qid}`);
      }
    }
    
    total += result.results.length;
    cursor = result.has_more ? result.next_cursor : undefined;
    await new Promise(r => setTimeout(r, 300));
  } while (cursor);
  
  console.log(`Loaded ${total} existing Notion rows (${existing.size} indexed)`);
  return existing;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all real orgs
  const [orgs] = await conn.execute("SELECT slug, name FROM organizations ORDER BY slug");
  console.log(`Real orgs: ${orgs.length}`);
  
  // Load existing Notion rows
  const existing = await loadExistingNotionRows();
  
  // Calculate what's missing
  const toCreate = [];
  for (const org of orgs) {
    const slug = org.slug.trim(); // Lodi Memorial has leading space
    for (const q of ALL_QUESTIONS) {
      const key = `${slug}::${q.id}`;
      if (!existing.has(key)) {
        toCreate.push({ slug, orgName: org.name, questionId: q.id, questionText: q.text, section: q.section });
      }
    }
  }
  
  console.log(`\nTotal matrix: ${orgs.length} orgs × ${ALL_QUESTIONS.length} questions = ${orgs.length * ALL_QUESTIONS.length}`);
  console.log(`Already exist: ${existing.size}`);
  console.log(`To create (blank): ${toCreate.length}`);
  
  // Create blank rows
  let created = 0;
  let errors = 0;
  
  console.log(`\nStarting creation of ${toCreate.length} rows...`);
  
  for (let i = 0; i < toCreate.length; i++) {
    const row = toCreate[i];
    try {
      await notion.pages.create({
        parent: { database_id: QUESTIONNAIRE_DB_ID },
        properties: {
          "Question": { title: [{ text: { content: row.questionText } }] },
          "Question ID": { rich_text: [{ text: { content: row.questionId } }] },
          "Answer": { rich_text: [{ text: { content: "" } }] },
          "Section": { select: { name: row.section } },
          "Institution Group": { select: { name: row.slug } },
          "Slug": { rich_text: [{ text: { content: row.slug } }] },
          "Status": { select: { name: "Not Started" } },
          "Updated By": { rich_text: [{ text: { content: "" } }] },
        }
      });
      created++;
      
      if (created % 25 === 0) {
        console.log(`  Created ${created}/${toCreate.length} (${row.slug}/${row.questionId})`);
      }
      
      // Rate limit: ~2.5 req/sec
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      errors++;
      console.log(`  ERROR [${row.slug}/${row.questionId}]: ${e.message}`);
      if (e.code === "rate_limited" || e.message?.includes("rate")) {
        console.log("  Rate limited, waiting 5s...");
        await new Promise(r => setTimeout(r, 5000));
        // Retry
        i--;
      }
    }
  }
  
  console.log(`\n=== Matrix Creation Complete ===`);
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total rows now: ${existing.size + created}`);
  
  await conn.end();
}

main().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
