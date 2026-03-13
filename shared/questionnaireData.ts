/**
 * Radiology One New Site Onboarding Questionnaire
 * 4 sections: Organization Info, Integration Workflows, Connectivity, HL7 & DICOM Data
 * Note: Architecture/Systems inventory is now part of Integration Workflows
 * Note: Router = Integration 3rd Party Router for all overlay situations
 */

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'dropdown' | 'date' | 'multi-select' | 'upload' | 'upload-download' | 'contacts-table' | 'systems-list';
  options?: string[];
  notes?: string;
  placeholder?: string;
  templateUrl?: string; // For upload-download questions: URL to download template
  templateFileName?: string; // Display name for template download
  partnerTemplates?: { [clientId: number]: { url: string; fileName: string } }; // Partner-specific templates
  conditionalOn?: { questionId: string; value: string }; // Show this question only if another question has specific value
  inactive?: boolean; // If true, question is hidden from the UI
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions?: Question[]; // Optional for workflow sections
  type?: 'standard' | 'workflow' | 'integration-workflows' | 'architecture-overview' | 'connectivity-table'; // workflow sections use WorkflowDiagram component, connectivity-table renders editable endpoint table
  workflowType?: 'orders' | 'images' | 'priors' | 'reports'; // which workflow to render
}

export const questionnaireSections: Section[] = [
  {
    id: 'org-info',
    title: 'Organization Info',
    description: 'Sites, contacts, and testing timelines',
    questions: [
      { id: 'H.1', text: 'Number of sites/locations (this determines how many VPN tunnels need to be built)', type: 'text', placeholder: 'Enter number of sites' },
      { id: 'H.2', text: 'Site names and identifiers', type: 'textarea', placeholder: 'List all site names and IDs' },
      { id: 'H.3', text: 'Site-specific user access restrictions', type: 'textarea', placeholder: 'Document any access restrictions by site' },
      {
        id: 'A.contacts',
        text: 'Contacts',
        type: 'contacts-table',
        notes: 'All fields are optional — the block counts as complete once any field is filled. Rows: Administrative (A.1), IT Connectivity (A.2), IT Post-Production Support, Clinical (A.3), Radiologist Champion (A.4), Project Manager (A.5).',
      },
      { id: 'A.6', text: 'Is a security questionnaire required?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.6.1', text: 'Please provide details on how and when you plan to share the security questionnaire (link, email, timeline)', type: 'textarea', placeholder: 'Example: We will send the questionnaire via email to security@newlantern.ai by [date]. Link to our security portal: https://...', conditionalOn: { questionId: 'A.6', value: 'Yes' } },
      { id: 'L.2', text: 'Test patient data requirements', type: 'textarea', placeholder: 'Document test patient data needs' },
      { id: 'L.3', text: 'Test study requirements', type: 'textarea', placeholder: 'Document test study requirements' },
      { id: 'L.4', text: 'Please share any timeline requirements or expectations you have around implementation, testing, and going live so we can coordinate resources', type: 'textarea', placeholder: 'Example: Our current PACS system is being decommissioned June 30th. Contract requires go-live by Q2 2026. Prefer 2 weeks for integration testing, 1 week for UAT.' },
      { id: 'L.8', text: 'Go-live support requirements', type: 'textarea', placeholder: 'Document go-live support needs' },
      { id: 'L.9', text: 'Post go-live monitoring requirements', type: 'textarea', placeholder: 'Document post go-live monitoring' },
      { id: 'L.10', text: 'Issue escalation process', type: 'textarea', placeholder: 'Document escalation process' },
      { id: 'L.11', text: 'Downtime Plans - Please describe how your organization handles downtimes planned and unplanned that impact orders and reports or backup reading', type: 'textarea', placeholder: 'Example: During planned maintenance windows (announced 2 weeks in advance), we route orders to backup PACS. For unplanned outages, we have 4-hour SLA for critical systems and maintain paper backup procedures for order entry.' },
    ],
  },
  {
    id: 'architecture',
    type: 'architecture-overview',
    title: 'Integration Workflows',
    description: 'Define your systems and how data flows between them',
    questions: [
      { id: 'ARCH.diagram', text: 'Architecture Diagram', type: 'upload', notes: 'Accepted formats: PNG, JPG, PDF' },
      { id: 'ARCH.systems', text: 'Systems in Your Environment', type: 'systems-list' },
      // Legacy fields - kept for data compatibility but hidden from new UI
      { id: 'ARCH.1', text: 'PACS system (vendor and product name)', type: 'text', placeholder: 'e.g., Sectra IDS7, Philips IntelliSpace, Agfa IMPAX', inactive: true },
      { id: 'ARCH.2', text: 'RIS system (vendor and product name)', type: 'text', placeholder: 'e.g., Epic Radiant, Cerner RadNet, Meditech', inactive: true },
      { id: 'ARCH.3', text: 'EMR / EHR system (vendor and product name)', type: 'text', placeholder: 'e.g., Epic, Cerner, Athenahealth, eClinicalWorks', inactive: true },
      { id: 'ARCH.4', text: 'Interface Engine / Middleware (if applicable)', type: 'text', placeholder: 'e.g., Mirth Connect, Rhapsody, Iguana, Infor Cloverleaf', inactive: true },
      { id: 'ARCH.5', text: 'Additional systems (VNA, AI platforms, cardiology PACS, dose tracking, etc.)', type: 'textarea', placeholder: 'List any other systems relevant to the integration, including vendor names and their roles', inactive: true },
    ],
  },
  {
    id: 'integration-workflows',
    type: 'integration-workflows',
    title: 'Integration Workflows',
    description: 'Workflow descriptions for orders, images, priors, and reports',
    questions: [
      { id: 'IW.orders_description', text: 'Orders Workflow: Describe how imaging orders reach the platform', type: 'textarea', placeholder: 'e.g., Orders originate in Epic, sent via HL7 ORM through Mirth Connect to New Lantern...' },
      { id: 'IW.images_description', text: 'Images Workflow: Describe how imaging studies are routed', type: 'textarea', placeholder: 'e.g., Studies acquired on modalities (CT, MR, XR) and sent via DICOM C-STORE to PACS, then forwarded to New Lantern...' },
      { id: 'IW.priors_description', text: 'Priors Workflow: Describe how prior studies are retrieved', type: 'textarea', placeholder: 'e.g., New Lantern queries prior PACS via C-FIND/C-MOVE for relevant prior studies when a new order arrives...' },
      { id: 'IW.reports_description', text: 'Reports Workflow: Describe how reports are delivered back', type: 'textarea', placeholder: 'e.g., Finalized reports sent via HL7 ORU through Mirth Connect back to Epic Radiant...' },
    ],
  },
  {
    id: 'connectivity',
    title: 'Connectivity',
    description: 'VPN setup, network endpoints, and required configuration file uploads (IMPORTANT: Please de-identify all files before uploading)',
    type: 'connectivity-table',
    questions: [
      // D.1 moved here from HL7 & DICOM section
      { id: 'D.1', text: 'Can production systems be configured for testing prior to go-live?', type: 'dropdown', options: ['Yes', 'No'] },
      // VPN form
      {
        id: 'E.1',
        text: 'VPN form exchange: Download the VPN form template, complete it with your network details, and upload.',
        type: 'upload-download',
        notes: 'Required: Site-to-site VPN details, IP ranges, firewall rules, contact info. Rad One clients use the standard template. SRV clients require a separate form.',
        templateFileName: 'VPN Form Template',
      },
      // Old E.2-E.6.1 endpoint textareas replaced by connectivity table (rendered in UI component)
      // Configuration File Uploads
      { id: 'CF.1', text: 'Procedure code list: Please upload your list of all procedure codes with modality that you will be sending in the order message.', type: 'upload-download', notes: 'Required: Procedure code, Description, Modality. Optional: CPT, Body part, Subspecialty', templateFileName: 'Procedure Code List Template' },
      { id: 'CF.2', text: 'User list: Please upload a file of all users and their roles.', type: 'upload-download', notes: 'Required: User email, User name, Role (Admin/PACS Admin/Tech)', templateFileName: 'User List Template' },
      { id: 'CF.3', text: 'Sample ORU report: Please upload a sample ORU report showing the expected format we will send to you', type: 'upload' },
      { id: 'CF.4', text: 'ORM/ORU specifications: Please upload your ORM specification and ORU specification if sending to New Lantern', type: 'upload' },
      { id: 'CF.5', text: 'Sample ORM report: Please upload a sample ORM report showing the expected format you will be sending', type: 'upload' },
      { id: 'CF.6', text: 'Provider Directory: Please upload your provider directory listing all referring and reading physicians', type: 'upload-download', notes: 'Required: Provider name, NPI, Specialty. Download the template below, complete it, and upload.', templateFileName: 'Provider Directory Template' },
    ],
  },
  {
    id: 'hl7-dicom',
    title: 'HL7 & DICOM Data',
    description: 'Data exchange configuration, modalities, go-live details, and HL7 message field values',
    questions: [
      // D.1 moved to Connectivity section
      { id: 'D.2', text: 'Requested go-live date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { id: 'D.3', text: 'Expected modalities', type: 'multi-select', options: ['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Nuclear Medicine', 'Mammography'] },
      // D.7 (Historic Reports method) moved to Integration Workflows → Historic Results block
      // D.8 (Tech sheets input method) moved to Integration Workflows → Tech Sheets block
      { id: 'D.9', text: 'Are there DICOM SR or other data sources for auto-populating fields? Also, will your HL7 messages include tokens/segments carrying clinical data such as medications (RXA/RXE), patient history (AL1 for allergies, DG1 for diagnoses), or other clinical context? If so, please describe which segments and what data they contain.', type: 'textarea', placeholder: 'List DICOM SR sources and describe any HL7 segments carrying clinical data (e.g., RXA for medications, AL1 for allergies, DG1 for diagnoses, OBX for clinical observations)' },
      { id: 'D.10', text: 'What are the HL7 priority values in your orders (OBR:27.1) and what do they mean?', type: 'textarea', placeholder: 'Example: S=Stat, R=Routine' },
      { id: 'D.11', text: 'What patient identifier do you use for matching (e.g. MRN) and is it in PID:3.1?', type: 'textarea', placeholder: 'Document patient identifier field' },
      { id: 'D.12', text: 'Is the patient identifier in your order the same as in prior reports and comparison images?', type: 'textarea', placeholder: 'Yes/No and explain any differences' },
      { id: 'D.13', text: 'Please document DICOM tag 0008,1040 value and corresponding PV1:11 value for matching (Note: DICOM tagging is handled by the Router / Integration 3rd Party, not client sites)', type: 'textarea', placeholder: 'Document tag values for patient matching' },
      // HL7 message field values
      { id: 'G.3', text: 'ORC-1 (Order Control) - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: NW = New order, CA = Cancel order, XO = Change order, etc.' },
      { id: 'G.4', text: 'ORC-5 (Order Status) - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: SC = In process/scheduled, CM = Complete, CA = Canceled, etc.' },
      { id: 'G.5', text: 'OBR:27.1 (Quantity/Timing) in ORU messages - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: STAT = Urgent/immediate, ROUTINE = Normal priority, ASAP = As soon as possible, etc.' },
      { id: 'G.6', text: 'Please share what values you send for Patient Class (PV1:2) and what each means', type: 'textarea', placeholder: 'Example: E = Emergency, I = Inpatient, O = Outpatient, P = Preadmit, R = Recurring, etc.' },
      { id: 'G.7', text: 'Please share what values you send for Patient Location (PV1:3) - Optional but useful', type: 'textarea', placeholder: 'Example: MAIN^3RD^302A = Main building, 3rd floor, room 302A\nEAST^RAD^CT1 = East wing, Radiology, CT Scanner 1\n\nLeave blank if not applicable' },
    ],
  },
];

// Total questions count
export const TOTAL_QUESTIONS = questionnaireSections.reduce(
  (sum, section) => sum + (section.questions?.length || 0),
  0
);

// Legacy export for backward compatibility
export const questionnaireData = questionnaireSections;
