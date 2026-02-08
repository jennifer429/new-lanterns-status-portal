/**
 * Radiology One New Site Onboarding Questionnaire
 * 6 sections, 51 total questions
 * Note: Router = DataFirst (Silverback) for all overlay situations
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
  conditionalOn?: { questionId: string; value: string }; // Show this question only if another question has specific value
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export const questionnaireSections: Section[] = [
  {
    id: 'org-info',
    title: 'Organization Information',
    description: 'Sites, contacts, and testing timelines',
    questions: [
      { id: 'H.1', text: 'Number of sites/locations (this determines how many VPN tunnels Rad1 needs to build)', type: 'text', placeholder: 'Enter number of sites' },
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
      { id: 'L.6', text: 'UAT participants', type: 'textarea', placeholder: 'List UAT participants' },
      { id: 'L.8', text: 'Go-live support requirements', type: 'textarea', placeholder: 'Document go-live support needs' },
      { id: 'L.9', text: 'Post go-live monitoring requirements', type: 'textarea', placeholder: 'Document post go-live monitoring' },
      { id: 'L.10', text: 'Issue escalation process', type: 'textarea', placeholder: 'Document escalation process' },
    ],
  },
  {
    id: 'overview-arch',
    title: 'Overview & Architecture',
    description: 'System architecture and integrations',
    questions: [
      { id: 'A.7', text: 'Do you have an integration engine (HL7)?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.7.1', text: 'What is your integration engine system name and version?', type: 'text', placeholder: 'Example: Rhapsody 6.5, Mirth Connect 4.0, Cloverleaf', conditionalOn: { questionId: 'A.7', value: 'Yes' } },
      { id: 'A.8', text: 'Do you have a router (DICOM)?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.8.1', text: 'What is your DICOM router system name and version?', type: 'text', placeholder: 'Example: Laurel Bridge DCF, DCMTK Router, Intelerad', conditionalOn: { questionId: 'A.8', value: 'Yes' } },
      { id: 'A.9', text: 'Do you have a RIS (system you will generate orders from)?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.9.1', text: 'What is your RIS system name?', type: 'text', placeholder: 'Example: Epic Radiant', conditionalOn: { questionId: 'A.9', value: 'Yes' } },
      { id: 'A.10', text: 'Do you have an EHR system?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.10.1', text: 'What is your EHR system name?', type: 'text', placeholder: 'Example: Epic, Cerner', conditionalOn: { questionId: 'A.10', value: 'Yes' } },
      { id: 'A.11', text: 'What is your PACS system?', type: 'text', placeholder: 'Example: GE Centricity' },
      { id: 'A.12', text: 'What is your current archive system (VNA)?', type: 'text', placeholder: 'Example: GE (often your PACS)' },
      { id: 'A.13', text: 'System that produces DICOM SR', type: 'text', placeholder: 'Examples: dosage reports, radiation dose monitoring systems' },
      { id: 'A.14', text: 'Please list all AI integrations', type: 'textarea', placeholder: 'Example: Viz AI, Heart Flow, etc.' },
      { id: 'A.15', text: 'Will any systems be replaced during integration (PACS/RIS/EHR retirement)?', type: 'textarea', placeholder: 'Document any system replacements' },
      { id: 'A.16', text: 'Will your modality worklist system be impacted during this implementation?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.16.1', text: 'What is your modality worklist system name?', type: 'text', placeholder: 'Example: GE RIS, Epic Radiant MWL', conditionalOn: { questionId: 'A.16', value: 'Yes' } },
    ],
  },
  {
    id: 'data-integration',
    title: 'Data & Integration',
    description: 'Data exchange and integration configuration',
    questions: [
      { id: 'D.1', text: 'Can production systems be configured for testing prior to go-live?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'D.2', text: 'Confirmed go-live date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { id: 'D.3', text: 'Expected modalities', type: 'multi-select', options: ['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Nuclear Medicine', 'Mammography'] },
      { id: 'D.5', text: 'How will comparison images for priors be obtained?', type: 'dropdown', options: ['1) Manually pushed', '2) Automatically pushed by your system', '3) Query Retrieve'] },
      { id: 'D.7', text: 'How will prior reports be obtained?', type: 'dropdown', options: ['1) HL7 messages', '2) Flat file (requires 3-4 weeks for processing)', '3) DICOM SR images'] },
      { id: 'D.8', text: 'Tech sheets input method (Note: Tech sheets come automatically with images in PACS as DICOM PDF or images, not SR)', type: 'dropdown', options: ['1) Automatically with images', '2) Manually as PDF'], notes: 'Prior reports are SR (text), but tech sheets are typically DICOM PDF or actual images' },
      { id: 'D.9', text: 'Are there DICOM SR or other data sources for auto-populating fields?', type: 'textarea', placeholder: 'List DICOM SR sources' },
      { id: 'D.10', text: 'What are the HL7 priority values in your orders (OBR:27.1) and what do they mean?', type: 'textarea', placeholder: 'Example: S=Stat, R=Routine' },
      { id: 'D.11', text: 'What patient identifier do you use for matching (e.g. MRN) and is it in PID:3.1?', type: 'textarea', placeholder: 'Document patient identifier field' },
      { id: 'D.12', text: 'Is the patient identifier in your order the same as in prior reports and comparison images?', type: 'textarea', placeholder: 'Yes/No and explain any differences' },
      { id: 'D.13', text: 'Please document DICOM tag 0008,1040 value and corresponding PV1:11 value for matching (Note: DICOM tagging is handled by Silverback, not client sites)', type: 'textarea', placeholder: 'Document tag values for patient matching' },
    ],
  },
  {
    id: 'config-files',
    title: 'Configuration Files',
    description: 'Required file uploads for configuration (IMPORTANT: Please de-identify all files before uploading)',
    questions: [
      { id: 'D.13', text: 'Procedure code list: Please upload your list of all procedure codes with modality that you will be sending in the order message.', type: 'upload', notes: 'Required: Procedure code, Description, Modality. Optional: CPT, Body part, Subspecialty' },
      { id: 'D.14', text: 'User list: Please upload a file of all users and their roles.', type: 'upload', notes: 'Required: User email, User name, Role (Admin/PACS Admin/Tech)' },
      { id: 'D.15', text: 'Sample ORU report: Please upload a sample ORU report showing the expected format we will send to you', type: 'upload' },
      { id: 'D.16', text: 'ORM/ORU specifications: Please upload your ORM specification and ORU specification if sending to New Lantern', type: 'upload' },
      { id: 'D.17', text: 'Sample ORM report: Please upload a sample ORM report showing the expected format you will be sending', type: 'upload' },
    ],
  },
  {
    id: 'vpn-connectivity',
    title: 'VPN & Connectivity',
    description: 'VPN setup and network connectivity (DICOM requires: IP address, port | HL7 requires: IP address, port)',
    questions: [
      { 
        id: 'E.1', 
        text: 'VPN form exchange', 
        type: 'upload-download', 
        notes: 'Upload your completed VPN form or download our template. MUST include IP addresses and ports for all DICOM endpoints and HL7 interfaces.',
        templateUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663326227304/NfNtZiMfXpqdbVqa.xlsx',
        templateFileName: 'VPN_Form_Template.xlsx'
      },
      { 
        id: 'E.2', 
        text: 'DICOM Endpoints - Test/Proof Environment (IP address, Port, AE title for each endpoint)', 
        type: 'textarea', 
        placeholder: 'Example:\n- PACS Test: IP 10.1.2.4, Port 104, AE Title: PACS_TEST\n- CT Scanner Test: IP 10.1.2.11, Port 104, AE Title: CT1_TEST\n- Modality Test: IP 10.1.2.12, Port 104, AE Title: MOD_TEST' 
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
        placeholder: 'Example:\n- RIS Test: IP 10.1.3.10, Port 2575' 
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
        placeholder: 'Example:\n- EHR Test: IP 10.1.3.11, Port 2576' 
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
        placeholder: 'Example:\n- Your HL7 Listener Test: IP 10.1.3.12, Port 2577' 
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
        placeholder: 'Example:\n- ADT Interface Test: IP 10.1.3.13, Port 2578\n\nLeave blank if ADTs are not in scope for this implementation' 
      },
      { 
        id: 'E.6.1', 
        text: 'HL7 ADTs (if in scope) - Production Environment (IP address and Port)', 
        type: 'textarea', 
        placeholder: 'Example:\n- ADT Interface Production: IP 10.1.3.8, Port 2578\n\nLeave blank if ADTs are not in scope for this implementation' 
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
      { id: 'G.6', text: 'PV1:2 (Patient Class) - Please document the values you will send and what each means', type: 'textarea', placeholder: 'Example: E = Emergency, I = Inpatient, O = Outpatient, P = Preadmit, R = Recurring, etc.' },
      { id: 'G.7', text: 'PV1:3 (Assigned Patient Location) - Optional but useful - Please document your location codes and what they mean', type: 'textarea', placeholder: 'Example: MAIN^3RD^302A = Main building, 3rd floor, room 302A\nEAST^RAD^CT1 = East wing, Radiology, CT Scanner 1\n\nLeave blank if not applicable' },
    ],
  },
];

// Total questions count
export const TOTAL_QUESTIONS = questionnaireSections.reduce(
  (sum, section) => sum + section.questions.length,
  0
); // 51 questions

// Legacy export for backward compatibility
export const questionnaireData = questionnaireSections;
