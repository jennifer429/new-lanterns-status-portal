/**
 * Rad Onboarding Worklist Questionnaire
 * Partner-level questionnaire — filled out once per partner (client), not per site.
 * Covers radiologist workflow setup, worklist preferences, routing, and QA.
 */

export interface RadQuestion {
  id: string;          // e.g., "RW.1"
  text: string;
  type: 'text' | 'textarea' | 'dropdown' | 'multi-select' | 'upload';
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

// ─── Additional sections appended below ─────────────────────────────────────

radOnboardingSections.push(
  // ── Section 9: Templates ──────────────────────────────────────────────────
  {
    id: 'templates',
    title: 'Report Templates',
    description: 'Upload your standard report templates and describe how they should be configured',
    questions: [
      {
        id: 'RW.39',
        text: 'Upload your report template library (Word, PDF, or exported from your dictation system)',
        type: 'upload',
        notes: 'Accepted: .docx, .pdf, .txt, .zip. Upload one file or a zip of multiple templates.',
      },
      {
        id: 'RW.40',
        text: 'Describe the template naming convention and how templates are organized (by modality, subspecialty, body part, etc.)',
        type: 'textarea',
        placeholder: 'e.g., Templates named by modality-bodypart: CT-Chest, MR-Brain, XR-Chest. Organized by subspecialty folder in Dragon.',
      },
      {
        id: 'RW.41',
        text: 'Are there site-specific or radiologist-specific template variants that differ from the master library?',
        type: 'textarea',
        placeholder: 'e.g., Yes — Dr. Johnson has custom neuro templates. Site B uses a pediatric chest template not in the master set.',
      },
      {
        id: 'RW.42',
        text: 'Should templates be locked (read-only) for most rads, editable only by a template admin?',
        type: 'dropdown',
        options: [
          'Yes — central template admin controls the library',
          'No — each radiologist can create and edit their own',
          'Mixed — shared templates locked, personal templates editable',
        ],
      },
    ],
  },

  // ── Section 10: Procedures & RVU ─────────────────────────────────────────
  {
    id: 'procedures-rvu',
    title: 'Procedures & RVU',
    description: 'Procedure code list and RVU tracking preferences',
    questions: [
      {
        id: 'RW.43',
        text: 'Upload your procedure code list with associated CPT codes and RVU values',
        type: 'upload',
        notes: 'Preferred format: Excel or CSV with columns — Procedure Code, Description, Modality, CPT Code, Work RVU, Total RVU.',
      },
      {
        id: 'RW.44',
        text: 'How do you want RVU values displayed or tracked in New Lantern?',
        type: 'dropdown',
        options: [
          'Display work RVU per study on the worklist',
          'Track cumulative RVU per radiologist per day/week/month',
          'Both display and tracking',
          'No RVU tracking needed',
        ],
      },
      {
        id: 'RW.45',
        text: 'Are there procedures that should be flagged or restricted (e.g., requires fellowship-trained rad, MQSA certification)?',
        type: 'textarea',
        placeholder: 'e.g., Mammography: MQSA-certified rads only. Interventional procedures: IR fellowship required. Pediatric MR: pediatric rad preferred.',
      },
      {
        id: 'RW.46',
        text: 'Do you use add-on CPT codes or modifier tracking for complex cases?',
        type: 'textarea',
        placeholder: 'e.g., Yes — we use modifier 26 (professional component only). Add-on codes 75571 and 75572 tracked separately for cardiac CT.',
      },
    ],
  },

  // ── Section 11: Macros ───────────────────────────────────────────────────
  {
    id: 'macros',
    title: 'Macros',
    description: 'Dictation macros, text shortcuts, and auto-fill content',
    questions: [
      {
        id: 'RW.47',
        text: 'Upload your current macro library (exported from Dragon, PowerScribe, or other dictation system)',
        type: 'upload',
        notes: 'Accepted: Dragon .xml export, PowerScribe macro export, plain text list. One file or zip.',
      },
      {
        id: 'RW.48',
        text: 'Describe the macro naming convention and how they are triggered (voice command, keyboard shortcut, etc.)',
        type: 'textarea',
        placeholder: 'e.g., Macros named "normal chest" → voice command "insert normal chest". Triggered by saying the macro name. ~120 macros in the library.',
      },
      {
        id: 'RW.49',
        text: 'Are macros shared across all radiologists or maintained individually?',
        type: 'dropdown',
        options: [
          'Shared library only — all rads use the same macros',
          'Individual only — each rad maintains their own',
          'Both — shared base library + individual customization allowed',
        ],
      },
      {
        id: 'RW.50',
        text: 'Are there normal / baseline macros that auto-populate specific report sections (e.g., "normal abdomen and pelvis")?',
        type: 'textarea',
        placeholder: 'e.g., Yes — "normal abdomen pelvis" fills findings and impression sections. "normal CXR" fills a standard normal chest template.',
      },
    ],
  },

  // ── Section 12: Hotkeys ──────────────────────────────────────────────────
  {
    id: 'hotkeys',
    title: 'Hotkeys & Keyboard Preferences',
    description: 'Keyboard shortcuts, viewer hotkeys, and workstation key bindings',
    questions: [
      {
        id: 'RW.51',
        text: 'Upload your current hotkey / keyboard shortcut mapping file',
        type: 'upload',
        notes: 'Accepted: exported config from your PACS viewer, Excel/CSV mapping, or plain text list. Format: Action → Key.',
      },
      {
        id: 'RW.52',
        text: 'List the most critical hotkeys your radiologists rely on (window/level presets, scroll speed, series navigation, sign/save)',
        type: 'textarea',
        placeholder: 'e.g., F1 = sign report, F2 = next study, F3 = abdomen window preset, F4 = lung window, Ctrl+Z = undo, Space = play cine.',
      },
      {
        id: 'RW.53',
        text: 'Do radiologists use a foot pedal for dictation control (play/stop/rewind)?',
        type: 'dropdown',
        options: ['Yes — Olympus', 'Yes — Philips SpeechMike', 'Yes — other (describe below)', 'No'],
      },
      {
        id: 'RW.53.1',
        text: 'If other foot pedal / dictation hardware, please describe the model and how it is mapped',
        type: 'textarea',
        placeholder: 'e.g., Stenograph foot pedal — left pedal = rewind, center = play/stop, right = fast forward.',
      },
    ],
  },

  // ── Section 13: Billing & Address ─────────────────────────────────────────
  {
    id: 'billing',
    title: 'Billing & Address',
    description: 'Billing entities, addresses, and report signature requirements for claims',
    questions: [
      {
        id: 'RW.54',
        text: 'Legal billing entity name (as it should appear on reports and claims)',
        type: 'text',
        placeholder: 'e.g., Apex Radiology Associates, LLC',
      },
      {
        id: 'RW.55',
        text: 'Primary billing address',
        type: 'textarea',
        placeholder: 'Street, City, State, ZIP, Country',
      },
      {
        id: 'RW.56',
        text: 'Tax ID / NPI (Group NPI for the billing entity)',
        type: 'text',
        placeholder: 'e.g., Group NPI: 1234567890 / EIN: 12-3456789',
      },
      {
        id: 'RW.57',
        text: 'Who is the billing contact (name, email, phone)?',
        type: 'textarea',
        placeholder: 'e.g., Jane Smith, billing@apexrad.com, (555) 123-4567',
      },
      {
        id: 'RW.58',
        text: 'What billing system / RCM platform do you use?',
        type: 'text',
        placeholder: 'e.g., Kareo, AdvancedMD, Athenahealth, Epic Resolute, in-house',
      },
      {
        id: 'RW.59',
        text: 'Does the signed report need to include specific billing fields (e.g., rendering provider NPI, place of service code, attending physician)?',
        type: 'textarea',
        placeholder: 'e.g., Report footer must include: Rendering NPI, Group NPI, Place of Service 22 (Outpatient Hospital). Attending co-signature required for inpatient.',
      },
      {
        id: 'RW.60',
        text: 'Are there any insurance-specific report format requirements (e.g., Medicare, Medicaid, specific commercial plans)?',
        type: 'textarea',
        placeholder: 'e.g., Medicare requires laterality documented in impression. Medicaid requires procedure description in first line of findings.',
      },
    ],
  },

  // ── Section 14: Report Requirements ──────────────────────────────────────
  {
    id: 'report-requirements',
    title: 'Report Requirements',
    description: 'Required report fields, formatting standards, and distribution rules',
    questions: [
      {
        id: 'RW.61',
        text: 'What required fields must every report contain? (e.g., clinical indication, technique, comparison, findings, impression)',
        type: 'multi-select',
        options: [
          'Clinical indication',
          'Technique / protocol',
          'Comparison studies',
          'Findings (by organ/system)',
          'Impression / conclusion',
          'Recommendation / follow-up',
          'Radiation dose (CT)',
          'Contrast information',
          'Referring physician',
          'Interpreting radiologist name + credentials',
          'Date/time of interpretation',
          'Electronic signature',
        ],
      },
      {
        id: 'RW.62',
        text: 'Are there structured reporting requirements for any modalities or subspecialties (e.g., RADS scoring systems like LI-RADS, PI-RADS, BI-RADS, TI-RADS)?',
        type: 'textarea',
        placeholder: 'e.g., Liver MR: LI-RADS required. Prostate MR: PI-RADS required. Breast US: BI-RADS required. Thyroid US: TI-RADS required.',
      },
      {
        id: 'RW.63',
        text: 'What are the required report distribution destinations (e.g., RIS, EHR, referring physician portal, patient portal)?',
        type: 'textarea',
        placeholder: 'e.g., Final reports sent to: Epic EHR (HL7 ORU), referring physician secure email (DrFirst), patient MyChart portal (24hr delay).',
      },
      {
        id: 'RW.64',
        text: 'What is the report retention policy (how long must reports be stored)?',
        type: 'text',
        placeholder: 'e.g., 7 years for adults, 7 years past age of majority for pediatric (21 + 7 = 28 years in most states)',
      },
      {
        id: 'RW.65',
        text: 'Are there any state-specific or accreditation-required report formatting rules you need to comply with?',
        type: 'textarea',
        placeholder: 'e.g., ACR accreditation requires radiation dose index recorded for all CT. State X requires plain-language impression for patient-facing reports.',
      },
    ],
  },

  // ── Section 15: MIPS ─────────────────────────────────────────────────────
  {
    id: 'mips',
    title: 'MIPS & Quality Measures',
    description: 'Merit-Based Incentive Payment System participation and quality reporting',
    questions: [
      {
        id: 'RW.66',
        text: 'Does your group participate in MIPS (Merit-Based Incentive Payment System)?',
        type: 'dropdown',
        options: [
          'Yes — we report as a group (TIN-level)',
          'Yes — individual radiologists report separately',
          'No — we are exempt (low-volume threshold)',
          'No — we participate through an APM / ACO instead',
          'Unsure',
        ],
      },
      {
        id: 'RW.67',
        text: 'Which MIPS performance categories apply to your group?',
        type: 'multi-select',
        options: [
          'Quality measures',
          'Promoting Interoperability (PI)',
          'Improvement Activities (IA)',
          'Cost',
        ],
      },
      {
        id: 'RW.68',
        text: 'Which radiology-specific quality measures do you report (e.g., ACR QCDR measures, eCQMs)?',
        type: 'textarea',
        placeholder: 'e.g., QCDR measure RAD-01 (CT dose), RAD-02 (appropriate imaging), eCQM CMS528 (lung cancer screening follow-up). Submitted via ACR NRDR registry.',
      },
      {
        id: 'RW.69',
        text: 'What registry or reporting method do you use for MIPS data submission?',
        type: 'dropdown',
        options: [
          'ACR NRDR (National Radiology Data Registry)',
          'Claims-based submission',
          'EHR-based submission',
          'Qualified Clinical Data Registry (QCDR) — other',
          'Not applicable',
        ],
      },
      {
        id: 'RW.70',
        text: 'Are there data elements New Lantern needs to capture in the report to support MIPS measure documentation?',
        type: 'textarea',
        placeholder: 'e.g., CT DLP and CTDI must be auto-captured from DICOM header and included in report. Lung-RADS category must be structured for RAD-02 reporting.',
      },
    ],
  },

  // ── Section 16: AI Integration ───────────────────────────────────────────
  {
    id: 'ai-integration',
    title: 'AI Integration',
    description: 'AI/ML tools in the reading workflow — triage, detection, and automation',
    questions: [
      {
        id: 'RW.71',
        text: 'Does your group currently use or plan to use AI/ML tools in the radiology workflow?',
        type: 'dropdown',
        options: [
          'Yes — currently using one or more AI tools',
          'Yes — planning to add AI tools at go-live',
          'Evaluating / no decision yet',
          'No',
        ],
      },
      {
        id: 'RW.72',
        text: 'Which AI tools or vendors are you using or evaluating?',
        type: 'textarea',
        placeholder: 'e.g., Aidoc (triage — ICH, PE, aorta), Viz.ai (stroke triage), Nuance AI (report automation), Gleamer (fracture detection). Evaluating: Sievenius (lung nodule).',
      },
      {
        id: 'RW.73',
        text: 'What AI use cases are in scope?',
        type: 'multi-select',
        options: [
          'Triage / worklist prioritization (e.g., stat flag ICH, PE)',
          'Detection / CAD (abnormality flagging)',
          'Measurements / quantification (e.g., nodule size, EF)',
          'Report draft / pre-population',
          'Hanging protocol automation',
          'Dose optimization',
          'Prior image retrieval and comparison',
          'Scheduling / slot optimization',
        ],
      },
      {
        id: 'RW.74',
        text: 'How should AI alerts surface in the New Lantern worklist? (e.g., separate alert column, color flag, notification banner)',
        type: 'textarea',
        placeholder: 'e.g., Aidoc ICH alert → red banner on study row + push notification to on-call rad. Lung nodule CAD → orange flag in worklist, visible in viewer overlay.',
      },
      {
        id: 'RW.75',
        text: 'Is the AI vendor integrated via DICOM or HL7, and who manages the integration (partner IT, AI vendor, New Lantern)?',
        type: 'textarea',
        placeholder: 'e.g., Aidoc receives DICOM from PACS via DICOMweb. Results returned as DICOM SR. Aidoc handles the integration setup; NL maps SR tags to worklist flags.',
      },
      {
        id: 'RW.76',
        text: 'Should AI findings be included or referenced in the final radiology report?',
        type: 'dropdown',
        options: [
          'Yes — AI result auto-appended to report technique section',
          'Yes — rad decides whether to include case-by-case',
          'No — AI is for triage only, not referenced in report',
          'TBD / not yet decided',
        ],
      },
    ],
  },
);

// Flat list of all questions for easy lookup by ID
export const allRadQuestions: RadQuestion[] = radOnboardingSections.flatMap(s => s.questions);

export const RAD_TOTAL_QUESTIONS = allRadQuestions.length;
