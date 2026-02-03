// Real PACS Implementation Questionnaire
// Parsed from actual New Lantern intake spreadsheet

export type QuestionType = 'text' | 'yesno' | 'select' | 'date' | 'multiline' | 'file' | 'contact';

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  helpText?: string;
  required?: boolean;
  options?: string[];
  acceptsFiles?: boolean;
  conditionalOn?: {
    questionId: string;
    answer: string;
  };
}

export interface IntakeSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export const intakeSections: IntakeSection[] = [
  {
    id: 'overview',
    title: 'Overview & Architecture',
    description: 'Key contacts and system overview',
    questions: [
      {
        id: 'admin_contact',
        question: 'Administrative point(s) of contact',
        type: 'contact',
        required: true
      },
      {
        id: 'it_contact',
        question: 'IT point(s) of contact - Connectivity & Systems',
        type: 'contact',
        required: true
      },
      {
        id: 'clinical_contact',
        question: 'Clinical Contact(s) - Technologist/Clinical Informatics',
        type: 'contact',
        required: true
      },
      {
        id: 'radiologist_champion',
        question: 'Radiologist Champion(s)',
        type: 'contact',
        required: false
      },
      {
        id: 'project_manager',
        question: 'Project Manager if applicable',
        type: 'contact',
        required: false
      },
      {
        id: 'integration_checklist',
        question: 'Please fill out the Integration System Checklist. Are there any systems that will be replaced during the integration with New Lantern? (answer \'Yes\' if you will be retiring your existing PACS or changing your RIS or EHR)',
        type: 'yesno',
        helpText: 'Please use the integration system list tab to help determine scope',
        required: true
      },
      {
        id: 'modality_worklist_retiring',
        question: 'Will the system contributing to your modality worklists be retiring?',
        type: 'yesno',
        required: true
      },
      {
        id: 'sor_retiring',
        question: 'Will the system used for your SOR be retiring?',
        type: 'yesno',
        required: true
      },
      {
        id: 'router_retiring',
        question: 'Router',
        type: 'yesno',
        required: false
      },
      {
        id: 'ris_retiring',
        question: 'RIS',
        type: 'yesno',
        required: false
      },
      {
        id: 'integration_engines_retiring',
        question: 'Integration engines',
        type: 'yesno',
        required: false
      },
      {
        id: 'ehr_retiring',
        question: 'EHR system',
        type: 'yesno',
        required: false
      },
      {
        id: 'current_pacs_retiring',
        question: 'Current PACS',
        type: 'yesno',
        required: false
      }
    ]
  },
  {
    id: 'security',
    title: 'Security & Permissions',
    description: 'Security compliance, authentication, and access control',
    questions: [
      {
        id: 'security_questionnaire',
        question: 'New Lantern uses a third-party vendor for security compliance and has completed an evaluation for SOC 2; however, we have not yet achieved formal certification. Do you require a security questionnaire or a letter from our third-party partner, Delve?',
        type: 'yesno',
        helpText: 'Please share your questionnaire or requirement for letter allowing 2 weeks for completion. If this will impact connectivity to New Lantern, this should be scheduled immediately.',
        required: true
      },
      {
        id: 'active_directory_sso',
        question: 'Do you have an Active Directory Configurable for SSO?',
        type: 'yesno',
        helpText: 'Please let us know if you intend to use MFA for authentication',
        required: true,
        acceptsFiles: true
      },
      {
        id: 'role_permissions',
        question: 'Please review the system Role Permissions and confirm that your organization will use the product roles. You can update the roles permissions as an admin.',
        type: 'yesno',
        helpText: 'Please review the Role Permissions sheet and customize the permissions for each role in your environment if you need to make changes prior to scheduling user training.',
        required: true
      },
      {
        id: 'multitenancy',
        question: 'Do you require data and user access to be separated by organization in New Lantern (multi-tenancy)? 1) Your patients have different MRNs that must remain separate by contributing organization 2) Your DICOM studies are from multiple PACS systems that must remain separate by contributing organization 3) Your users must be restricted by tenant when managing radiology accessions',
        type: 'yesno',
        helpText: 'Please update your requirements around multitenancy in the multitenancy worksheet.',
        required: true
      }
    ]
  },
  {
    id: 'imaging',
    title: 'Imaging Routing & Connectivity',
    description: 'DICOM routing, VPN, and connectivity requirements',
    questions: [
      {
        id: 'monthly_volume',
        question: 'Estimated monthly volume',
        type: 'select',
        options: ['<10K/Month', '10K-25K/Month', '25K-50K/Month', '50K-100K/Month', '>100K/Month'],
        required: true
      },
      {
        id: 'vpn_vendor',
        question: 'Your Organization uses a vendor',
        type: 'text',
        helpText: 'Please share the contact(s) we should work with and use the link to the VPN sheet',
        acceptsFiles: true
      },
      {
        id: 'dicom_sor',
        question: 'What is the current DICOM System of Record (SOR)?',
        type: 'text',
        required: true
      },
      {
        id: 'sor_iocm',
        question: 'Does the SOR have IOCM capabilities?',
        type: 'yesno',
        required: false
      }
    ]
  },
  {
    id: 'data',
    title: 'Data and Integration',
    description: 'HL7, DICOM, and system integration details',
    questions: [
      {
        id: 'production_testing',
        question: 'Capable of configuring your production systems for Testing prior to go live?',
        type: 'yesno',
        helpText: 'Discuss how your organization will support issues during your scheduled go live to ensure production data is correctly configured if not scheduling the testing of production data',
        required: true
      },
      {
        id: 'go_live_date',
        question: 'Requested Go live date - MM/DD/YY',
        type: 'date',
        helpText: 'Speak with your vendors to confirm they can meet your production timeline for HL7 and DICOM routing. New Lantern recommends that you send production HL7 and DICOM data to New Lantern for a minimum of 3 consecutive days in real time and start no later than 3-4 weeks before go-live',
        required: true
      },
      {
        id: 'expected_volume',
        question: 'What is the expected volume of images ready each month?',
        type: 'select',
        options: ['<10K/Month', '10K-25K/Month', '25K-50K/Month', '50K-100K/Month', '>100K/Month'],
        required: true
      },
      {
        id: 'modalities',
        question: 'What modalities are expected?',
        type: 'multiline',
        required: true
      },
      {
        id: 'integration_engines',
        question: 'Does [Group] utilize any integration engines or routers? Please elaborate?',
        type: 'multiline',
        required: false
      },
      {
        id: 'overlay_pacs_count',
        question: 'If looking for an overlay PACS, how many PACS systems are expected to be overlayed?',
        type: 'text',
        required: false
      },
      {
        id: 'vna_migration',
        question: 'Data Migration out of VNA',
        type: 'multiline',
        acceptsFiles: true,
        required: false
      },
      {
        id: 'current_pacs',
        question: 'What PACS system does [Group] currently use?',
        type: 'text',
        required: true
      },
      {
        id: 'current_reporting',
        question: 'What Reporting system does [Group] currently use?',
        type: 'text',
        required: true
      },
      {
        id: 'current_emr_ris',
        question: 'What EMR/RIS system does [Group] currently use?',
        type: 'text',
        required: true
      },
      {
        id: 'comparison_studies',
        question: 'How will comparison studies be sent? Will they need to be retrieved?',
        type: 'multiline',
        required: false
      },
      {
        id: 'comparison_reports',
        question: 'How will comparison reports be sent? Will they need to be retrieved?',
        type: 'multiline',
        required: false
      }
    ]
  },
  {
    id: 'workflows',
    title: 'Additional Workflows',
    description: 'Document retrieval, integrations, and custom workflows',
    questions: [
      {
        id: 'document_retrieval',
        question: 'Does [Group] have a RIS or PACS where documents or forms will need to be retrieved? If so please elaborate.',
        type: 'multiline',
        required: false
      },
      {
        id: 'tech_notes',
        question: 'Where are tech notes inputted? HL7, in New Lantern, etc',
        type: 'text',
        required: false
      },
      {
        id: 'emr_ris_integrations',
        question: 'What integrations are needed (if applicable) with the EMR/RIS?',
        type: 'multiline',
        acceptsFiles: true,
        required: false
      },
      {
        id: 'secondary_captures',
        question: 'Are there any applications that produce secondary captures or AI results? (Viz.ai, etc)',
        type: 'multiline',
        required: false
      },
      {
        id: 'dicom_sr_integration',
        question: 'Do you integrate other data sources/DICOM SR to automatically populate merge fields or reports? Ex: Ultrasound measurements, DEXA, etc.',
        type: 'yesno',
        required: false
      },
      {
        id: 'dicom_sr_system',
        question: 'If yes above, do you use Modlink, LaurelBridge, or another system?',
        type: 'text',
        conditionalOn: {
          questionId: 'dicom_sr_integration',
          answer: 'yes'
        },
        required: false
      },
      {
        id: 'universal_patient_id',
        question: 'If applicable, is there a universal patient ID or index to unify patients and MRNs across sites?',
        type: 'multiline',
        required: false
      },
      {
        id: 'custom_procedure_codes',
        question: 'If applicable, are sites able to provide a mapping of their custom procedure codes?',
        type: 'yesno',
        acceptsFiles: true,
        required: false
      },
      {
        id: 'multiple_reports',
        question: 'How are studies with multiple reports/orders handled?',
        type: 'multiline',
        required: false
      },
      {
        id: 'reporting_criteria',
        question: 'Are there specific reporting criteria that need to be added? (Ex MIPS, site-specific footers, etc)',
        type: 'multiline',
        required: false
      },
      {
        id: 'downtime_procedures',
        question: 'Are there times when the EMR/RIS are offline but DICOM will still be sent? What do those downtime procedures look like?',
        type: 'multiline',
        required: false
      },
      {
        id: 'prelim_reports',
        question: 'Do you require a workflow for prelim reports?',
        type: 'yesno',
        required: false
      },
      {
        id: 'credentialing_process',
        question: 'What is the credentialing process for each site(s)',
        type: 'multiline',
        required: false
      }
    ]
  },
  {
    id: 'rad_workflows',
    title: 'Rad Workflows',
    description: 'Radiologist and technologist workflows',
    questions: [
      {
        id: 'qaqc_workflow',
        question: 'What is your workflow for QA/QC issues with images? Ex. Missing images, incorrect notes, etc',
        type: 'multiline',
        required: false
      },
      {
        id: 'rad_tech_communication',
        question: 'How do your radiologists communicate with techs? Phone, PACS system, external chat (Teams), etc',
        type: 'text',
        required: false
      },
      {
        id: 'central_tech',
        question: 'Do you have a central technologist responsible for communication with radiologists? Or is modality dependent?',
        type: 'multiline',
        required: false
      },
      {
        id: 'tech_logins',
        question: 'Does each technologist have their own login to the PACS?',
        type: 'yesno',
        required: false
      },
      {
        id: 'peer_review',
        question: 'What are your Peer Review Requirements',
        type: 'multiline',
        required: false
      },
      {
        id: 'critical_results',
        question: 'How do you handle critical result reporting with the referring physicians?',
        type: 'multiline',
        required: false
      },
      {
        id: 'rad_scheduling',
        question: 'How are radiologists scheduled',
        type: 'multiline',
        required: false
      }
    ]
  }
];
