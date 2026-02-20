/**
 * Rad Onboarding Worklist Questionnaire
 * Partner-level questionnaire — filled out once per partner (client), not per site.
 * Covers radiologist workflow setup, worklist preferences, routing, and QA.
 */

export interface RadQuestion {
  id: string;          // e.g., "RW.1"
  text: string;
  type: 'text' | 'textarea' | 'dropdown' | 'multi-select';
  options?: string[];
  placeholder?: string;
  notes?: string;
}

export interface RadSection {
  id: string;
  title: string;
  description?: string;
  questions: RadQuestion[];
}

export const radOnboardingSections: RadSection[] = [
  {
    id: 'reading-environment',
    title: 'Reading Environment',
    description: 'Basic setup and coverage details for the reading group',
    questions: [
      {
        id: 'RW.1',
        text: 'What time zone(s) do your radiologists read from?',
        type: 'text',
        placeholder: 'e.g., Eastern (ET), Central (CT)',
      },
      {
        id: 'RW.2',
        text: 'What are the standard reading hours (include any overnight / weekend coverage)?',
        type: 'textarea',
        placeholder: 'e.g., Weekdays 7am–10pm ET, Overnight 10pm–7am ET (outsourced), Weekends 8am–8pm ET',
      },
      {
        id: 'RW.3',
        text: 'Do you use a teleradiology / nighthawk service for after-hours coverage?',
        type: 'dropdown',
        options: ['Yes', 'No'],
      },
      {
        id: 'RW.3.1',
        text: 'Nighthawk / teleradiology provider name and contact',
        type: 'textarea',
        placeholder: 'e.g., Nighthawk Radiology — contact: integration@nighthawk.com',
        notes: 'Only needed if you answered Yes above',
      },
      {
        id: 'RW.4',
        text: 'Where do radiologists primarily read from?',
        type: 'multi-select',
        options: ['Home', 'Office / reading room', 'Hospital on-site', 'Mixed (home + office)'],
      },
      {
        id: 'RW.5',
        text: 'Do radiologists use dual monitors?',
        type: 'dropdown',
        options: ['Yes — all', 'Yes — some', 'No'],
      },
      {
        id: 'RW.6',
        text: 'How many radiologists will be using New Lantern at launch?',
        type: 'text',
        placeholder: 'e.g., 12',
      },
    ],
  },
  {
    id: 'worklist-preferences',
    title: 'Worklist Preferences',
    description: 'How radiologists want studies displayed and organized',
    questions: [
      {
        id: 'RW.7',
        text: 'What is the preferred default worklist sort order?',
        type: 'dropdown',
        options: [
          'Priority (STAT first)',
          'Study date/time (oldest first)',
          'Study date/time (newest first)',
          'Modality',
          'Patient name',
          'Custom (describe in notes below)',
        ],
      },
      {
        id: 'RW.7.1',
        text: 'If custom sort, describe the preferred worklist ordering',
        type: 'textarea',
        placeholder: 'e.g., STAT first, then by modality (CT → MR → XR), then by study time oldest first',
      },
      {
        id: 'RW.8',
        text: 'Should the next unread study auto-open when a report is signed?',
        type: 'dropdown',
        options: ['Yes', 'No', 'User-configurable preference'],
      },
      {
        id: 'RW.9',
        text: 'How many prior studies should be prefetched / displayed by default?',
        type: 'dropdown',
        options: ['1 most recent', '2 most recent', '3 most recent', 'All available priors', 'User-configurable'],
      },
      {
        id: 'RW.10',
        text: 'Should the worklist filter by reading location / site by default?',
        type: 'dropdown',
        options: ['Yes — each rad sees their assigned site(s) only', 'No — all rads see all sites', 'User-configurable'],
      },
      {
        id: 'RW.11',
        text: 'Are there any specific worklist columns or data fields that must be visible? (e.g., referring physician, patient DOB, order notes)',
        type: 'textarea',
        placeholder: 'e.g., Must show: Referring MD, Patient DOB, Order notes, Accession #, Body part',
      },
    ],
  },
  {
    id: 'priority-workflow',
    title: 'Priority & STAT Workflow',
    description: 'How urgent studies are identified, routed, and tracked',
    questions: [
      {
        id: 'RW.12',
        text: 'What HL7 priority values map to STAT in your orders (OBR:27.1 or equivalent)?',
        type: 'textarea',
        placeholder: 'e.g., S = STAT, A = ASAP — both should surface in the urgent worklist',
      },
      {
        id: 'RW.13',
        text: 'What is the expected STAT turnaround time (TAT)?',
        type: 'text',
        placeholder: 'e.g., 30 minutes from study complete to signed report',
      },
      {
        id: 'RW.14',
        text: 'What is the expected Routine turnaround time (TAT)?',
        type: 'text',
        placeholder: 'e.g., Same business day or 24 hours',
      },
      {
        id: 'RW.15',
        text: 'How should STAT studies be flagged in the worklist?',
        type: 'multi-select',
        options: [
          'Visual highlight / color coding',
          'Audible alert / notification sound',
          'Email/SMS alert to on-call rad',
          'Separate STAT-only worklist view',
          'Pop-up notification',
        ],
      },
      {
        id: 'RW.16',
        text: 'Is there an escalation process if a STAT study is not read within the TAT window?',
        type: 'textarea',
        placeholder: 'e.g., After 30 min, system sends alert to lead radiologist and supervising MD',
      },
    ],
  },
  {
    id: 'subspecialty-routing',
    title: 'Subspecialty & Routing',
    description: 'Which radiologists read which study types and how routing is assigned',
    questions: [
      {
        id: 'RW.17',
        text: 'What subspecialties does your reading group cover?',
        type: 'multi-select',
        options: [
          'General / body radiology',
          'Neuroradiology',
          'Musculoskeletal (MSK)',
          'Cardiac / cardiovascular',
          'Interventional radiology',
          'Pediatric radiology',
          'Breast imaging / mammography',
          'Nuclear medicine',
          'Emergency radiology',
          'Oncologic radiology',
        ],
      },
      {
        id: 'RW.18',
        text: 'How are studies routed to subspecialists? (describe your routing logic)',
        type: 'textarea',
        placeholder: 'e.g., Neuro MR/CT → neurorad worklist. MSK MR → MSK worklist. All plain films → general pool. After 8pm all go to general on-call.',
      },
      {
        id: 'RW.19',
        text: 'How is the on-call radiologist assigned / communicated to the system?',
        type: 'textarea',
        placeholder: 'e.g., On-call schedule managed in QGenda — exported weekly. On-call rad is assigned in NL via admin panel each Monday.',
      },
      {
        id: 'RW.20',
        text: 'Are studies ever re-assigned or transferred between radiologists? If so, how?',
        type: 'textarea',
        placeholder: 'e.g., Yes — rads can reassign from their worklist. Lead rad can also reassign via admin worklist view.',
      },
    ],
  },
  {
    id: 'report-workflow',
    title: 'Report Workflow',
    description: 'Report creation, signing, and distribution preferences',
    questions: [
      {
        id: 'RW.21',
        text: 'Does your group use preliminary (wet read) reports before a final signed report?',
        type: 'dropdown',
        options: ['Yes — always', 'Yes — for STAT/ER studies only', 'No — final report only'],
      },
      {
        id: 'RW.22',
        text: 'What voice recognition / dictation software do your radiologists use?',
        type: 'dropdown',
        options: [
          'Dragon Medical One',
          'nVoq / Saykara',
          'Nuance PowerScribe',
          'Fluency (MModal)',
          'Manual typing only',
          'Other (describe below)',
        ],
      },
      {
        id: 'RW.22.1',
        text: 'If other dictation software, please name it and provide integration contact if known',
        type: 'textarea',
        placeholder: 'e.g., We use Suki AI — integration contact: integrations@suki.ai',
      },
      {
        id: 'RW.23',
        text: 'Do radiologists use report templates / macros? If yes, how are they maintained?',
        type: 'textarea',
        placeholder: 'e.g., Yes — each rad has personal macros in Dragon. Group-level templates maintained by lead rad in a shared library.',
      },
      {
        id: 'RW.24',
        text: 'Does a report require co-signature or attestation (e.g., resident → attending)?',
        type: 'dropdown',
        options: ['Yes — resident/fellow reports need attending co-sign', 'No — all rads sign independently'],
      },
      {
        id: 'RW.25',
        text: 'Are addenda to signed reports permitted? If so, who can create them?',
        type: 'textarea',
        placeholder: 'e.g., Yes — any radiologist can create an addendum. Addendum triggers a new ORU to the RIS.',
      },
    ],
  },
  {
    id: 'critical-results',
    title: 'Critical Results',
    description: 'Process for communicating critical / urgent findings',
    questions: [
      {
        id: 'RW.26',
        text: 'Does your organization have a formal critical results / critical findings policy?',
        type: 'dropdown',
        options: ['Yes', 'No', 'In development'],
      },
      {
        id: 'RW.27',
        text: 'How are critical results communicated from the radiologist to the ordering provider?',
        type: 'multi-select',
        options: [
          'Phone call — rad calls ordering provider directly',
          'Secure message / in-app notification',
          'Critical results tracking system (e.g., Primordial, Talksoft)',
          'Nurse / clinical coordinator relay',
          'Documented in report header only',
        ],
      },
      {
        id: 'RW.28',
        text: 'Should critical results be documented / tracked inside New Lantern?',
        type: 'dropdown',
        options: ['Yes — NL should capture the notification and callback confirmation', 'No — tracked externally'],
      },
      {
        id: 'RW.29',
        text: 'Who is responsible for critical results escalation if the ordering provider cannot be reached?',
        type: 'textarea',
        placeholder: 'e.g., After 2 attempts, rad contacts charge nurse or attending on duty. Documents all attempts in report.',
      },
    ],
  },
  {
    id: 'qa-peer-review',
    title: 'Quality Assurance & Peer Review',
    description: 'QA processes, peer review programs, and error tracking',
    questions: [
      {
        id: 'RW.30',
        text: 'Does your group participate in a peer review / quality assurance program?',
        type: 'dropdown',
        options: ['Yes — ACR RADPEER', 'Yes — internal program', 'Yes — both ACR and internal', 'No'],
      },
      {
        id: 'RW.31',
        text: 'What percentage of studies require peer review, and who selects them?',
        type: 'textarea',
        placeholder: 'e.g., 2% random selection via system. RADPEER score entered at time of read on prior studies.',
      },
      {
        id: 'RW.32',
        text: 'Is there a discrepancy / error tracking workflow? Who reviews and acts on discrepancies?',
        type: 'textarea',
        placeholder: 'e.g., Major discrepancies reported to QA committee monthly. Lead rad reviews all major discordances.',
      },
      {
        id: 'RW.33',
        text: 'Are there any regulatory or accreditation requirements that impact the QA workflow (e.g., ACR, Joint Commission, state licensure)?',
        type: 'textarea',
        placeholder: 'e.g., ACR accredited — must maintain RADPEER data. State requires 2-year report retention minimum.',
      },
    ],
  },
  {
    id: 'rad-user-setup',
    title: 'Radiologist User Setup',
    description: 'Credentialing, training, and account provisioning details',
    questions: [
      {
        id: 'RW.34',
        text: 'How will radiologist accounts be provisioned? (SSO, invite link, manual by admin)',
        type: 'dropdown',
        options: [
          'SSO / SAML (managed by partner IT)',
          'Email invite from New Lantern admin',
          'Manual account creation by partner admin',
        ],
      },
      {
        id: 'RW.35',
        text: 'What NPI data is required in each radiologist\'s profile?',
        type: 'textarea',
        placeholder: 'e.g., Individual NPI, Group NPI, State license number(s), DEA number if applicable',
      },
      {
        id: 'RW.36',
        text: 'Are there any credentialing or licensing restrictions that limit which sites or study types a radiologist can read?',
        type: 'textarea',
        placeholder: 'e.g., Dr. Smith only licensed in NY and NJ — cannot read studies from FL sites. Mammography reads restricted to MQSA-certified rads only.',
      },
      {
        id: 'RW.37',
        text: 'What training / onboarding is required before a radiologist goes live?',
        type: 'textarea',
        placeholder: 'e.g., 1-hour live training session with NL trainer + completion of online self-paced module. Must read 5 practice studies before go-live clearance.',
      },
      {
        id: 'RW.38',
        text: 'Any other notes or requirements for radiologist onboarding not covered above?',
        type: 'textarea',
        placeholder: 'Open field for anything else important to your rad team\'s setup',
      },
    ],
  },
];

// Flat list of all questions for easy lookup by ID
export const allRadQuestions: RadQuestion[] = radOnboardingSections.flatMap(s => s.questions);

export const RAD_TOTAL_QUESTIONS = allRadQuestions.length;
