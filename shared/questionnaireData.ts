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
      { id: 'L.2', text: 'Test patient data requirements', type: 'textarea', placeholder: 'Document test patient data needs' },
      { id: 'L.3', text: 'Test study requirements', type: 'textarea', placeholder: 'Document test study requirements' },
      { id: 'L.4', text: 'Integration testing duration (Rad1 will guide final timeline)', type: 'text', placeholder: 'Example: 2 weeks' },
      { id: 'L.5', text: 'User acceptance testing (UAT) duration (Rad1 will guide final timeline)', type: 'text', placeholder: 'Example: 1 week' },
      { id: 'L.6', text: 'UAT participants', type: 'textarea', placeholder: 'List UAT participants' },
      { id: 'L.7', text: 'Production validation timeline', type: 'date', placeholder: 'MM/DD/YYYY' },
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
      { id: 'A.8', text: 'Do you have a router (DICOM)?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'A.9', text: 'Current RIS (system you will generate orders from)', type: 'text', placeholder: 'Example: Epic Radiant' },
      { id: 'A.10', text: 'What is your EHR system?', type: 'text', placeholder: 'Example: Epic, Cerner' },
      { id: 'A.11', text: 'What is your PACS system?', type: 'text', placeholder: 'Example: GE Centricity' },
      { id: 'A.12', text: 'What is your current archive system (VNA)?', type: 'text', placeholder: 'Example: GE (often your PACS)' },
      { id: 'A.13', text: 'System that produces DICOM SR', type: 'text', placeholder: 'Examples: dosage reports, radiation dose monitoring systems' },
      { id: 'A.14', text: 'Please list all AI integrations', type: 'textarea', placeholder: 'Example: Viz AI, Heart Flow, etc.' },
      { id: 'A.15', text: 'Will any systems be replaced during integration (PACS/RIS/EHR retirement)?', type: 'textarea', placeholder: 'Document any system replacements' },
      { id: 'A.16', text: 'Will your modality worklist system be impacted during this implementation?', type: 'dropdown', options: ['Yes', 'No'] },
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
      { id: 'D.4', text: 'Do you perform mammography?', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'D.4.1', text: 'If yes, is it 2D or 3D? Please provide details.', type: 'textarea', placeholder: 'Describe mammography capabilities' },
      { id: 'D.5', text: 'How will comparison images for priors be obtained?', type: 'dropdown', options: ['1) Manually pushed', '2) Automatically pushed by your system', '3) Query Retrieve'] },
      { id: 'D.7', text: 'How will prior reports be obtained?', type: 'dropdown', options: ['1) HL7 messages', '2) Flat file (requires 3-4 weeks for processing)', '3) DICOM SR images'] },
      { id: 'D.8', text: 'Tech sheets input method (Note: Tech sheets come automatically with images in PACS as DICOM PDF or images, not SR)', type: 'dropdown', options: ['1) Automatically with images', '2) Manually as PDF'], notes: 'Prior reports are SR (text), but tech sheets are typically DICOM PDF or actual images' },
      { id: 'D.9', text: 'Are there DICOM SR or other data sources for auto-populating fields?', type: 'textarea', placeholder: 'List DICOM SR sources' },
      { id: 'D.10', text: 'What are the HL7 priority values in your orders (OBR:27.1) and what do they mean?', type: 'textarea', placeholder: 'Example: S=Stat, R=Routine' },
      { id: 'D.11', text: 'What patient identifier do you use for matching (e.g. MRN) and is it in PID:3.1?', type: 'textarea', placeholder: 'Document patient identifier field' },
      { id: 'D.12', text: 'Is the patient identifier in your order the same as in prior reports and comparison images?', type: 'textarea', placeholder: 'Yes/No and explain any differences' },
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
    id: 'connectivity',
    title: 'Connectivity',
    description: 'VPN and DICOM connectivity configuration (DICOM requires: IP address, AE title, port | HL7 requires: IP, port)',
    questions: [
      { 
        id: 'E.1', 
        text: 'VPN form exchange', 
        type: 'upload-download', 
        notes: 'Upload your completed VPN form or download our template',
        templateUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663326227304/NfNtZiMfXpqdbVqa.xlsx',
        templateFileName: 'VPN_Form_Template.xlsx'
      },
      { id: 'E.2', text: 'Please document AE titles here', type: 'textarea', placeholder: 'List all Application Entity titles for DICOM connectivity' },
      { id: 'E.3', text: 'Please document DICOM tag 0008,1040 value and corresponding PV1:11 value for matching (Note: DICOM tagging is handled by Silverback, not client sites)', type: 'textarea', placeholder: 'Document tag values for patient matching' },
    ],
  },
  {
    id: 'dicom-validation',
    title: 'DICOM Data Validation',
    description: 'HL7 message validation',
    questions: [
      { id: 'G.3', text: 'Please document the ORC-1 values you expect to send', type: 'textarea', placeholder: 'Example: NW (New order), CA (Cancel order), etc.' },
      { id: 'G.4', text: 'Please document the ORC-5 values you expect to send', type: 'textarea', placeholder: 'Example: SC (In process), CM (Complete), etc.' },
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
