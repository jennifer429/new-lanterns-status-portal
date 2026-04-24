export interface TaskDef {
  id: string;
  title: string;
  description?: string;
  intakeLink?: string;
  intakeLinkLabel?: string;
  specLink?: string;
  specLinkLabel?: string;
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
      { id: "network:vpn",      title: "Configure VPN Tunnel",                description: "Establish and verify site-to-site VPN",                          intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)" },
      { id: "network:firewall", title: "Open Firewall Ports",                 description: "Open required ports in both directions",                         intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:hl7-port", title: "Configure HL7 Listener Ports",        description: "Configure HL7 listeners and confirm ACK responses",              intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom",    title: "Test DICOM Connectivity",             description: "Confirm C-ECHO success from all AE titles (test and prod)",      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
    ],
  },
  {
    id: "hl7",
    title: "HL7 Interface Build",
    duration: "7–14 days",
    tasks: [
      { id: "hl7:orm",       title: "Build ORM Interface",          description: "Configure order message flow from EHR to New Lantern",       intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru",       title: "Build ORU Interface",          description: "Configure result/report message flow back to EHR",           intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:adt",       title: "Build ADT Interface",          description: "Configure patient demographics updates",                     intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:validate",  title: "Validate HL7 Messages",        description: "Validate all HL7 message types end-to-end",                  intakeLink: "/validation",                           intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "config",
    title: "System Configuration",
    duration: "3–7 days",
    tasks: [
      { id: "config:proc",     title: "Map Procedure Codes",          description: "Load and map procedure codes to modalities",               intakeLink: "/intake?section=config-files", intakeLinkLabel: "Procedure Code List (CF.1)" },
      { id: "config:users",    title: "Provision User Accounts",      description: "Create user accounts with correct roles",                  intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "config:provider", title: "Upload Provider Directory",    description: "Load referring and reading physician directory",           intakeLink: "/intake?section=config-files", intakeLinkLabel: "Provider Directory (CF.6)" },
      { id: "config:worklist", title: "Configure Worklist",           description: "Set up worklist filters, sorting, and display",            intakeLink: "/intake?section=hl7-dicom",    intakeLinkLabel: "HL7 & DICOM Settings" },
      { id: "config:sso",      title: "Configure SSO",                description: "Set up Single Sign-On via Active Directory",               specLink: "/specs", specLinkLabel: "SSO Instructions" },
    ],
  },
  {
    id: "templates",
    title: "Worklist & Templates",
    duration: "3–5 days",
    tasks: [
      { id: "tmpl:worklist", title: "Set Up Worklist Filters",        description: "Filter by modality, body part, priority, and location" },
      { id: "tmpl:reports",  title: "Configure Report Templates",     description: "Load and format report templates",                         intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU (CF.3)" },
      { id: "tmpl:macros",   title: "Set Up Macros & Auto-text",      description: "Configure radiologist macros and auto-text" },
    ],
  },
  {
    id: "training",
    title: "Training & Go-Live Preparation",
    duration: "3–5 days",
    tasks: [
      { id: "train:admin",         title: "Train Admins",              description: "System administration, user management, configuration" },
      { id: "train:tech",          title: "Train Techs",               description: "Modality workflow, image QC, worklist operations" },
      { id: "train:users",         title: "Train End Users",           description: "Provision accounts, assign roles, verify logins",              intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "train:downtime",      title: "Train Downtime Workflow",   description: "Paper backup, rerouting, and recovery procedures",             intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "train:troubleshoot",  title: "Document Troubleshooting",  description: "Escalation paths, common issues, support contacts",            intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Issue Escalation (L.10)" },
    ],
  },
  {
    id: "testing",
    title: "End-to-End Testing",
    duration: "5–7 days",
    tasks: [
      { id: "test:e2e", title: "Perform End-to-End Testing", description: "Run full order-to-report workflow, edge cases, and performance checks", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "prod-validation",
    title: "Production Validation & Go-Live",
    duration: "14 days minimum",
    tasks: [
      { id: "prod:validate", title: "Perform Production Validation", description: "Run 2-week live production validation across normal, STAT, addendum, and downtime flows" },
      { id: "prod:golive",   title: "Go-Live Sign-Off",              description: "Confirm all validation complete and approve for full go-live" },
    ],
  },
];

export const ALL_TASK_IDS = SECTION_DEFS.flatMap(s => s.tasks.map(t => t.id));
export const TOTAL_TASK_COUNT = ALL_TASK_IDS.length;
