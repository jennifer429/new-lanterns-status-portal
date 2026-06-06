import { Client } from "@notionhq/client";

// All 39 tasks from taskDefs.ts
const tasks = [
  // Network & Connectivity (5 tasks)
  { key: "network:vpn", title: "VPN Tunnel Configuration", description: "Site-to-site VPN established and verified", section: "network", sectionTitle: "Network & Connectivity", duration: "5–10 days", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)", sortOrder: 1 },
  { key: "network:firewall", title: "Firewall Rules & Port Openings", description: "All required ports open in both directions", section: "network", sectionTitle: "Network & Connectivity", duration: "5–10 days", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card", sortOrder: 2 },
  { key: "network:dicom-t", title: "DICOM Endpoint Testing (Test Env)", description: "C-ECHO success from all AE titles in test environment", section: "network", sectionTitle: "Network & Connectivity", duration: "5–10 days", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card", sortOrder: 3 },
  { key: "network:dicom-p", title: "DICOM Endpoint Testing (Production)", description: "C-ECHO success from all AE titles in production environment", section: "network", sectionTitle: "Network & Connectivity", duration: "5–10 days", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card", sortOrder: 4 },
  { key: "network:hl7-port", title: "HL7 Port Configuration", description: "HL7 listener ports configured and ACK responses confirmed", section: "network", sectionTitle: "Network & Connectivity", duration: "5–10 days", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card", sortOrder: 5 },
  // HL7 Interface Build (6 tasks)
  { key: "hl7:orm", title: "ORM Interface Configuration", description: "Order messages flowing from EHR to New Lantern", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows", sortOrder: 1 },
  { key: "hl7:oru", title: "ORU Interface Configuration", description: "Result/report messages returning from New Lantern to EHR", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows", sortOrder: 2 },
  { key: "hl7:adt", title: "ADT Interface Configuration", description: "Patient demographics updates flowing correctly", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows", sortOrder: 3 },
  { key: "hl7:oru-spec", title: "ORU Specification Review", description: "ORU spec reviewed and field mappings confirmed", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU / Specs (CF.3, CF.4)", sortOrder: 4 },
  { key: "hl7:orm-spec", title: "ORM Specification Review", description: "ORM spec reviewed and order fields mapped", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORM / Specs (CF.4, CF.5)", sortOrder: 5 },
  { key: "hl7:validate", title: "HL7 Message Validation", description: "All message types validated end-to-end", section: "hl7", sectionTitle: "HL7 Interface Build", duration: "7–14 days", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist", sortOrder: 6 },
  // System Configuration (5 tasks)
  { key: "config:proc", title: "Procedure Code Mapping", description: "All procedure codes loaded and mapped to modalities", section: "config", sectionTitle: "System Configuration", duration: "3–7 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Procedure Code List (CF.1)", sortOrder: 1 },
  { key: "config:users", title: "User Account Provisioning", description: "All user accounts created with correct roles", section: "config", sectionTitle: "System Configuration", duration: "3–7 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)", sortOrder: 2 },
  { key: "config:provider", title: "Provider Directory Upload", description: "Referring and reading physician directory loaded", section: "config", sectionTitle: "System Configuration", duration: "3–7 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Provider Directory (CF.6)", sortOrder: 3 },
  { key: "config:worklist", title: "Worklist Configuration", description: "Worklist filters, sorting, and display configured", section: "config", sectionTitle: "System Configuration", duration: "3–7 days", intakeLink: "/intake?section=hl7-dicom", intakeLinkLabel: "HL7 & DICOM Settings", sortOrder: 4 },
  { key: "config:sso", title: "SSO Active Directory Configuration", description: "Single Sign-On configured via Active Directory per SSO Instructions", section: "config", sectionTitle: "System Configuration", duration: "3–7 days", specLink: "/specs", specLinkLabel: "SSO Instructions", sortOrder: 5 },
  // Worklist & Templates (3 tasks)
  { key: "tmpl:worklist", title: "Worklist Filter Setup", description: "Filters by modality, body part, priority, and location", section: "templates", sectionTitle: "Worklist & Templates", duration: "3–5 days", sortOrder: 1 },
  { key: "tmpl:reports", title: "Report Template Configuration", description: "Report templates loaded and formatted correctly", section: "templates", sectionTitle: "Worklist & Templates", duration: "3–5 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU (CF.3)", sortOrder: 2 },
  { key: "tmpl:macros", title: "Macro & Auto-text Setup", description: "Radiologist macros and auto-text configured", section: "templates", sectionTitle: "Worklist & Templates", duration: "3–5 days", sortOrder: 3 },
  // Training & Go-Live Preparation (5 tasks)
  { key: "train:admin", title: "Admin Training", description: "System administration, user management, configuration changes", section: "training", sectionTitle: "Training & Go-Live Preparation", duration: "3–5 days", sortOrder: 1 },
  { key: "train:tech", title: "Tech Training", description: "Modality workflow, image QC, worklist operations", section: "training", sectionTitle: "Training & Go-Live Preparation", duration: "3–5 days", sortOrder: 2 },
  { key: "train:users", title: "User Setup", description: "All accounts provisioned, roles assigned, logins verified", section: "training", sectionTitle: "Training & Go-Live Preparation", duration: "3–5 days", intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)", sortOrder: 3 },
  { key: "train:downtime", title: "Downtime Workflow", description: "Team trained on paper backup, rerouting, and recovery", section: "training", sectionTitle: "Training & Go-Live Preparation", duration: "3–5 days", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)", sortOrder: 4 },
  { key: "train:troubleshoot", title: "Troubleshooting Workflows", description: "Escalation paths, common issues, support contacts documented", section: "training", sectionTitle: "Training & Go-Live Preparation", duration: "3–5 days", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Issue Escalation (L.10)", sortOrder: 5 },
  // End-to-End Testing (4 tasks)
  { key: "test:e2e", title: "Full Order-to-Report Workflow Test", description: "Complete cycle validated end-to-end", section: "testing", sectionTitle: "End-to-End Testing", duration: "5–7 days", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist", sortOrder: 1 },
  { key: "test:edge", title: "Edge Case Testing (STAT, Addendum, etc.)", description: "STAT priority, addendum, cancel, reschedule flows", section: "testing", sectionTitle: "End-to-End Testing", duration: "5–7 days", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist", sortOrder: 2 },
  { key: "test:perf", title: "Performance & Load Testing", description: "Performance confirmed at expected study volume", section: "testing", sectionTitle: "End-to-End Testing", duration: "5–7 days", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist", sortOrder: 3 },
  { key: "test:signoff", title: "Go-Live Readiness Sign-Off", description: "All parties signed off on readiness", section: "testing", sectionTitle: "End-to-End Testing", duration: "5–7 days", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist", sortOrder: 4 },
  // Production Data Validation (11 tasks)
  { key: "prod:start", title: "Begin Live Production Data Flow", description: "Production data flowing into New Lantern", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 1 },
  { key: "prod:data-quality", title: "Data Quality Review", description: "Study and report completeness and accuracy verified", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 2 },
  { key: "prod:timeliness", title: "Timeliness Audit", description: "Studies and reports flowing within agreed SLAs", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 3 },
  { key: "prod:normal-wf", title: "Normal Workflow Sign-Off", description: "Standard order → image → report cycle validated", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 4 },
  { key: "prod:stat", title: "STAT & Priority Routing", description: "STAT and priority routing verified end-to-end", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 5 },
  { key: "prod:addendum", title: "Addendum & Correction Workflow", description: "Addendum and correction workflow validated", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 6 },
  { key: "prod:cancel", title: "Order Cancellation", description: "Cancellation and worklist removal confirmed", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 7 },
  { key: "prod:downtime", title: "Downtime / Reconnect", description: "Queued studies process correctly after reconnect", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)", sortOrder: 8 },
  { key: "prod:volume", title: "Volume & Load Confirmation", description: "Performance confirmed at full production volume", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 9 },
  { key: "prod:adjustments", title: "Issue Documentation & Remediation", description: "All issues found during validation documented and resolved", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 10 },
  { key: "prod:golive", title: "2-Week Validation Complete", description: "Approved for full go-live", section: "prod-validation", sectionTitle: "Production Data Validation (2 Weeks)", duration: "14 days minimum", sortOrder: 11 },
];

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = "20145e64-99de-4436-829e-e8b70de1bed0";

async function createPages() {
  let created = 0;
  let failed = 0;
  
  for (const task of tasks) {
    try {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Title: { title: [{ text: { content: task.title } }] },
          Key: { rich_text: [{ text: { content: task.key } }] },
          Description: { rich_text: [{ text: { content: task.description } }] },
          Section: { select: { name: task.section } },
          "Section Title": { rich_text: [{ text: { content: task.sectionTitle } }] },
          Duration: { rich_text: [{ text: { content: task.duration } }] },
          "Sort Order": { number: task.sortOrder },
          "Intake Link": { rich_text: task.intakeLink ? [{ text: { content: task.intakeLink } }] : [] },
          "Intake Link Label": { rich_text: task.intakeLinkLabel ? [{ text: { content: task.intakeLinkLabel } }] : [] },
          "Spec Link": { rich_text: task.specLink ? [{ text: { content: task.specLink } }] : [] },
          "Spec Link Label": { rich_text: task.specLinkLabel ? [{ text: { content: task.specLinkLabel } }] : [] },
          Active: { checkbox: true },
        },
      });
      created++;
      console.log(`✓ Created: ${task.title}`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed: ${task.title}`, error.message);
    }
    
    // Rate limit: 3 requests per second
    await new Promise(resolve => setTimeout(resolve, 333));
  }
  
  console.log(`\n✓ Created: ${created}/${tasks.length}`);
  if (failed > 0) console.log(`✗ Failed: ${failed}`);
}

createPages().catch(console.error);
