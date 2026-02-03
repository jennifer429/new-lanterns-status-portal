/**
 * Radiology One New Site Onboarding Questionnaire
 * Comprehensive 11-section questionnaire for PACS implementation
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
    id: 'section-1',
    title: 'Site Information & Contacts',
    description: 'Basic facility information and primary contact details',
    questions: [
      {
        id: '1.1.1',
        question: 'Site/Facility Name',
        type: 'text',
        required: true,
        placeholder: 'Enter the complete legal name of your facility'
      },
      {
        id: '1.1.2',
        question: 'Healthcare System/Parent Organization',
        type: 'text',
        placeholder: 'If your site is part of a larger health system, please enter the organization name'
      },
      {
        id: '1.1.3',
        question: 'Site Address',
        type: 'textarea',
        required: true,
        placeholder: 'Street address, city, state, ZIP code'
      },
      {
        id: '1.1.4',
        question: 'Site Website',
        type: 'text',
        placeholder: 'www.example.com or leave blank if not applicable'
      },
      {
        id: '1.1.5',
        question: 'Facility Type',
        type: 'text',
        required: true,
        placeholder: 'Examples: Outpatient only, Rural Hospital, Ambulatory Surgery Center, Urban Hospital, Academic Medical Center, Community Hospital, Diagnostic Imaging Center, etc.'
      },
      {
        id: '1.2',
        question: 'Primary Contacts',
        type: 'table',
        required: true,
        tableColumns: ['Contact Role', 'Name', 'Email', 'Phone'],
        helpText: 'Please provide contact information for: Administrative Point of Contact, IT/Systems Contact, Clinical/Operations Contact'
      }
    ]
  },
  {
    id: 'section-2',
    title: 'Site Systems & New Lantern Integration Points',
    description: 'Understanding your current systems and integration requirements',
    questions: [
      {
        id: '2.1',
        question: 'Systems at Your Site',
        type: 'table',
        required: true,
        tableColumns: ['System Component', 'System Name/Vendor', 'Version (if known)', 'Enter "N/A" if not applicable'],
        helpText: 'List: Radiology Information System (RIS), PACS, Electronic Health Record (EHR), Reporting/Dictation System, Other Systems Requiring Integration'
      },
      {
        id: '2.2.1',
        question: 'Where will radiology orders originate for New Lantern?',
        type: 'dropdown',
        required: true,
        options: [
          'From EHR',
          'From RIS',
          'From external order entry system',
          'From paper (manual entry into New Lantern)',
          'Other (please specify)'
        ]
      },
      {
        id: '2.2.2',
        question: 'Will your site need to receive/view incoming orders within New Lantern?',
        type: 'yes-no',
        required: true
      },
      {
        id: '2.3.1',
        question: 'Where should New Lantern send completed reports?',
        type: 'textarea',
        required: true,
        placeholder: 'Examples: Back to EHR, back to RIS, external portal, provider inbox, etc.'
      },
      {
        id: '2.3.2',
        question: 'Will New Lantern reports need to integrate with any other systems at your site?',
        type: 'yes-no',
        required: true
      },
      {
        id: '2.3.3',
        question: 'If yes, which systems?',
        type: 'textarea',
        placeholder: 'List all systems that need report integration'
      }
    ]
  },
  {
    id: 'section-3',
    title: 'DICOM & Imaging Capability',
    description: 'Your imaging infrastructure and DICOM capabilities',
    questions: [
      {
        id: '3.1.1',
        question: 'Do your imaging modalities (CT, MRI, Ultrasound, X-ray, etc.) currently send DICOM images?',
        type: 'yes-no',
        required: true
      },
      {
        id: '3.1.2',
        question: 'Which imaging modalities do you have at this site? (Select all that apply)',
        type: 'multi-select',
        required: true,
        options: [
          'Radiography (X-ray)',
          'Computed Tomography (CT)',
          'Magnetic Resonance Imaging (MRI)',
          'Ultrasound',
          'Mammography',
          'Nuclear Medicine',
          'Fluoroscopy',
          'PET/CT',
          'Other (please specify)'
        ]
      },
      {
        id: '3.1.3',
        question: 'DICOM export capability: Can your imaging equipment directly export DICOM images to external systems?',
        type: 'yes-no',
        required: true
      },
      {
        id: '3.1.4',
        question: 'Approximate daily volume of imaging studies',
        type: 'text',
        required: true,
        placeholder: 'Numeric value (number of studies)'
      },
      {
        id: '3.1.5',
        question: 'Are your DICOM images currently being sent to an external location?',
        type: 'yes-no',
        required: true
      },
      {
        id: '3.1.6',
        question: 'Current external DICOM destinations (if applicable)',
        type: 'textarea',
        placeholder: 'List systems/vendors receiving DICOM data'
      }
    ]
  },
  {
    id: 'section-4',
    title: 'Workflow & Integration Requirements',
    description: 'Order flow and report delivery workflows',
    questions: [
      {
        id: '4.1.1',
        question: 'Where do radiology orders originate? (Primary source)',
        type: 'dropdown',
        required: true,
        options: [
          'EHR',
          'RIS',
          'Paper requisition',
          'Standalone order entry system',
          'Multiple sources (please specify)',
          'Other (please specify)'
        ]
      },
      {
        id: '4.1.2',
        question: 'Do you currently send orders to an external vendor/service?',
        type: 'yes-no',
        required: true
      },
      {
        id: '4.1.3',
        question: 'If yes to 4.1.2, what vendor/service?',
        type: 'text',
        placeholder: 'Vendor name'
      },
      {
        id: '4.1.4',
        question: 'Are there any intermediary systems between your order source and New Lantern?',
        type: 'yes-no',
        required: true,
        helpText: 'Examples: DataFirst, middleware, translation services'
      },
      {
        id: '4.1.5',
        question: 'If yes to 4.1.4, please name the intermediary system(s)',
        type: 'textarea',
        placeholder: 'List all intermediary systems'
      },
      {
        id: '4.1.6',
        question: 'Where should completed radiology reports be delivered?',
        type: 'multi-select',
        required: true,
        options: [
          'Back to originating EHR',
          'RIS',
          'External provider portal',
          'Fax (phone number required)',
          'Email (email address required)',
          'Both EHR and external portal',
          'Other (please specify)'
        ]
      },
      {
        id: '4.1.7',
        question: 'Do you currently use an external dictation service?',
        type: 'yes-no',
        required: true
      },
      {
        id: '4.1.8',
        question: 'If yes to 4.1.7, which service?',
        type: 'text',
        placeholder: 'Examples: Radiology One, Radtech, Nuance Dragon, etc.'
      }
    ]
  },
  {
    id: 'section-5',
    title: 'Clinical Workflows & Specialties',
    description: 'Imaging specialties and worklist configuration',
    questions: [
      {
        id: '5.1.1',
        question: 'Which radiology specialties do you perform at this site? (Select all that apply)',
        type: 'multi-select',
        required: true,
        options: [
          'General Radiology/Radiography',
          'CT',
          'MRI',
          'Ultrasound',
          'Mammography',
          'Nuclear Medicine',
          'Interventional Radiology',
          'Emergency Radiology',
          'Pediatric Radiology',
          'Other (please specify)'
        ]
      },
      {
        id: '5.1.2',
        question: 'Do you have different radiologist groups/providers for different specialties?',
        type: 'yes-no',
        required: true
      },
      {
        id: '5.1.3',
        question: 'How many radiologists typically work at this site at one time?',
        type: 'text',
        required: true,
        placeholder: 'Numeric value (average during business hours)'
      },
      {
        id: '5.1.4',
        question: 'What are your primary clinical service lines?',
        type: 'textarea',
        required: true,
        placeholder: 'Examples: Emergency Department, Inpatient Medicine, Surgery, Orthopedics, etc.'
      },
      {
        id: '5.1.5',
        question: 'Do you need studies organized by specialty in separate worklists?',
        type: 'yes-no',
        required: true
      },
      {
        id: '5.1.6',
        question: 'If yes to 5.1.5, list the specialties that need separate worklists',
        type: 'textarea',
        placeholder: 'List specialties requiring separate worklists'
      },
      {
        id: '5.1.7',
        question: 'Do you use priority levels (STAT, Routine, etc.) for studies?',
        type: 'yes-no',
        required: true
      },
      {
        id: '5.1.8',
        question: 'If yes to 5.1.7, what priority levels do you use?',
        type: 'text',
        placeholder: 'Examples: STAT, URGENT, HIGH, ROUTINE, SCHEDULED'
      }
    ]
  },
  {
    id: 'section-6',
    title: 'Technical Requirements & Integration',
    description: 'Connectivity, authentication, and data exchange protocols',
    questions: [
      {
        id: '6.1.1',
        question: 'What is your primary internet connectivity for sending/receiving medical data?',
        type: 'dropdown',
        required: true,
        options: [
          'Direct internet connection',
          'VPN',
          'Dedicated line (T1, etc.)',
          'MPLS/Private network',
          'Combination (please specify)',
          'Other (please specify)'
        ]
      },
      {
        id: '6.1.2',
        question: 'What is your estimated internet upload/download speed (Mbps)?',
        type: 'text',
        required: true,
        placeholder: 'Format: Upload X Mbps / Download Y Mbps'
      },
      {
        id: '6.1.3',
        question: 'Do you have a DMZ or separate network segment for external integrations?',
        type: 'yes-no',
        required: true
      },
      {
        id: '6.1.4',
        question: 'Are there any firewall or network restrictions we should be aware of?',
        type: 'textarea',
        placeholder: 'Describe any relevant network policies, port restrictions, etc.'
      },
      {
        id: '6.2.1',
        question: 'What authentication method would you prefer for New Lantern integration?',
        type: 'dropdown',
        required: true,
        options: [
          'HL7 with shared secret key',
          'API Key',
          'OAuth 2.0',
          'SAML',
          'Other (please specify)',
          'No preference / Let Radiology One decide'
        ]
      },
      {
        id: '6.2.2',
        question: 'Do you have specific HIPAA compliance or audit requirements beyond standard compliance?',
        type: 'yes-no',
        required: true
      },
      {
        id: '6.2.3',
        question: 'If yes to 6.2.2, please describe',
        type: 'textarea',
        placeholder: 'Describe specific compliance requirements'
      },
      {
        id: '6.3.1',
        question: 'Does your system support SFTP file transfer?',
        type: 'yes-no',
        required: true
      },
      {
        id: '6.3.2',
        question: 'Does your system support REST/HTTPS API?',
        type: 'yes-no',
        required: true
      },
      {
        id: '6.file-upload',
        question: 'Upload Supporting Documents',
        type: 'file',
        helpText: 'Upload network diagrams, system documentation, or compliance certificates'
      }
    ]
  },
  {
    id: 'section-7',
    title: 'Image Handling & Annotations',
    description: 'DICOM handling and annotation requirements',
    questions: [
      {
        id: '7.1.1',
        question: 'Do your radiologists use any annotation or markup tools on DICOM images?',
        type: 'yes-no',
        required: true
      },
      {
        id: '7.1.2',
        question: 'If yes to 7.1.1, what types of annotations do you use? (Select all that apply)',
        type: 'multi-select',
        options: [
          'Drawing/pointer tools (lines, circles, arrows)',
          'Measurements',
          'Text overlays',
          'Lesion markers',
          'Other (please specify)'
        ]
      },
      {
        id: '7.1.3',
        question: 'Is it critical that annotations/markups persist across systems?',
        type: 'yes-no',
        required: true
      },
      {
        id: '7.1.4',
        question: 'Do you need DICOM images viewable directly within your EHR or worklist?',
        type: 'yes-no',
        required: true
      },
      {
        id: '7.1.5',
        question: 'Are there specific DICOM secondary capture or image format requirements?',
        type: 'yes-no',
        required: true
      },
      {
        id: '7.1.6',
        question: 'If yes to 7.1.5, please specify',
        type: 'textarea',
        placeholder: 'Describe DICOM format requirements'
      }
    ]
  },
  {
    id: 'section-8',
    title: 'Volume & Capacity Planning',
    description: 'Expected volumes and turnaround time requirements',
    questions: [
      {
        id: '8.1.1',
        question: 'Expected number of imaging studies per month',
        type: 'text',
        required: true,
        placeholder: 'Numeric value'
      },
      {
        id: '8.1.2',
        question: 'Expected number of reports per month',
        type: 'text',
        required: true,
        placeholder: 'Numeric value'
      },
      {
        id: '8.1.3',
        question: 'What percentage of studies are STAT/Urgent?',
        type: 'text',
        required: true,
        placeholder: 'Percentage (0-100%)'
      },
      {
        id: '8.1.4',
        question: 'What is your expected turnaround time requirement for report delivery?',
        type: 'dropdown',
        required: true,
        options: [
          'Real-time (within minutes)',
          'Within 1 hour',
          'Within 4 hours',
          'Within 24 hours',
          'Next business day',
          'Varies by priority level',
          'Other (please specify)'
        ]
      }
    ]
  },
  {
    id: 'section-9',
    title: 'Go-Live Planning',
    description: 'Timeline, implementation approach, and training needs',
    questions: [
      {
        id: '9.1.1',
        question: 'What is your target go-live date?',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY'
      },
      {
        id: '9.1.2',
        question: 'What is your preferred go-live approach?',
        type: 'dropdown',
        required: true,
        options: [
          'Cutover (switch all studies at once)',
          'Phased by modality',
          'Phased by clinic/department',
          'Pilot group first, then all',
          'Other (please specify)'
        ]
      },
      {
        id: '9.1.3',
        question: 'Will you need downtime for this cutover?',
        type: 'yes-no',
        required: true
      },
      {
        id: '9.1.4',
        question: 'If yes to 9.1.3, how long of a downtime window can you accommodate?',
        type: 'text',
        placeholder: 'Examples: 1 hour, 2 hours, weekend, etc.'
      },
      {
        id: '9.1.5',
        question: 'How many staff members will need training?',
        type: 'text',
        required: true,
        placeholder: 'Numeric value'
      },
      {
        id: '9.1.6',
        question: 'What roles need training? (Select all that apply)',
        type: 'multi-select',
        required: true,
        options: [
          'Radiologists',
          'Technologists',
          'Administrative staff',
          'IT staff',
          'Clinical staff',
          'Front desk/Registration',
          'Other (please specify)'
        ]
      },
      {
        id: '9.1.7',
        question: 'What is your preferred training method?',
        type: 'multi-select',
        required: true,
        options: [
          'On-site training',
          'Remote/Virtual training',
          'Self-paced online modules',
          'Documentation/manuals',
          'Combination (please specify)'
        ]
      }
    ]
  },
  {
    id: 'section-10',
    title: 'Additional Information',
    description: 'Special considerations and compliance requirements',
    questions: [
      {
        id: '10.1.1',
        question: 'Are there any known integration challenges or special requirements we should be aware of?',
        type: 'textarea',
        placeholder: 'Describe any special considerations'
      },
      {
        id: '10.1.2',
        question: 'Do you have any pending system upgrades or changes that might affect integration timing?',
        type: 'yes-no',
        required: true
      },
      {
        id: '10.1.3',
        question: 'If yes to 10.1.2, please describe',
        type: 'textarea',
        placeholder: 'Describe pending system changes'
      },
      {
        id: '10.1.4',
        question: 'Are there any compliance requirements specific to your facility (state-specific, accreditation, etc.)?',
        type: 'yes-no',
        required: true
      },
      {
        id: '10.1.5',
        question: 'If yes to 10.1.4, please describe',
        type: 'textarea',
        placeholder: 'Describe specific compliance requirements'
      },
      {
        id: '10.1.6',
        question: 'Is there any other information we should know to successfully onboard your facility?',
        type: 'textarea',
        placeholder: 'Any additional information'
      },
      {
        id: '10.file-upload',
        question: 'Upload Additional Documentation',
        type: 'file',
        helpText: 'Upload any additional documents that may help with onboarding'
      }
    ]
  },
  {
    id: 'section-11',
    title: 'Acknowledgment',
    description: 'Confirmation and authorization',
    questions: [
      {
        id: '11.1',
        question: 'I confirm that the information provided is accurate and complete to the best of my knowledge.',
        type: 'yes-no',
        required: true
      },
      {
        id: '11.2',
        question: 'Authorized Representative Name',
        type: 'text',
        required: true,
        placeholder: 'Full name'
      },
      {
        id: '11.3',
        question: 'Authorized Representative Title',
        type: 'text',
        required: true,
        placeholder: 'Job title'
      },
      {
        id: '11.4',
        question: 'Date Submitted',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY'
      }
    ]
  }
];
