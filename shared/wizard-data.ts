/**
 * Wizard-style questionnaire data
 * Step-by-step with yes/no questions and conditional logic
 */

export type QuestionType = 'yesno' | 'text' | 'dropdown' | 'date' | 'textarea';

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: 'upload' | 'form' | 'schedule' | 'review';
}

export interface ConditionalFollowUp {
  type: QuestionType;
  question: string;
  id: string;
  text?: string;
  required?: boolean;
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  helpText?: string;
}

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  required?: boolean;
  
  // For yes/no questions
  yesFollowUps?: ConditionalFollowUp[];
  noFollowUps?: ConditionalFollowUp[];
  
  // Tasks generated based on answer
  yesTasks?: Task[];
  noTasks?: Task[];
  
  // For non-yes/no questions
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  text?: string;
  helpText?: string;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export const wizardSteps: WizardStep[] = [
  {
    id: 'basics',
    title: 'Basics',
    description: 'Organization and contact information',
    questions: [
      {
        id: 'org_name',
        question: 'Organization Name',
        type: 'text',
        required: true,
        placeholder: 'Enter your organization name'
      },
      {
        id: 'primary_contact',
        question: 'Primary Contact Name',
        type: 'text',
        required: true,
        placeholder: 'Full name'
      },
      {
        id: 'contact_email',
        question: 'Primary Contact Email',
        type: 'text',
        required: true,
        placeholder: 'email@organization.com'
      },
      {
        id: 'contact_phone',
        question: 'Primary Contact Phone',
        type: 'text',
        required: true,
        placeholder: '(555) 123-4567'
      },
      {
        id: 'go_live_date',
        question: 'Target Go-Live Date',
        type: 'date',
        required: true
      }
    ]
  },
  {
    id: 'systems',
    title: 'Systems',
    description: 'Existing systems and infrastructure',
    questions: [
      {
        id: 'has_pacs',
        question: 'Do you currently have a PACS system?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'pacs_vendor',
            question: 'PACS Vendor',
            type: 'text',
            required: true,
            placeholder: 'e.g., GE, Philips, Siemens'
          },
          {
            id: 'pacs_version',
            question: 'PACS Version (if known)',
            type: 'text',
            placeholder: 'Optional'
          },
          {
            id: 'pacs_retention',
            question: 'Will this system remain post go-live?',
            type: 'dropdown',
            required: true,
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unsure', label: 'Not Sure' }
            ]
          }
        ],
        yesTasks: [
          {
            id: 'task_pacs_config',
            title: 'Upload PACS Configuration',
            description: 'Export and upload your current PACS configuration file',
            type: 'upload'
          }
        ]
      },
      {
        id: 'has_ris',
        question: 'Do you have a RIS (Radiology Information System)?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'ris_vendor',
            question: 'RIS Vendor',
            type: 'text',
            required: true,
            placeholder: 'e.g., Epic, Cerner, Meditech'
          },
          {
            id: 'ris_version',
            question: 'RIS Version',
            type: 'text',
            placeholder: 'Optional'
          }
        ],
        yesTasks: [
          {
            id: 'task_ris_integration',
            title: 'Schedule RIS Integration Call',
            description: 'Coordinate with your RIS vendor for integration planning',
            type: 'schedule'
          }
        ]
      },
      {
        id: 'has_ehr',
        question: 'Do you have an EHR (Electronic Health Record) system?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'ehr_vendor',
            question: 'EHR Vendor',
            type: 'text',
            required: true,
            placeholder: 'e.g., Epic, Cerner, Allscripts'
          }
        ],
        yesTasks: [
          {
            id: 'task_ehr_integration',
            title: 'EHR Integration Planning',
            description: 'Review EHR integration requirements and workflows',
            type: 'review'
          }
        ]
      }
    ]
  },
  {
    id: 'data',
    title: 'Data & Integration',
    description: 'Data exchange and connectivity requirements',
    questions: [
      {
        id: 'send_hl7',
        question: 'Will you be sending HL7 messages?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'hl7_types',
            question: 'Select message types',
            type: 'dropdown',
            required: true,
            options: [
              { value: 'adt', label: 'ADT (Patient Admin)' },
              { value: 'orm', label: 'ORM (Orders)' },
              { value: 'oru', label: 'ORU (Results)' },
              { value: 'multiple', label: 'Multiple Types' }
            ]
          }
        ],
        yesTasks: [
          {
            id: 'task_hl7_spec',
            title: 'Upload HL7 Interface Specification',
            description: 'Provide your HL7 interface documentation',
            type: 'upload'
          },
          {
            id: 'task_hl7_test',
            title: 'Schedule HL7 Test Window',
            description: 'Coordinate testing time with IT team',
            type: 'schedule'
          }
        ]
      },
      {
        id: 'dicom_routing',
        question: 'Do you need DICOM routing/forwarding?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'dicom_destinations',
            question: 'Number of destination systems',
            type: 'text',
            required: true,
            placeholder: 'e.g., 3'
          }
        ],
        yesTasks: [
          {
            id: 'task_dicom_config',
            title: 'Provide DICOM Routing Configuration',
            description: 'List all destination AE titles, IPs, and ports',
            type: 'form'
          }
        ]
      },
      {
        id: 'has_vpn',
        question: 'Do you have VPN access for remote connectivity?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'vpn_type',
            question: 'VPN Type',
            type: 'dropdown',
            required: true,
            options: [
              { value: 'site_to_site', label: 'Site-to-Site' },
              { value: 'client', label: 'Client VPN' },
              { value: 'both', label: 'Both' }
            ]
          }
        ],
        noTasks: [
          {
            id: 'task_vpn_setup',
            title: 'VPN Setup Required',
            description: 'Coordinate with IT to establish secure remote access',
            type: 'schedule'
          }
        ]
      }
    ]
  },
  {
    id: 'validation',
    title: 'Validation',
    description: 'Testing and validation requirements',
    questions: [
      {
        id: 'can_provide_samples',
        question: 'Can you provide sample DICOM studies for testing?',
        type: 'yesno',
        yesTasks: [
          {
            id: 'task_sample_upload',
            title: 'Upload Sample DICOM Studies',
            description: 'Provide 3-5 representative studies for testing',
            type: 'upload'
          }
        ],
        noTasks: [
          {
            id: 'task_sample_generation',
            title: 'Sample Data Generation',
            description: 'We will generate test data for validation',
            type: 'review'
          }
        ]
      },
      {
        id: 'has_test_environment',
        question: 'Do you have a separate test/staging environment?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'test_env_details',
            question: 'Test environment details',
            type: 'textarea',
            placeholder: 'Describe your test environment setup'
          }
        ]
      },
      {
        id: 'validation_window',
        question: 'Have you identified a validation testing window?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'validation_dates',
            question: 'Preferred validation dates',
            type: 'text',
            placeholder: 'e.g., March 15-20, 2026'
          }
        ],
        noTasks: [
          {
            id: 'task_schedule_validation',
            title: 'Schedule Validation Session',
            description: 'Coordinate validation testing timeline',
            type: 'schedule'
          }
        ]
      }
    ]
  },
  {
    id: 'golive',
    title: 'Go-Live',
    description: 'Final preparation and go-live planning',
    questions: [
      {
        id: 'has_downtime_window',
        question: 'Do you have an approved downtime window for go-live?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'downtime_details',
            question: 'Downtime window details',
            type: 'textarea',
            placeholder: 'Date, time, duration, and any constraints'
          }
        ],
        noTasks: [
          {
            id: 'task_downtime_approval',
            title: 'Obtain Downtime Approval',
            description: 'Get leadership approval for go-live downtime window',
            type: 'review'
          }
        ]
      },
      {
        id: 'has_support_plan',
        question: 'Do you have a support plan for go-live weekend?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'support_contacts',
            question: 'Support team contacts',
            type: 'textarea',
            placeholder: 'List names, roles, and contact info for go-live support'
          }
        ],
        noTasks: [
          {
            id: 'task_support_planning',
            title: 'Create Go-Live Support Plan',
            description: 'Define support coverage and escalation procedures',
            type: 'form'
          }
        ]
      },
      {
        id: 'has_rollback_plan',
        question: 'Do you have a rollback plan if issues occur?',
        type: 'yesno',
        yesFollowUps: [
          {
            id: 'rollback_details',
            question: 'Rollback plan details',
            type: 'textarea',
            placeholder: 'Describe your rollback procedures'
          }
        ],
        noTasks: [
          {
            id: 'task_rollback_planning',
            title: 'Develop Rollback Plan',
            description: 'Document procedures for reverting to previous system',
            type: 'form'
          }
        ]
      }
    ]
  }
];
