/**
 * Questionnaire data structure based on Google Sheet
 * Defines all sections, questions, and conditional logic
 */

export interface QuestionOption {
  value: string;
  label: string;
  nextStep?: string; // Conditional message shown when this option is selected
}

export interface Question {
  id: string;
  text: string;
  type: "dropdown" | "text" | "textarea" | "date";
  options?: QuestionOption[];
  documentation?: string; // Link or reference to documentation
  required?: boolean;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export const questionnaireData: Section[] = [
  {
    id: "overview",
    title: "Overview & Architecture",
    description: "Contact information and system integration overview",
    questions: [
      {
        id: "1.1",
        text: "Administrative point(s) of contact",
        type: "text",
        required: true,
      },
      {
        id: "1.2",
        text: "IT point(s) of contact - Connectivity & Systems",
        type: "text",
        required: true,
      },
      {
        id: "1.3",
        text: "Clinical Contact(s) - Technologist/Clinical Informatics",
        type: "text",
        required: true,
      },
      {
        id: "1.4",
        text: "Radiologist Champion(s)",
        type: "text",
      },
      {
        id: "1.5",
        text: "Project Manager if applicable",
        type: "text",
      },
      {
        id: "1.6",
        text: "Please fill out the Integration System Checklist. Are there any systems that will be replaced during the integration with New Lantern? (answer 'Yes' if you will be retiring your existing PACS or changing your RIS or EHR)",
        type: "dropdown",
        options: [
          {
            value: "yes",
            label: "Yes",
            nextStep: "Please use the integration system list tab to help determine scope",
          },
          { value: "no", label: "No" },
        ],
        documentation: "Integration System List",
      },
      {
        id: "1.7",
        text: "Will the system contributing to your modality worklists be retiring?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.8",
        text: "Will the system used for your SOR be retiring?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.9",
        text: "Router",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.10",
        text: "RIS",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.11",
        text: "Integration engines",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.12",
        text: "EHR system",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "1.13",
        text: "Current PACS",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "security",
    title: "Security & Permissions",
    description: "Security requirements and access control",
    questions: [
      {
        id: "2.1",
        text: "New Lantern uses a third-party vendor for security compliance and has completed an evaluation for SOC 2; however, we have not yet achieved formal certification. Do you require a security questionnaire or a letter from our third-party partner, Delve?",
        type: "dropdown",
        options: [
          {
            value: "yes",
            label: "Yes",
            nextStep: "Please share your questionnaire or requirement for letter allowing 2 weeks for completion. If this will impact connectivity to New Lantern, this should be scheduled immediately.",
          },
          { value: "no", label: "No" },
        ],
        documentation: "While New Lantern has not yet completed a formal security certification, we work with a third-party security partner, Delve, to support security management and oversight.",
      },
      {
        id: "2.2",
        text: "Do you have an Active Directory Configurable for SSO?",
        type: "dropdown",
        options: [
          {
            value: "yes",
            label: "Yes",
            nextStep: "Please let us know if you intend to use MFA for authentication",
          },
          { value: "no", label: "No" },
        ],
        documentation: "New_Lantern_SSO_OnePager -2026.1.11.docx",
      },
      {
        id: "2.3",
        text: "Please review the system Role Permissions and confirm that your organization will use the product roles. You can update the roles permissions as an admin.",
        type: "dropdown",
        options: [
          {
            value: "yes",
            label: "Yes",
            nextStep: "Please review the Role Permissions sheet and customize the permissions for each role in your environment if you need to make changes prior to scheduling user training.",
          },
          { value: "no", label: "No - we need custom roles" },
        ],
        documentation: "Role Permissions",
      },
      {
        id: "2.4",
        text: "Do you require data and user access to be separated by organization in New Lantern (multi-tenancy)? This applies if: 1) Your patients have different MRNs that must remain separate by contributing organization, 2) Your DICOM studies are from multiple PACS systems that must remain separate by contributing organization, 3) Your users must be restricted by tenant when managing radiology accessions",
        type: "dropdown",
        options: [
          {
            value: "yes",
            label: "Yes",
            nextStep: "Please update your requirements around multitenancy in the multitenancy worksheet.",
          },
          { value: "no", label: "No" },
        ],
        documentation: "Multi-Tenancy Worksheet",
      },
    ],
  },
  {
    id: "imaging",
    title: "Imaging Routing & Connectivity",
    description: "DICOM routing and connectivity setup",
    questions: [
      {
        id: "3.1",
        text: "Estimated monthly volume",
        type: "dropdown",
        options: [
          { value: "under-10k", label: "Under 10K/Month" },
          { value: "10k-25k", label: "10K-25K/Month" },
          { value: "25k-50k", label: "25K-50K/Month" },
          { value: "50k-100k", label: "50K-100K/Month" },
          { value: "over-100k", label: "Over 100K/Month" },
          {
            value: "vendor",
            label: "Your Organization uses a vendor",
            nextStep: "Please share the contact(s) we should work with and use the link to the VPN sheet",
          },
        ],
        documentation: "Link to VPN sheet if needed",
      },
      {
        id: "3.2",
        text: "What is the current DICOM System of Record (SOR)?",
        type: "text",
      },
      {
        id: "3.3",
        text: "Does the SOR have IOCM capabilities?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "unknown", label: "Unknown" },
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data and Integration",
    description: "Data migration and system integration",
    questions: [
      {
        id: "4.1",
        text: "Capable of configuring your production systems for Testing prior to go live?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          {
            value: "no",
            label: "No",
            nextStep: "Discuss how your organization will support issues during your scheduled go live to ensure production data is correctly configured if not scheduling the testing of production data",
          },
        ],
      },
      {
        id: "4.2",
        text: "Requested Go live date (MM/DD/YY)",
        type: "date",
        required: true,
      },
      {
        id: "4.3",
        text: "What is the expected volume of images ready each month?",
        type: "dropdown",
        options: [
          { value: "under-10k", label: "Under 10K/Month" },
          { value: "10k-25k", label: "10K-25K/Month" },
          { value: "25k-50k", label: "25K-50K/Month" },
          { value: "50k-100k", label: "50K-100K/Month" },
          { value: "over-100k", label: "Over 100K/Month" },
        ],
      },
      {
        id: "4.4",
        text: "What modalities are expected?",
        type: "textarea",
      },
      {
        id: "4.5",
        text: "Does your organization utilize any integration engines or routers? Please elaborate.",
        type: "textarea",
      },
      {
        id: "4.6",
        text: "If looking for an overlay PACS, how many PACS systems are expected to be overlayed?",
        type: "text",
      },
      {
        id: "4.7",
        text: "What PACS system does your organization currently use?",
        type: "text",
      },
      {
        id: "4.8",
        text: "What Reporting system does your organization currently use?",
        type: "text",
      },
      {
        id: "4.9",
        text: "What EMR/RIS system does your organization currently use?",
        type: "text",
      },
      {
        id: "4.10",
        text: "How will comparison studies be sent? Will they need to be retrieved?",
        type: "textarea",
      },
      {
        id: "4.11",
        text: "How will comparison reports be sent? Will they need to be retrieved?",
        type: "textarea",
      },
    ],
  },
  {
    id: "workflows",
    title: "Additional Workflows",
    description: "Custom workflows and integrations",
    questions: [
      {
        id: "5.1",
        text: "Does your organization have a RIS or PACS where documents or forms will need to be retrieved? If so please elaborate.",
        type: "textarea",
      },
      {
        id: "5.2",
        text: "Where are tech notes inputted? HL7, in New Lantern, etc",
        type: "textarea",
      },
      {
        id: "5.3",
        text: "What integrations are needed (if applicable) with the EMR/RIS?",
        type: "textarea",
      },
      {
        id: "5.4",
        text: "Are there any applications that produce secondary captures or AI results? (Viz.ai, etc)",
        type: "textarea",
      },
      {
        id: "5.5",
        text: "Do you integrate other data sources/DICOM SR to automatically populate merge fields or reports? Ex: Ultrasound measurements, DEXA, etc.",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "5.6",
        text: "If yes above, do you use Modlink, LaurelBridge, or another system?",
        type: "text",
      },
      {
        id: "5.7",
        text: "If applicable, is there a universal patient ID or index to unify patients and MRNs across sites?",
        type: "textarea",
      },
      {
        id: "5.8",
        text: "If applicable, are sites able to provide a mapping of their custom procedure codes?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "na", label: "N/A" },
        ],
      },
      {
        id: "5.9",
        text: "How are studies with multiple reports/orders handled?",
        type: "textarea",
      },
      {
        id: "5.10",
        text: "Are there specific reporting criteria that need to be added? (Ex MIPS, site-specific footers, etc)",
        type: "textarea",
      },
      {
        id: "5.11",
        text: "Are there times when the EMR/RIS are offline but DICOM will still be sent? What do those downtime procedures look like?",
        type: "textarea",
      },
      {
        id: "5.12",
        text: "Do you require a workflow for prelim reports?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "5.13",
        text: "What is the credentialing process for each site(s)?",
        type: "textarea",
      },
    ],
  },
  {
    id: "rad-workflows",
    title: "Rad Workflows",
    description: "Radiologist and technologist workflows",
    questions: [
      {
        id: "6.1",
        text: "What is your workflow for QA/QC issues with images? Ex. Missing images, incorrect notes, etc",
        type: "textarea",
      },
      {
        id: "6.2",
        text: "How do your radiologists communicate with techs? Phone, PACS system, external chat (Teams), etc",
        type: "textarea",
      },
      {
        id: "6.3",
        text: "Do you have a central technologist responsible for communication with radiologists? Or is modality dependent?",
        type: "textarea",
      },
      {
        id: "6.4",
        text: "Does each technologist have their own login to the PACS?",
        type: "dropdown",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "6.5",
        text: "What are your Peer Review Requirements?",
        type: "textarea",
      },
      {
        id: "6.6",
        text: "How do you handle critical result reporting with the referring physicians?",
        type: "textarea",
      },
      {
        id: "6.7",
        text: "How are radiologists scheduled?",
        type: "textarea",
      },
    ],
  },
  {
    id: "worklists",
    title: "Worklists",
    description: "Worklist configuration and management",
    questions: [
      {
        id: "7.1",
        text: "Worklist configuration requirements",
        type: "textarea",
      },
    ],
  },
];
