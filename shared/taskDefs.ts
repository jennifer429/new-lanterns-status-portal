export interface TaskDef {
  id: string;
  title: string;
  description?: string;
  intakeLink?: string;
  intakeLinkLabel?: string;
}

export interface SectionDef {
  id: string;
  title: string;
  duration: string;
  tasks: TaskDef[];
}

export const SECTION_DEFS: SectionDef[] = [
  {
    id: "network",
    title: "Network & Connectivity",
    duration: "5–10 days",
    tasks: [
      { id: "network:vpn",      title: "VPN Tunnel Configuration",            description: "Site-to-site VPN established and verified",                       intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)" },
      { id: "network:firewall", title: "Firewall Rules & Port Openings",       description: "All required ports open in both directions",                      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-t",  title: "DICOM Endpoint Testing (Test Env)",   description: "C-ECHO success from all AE titles in test environment",           intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-p",  title: "DICOM Endpoint Testing (Production)", description: "C-ECHO success from all AE titles in production environment",      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:hl7-port", title: "HL7 Port Configuration",              description: "HL7 listener ports configured and ACK responses confirmed",        intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
    ],
  },
  {
    id: "hl7",
    title: "HL7 Interface Build",
    duration: "7–14 days",
    tasks: [
      { id: "hl7:orm",       title: "ORM Interface Configuration",   description: "Order messages flowing from EHR to New Lantern",          intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru",       title: "ORU Interface Configuration",   description: "Result/report messages returning from New Lantern to EHR", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:adt",       title: "ADT Interface Configuration",   description: "Patient demographics updates flowing correctly",           intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru-spec",  title: "ORU Specification Review",      description: "ORU spec reviewed and field mappings confirmed",           intakeLink: "/intake?section=config-files",          intakeLinkLabel: "Sample ORU / Specs (CF.3, CF.4)" },
      { id: "hl7:orm-spec",  title: "ORM Specification Review",      description: "ORM spec reviewed and order fields mapped",               intakeLink: "/intake?section=config-files",          intakeLinkLabel: "Sample ORM / Specs (CF.4, CF.5)" },
      { id: "hl7:validate",  title: "HL7 Message Validation",        description: "All message types validated end-to-end",                  intakeLink: "/validation",                           intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "config",
    title: "System Configuration",
    duration: "3–7 days",
    tasks: [
      { id: "config:proc",     title: "Procedure Code Mapping",      description: "All procedure codes loaded and mapped to modalities",      intakeLink: "/intake?section=config-files", intakeLinkLabel: "Procedure Code List (CF.1)" },
      { id: "config:users",    title: "User Account Provisioning",   description: "All user accounts created with correct roles",             intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "config:provider", title: "Provider Directory Upload",   description: "Referring and reading physician directory loaded",         intakeLink: "/intake?section=config-files", intakeLinkLabel: "Provider Directory (CF.6)" },
      { id: "config:worklist", title: "Worklist Configuration",      description: "Worklist filters, sorting, and display configured",        intakeLink: "/intake?section=hl7-dicom",    intakeLinkLabel: "HL7 & DICOM Settings" },
    ],
  },
  {
    id: "templates",
    title: "Worklist & Templates",
    duration: "3–5 days",
    tasks: [
      { id: "tmpl:worklist", title: "Worklist Filter Setup",          description: "Filters by modality, body part, priority, and location" },
      { id: "tmpl:reports",  title: "Report Template Configuration",  description: "Report templates loaded and formatted correctly",  intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU (CF.3)" },
      { id: "tmpl:macros",   title: "Macro & Auto-text Setup",        description: "Radiologist macros and auto-text configured" },
    ],
  },
  {
    id: "training",
    title: "Training & Go-Live Preparation",
    duration: "3–5 days",
    tasks: [
      { id: "train:admin",         title: "Admin Training",          description: "System administration, user management, configuration changes" },
      { id: "train:tech",          title: "Tech Training",           description: "Modality workflow, image QC, worklist operations" },
      { id: "train:users",         title: "User Setup",              description: "All accounts provisioned, roles assigned, logins verified",    intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "train:downtime",      title: "Downtime Workflow",       description: "Team trained on paper backup, rerouting, and recovery",        intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "train:troubleshoot",  title: "Troubleshooting Workflows", description: "Escalation paths, common issues, support contacts documented", intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Issue Escalation (L.10)" },
    ],
  },
  {
    id: "testing",
    title: "End-to-End Testing",
    duration: "5–7 days",
    tasks: [
      { id: "test:e2e",     title: "Full Order-to-Report Workflow Test",       description: "Complete cycle validated end-to-end",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:edge",    title: "Edge Case Testing (STAT, Addendum, etc.)", description: "STAT priority, addendum, cancel, reschedule flows", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:perf",    title: "Performance & Load Testing",               description: "Performance confirmed at expected study volume",     intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:signoff", title: "Go-Live Readiness Sign-Off",               description: "All parties signed off on readiness",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "prod-validation",
    title: "Production Data Validation (2 Weeks)",
    duration: "14 days minimum",
    tasks: [
      { id: "prod:start",        title: "Begin Live Production Data Flow",    description: "Production data flowing into New Lantern" },
      { id: "prod:data-quality", title: "Data Quality Review",                description: "Study and report completeness and accuracy verified" },
      { id: "prod:timeliness",   title: "Timeliness Audit",                   description: "Studies and reports flowing within agreed SLAs" },
      { id: "prod:normal-wf",    title: "Normal Workflow Sign-Off",           description: "Standard order → image → report cycle validated" },
      { id: "prod:stat",         title: "STAT & Priority Routing",            description: "STAT and priority routing verified end-to-end" },
      { id: "prod:addendum",     title: "Addendum & Correction Workflow",     description: "Addendum and correction workflow validated" },
      { id: "prod:cancel",       title: "Order Cancellation",                 description: "Cancellation and worklist removal confirmed" },
      { id: "prod:downtime",     title: "Downtime / Reconnect",               description: "Queued studies process correctly after reconnect", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "prod:volume",       title: "Volume & Load Confirmation",         description: "Performance confirmed at full production volume" },
      { id: "prod:adjustments",  title: "Issue Documentation & Remediation",  description: "All issues found during validation documented and resolved" },
      { id: "prod:golive",       title: "2-Week Validation Complete",         description: "Approved for full go-live" },
    ],
  },
];

export const ALL_TASK_IDS = SECTION_DEFS.flatMap(s => s.tasks.map(t => t.id));
export const TOTAL_TASK_COUNT = ALL_TASK_IDS.length;
