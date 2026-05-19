/**
 * Migration script: Push all MySQL intake responses to Notion questionnaire database.
 * 
 * Notion schema (no translation needed):
 *   Question (title) — question text from questionnaireData.ts
 *   Question ID (rich_text) — stable ID (e.g., A.2, IW.orders_description)
 *   Answer (rich_text) — the response text
 *   Section (select) — Architecture, Integration Workflows, etc.
 *   Institution Group (select) — RRAL, Boulder, baycare, etc.
 *   Slug (rich_text) — org slug for exact text matching
 *   Status (select) — Complete (all migrated rows have answers)
 *   Updated By (rich_text) — who last changed it
 *   Created At (date) — original createdAt from MySQL
 *   Last Updated (last_edited_time) — auto-managed by Notion
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY || process.env.Notion_API_Key });
const QUESTIONNAIRE_DB_ID = "c16396a9-b4c9-48f0-9264-6e58f3742676";

// Question ID → text mapping (from shared/questionnaireData.ts)
const QUESTION_TEXT = {
  "H.1": "Number of sites/locations (this determines how many VPN tunnels need to be built)",
  "H.2": "Site names and identifiers",
  "H.3": "Site-specific user access restrictions",
  "A.contacts": "Contacts",
  "A.6": "Is a security questionnaire required?",
  "A.6.1": "Security questionnaire details",
  "L.2": "Test patient data requirements",
  "L.3": "Test study requirements",
  "L.4": "Timeline requirements or expectations",
  "L.8": "Go-live support requirements",
  "L.9": "Post go-live monitoring requirements",
  "L.10": "Issue escalation process",
  "L.11": "Downtime Plans",
  "ARCH.diagram": "Architecture Diagram",
  "ARCH.systems": "Systems in Your Environment",
  "ARCH.1": "PACS system (vendor and product name)",
  "ARCH.2": "RIS system (vendor and product name)",
  "ARCH.3": "EMR / EHR system (vendor and product name)",
  "ARCH.4": "Interface Engine / Middleware",
  "ARCH.5": "Additional systems (VNA, AI platforms, etc.)",
  "IW.orders_description": "Orders Workflow: Describe how imaging orders reach the platform",
  "IW.images_description": "Images Workflow: Describe how imaging studies are routed",
  "IW.priors_description": "Priors Workflow: Describe how prior studies are retrieved",
  "IW.reports_description": "Reports Workflow: Describe how reports are delivered back",
  "D.1": "Can production systems be configured for testing prior to go-live?",
  "E.1": "VPN form exchange",
  "CF.1": "Procedure code list",
  "CF.2": "User list",
  "CF.3": "Sample ORU report",
  "CF.4": "ORM/ORU specifications",
  "CF.5": "Sample ORM report",
  "CF.6": "Provider Directory",
  "D.2": "Requested go-live date",
  "D.3": "Expected modalities",
  "D.4": "Approximate daily study volume",
  "D.9": "DICOM SR or other data sources / HL7 clinical segments",
  "D.10": "HL7 priority values in orders (OBR:27.1)",
  "D.11": "Patient identifier for matching",
  "D.12": "Is patient identifier same in orders and priors?",
  "D.13": "DICOM tag 0008,1040 and PV1:11 values",
  "G.3": "ORC-1 (Order Control) values",
  "G.4": "ORC-5 (Order Status) values",
  "G.5": "OBR:27.1 (Quantity/Timing) in ORU messages",
  "G.6": "Patient Class (PV1:2) values",
  "G.7": "Patient Location (PV1:3) values",
};

// Question ID prefix → Section mapping
function getSection(questionId) {
  if (!questionId) return "Organization Info";
  if (questionId.startsWith("ARCH.")) return "Architecture";
  if (questionId.startsWith("IW.") || questionId.startsWith("OW.")) return "Integration Workflows";
  if (questionId === "D.1" || questionId.startsWith("E.") || questionId.startsWith("CONN.")) return "Connectivity";
  if (questionId.startsWith("CF.")) return "Configuration Files";
  if (questionId.startsWith("D.") || questionId.startsWith("G.") || questionId.startsWith("HL7.") || questionId.startsWith("DICOM.")) return "HL7 & DICOM Data";
  if (questionId.startsWith("H.") || questionId.startsWith("A.") || questionId.startsWith("L.")) return "Organization Info";
  return "Organization Info";
}

function getQuestionText(questionId) {
  return QUESTION_TEXT[questionId] || questionId;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get all non-empty responses with org info
  const [rows] = await conn.execute(`
    SELECT ir.questionId, ir.response, ir.createdAt, ir.updatedAt, ir.updatedBy, ir.organizationId, o.slug, o.name
    FROM intakeResponses ir
    JOIN organizations o ON ir.organizationId = o.id
    WHERE ir.response IS NOT NULL AND ir.response != ''
    ORDER BY o.slug, ir.questionId
  `);

  console.log(`Total responses to migrate: ${rows.length}`);
  console.log(`Unique orgs: ${[...new Set(rows.map(r => r.slug))].join(', ')}`);

  let created = 0;
  let errors = 0;
  let retries = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const section = getSection(row.questionId);
    const questionText = getQuestionText(row.questionId);
    
    // Truncate answer to 2000 chars (Notion rich_text limit)
    const answer = (row.response || "").substring(0, 2000);
    
    // Use slug for Institution Group select — Notion will auto-create if not in list
    const slug = row.slug || row.name || "unknown";
    
    const properties = {
      "Question": {
        title: [{ text: { content: questionText } }]
      },
      "Question ID": {
        rich_text: [{ text: { content: row.questionId } }]
      },
      "Answer": {
        rich_text: [{ text: { content: answer } }]
      },
      "Section": {
        select: { name: section }
      },
      "Institution Group": {
        select: { name: slug }
      },
      "Slug": {
        rich_text: [{ text: { content: slug } }]
      },
      "Status": {
        select: { name: "Complete" }
      }
    };

    // Add Updated By if available
    if (row.updatedBy) {
      properties["Updated By"] = {
        rich_text: [{ text: { content: row.updatedBy } }]
      };
    }

    // Add Created At if available
    if (row.createdAt) {
      properties["Created At"] = {
        date: { start: new Date(row.createdAt).toISOString() }
      };
    }

    try {
      await notion.pages.create({
        parent: { database_id: QUESTIONNAIRE_DB_ID },
        properties
      });
      created++;
      
      if (created % 25 === 0) {
        console.log(`  Progress: ${created}/${rows.length} created (${errors} errors)`);
      }
      
      // Rate limit: ~2.5 requests/sec
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      if (e.code === "rate_limited") {
        retries++;
        console.log(`  Rate limited at ${created}/${rows.length}, waiting 5s... (retry #${retries})`);
        await new Promise(r => setTimeout(r, 5000));
        i--; // retry this row
      } else {
        errors++;
        console.log(`  ERROR [${slug}/${row.questionId}]: ${e.message}`);
        // Continue to next row
      }
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
  console.log(`Rate limit retries: ${retries}`);
  await conn.end();
}

main().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
