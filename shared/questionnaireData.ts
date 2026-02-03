/**
 * Radiology One New Site Onboarding Questionnaire
 * Based on Boulder/Template Client Checklist
 * Note: Router = DataFirst (Silverback) for all overlay situations
 */

export interface Question {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'dropdown' | 'multi-select' | 'yes-no' | 'date' | 'table' | 'file';
  options?: string[];
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  tableColumns?: string[];
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export const questionnaireData: Section[] = [
  {
    id: 'section-header',
    title: 'Header Info',
    description: 'Basic client information',
    questions: [
      {
        id: 'INFO.1',
        question: 'Client Name',
        type: 'text',
        required: true,
        placeholder: 'Enter client organization name'
      },
      {
        id: 'INFO.3',
        question: 'Target Go-Live Date',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY'
      }
    ]
  },
  {
    id: 'section-overview',
    title: 'Overview & Architecture',
    description: 'Key contacts and system architecture',
    questions: [
      {
        id: 'A.1',
        question: 'Administrative point(s) of contact',
        type: 'textarea',
        required: true,
        placeholder: 'Name, title, email, phone'
      },
      {
        id: 'A.2',
        question: 'IT point(s) of contact - Connectivity & Systems',
        type: 'textarea',
        required: true,
        placeholder: 'Name, title, email, phone'
      },
      {
        id: 'A.3',
        question: 'Clinical Contact(s) - Technologist/Clinical Informatics',
        type: 'textarea',
        required: true,
        placeholder: 'Name, title, email, phone'
      },
      {
        id: 'A.4',
        question: 'Radiologist Champion(s)',
        type: 'textarea',
        placeholder: 'Name, title, email, phone'
      },
      {
        id: 'A.5',
        question: 'Project Manager (if applicable)',
        type: 'textarea',
        placeholder: 'Name, title, email, phone'
      },
      {
        id: 'A.7',
        question: 'Will any systems be replaced during integration (PACS, RIS, EHR retirement)?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No - overlay integration with existing systems']
      },
      {
        id: 'A.8',
        question: 'Will your modality worklist system be impacted during this implementation?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No']
      },
      {
        id: 'A.10',
        question: 'Router details (DataFirst/Silverback)',
        type: 'textarea',
        required: true,
        helpText: 'Document routing intermediary for HL7/DICOM. Assume Router = DataFirst for overlay situations.',
        placeholder: 'Example: Silverback (DataFirst) - routing intermediary for HL7/DICOM'
      },
      {
        id: 'A.12',
        question: 'Integration Engine (if applicable)',
        type: 'text',
        placeholder: 'Example: Laurel Bridge, Mirth, etc.'
      },
      {
        id: 'A.13',
        question: 'EHR system',
        type: 'text',
        required: true,
        placeholder: 'Example: Cerner, Epic, etc.'
      },
      {
        id: 'A.14',
        question: 'Current PACS',
        type: 'text',
        required: true,
        placeholder: 'Example: Cerner Cam 7, GE Centricity, etc.'
      }
    ]
  },
  {
    id: 'section-security',
    title: 'Security & Permissions',
    description: 'Security requirements and multi-tenancy configuration',
    questions: [
      {
        id: 'B.1',
        question: 'Is security questionnaire required?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'Completed']
      },
      {
        id: 'B.4',
        question: 'Multi-tenancy requirements: Separate MRNs by organization?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No']
      },
      {
        id: 'B.4-details',
        question: 'If multi-tenancy or MRN issues exist, provide details',
        type: 'textarea',
        placeholder: 'Example: Historical multi-MRN issue, Laurel Bridge handles MRN normalization, etc.'
      },
      {
        id: 'B.5',
        question: 'Multi-tenancy requirements: Separate DICOM studies by PACS?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'N/A']
      },
      {
        id: 'B.6',
        question: 'Multi-tenancy requirements: User restrictions by tenant?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'N/A']
      }
    ]
  },
  {
    id: 'section-imaging',
    title: 'Imaging Routing & Connectivity',
    description: 'DICOM configuration and volume estimates',
    questions: [
      {
        id: 'C.1',
        question: 'Estimated monthly volume',
        type: 'text',
        required: true,
        placeholder: 'Number of studies per month'
      },
      {
        id: 'C.2',
        question: 'Current DICOM System of Record (SOR)',
        type: 'text',
        required: true,
        placeholder: 'Example: Cerner Cam 7, GE Centricity, etc.'
      },
      {
        id: 'C.3',
        question: 'Does SOR have IOCM capabilities (prior image routing/prefetch)?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'Handled by integration engine']
      },
      {
        id: 'C.3-details',
        question: 'If IOCM/prefetch is available, provide details',
        type: 'textarea',
        placeholder: 'Example: Laurel Bridge handles prior image routing/prefetch'
      }
    ]
  },
  {
    id: 'section-data',
    title: 'Data & Integration',
    description: 'System integration and data exchange configuration',
    questions: [
      {
        id: 'D.1',
        question: 'Can production systems be configured for testing prior to go-live?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No']
      },
      {
        id: 'D.2',
        question: 'Confirmed go-live date',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY'
      },
      {
        id: 'D.3',
        question: 'Expected volume of images ready each month',
        type: 'text',
        required: true,
        placeholder: 'Number of images'
      },
      {
        id: 'D.4',
        question: 'Expected modalities',
        type: 'multi-select',
        required: true,
        options: [
          'CT',
          'MRI',
          'X-Ray',
          'Ultrasound',
          'Mammography',
          'Nuclear Medicine',
          'PET/CT',
          'Fluoroscopy',
          'Other'
        ]
      },
      {
        id: 'D.5',
        question: 'Integration engines or routers in use',
        type: 'textarea',
        required: true,
        placeholder: 'Example: Silverback (router); Laurel Bridge (integration engine)'
      },
      {
        id: 'D.6',
        question: 'Number of PACS systems to be overlayed (if overlay PACS)',
        type: 'text',
        required: true,
        placeholder: 'Example: 1'
      },
      {
        id: 'D.7',
        question: 'Current PACS system',
        type: 'text',
        required: true,
        placeholder: 'Example: Cerner Cam 7'
      },
      {
        id: 'D.8',
        question: 'Current Reporting system',
        type: 'text',
        required: true,
        placeholder: 'Example: Intellirad, PowerScribe, etc.'
      },
      {
        id: 'D.9',
        question: 'Current EMR/RIS system',
        type: 'text',
        required: true,
        placeholder: 'Example: Cerner, Epic, etc.'
      },
      {
        id: 'D.10',
        question: 'Prefetch Query Retrieve configuration',
        type: 'textarea',
        required: true,
        helpText: 'Define prefetch rules and which system handles it',
        placeholder: 'Example: Client handles prefetch via Laurel Bridge. Rules based on first name, last name, DOB, gender (not MRN due to multi-MRN issues).'
      },
      {
        id: 'D.11',
        question: 'How will comparison reports be sent/retrieved?',
        type: 'textarea',
        required: true,
        placeholder: 'Example: Export of prior imaging reports (ORU) from existing reporting system'
      }
    ]
  },
  {
    id: 'section-workflows',
    title: 'Additional Workflows',
    description: 'Integration workflows and special requirements',
    questions: [
      {
        id: 'E.2',
        question: 'Tech notes input method',
        type: 'textarea',
        placeholder: 'How will technologists enter notes?'
      },
      {
        id: 'E.3',
        question: 'Required EMR/RIS integrations',
        type: 'textarea',
        required: true,
        placeholder: 'Example: HL7: ADT (A34 only - patient merge); ORM; ORU. All messages from Cerner forked to Radiology One via Silverback.'
      },
      {
        id: 'E.4',
        question: 'Applications producing secondary captures or AI results',
        type: 'textarea',
        placeholder: 'Example: Viz AI; Heart Flow - updates come through PACS as DICOM updates'
      },
      {
        id: 'E.5',
        question: 'DICOM SR or other data sources for auto-populating fields',
        type: 'textarea',
        placeholder: 'List any DICOM Structured Report sources'
      },
      {
        id: 'E.6',
        question: 'System for DICOM SR',
        type: 'text',
        placeholder: 'Which system generates DICOM SR?'
      },
      {
        id: 'E.7',
        question: 'Universal patient ID/index for unifying patients across sites',
        type: 'textarea',
        placeholder: 'Example: Multi-MRN issue being addressed. All MRNs included in every HL7 message.'
      },
      {
        id: 'E.8',
        question: 'Mapping of custom procedure codes from sites',
        type: 'textarea',
        required: true,
        placeholder: 'Example: CPT crosswalk on OBR44'
      },
      {
        id: 'E.9',
        question: 'Handling of studies with multiple reports/orders',
        type: 'textarea',
        placeholder: 'How should multi-report studies be handled?'
      },
      {
        id: 'E.10',
        question: 'Specific reporting criteria (MIPS, site-specific footers, etc.)',
        type: 'textarea',
        placeholder: 'Any special reporting requirements'
      },
      {
        id: 'E.11',
        question: 'Downtime procedures when EMR/RIS offline',
        type: 'textarea',
        required: true,
        placeholder: 'Document downtime workflow'
      },
      {
        id: 'E.12',
        question: 'Prelim report workflow requirements',
        type: 'textarea',
        placeholder: 'How should preliminary reports be handled?'
      },
      {
        id: 'E.13',
        question: 'Credentialing process for each site',
        type: 'textarea',
        required: true,
        placeholder: 'Document credentialing timeline and requirements'
      }
    ]
  },
  {
    id: 'section-rad-workflows',
    title: 'Rad Workflows',
    description: 'Radiologist and technologist workflow configuration',
    questions: [
      {
        id: 'F.1',
        question: 'QA/QC workflow for image issues',
        type: 'textarea',
        placeholder: 'How should image quality issues be escalated?'
      },
      {
        id: 'F.2',
        question: 'Radiologist-to-tech communication method',
        type: 'textarea',
        placeholder: 'How do radiologists communicate with techs?'
      },
      {
        id: 'F.3',
        question: 'Central technologist for radiologist communication',
        type: 'text',
        placeholder: 'Name and contact info'
      },
      {
        id: 'F.4',
        question: 'Does each technologist have individual PACS login?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No']
      },
      {
        id: 'F.5',
        question: 'Peer Review requirements',
        type: 'textarea',
        placeholder: 'Document peer review workflow if applicable'
      },
      {
        id: 'F.6',
        question: 'Critical result reporting process with referring physicians',
        type: 'textarea',
        placeholder: 'How are critical results communicated?'
      },
      {
        id: 'F.7',
        question: 'Radiologist scheduling process',
        type: 'textarea',
        required: true,
        placeholder: 'Example: QGenda used by both Rad1 and client. Visibility to schedule through New Lantern.'
      },
      {
        id: 'F.8',
        question: 'Worklist configuration requirements',
        type: 'textarea',
        required: true,
        placeholder: 'Document worklist preferences, filters, sorting, etc.'
      }
    ]
  },
  {
    id: 'section-dicom-validation',
    title: 'DICOM Data Validation',
    description: 'DICOM tag validation and testing',
    questions: [
      {
        id: 'G.1',
        question: 'Patient ID Match - Tag (0010,0020)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.2',
        question: 'Accession Number Match - Tag (0008,0050)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.3',
        question: 'Study Description - Tag (0008,1030)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.4',
        question: 'Modality - Tag (0008,0060)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.5',
        question: 'Institution Name - Tag (0008,0080)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.6',
        question: 'Institution Department Name - Tag (0008,1040)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.7',
        question: 'Station Name/AE Title - Tag (0008,1010)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.7-details',
        question: 'AE Title details (if validated)',
        type: 'text',
        placeholder: 'Example: MUNSON'
      },
      {
        id: 'G.8',
        question: 'Study Date/Time - Tag (0008,0020/0030)',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.9',
        question: 'Series Count',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      },
      {
        id: 'G.10',
        question: 'Image Count',
        type: 'dropdown',
        required: true,
        options: ['Validated', 'Pending Testing', 'Issues Found']
      }
    ]
  },
  {
    id: 'section-institution',
    title: 'Institution Group Configuration',
    description: 'Site-specific configuration settings',
    questions: [
      {
        id: 'H.1',
        question: 'Institution Group Name',
        type: 'text',
        required: true,
        placeholder: 'Example: MUNSON'
      },
      {
        id: 'H.2',
        question: 'Timezone',
        type: 'dropdown',
        required: true,
        options: [
          'Eastern Time (ET)',
          'Central Time (CT)',
          'Mountain Time (MT)',
          'Pacific Time (PT)',
          'Alaska Time (AKT)',
          'Hawaii Time (HT)'
        ],
        helpText: 'ORUs come out of New Lantern as UTC by default. Silverback/DataFirst will convert to site-specific timezone.'
      },
      {
        id: 'H.3',
        question: 'Report Footer',
        type: 'textarea',
        required: true,
        placeholder: 'Custom footer text for reports'
      },
      {
        id: 'H.4',
        question: 'ORU Destination',
        type: 'text',
        required: true,
        placeholder: 'Where should ORU messages be sent?'
      }
    ]
  },
  {
    id: 'section-users',
    title: 'User & Access Configuration',
    description: 'User accounts and permissions setup',
    questions: [
      {
        id: 'I.1',
        question: 'Radiologist Accounts - Provide list of radiologists',
        type: 'textarea',
        required: true,
        placeholder: 'Name, email for each radiologist'
      },
      {
        id: 'I.2',
        question: 'Radiologist Group assignment',
        type: 'text',
        required: true,
        placeholder: 'Which radiologist group?'
      },
      {
        id: 'I.3',
        question: 'Admin Accounts - Provide list of admins',
        type: 'textarea',
        required: true,
        placeholder: 'Name, email for each admin'
      },
      {
        id: 'I.4',
        question: 'Tech Accounts - Provide list of technologists (if applicable)',
        type: 'textarea',
        placeholder: 'Name, email for each tech'
      },
      {
        id: 'I.5',
        question: 'Worklist Visibility preferences',
        type: 'textarea',
        required: true,
        placeholder: 'Which users should see which worklists?'
      },
      {
        id: 'I.6',
        question: 'Dashboard Access preferences',
        type: 'textarea',
        required: true,
        placeholder: 'Which users should have dashboard access?'
      }
    ]
  },
  {
    id: 'section-templates',
    title: 'Template & RVU Configuration',
    description: 'Report templates and RVU setup',
    questions: [
      {
        id: 'J.1',
        question: 'High-Volume Procedure Templates needed',
        type: 'textarea',
        required: true,
        placeholder: 'List procedures that need templates'
      },
      {
        id: 'J.2',
        question: 'Should templates be replicated from existing system?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'N/A']
      },
      {
        id: 'J.3',
        question: 'Are there junk templates that should be removed?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No', 'N/A']
      },
      {
        id: 'J.4',
        question: 'RVU Values configuration',
        type: 'textarea',
        required: true,
        placeholder: 'Document RVU requirements'
      },
      {
        id: 'J.5',
        question: 'Default Template assignment',
        type: 'textarea',
        required: true,
        placeholder: 'Which template should be default?'
      }
    ]
  },
  {
    id: 'section-worklist',
    title: 'Worklist Configuration',
    description: 'Worklist views and filters',
    questions: [
      {
        id: 'K.1',
        question: 'Main Worklist View preferences',
        type: 'textarea',
        required: true,
        placeholder: 'How should the main worklist be configured?'
      },
      {
        id: 'K.2',
        question: 'Modality Filters needed',
        type: 'multi-select',
        required: true,
        options: ['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Mammography', 'Nuclear Medicine', 'PET/CT', 'Fluoroscopy', 'All']
      },
      {
        id: 'K.3',
        question: 'Priority Sorting preferences',
        type: 'dropdown',
        required: true,
        options: ['STAT first', 'Oldest first', 'Newest first', 'Custom']
      },
      {
        id: 'K.4',
        question: 'STAT Indicator - How should STAT studies be marked?',
        type: 'text',
        required: true,
        placeholder: 'Example: Red flag, bold text, etc.'
      },
      {
        id: 'K.5',
        question: 'Site Filter - Should worklist be filterable by site?',
        type: 'dropdown',
        required: true,
        options: ['Yes', 'No']
      },
      {
        id: 'K.6',
        question: 'Auto-Refresh interval',
        type: 'dropdown',
        required: true,
        options: ['30 seconds', '1 minute', '2 minutes', '5 minutes', 'Manual only']
      }
    ]
  },
  {
    id: 'section-validation',
    title: 'End-to-End Validation',
    description: 'Testing and validation tasks',
    questions: [
      {
        id: 'L.1',
        question: 'ORM to Worklist Test - Status',
        type: 'dropdown',
        required: true,
        options: ['Passed', 'Failed', 'Pending', 'Not Started']
      },
      {
        id: 'L.1-notes',
        question: 'ORM to Worklist Test - Notes',
        type: 'textarea',
        placeholder: 'Document test results and any issues'
      },
      {
        id: 'L.2',
        question: 'DICOM to Images Test - Status',
        type: 'dropdown',
        required: true,
        options: ['Passed', 'Failed', 'Pending', 'Not Started']
      },
      {
        id: 'L.2-notes',
        question: 'DICOM to Images Test - Notes',
        type: 'textarea',
        placeholder: 'Document test results and any issues'
      },
      {
        id: 'L.3',
        question: 'Template Selection Test - Status',
        type: 'dropdown',
        required: true,
        options: ['Passed', 'Failed', 'Pending', 'Not Started']
      },
      {
        id: 'L.3-notes',
        question: 'Template Selection Test - Notes',
        type: 'textarea',
        placeholder: 'Document test results and any issues'
      },
      {
        id: 'L.4',
        question: 'Report to ORU Test - Status',
        type: 'dropdown',
        required: true,
        options: ['Passed', 'Failed', 'Pending', 'Not Started']
      },
      {
        id: 'L.4-notes',
        question: 'Report to ORU Test - Notes',
        type: 'textarea',
        placeholder: 'Document test results and any issues'
      },
      {
        id: 'L.5',
        question: 'Prior Association Test - Status',
        type: 'dropdown',
        required: true,
        options: ['Passed', 'Failed', 'Pending', 'Not Started']
      },
      {
        id: 'L.5-notes',
        question: 'Prior Association Test - Notes',
        type: 'textarea',
        placeholder: 'Document test results and any issues'
      }
    ]
  }
];
