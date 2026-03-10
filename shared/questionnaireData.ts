/**
 * Radiology One New Site Onboarding Questionnaire
 * 6 sections (5 standard + 1 integration workflows), 51 total questions
 * Note: Router = Integration 3rd Party Router for all overlay situations
 */

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'dropdown' | 'date' | 'multi-select' | 'upload' | 'upload-download';
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
  type?: 'standard' | 'workflow' | 'integration-workflows'; // New: workflow sections use WorkflowDiagram component
  workflowType?: 'orders' | 'images' | 'priors' | 'reports'; // New: which workflow to render
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
      { id: 'A.1', text: 'Administrative point(s) of contact', type: 'textarea', placeholder: 'Name, title, email, phone' },
      { id: 'A.2', text: 'IT point(s) of contact - Connectivity & Systems', type: 'textarea', placeholder: 'Name, title, email, phone' },
      { id: 'A.3', text: 'Clinical contact(s) - Technologist/Clinical Informatics', type: 'textarea', placeholder: 'Name, title, email, phone' },
      { id: 'A.4', text: 'Radiologist champion(s)', type: 'textarea', placeholder: 'Name, title, email, phone' },
      { id: 'A.5', text: 'Project manager (if applicable)', type: 'textarea', placeholder: 'Name, title, email, phone' },
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
    id: 'data-integration',
    title: 'Data & Integration',
    description: 'Data exchange and integration configuration',
    questions: [
      { id: 'D.1', text: 'Can production systems be configured for testing prior to go-live?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'D.2', text: 'Requested go-live date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { id: 'D.3', text: 'Expected modalities', type: 'multi-select', options: ['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Nuclear Medicine', 'Mammography'] },

      { id: 'D.7', text: 'Method for Historic Reports Data load', type: 'dropdown', options: ['HL7 messages bulk sent prior to go-live', 'Pipe delimited flat file (3-4 weeks lead time)', 'Automatically with images - Reports sent as DICOM with the images, so no historic data load required'] },
      { id: 'D.8', text: 'Tech sheets input method', type: 'dropdown', options: ['Automatically with images', 'Manually as PDF'] },
      { id: 'D.9', text: 'Are there DICOM SR or other data sources for auto-populating fields?', type: 'textarea', placeholder: 'List DICOM SR sources' },
      { id: 'D.10', text: 'What are the HL7 priority values in your orders (OBR:27.1) and what do they mean?', type: 'textarea', placeholder: 'Example: S=Stat, R=Routine' },
      { id: 'D.11', text: 'What patient identifier do you use for matching (e.g. MRN) and is it in PID:3.1?', type: 'textarea', placeholder: 'Document patient identifier field' },
      { id: 'D.12', text: 'Is the patient identifier in your order the same as in prior reports and comparison images?', type: 'textarea', placeholder: 'Yes/No and explain any differences' },
      { id: 'D.13', text: 'Please document DICOM tag 0008,1040 value and corresponding PV1:11 value for matching (Note: DICOM tagging is handled by the Router / Integration 3rd Party, not client sites)', type: 'textarea', placeholder: 'Document tag values for patient matching' },
    ],
  },
  {
    id: 'integration-workflows',
    type: 'integration-workflows',
    title: 'Integration Workflows',
    description: 'Architecture diagram, systems inventory, and workflow descriptions',
  },
  {
    id: 'config-files',
    title: 'Configuration Files',
    description: 'Required file uploads for configuration (IMPORTANT: Please de-identify all files before uploading)',
    questions: [
      { id: 'CF.1', text: 'Procedure code list: Please upload your list of all procedure codes with modality that you will be sending in the order message.', type: 'upload-download', notes: 'Required: Procedure code, Description, Modality. Optional: CPT, Body part, Subspecialty', templateFileName: 'Procedure Code List Template' },
      { id: 'CF.2', text: 'User list: Please upload a file of all users and their roles.', type: 'upload-download', notes: 'Required: User email, User name, Role (Admin/PACS Admin/Tech)', templateFileName: 'User List Template' },
      { id: 'CF.3', text: 'Sample ORU report: Please upload a sample ORU report showing the expected format we will send to you', type: 'upload' },
      { id: 'CF.4', text: 'ORM/ORU specifications: Please upload your ORM specification and ORU specification if sending to New Lantern', type: 'upload' },
      { id: 'CF.5', text: 'Sample ORM report: Please upload a sample ORM report showing the expected format you will be sending', type: 'upload' },
      { id: 'CF.6', text: 'Provider Directory: Please upload your provider directory listing all referring and reading physicians', type: 'upload-download', notes: 'Required: Provider name, NPI, Specialty. Download the template below, complete it, and upload.', templateFileName: 'Provider Directory Template' },
      { id: 'CF.7', text: 'NewLantern Technologists: Please upload the list of technologists who will use the NewLantern platform', type: 'upload', notes: 'Required: Technologist name, Email, Site/Location, Modality access', inactive: true },
      { id: 'CF.8', text: 'PACS Admins: Please upload the list of PACS administrators', type: 'upload', notes: 'Required: Admin name, Email, Site/Location, Access level', inactive: true },
      { id: 'CF.9', text: 'Radiologist Provider list for Radiology Portal: Please upload the user list for the Radiology Portal including all radiologists who will need access', type: 'upload', notes: 'Required: Radiologist name, Email, NPI, Subspecialty, Site/Location', inactive: true },
    ],
  },
  {
    id: 'vpn-connectivity',
    title: 'VPN & Connectivity',
    description: 'VPN setup and network connectivity (DICOM requires: IP address, port | HL7 requires: IP address, port)',
    questions: [
       { 
        id: 'E.1', 
        text: 'VPN form exchange: Download the VPN form template, complete it with your network details, and upload.', 
        type: 'upload-download', 
        notes: 'Required: Site-to-site VPN details, IP ranges, firewall rules, contact info. Rad One clients use the standard template. SRV clients require a separate form.',
        templateFileName: 'VPN Form Template',
      },
      { 
        id: 'E.2', 
        text: 'DICOM Endpoints - Test/Proof Environment (IP address, Port, AE title for each endpoint)', 
        type: 'textarea', 
        placeholder: 'Example:\n- PACS Test: IP 10.1.2.4, Port 104, AE Title: PACS_TEST\n- CT Scanner Test: IP 10.1.2.11, Port 104, AE Title: CT1_TEST\n\nIf you do not have a test environment, write: Not applicable' 
      },
      { 
        id: 'E.2.1', 
        text: 'DICOM Endpoints - Production Environment (IP address, Port, AE title for each endpoint)', 
        type: 'textarea', 
        placeholder: 'Example:\n- PACS: IP 10.1.2.3, Port 104, AE Title: PACS_PROD\n- CT Scanner 1: IP 10.1.2.10, Port 104, AE Title: CT1_PROD\n- Modality 1: IP 10.1.2.15, Port 104, AE Title: MOD1_PROD' 
      },
      { 
        id: 'E.3', 
        text: 'HL7 Orders - Test/Proof Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- RIS Test: IP 10.1.3.10, Port 2575\n\nIf you do not have a test environment, write: Not applicable' 
      },
      { 
        id: 'E.3.1', 
        text: 'HL7 Orders - Production Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- RIS Production: IP 10.1.3.5, Port 2575' 
      },
      { 
        id: 'E.4', 
        text: 'HL7 Prior Reports - Test/Proof Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- EHR Test: IP 10.1.3.11, Port 2576\n\nIf you do not have a test environment, write: Not applicable' 
      },
      { 
        id: 'E.4.1', 
        text: 'HL7 Prior Reports - Production Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- EHR Production: IP 10.1.3.6, Port 2576' 
      },
      { 
        id: 'E.5', 
        text: 'HL7 Reports from New Lantern - Test/Proof Environment (IP address and Port where you will receive reports)', 
        type: 'textarea', 
        placeholder: 'Example:\n- Your HL7 Listener Test: IP 10.1.3.12, Port 2577\n\nIf you do not have a test environment, write: Not applicable' 
      },
      { 
        id: 'E.5.1', 
        text: 'HL7 Reports from New Lantern - Production Environment (IP address and Port where you will receive reports)', 
        type: 'textarea', 
        placeholder: 'Example:\n- Your HL7 Listener Production: IP 10.1.3.7, Port 2577' 
      },
      { 
        id: 'E.6', 
        text: 'HL7 ADTs (if in scope) - Test/Proof Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- ADT Interface Test: IP 10.1.3.13, Port 2578\n\nIf you do not have a test environment or ADTs are not in scope, write: Not applicable' 
      },
      { 
        id: 'E.6.1', 
        text: 'HL7 ADTs (if in scope) - Production Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- ADT Interface Production: IP 10.1.3.8, Port 2578\n\nIf ADTs are not in scope for this implementation, write: Not applicable' 
      },
    ],
  },
  {
    id: 'hl7-config',
    title: 'HL7 Configuration',
    description: 'HL7 message field values and meanings (IP addresses and ports should be in VPN form)',
    questions: [
      { id: 'G.3', text: 'ORC-1 (Order Control) - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: NW = New order, CA = Cancel order, XO = Change order, etc.' },
      { id: 'G.4', text: 'ORC-5 (Order Status) - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: SC = In process/scheduled, CM = Complete, CA = Canceled, etc.' },
      { id: 'G.5', text: 'OBR:27.1 (Quantity/Timing) in ORU messages - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: STAT = Urgent/immediate, ROUTINE = Normal priority, ASAP = As soon as possible, etc.' },
      { id: 'G.6', text: 'Please share what values you send for Patient Class (PV1:2) and what each means', type: 'textarea', placeholder: 'Example: E = Emergency, I = Inpatient, O = Outpatient, P = Preadmit, R = Recurring, etc.' },
      { id: 'G.7', text: 'Please share what values you send for Patient Location (PV1:3) - Optional but useful', type: 'textarea', placeholder: 'Example: MAIN^3RD^302A = Main building, 3rd floor, room 302A\nEAST^RAD^CT1 = East wing, Radiology, CT Scanner 1\n\nLeave blank if not applicable' },
    ],
  },
  {
    id: 'admin-tracking',
    title: 'Admin Tracking',
    description: 'Internal fields managed by New Lantern staff — not visible to clients',
    questions: [
      // Organization operational
      { id: 'meta.prod_status',      text: 'Production Status',        type: 'dropdown', options: ['Active', 'Monitoring', 'Pending', 'Inactive'], inactive: true },
      { id: 'meta.reading_group',    text: 'Reading Group / Client',   type: 'text',     inactive: true },
      { id: 'meta.studies_per_day',  text: 'Avg Studies Per Day',      type: 'text',     inactive: true },
      // IT contact (structured breakdown of A.2)
      { id: 'meta.it_contact_name',  text: 'IT Contact Name',          type: 'text',     inactive: true },
      { id: 'meta.it_contact_email', text: 'IT Contact Email',         type: 'text',     inactive: true },
      { id: 'meta.it_contact_phone', text: 'IT Contact Phone',         type: 'text',     inactive: true },
      // Systems inventory
      { id: 'meta.pacs_system',       text: 'PACS System',            type: 'text',     inactive: true },
      { id: 'meta.ris_system',        text: 'RIS System',             type: 'text',     inactive: true },
      { id: 'meta.emr_system',        text: 'EMR / EHR System',       type: 'text',     inactive: true },
      { id: 'meta.interface_engine',  text: 'Interface Engine',        type: 'text',     inactive: true },
      // DICOM structured breakdown (supplements E.2 / E.2.1)
      { id: 'meta.dicom_image_source', text: 'DICOM Image Source',    type: 'text',     inactive: true },
      { id: 'meta.dicom_org_ae_title', text: 'Org AE Title',          type: 'text',     inactive: true },
      { id: 'meta.dicom_org_ip',       text: 'Org DICOM IP',          type: 'text',     inactive: true },
      { id: 'meta.dicom_org_port',     text: 'Org DICOM Port',        type: 'text',     inactive: true },
      { id: 'meta.dicom_sb_ip',        text: 'Silverback DICOM IP',   type: 'text',     inactive: true },
      { id: 'meta.dicom_sb_port',      text: 'Silverback DICOM Port', type: 'text',     inactive: true },
      { id: 'meta.dicom_nl_ip',        text: 'NL DICOM IP',           type: 'text',     inactive: true },
      { id: 'meta.dicom_nl_port',      text: 'NL DICOM Port',         type: 'text',     inactive: true },
      // HL7 Orders structured breakdown (supplements E.3 / E.3.1)
      { id: 'meta.hl7_ord_org_ip',    text: 'HL7 Orders – Org IP',          type: 'text', inactive: true },
      { id: 'meta.hl7_ord_org_port',  text: 'HL7 Orders – Org Port',        type: 'text', inactive: true },
      { id: 'meta.hl7_ord_sb_ip',     text: 'HL7 Orders – Silverback IP',   type: 'text', inactive: true },
      { id: 'meta.hl7_ord_sb_port',   text: 'HL7 Orders – Silverback Port', type: 'text', inactive: true },
      { id: 'meta.hl7_ord_nl_ip',     text: 'HL7 Orders – NL IP',           type: 'text', inactive: true },
      { id: 'meta.hl7_ord_nl_port',   text: 'HL7 Orders – NL Port',         type: 'text', inactive: true },
      // HL7 Results structured breakdown (supplements E.5 / E.5.1)
      { id: 'meta.hl7_res_nl_ip',     text: 'HL7 Results – NL IP',           type: 'text', inactive: true },
      { id: 'meta.hl7_res_nl_port',   text: 'HL7 Results – NL Port',         type: 'text', inactive: true },
      { id: 'meta.hl7_res_sb_ip',     text: 'HL7 Results – Silverback IP',   type: 'text', inactive: true },
      { id: 'meta.hl7_res_sb_port',   text: 'HL7 Results – Silverback Port', type: 'text', inactive: true },
      { id: 'meta.hl7_res_org_ip',    text: 'HL7 Results – Org IP',          type: 'text', inactive: true },
      { id: 'meta.hl7_res_org_port',  text: 'HL7 Results – Org Port',        type: 'text', inactive: true },
      // Gotchas / notes
      { id: 'meta.accession_format',  text: 'Accession Number Format',        type: 'text',     inactive: true },
      { id: 'meta.priors_available',  text: 'Priors Availability',            type: 'text',     inactive: true },
      { id: 'meta.other_notes',       text: 'Other Notes / Gotchas',          type: 'textarea', inactive: true },
    ],
  },
];

// Total questions count
// Note: Workflow sections don't have questions array, so we filter them out
export const TOTAL_QUESTIONS = questionnaireSections.reduce(
  (sum, section) => sum + (section.questions?.length || 0),
  0
);

// Legacy export for backward compatibility
export const questionnaireData = questionnaireSections;
