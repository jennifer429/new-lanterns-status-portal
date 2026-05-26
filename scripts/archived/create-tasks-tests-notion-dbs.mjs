/**
 * Create Notion databases for Task Definitions and Test Definitions,
 * then populate them with the existing hardcoded data from taskDefs.ts and Validation.tsx.
 *
 * Usage: node scripts/create-tasks-tests-notion-dbs.mjs
 */
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error("NOTION_API_KEY not set"); process.exit(1); }

const notion = new Client({ auth: NOTION_API_KEY });

// Use the contacts database parent as a known-good location
const CONTACTS_DB_ID = "c6f04901-bba7-4e3c-bf8e-51847c45ef06";

// ─── Task Definitions (from shared/taskDefs.ts) ─────────────────────────────
const SECTION_DEFS = [
  {
    id: "network", title: "Network & Connectivity", duration: "5–10 days",
    tasks: [
      { id: "network:vpn", title: "VPN Tunnel Configuration", description: "Site-to-site VPN established and verified", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)" },
      { id: "network:firewall", title: "Firewall Rules & Port Openings", description: "All required ports open in both directions", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-t", title: "DICOM Endpoint Testing (Test Env)", description: "C-ECHO success from all AE titles in test environment", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-p", title: "DICOM Endpoint Testing (Production)", description: "C-ECHO success from all AE titles in production environment", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:hl7-port", title: "HL7 Port Configuration", description: "HL7 listener ports configured and ACK responses confirmed", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
    ],
  },
  {
    id: "hl7", title: "HL7 Interface Build", duration: "7–14 days",
    tasks: [
      { id: "hl7:orm", title: "ORM Interface Configuration", description: "Order messages flowing from EHR to New Lantern", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru", title: "ORU Interface Configuration", description: "Result/report messages returning from New Lantern to EHR", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:adt", title: "ADT Interface Configuration", description: "Patient demographics updates flowing correctly", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru-spec", title: "ORU Specification Review", description: "ORU spec reviewed and field mappings confirmed", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU / Specs (CF.3, CF.4)" },
      { id: "hl7:orm-spec", title: "ORM Specification Review", description: "ORM spec reviewed and order fields mapped", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORM / Specs (CF.4, CF.5)" },
      { id: "hl7:validate", title: "HL7 Message Validation", description: "All message types validated end-to-end", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "config", title: "System Configuration", duration: "3–7 days",
    tasks: [
      { id: "config:proc", title: "Procedure Code Mapping", description: "All procedure codes loaded and mapped to modalities", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Procedure Code List (CF.1)" },
      { id: "config:users", title: "User Account Provisioning", description: "All user accounts created with correct roles", intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "config:provider", title: "Provider Directory Upload", description: "Referring and reading physician directory loaded", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Provider Directory (CF.6)" },
      { id: "config:worklist", title: "Worklist Configuration", description: "Worklist filters, sorting, and display configured", intakeLink: "/intake?section=hl7-dicom", intakeLinkLabel: "HL7 & DICOM Settings" },
      { id: "config:sso", title: "SSO Active Directory Configuration", description: "Single Sign-On configured via Active Directory per SSO Instructions", specLink: "/specs", specLinkLabel: "SSO Instructions" },
    ],
  },
  {
    id: "templates", title: "Worklist & Templates", duration: "3–5 days",
    tasks: [
      { id: "tmpl:worklist", title: "Worklist Filter Setup", description: "Filters by modality, body part, priority, and location" },
      { id: "tmpl:reports", title: "Report Template Configuration", description: "Report templates loaded and formatted correctly", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU (CF.3)" },
      { id: "tmpl:macros", title: "Macro & Auto-text Setup", description: "Radiologist macros and auto-text configured" },
    ],
  },
  {
    id: "training", title: "Training & Go-Live Preparation", duration: "3–5 days",
    tasks: [
      { id: "train:admin", title: "Admin Training", description: "System administration, user management, configuration changes" },
      { id: "train:tech", title: "Tech Training", description: "Modality workflow, image QC, worklist operations" },
      { id: "train:users", title: "User Setup", description: "All accounts provisioned, roles assigned, logins verified", intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "train:downtime", title: "Downtime Workflow", description: "Team trained on paper backup, rerouting, and recovery", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "train:troubleshoot", title: "Troubleshooting Workflows", description: "Escalation paths, common issues, support contacts documented", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Issue Escalation (L.10)" },
    ],
  },
  {
    id: "testing", title: "End-to-End Testing", duration: "5–7 days",
    tasks: [
      { id: "test:e2e", title: "Full Order-to-Report Workflow Test", description: "Complete cycle validated end-to-end", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:edge", title: "Edge Case Testing (STAT, Addendum, etc.)", description: "STAT priority, addendum, cancel, reschedule flows", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:perf", title: "Performance & Load Testing", description: "Performance confirmed at expected study volume", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:signoff", title: "Go-Live Readiness Sign-Off", description: "All parties signed off on readiness", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "prod-validation", title: "Production Data Validation (2 Weeks)", duration: "14 days minimum",
    tasks: [
      { id: "prod:start", title: "Begin Live Production Data Flow", description: "Production data flowing into New Lantern" },
      { id: "prod:data-quality", title: "Data Quality Review", description: "Study and report completeness and accuracy verified" },
      { id: "prod:timeliness", title: "Timeliness Audit", description: "Studies and reports flowing within agreed SLAs" },
      { id: "prod:normal-wf", title: "Normal Workflow Sign-Off", description: "Standard order → image → report cycle validated" },
      { id: "prod:stat", title: "STAT & Priority Routing", description: "STAT and priority routing verified end-to-end" },
      { id: "prod:addendum", title: "Addendum & Correction Workflow", description: "Addendum and correction workflow validated" },
      { id: "prod:cancel", title: "Order Cancellation", description: "Cancellation and worklist removal confirmed" },
      { id: "prod:downtime", title: "Downtime / Reconnect", description: "Queued studies process correctly after reconnect", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "prod:volume", title: "Volume & Load Confirmation", description: "Performance confirmed at full production volume" },
      { id: "prod:adjustments", title: "Issue Documentation & Remediation", description: "All issues found during validation documented and resolved" },
      { id: "prod:golive", title: "2-Week Validation Complete", description: "Approved for full go-live" },
    ],
  },
];

// ─── Test Definitions (from Validation.tsx phases) ──────────────────────────
const TEST_PHASES = [
  {
    title: "Connectivity Validation",
    tests: [
      { name: "VPN Tunnel Connectivity", description: "Verify bidirectional connectivity through VPN tunnel", relatedQuestions: "E.1 (VPN Form), H.1 (Number of Sites)" },
      { name: "DICOM Echo Test (C-ECHO)", description: "Confirm C-ECHO success from all AE titles", relatedQuestions: "ARCH.systems (Systems Inventory), CONN.endpoints (Endpoints)" },
      { name: "HL7 Port Connectivity", description: "Verify ACK received on all configured HL7 ports", relatedQuestions: "CONN.endpoints (Endpoints)" },
      { name: "SSO / Active Directory Authentication", description: "Verify Single Sign-On via Active Directory — users can log in with AD credentials, roles map correctly, and session persists", relatedQuestions: "CF.2 (User List)" },
    ],
  },
  {
    title: "HL7 Message Validation",
    tests: [
      { name: "ORM New Order (NW)", description: "Send a new order and verify it appears in worklist", relatedQuestions: "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values)" },
      { name: "ORM Cancel Order (CA)", description: "Cancel an order and verify removal from worklist", relatedQuestions: "G.3 (ORC-1 Values), G.4 (ORC-5 Values)" },
      { name: "ORU Report Delivery", description: "Verify finalized report delivered back to EHR", relatedQuestions: "IW.reports_description (Reports Workflow), G.5 (OBR:27.1 Values), CF.3 (Sample ORU)" },
      { name: "ADT Patient Update", description: "Verify patient demographics update in PACS", relatedQuestions: "D.11 (Patient Identifier), D.12 (ID Matching)" },
      { name: "Priority Routing (STAT)", description: "Verify STAT orders are flagged correctly in worklist", relatedQuestions: "D.10 (Priority Values), G.6 (Patient Class)" },
    ],
  },
  {
    title: "Image Routing Validation",
    tests: [
      { name: "DICOM Store from Modality", description: "Verify images arrive from modality to PACS", relatedQuestions: "IW.images_description (Images Workflow), D.3 (Modalities)" },
      { name: "Prior Image Query/Retrieve", description: "Verify prior studies are retrievable", relatedQuestions: "IW.priors_description (Priors Workflow), D.12 (ID Matching)" },
      { name: "Worklist (MWL) Query", description: "Verify scheduled exams returned via modality worklist", relatedQuestions: "ARCH.systems (Systems Inventory)" },
      { name: "AI Routing (if applicable)", description: "Verify images routed to AI engine if configured", relatedQuestions: "ARCH.systems (Systems Inventory), D.9 (DICOM SR / Clinical Data)" },
    ],
  },
  {
    title: "User Acceptance Testing",
    tests: [
      { name: "End-to-End Order Workflow", description: "Complete cycle: Order → Image → Report", relatedQuestions: "IW.orders_description, IW.images_description, IW.reports_description" },
      { name: "Radiologist Reading Workflow", description: "Study opens, report dictated and signed", relatedQuestions: "CF.1 (Procedure Codes), CF.2 (User List)" },
      { name: "Tech QC Workflow", description: "Tech can reject/accept images", relatedQuestions: "CF.2 (User List)" },
      { name: "Report Distribution", description: "Final report reaches referring provider", relatedQuestions: "CF.6 (Provider Directory), IW.reports_description" },
      { name: "STAT Escalation Path", description: "Critical results alert fires correctly", relatedQuestions: "D.10 (Priority Values)" },
      { name: "Downtime Recovery", description: "Queued studies process after reconnect", relatedQuestions: "L.11 (Downtime Plans), L.8 (Go-Live Support)" },
      { name: "Reschedule a Study", description: "Reschedule an existing order — verify worklist updates, prior linkage follows new appointment, and original order is closed", relatedQuestions: "IW.orders_description, G.3 (ORC-1 Values)" },
      { name: "Cancel a Study", description: "Cancel a scheduled study — verify removal from worklist, cancellation message delivered to EHR, and no orphaned images", relatedQuestions: "IW.orders_description, G.3 (ORC-1 Values), G.4 (ORC-5 Values)" },
      { name: "End-to-End Study Completion", description: "Perform a full study: order placed → patient checked in → images acquired → tech QC → radiologist reads → report signed → report delivered to EHR", relatedQuestions: "IW.orders_description, IW.images_description, IW.reports_description, CF.1" },
      { name: "Addendum Workflow", description: "Add an addendum to a signed report — verify addendum appended (not overwritten), versioned ORU sent to EHR, and referring provider notified", relatedQuestions: "IW.reports_description, CF.3 (Sample ORU)" },
      { name: "CT Dose & Tech Sheet Integration", description: "Verify CT dose data (RDSR/DICOM SR) populates tech sheet fields and flows into report templates correctly", relatedQuestions: "D.9 (DICOM SR / Clinical Data), IW.images_description, ARCH.systems" },
      { name: "BI-RADS Custom Report Insertion", description: "Verify BI-RADS structured reporting inserts correctly into mammography reports", relatedQuestions: "IW.reports_description, CF.3 (Sample ORU)" },
      { name: "Lung-RADS / Lung CA Mapping", description: "Verify Lung-RADS structured reporting populates correctly — nodule size, category, and follow-up recommendation", relatedQuestions: "IW.reports_description, CF.3 (Sample ORU)" },
      { name: "Study Merge", description: "Merge two separate studies into one — verify combined images, updated worklist entry, and correct report association", relatedQuestions: "IW.images_description" },
      { name: "Study Split", description: "Break apart a merged or incorrectly combined study — verify images route to correct separate orders and reports follow", relatedQuestions: "IW.images_description, IW.orders_description" },
    ],
  },
];

// ─── Helper: find parent page_id from an existing database ──────────────────
async function getParentPageId() {
  const db = await notion.databases.retrieve({ database_id: CONTACTS_DB_ID });
  if (db.parent.type === "page_id") return db.parent.page_id;
  // If parent is workspace, we'll use the database's own page as parent
  throw new Error("Cannot determine parent page for new databases");
}

// ─── Create Task Definitions Database ───────────────────────────────────────
async function createTaskDefsDb(parentPageId) {
  console.log("Creating Task Definitions database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Task Definitions" } }],
    properties: {
      "Title": { title: {} },
      "Key": { rich_text: {} },
      "Description": { rich_text: {} },
      "Section": { select: {} },
      "Section Title": { rich_text: {} },
      "Duration": { rich_text: {} },
      "Intake Link": { rich_text: {} },
      "Intake Link Label": { rich_text: {} },
      "Spec Link": { rich_text: {} },
      "Spec Link Label": { rich_text: {} },
      "Active": { checkbox: {} },
      "Sort Order": { number: {} },
    },
  });
  console.log("  Created:", db.id);
  return db.id;
}

// ─── Create Test Definitions Database ───────────────────────────────────────
async function createTestDefsDb(parentPageId) {
  console.log("Creating Test Definitions database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Test Definitions" } }],
    properties: {
      "Name": { title: {} },
      "Key": { rich_text: {} },
      "Description": { rich_text: {} },
      "Phase": { select: {} },
      "Related Questions": { rich_text: {} },
      "Active": { checkbox: {} },
      "Sort Order": { number: {} },
    },
  });
  console.log("  Created:", db.id);
  return db.id;
}

// ─── Populate Task Definitions ──────────────────────────────────────────────
async function populateTaskDefs(dbId) {
  console.log("\nPopulating Task Definitions...");
  let sortOrder = 0;
  let created = 0;

  for (const section of SECTION_DEFS) {
    for (const task of section.tasks) {
      sortOrder++;
      const properties = {
        "Title": { title: [{ text: { content: task.title } }] },
        "Key": { rich_text: [{ text: { content: task.id } }] },
        "Description": { rich_text: task.description ? [{ text: { content: task.description } }] : [] },
        "Section": { select: { name: section.id } },
        "Section Title": { rich_text: [{ text: { content: section.title } }] },
        "Duration": { rich_text: [{ text: { content: section.duration } }] },
        "Intake Link": { rich_text: task.intakeLink ? [{ text: { content: task.intakeLink } }] : [] },
        "Intake Link Label": { rich_text: task.intakeLinkLabel ? [{ text: { content: task.intakeLinkLabel } }] : [] },
        "Spec Link": { rich_text: task.specLink ? [{ text: { content: task.specLink } }] : [] },
        "Spec Link Label": { rich_text: task.specLinkLabel ? [{ text: { content: task.specLinkLabel } }] : [] },
        "Active": { checkbox: true },
        "Sort Order": { number: sortOrder },
      };

      try {
        await notion.pages.create({ parent: { database_id: dbId }, properties });
        created++;
        process.stdout.write(`\r  Created ${created} task definitions...`);
      } catch (err) {
        console.error(`\n  FAILED: ${task.id} — ${err.message}`);
      }

      // Rate limit: 3 requests/sec
      await new Promise(r => setTimeout(r, 350));
    }
  }
  console.log(`\n  Done: ${created} task definitions created.`);
}

// ─── Populate Test Definitions ──────────────────────────────────────────────
async function populateTestDefs(dbId) {
  console.log("\nPopulating Test Definitions...");
  let sortOrder = 0;
  let created = 0;

  for (const [phaseIdx, phase] of TEST_PHASES.entries()) {
    for (const [testIdx, test] of phase.tests.entries()) {
      sortOrder++;
      const testKey = `${phaseIdx}:${testIdx}`;
      const properties = {
        "Name": { title: [{ text: { content: test.name } }] },
        "Key": { rich_text: [{ text: { content: testKey } }] },
        "Description": { rich_text: test.description ? [{ text: { content: test.description } }] : [] },
        "Phase": { select: { name: phase.title } },
        "Related Questions": { rich_text: test.relatedQuestions ? [{ text: { content: test.relatedQuestions } }] : [] },
        "Active": { checkbox: true },
        "Sort Order": { number: sortOrder },
      };

      try {
        await notion.pages.create({ parent: { database_id: dbId }, properties });
        created++;
        process.stdout.write(`\r  Created ${created} test definitions...`);
      } catch (err) {
        console.error(`\n  FAILED: ${testKey} (${test.name}) — ${err.message}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 350));
    }
  }
  console.log(`\n  Done: ${created} test definitions created.`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Creating Task & Test Definition Notion Databases ===\n");

  // Find parent
  let parentPageId;
  try {
    parentPageId = await getParentPageId();
    console.log("Using parent page:", parentPageId);
  } catch (err) {
    console.error("Could not find parent page:", err.message);
    process.exit(1);
  }

  // Create databases
  const taskDbId = await createTaskDefsDb(parentPageId);
  const testDbId = await createTestDefsDb(parentPageId);

  console.log("\n=== Database IDs (add to ENV_OVERRIDES) ===");
  console.log(`NOTION_TASKS_DATABASE_ID: "${taskDbId}"`);
  console.log(`NOTION_TESTS_DATABASE_ID: "${testDbId}"`);

  // Populate
  await populateTaskDefs(taskDbId);
  await populateTestDefs(testDbId);

  console.log("\n=== Migration Complete ===");
  console.log(`Task Definitions DB: ${taskDbId}`);
  console.log(`Test Definitions DB: ${testDbId}`);
  console.log("\nNext steps:");
  console.log("1. Add NOTION_TASKS_DATABASE_ID and NOTION_TESTS_DATABASE_ID to env.ts ENV_OVERRIDES");
  console.log("2. Create MySQL cache tables (taskDefinitions, testDefinitions)");
  console.log("3. Update routers to read from MySQL cache");
}

main().catch(err => { console.error(err); process.exit(1); });
