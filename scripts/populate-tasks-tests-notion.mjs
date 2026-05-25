#!/usr/bin/env node
/**
 * Populate Task Definitions and Test Definitions Notion databases
 * with existing hardcoded data from taskDefs.ts and Validation.tsx.
 */
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
const TASKS_DB_ID = "0c6fc19c-9422-472b-a44e-c140df00b621";
const TESTS_DB_ID = "a1e174e5-c7a4-45eb-8601-3f2a497f102e";

const notion = new Client({ auth: NOTION_API_KEY });

// ─── Task Definitions ────────────────────────────────────────────────────────
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

// ─── Test Definitions ────────────────────────────────────────────────────────
const TEST_PHASES = [
  {
    title: "Connectivity Validation",
    tests: [
      { name: "VPN Tunnel Connectivity", description: "Verify bidirectional connectivity through VPN tunnel", relatedQuestions: "E.1 (VPN Form), H.1 (Number of Sites)" },
      { name: "DICOM Echo Test (C-ECHO)", description: "Confirm C-ECHO success from all AE titles", relatedQuestions: "ARCH.systems (Systems Inventory), CONN.endpoints (Endpoints)" },
      { name: "HL7 Port Connectivity", description: "Verify ACK received on all configured HL7 ports", relatedQuestions: "CONN.endpoints (Endpoints)" },
      { name: "SSO / Active Directory Authentication", description: "Verify Single Sign-On via Active Directory", relatedQuestions: "CF.2 (User List)" },
    ],
  },
  {
    title: "HL7 Message Validation",
    tests: [
      { name: "ORM New Order (NW)", description: "Send a new order and verify it appears in worklist", relatedQuestions: "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values)" },
      { name: "ORM Cancel Order (CA)", description: "Cancel an order and verify removal from worklist", relatedQuestions: "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values)" },
      { name: "ORU Report Delivery", description: "Verify report delivered to EHR via ORU", relatedQuestions: "IW.reports_description (Reports Workflow), CF.3 (Sample ORU)" },
      { name: "ADT Patient Update", description: "Update patient demographics and verify propagation", relatedQuestions: "IW.demographics_description (Demographics Workflow)" },
      { name: "Priority Routing (STAT)", description: "Verify STAT priority routes correctly", relatedQuestions: "D.10 (Priority Values), IW.orders_description (Orders Workflow)" },
    ],
  },
  {
    title: "Image Routing Validation",
    tests: [
      { name: "DICOM Store from Modality", description: "Verify images store successfully from modality", relatedQuestions: "ARCH.systems (Systems Inventory), CONN.endpoints (Endpoints)" },
      { name: "Prior Image Query/Retrieve", description: "Verify prior studies retrievable for comparison", relatedQuestions: "IW.priors_description (Priors Workflow), D.12 (ID Matching)" },
      { name: "Worklist (MWL) Query", description: "Verify scheduled exams returned via modality worklist", relatedQuestions: "ARCH.systems (Systems Inventory)" },
      { name: "AI Routing (if applicable)", description: "Verify images routed to AI engine if configured", relatedQuestions: "ARCH.systems (Systems Inventory), D.9 (DICOM SR / Clinical Data)" },
    ],
  },
  {
    title: "User Acceptance Testing",
    tests: [
      { name: "End-to-End Order Workflow", description: "Complete cycle: Order → Image → Report", relatedQuestions: "IW.orders_description (Orders Workflow), IW.images_description (Images Workflow), IW.reports_description (Reports Workflow)" },
      { name: "Radiologist Reading Workflow", description: "Study opens, report dictated and signed", relatedQuestions: "CF.1 (Procedure Codes), CF.2 (User List)" },
      { name: "Tech QC Workflow", description: "Tech can reject/accept images", relatedQuestions: "CF.2 (User List)" },
      { name: "Report Distribution", description: "Final report reaches referring provider", relatedQuestions: "CF.6 (Provider Directory), IW.reports_description (Reports Workflow)" },
      { name: "STAT Escalation Path", description: "Critical results alert fires correctly", relatedQuestions: "D.10 (Priority Values)" },
      { name: "Downtime Recovery", description: "Queued studies process after reconnect", relatedQuestions: "L.11 (Downtime Plans), L.8 (Go-Live Support)" },
      { name: "Reschedule a Study", description: "Reschedule an existing order — verify worklist updates", relatedQuestions: "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values)" },
      { name: "Cancel a Study", description: "Cancel a scheduled study — verify removal from worklist", relatedQuestions: "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values), G.4 (ORC-5 Values)" },
      { name: "End-to-End Study Completion", description: "Full study: order → check-in → images → QC → read → sign → deliver", relatedQuestions: "IW.orders_description (Orders Workflow), IW.images_description (Images Workflow), IW.reports_description (Reports Workflow), CF.1 (Procedure Codes)" },
      { name: "Addendum Workflow", description: "Add addendum to signed report — verify versioned ORU sent", relatedQuestions: "IW.reports_description (Reports Workflow), CF.3 (Sample ORU)" },
      { name: "CT Dose & Tech Sheet Integration", description: "Verify CT dose data and tech sheet populate correctly", relatedQuestions: "IW.images_description (Images Workflow), D.9 (DICOM SR / Clinical Data)" },
      { name: "BI-RADS Custom Report Insertion", description: "Verify BI-RADS assessment inserts into mammography reports", relatedQuestions: "IW.reports_description (Reports Workflow), CF.3 (Sample ORU)" },
      { name: "Lung-RADS / Lung CA Mapping", description: "Verify Lung-RADS structured reporting populates correctly", relatedQuestions: "IW.reports_description (Reports Workflow), CF.3 (Sample ORU)" },
      { name: "Study Merge", description: "Merge two separate studies into one — verify combined images", relatedQuestions: "IW.images_description (Images Workflow)" },
      { name: "Study Split", description: "Break apart a merged study — verify images route to correct orders", relatedQuestions: "IW.images_description (Images Workflow), IW.orders_description (Orders Workflow)" },
    ],
  },
];

// ─── Helper: create page ─────────────────────────────────────────────────────
async function createPage(databaseId, properties) {
  const props = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) continue;
    if (key === "Title" || key === "Name") {
      // The title property is called 'Name' in both databases
      props["Name"] = { title: [{ text: { content: String(value) } }] };
    } else if (key === "Active") {
      props[key] = { checkbox: value };
    } else if (key === "Sort Order") {
      props[key] = { number: value };
    } else if (key === "Section" || key === "Phase") {
      props[key] = { select: { name: String(value) } };
    } else {
      props[key] = { rich_text: [{ text: { content: String(value) } }] };
    }
  }

  return notion.pages.create({
    parent: { database_id: databaseId },
    properties: props,
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Populating Task Definitions ===");
  let sortOrder = 1;
  let taskCount = 0;
  for (const section of SECTION_DEFS) {
    for (const task of section.tasks) {
      try {
        await createPage(TASKS_DB_ID, {
          Title: task.title,
          Key: task.id,
          Description: task.description || "",
          Section: section.id,
          "Section Title": section.title,
          Duration: section.duration,
          "Intake Link": task.intakeLink || "",
          "Intake Link Label": task.intakeLinkLabel || "",
          "Spec Link": task.specLink || "",
          "Spec Link Label": task.specLinkLabel || "",
          Active: true,
          "Sort Order": sortOrder,
        });
        console.log(`  ✓ [${sortOrder}] ${task.id}: ${task.title}`);
        sortOrder++;
        taskCount++;
      } catch (err) {
        console.error(`  ✗ ${task.id}: ${err.message}`);
      }
      // Rate limit: 3 requests/sec
      await new Promise(r => setTimeout(r, 350));
    }
  }
  console.log(`\nTask Definitions: ${taskCount} rows created.\n`);

  console.log("=== Populating Test Definitions ===");
  let testSortOrder = 1;
  let testCount = 0;
  for (let phaseIdx = 0; phaseIdx < TEST_PHASES.length; phaseIdx++) {
    const phase = TEST_PHASES[phaseIdx];
    for (let testIdx = 0; testIdx < phase.tests.length; testIdx++) {
      const test = phase.tests[testIdx];
      const key = `${phaseIdx}:${testIdx}`;
      try {
        await createPage(TESTS_DB_ID, {
          Name: test.name,
          Key: key,
          Description: test.description || "",
          Phase: phase.title,
          "Related Questions": test.relatedQuestions || "",
          Active: true,
          "Sort Order": testSortOrder,
        });
        console.log(`  ✓ [${testSortOrder}] ${key}: ${test.name}`);
        testSortOrder++;
        testCount++;
      } catch (err) {
        console.error(`  ✗ ${key}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 350));
    }
  }
  console.log(`\nTest Definitions: ${testCount} rows created.`);
  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
