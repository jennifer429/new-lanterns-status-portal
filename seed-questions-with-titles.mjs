import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

// Helper function to create short title from question text
function createShortTitle(text) {
  // Take first few words, remove special chars, capitalize
  return text
    .split(':')[0] // Take part before colon
    .split('(')[0] // Remove parentheses
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .split(' ')
    .slice(0, 4) // Take first 4 words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-');
}

const questionsData = [
  // Organization Information (H.1 - H.10)
  { questionId: 'H.1', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 1, shortTitle: 'Number-Of-Sites', questionText: 'Number of sites/locations', questionType: 'text', placeholder: 'Enter number of sites' },
  { questionId: 'H.2', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 2, shortTitle: 'Site-Names-Identifiers', questionText: 'Site names and identifiers', questionType: 'textarea', placeholder: 'List all site names and IDs' },
  { questionId: 'H.3', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 3, shortTitle: 'IT-Contact', questionText: 'IT contact name, email, phone', questionType: 'textarea', placeholder: 'Name, email, phone number' },
  { questionId: 'H.4', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 4, shortTitle: 'Radiology-Manager-Contact', questionText: 'Radiology tech manager contact', questionType: 'textarea', placeholder: 'Name, email, phone number' },
  { questionId: 'H.5', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 5, shortTitle: 'Radiologist-Contact', questionText: 'Radiologist contact (if different)', questionType: 'textarea', placeholder: 'Name, email, phone number' },
  { questionId: 'H.6', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 6, shortTitle: 'Preferred-Testing-Days', questionText: 'Preferred testing days/times', questionType: 'textarea', placeholder: 'Days and time windows' },
  { questionId: 'H.7', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 7, shortTitle: 'Go-Live-Date', questionText: 'Target go-live date', questionType: 'date' },
  { questionId: 'H.8', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 8, shortTitle: 'Timezone', questionText: 'Timezone', questionType: 'dropdown', options: JSON.stringify(['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii']) },
  { questionId: 'H.9', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 9, shortTitle: 'Business-Hours', questionText: 'Business hours', questionType: 'text', placeholder: 'e.g., 8 AM - 5 PM EST' },
  { questionId: 'H.10', sectionId: 'org-info', sectionTitle: 'Organization Information', questionNumber: 10, shortTitle: 'After-Hours-Support', questionText: 'After-hours support contact', questionType: 'textarea', placeholder: 'Name, email, phone for emergencies' },

  // Overview & Architecture (A.1 - A.9)
  { questionId: 'A.1', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 1, shortTitle: 'Current-PACS-Vendor', questionText: 'Current PACS vendor', questionType: 'text', placeholder: 'e.g., GE, Philips, Fuji' },
  { questionId: 'A.2', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 2, shortTitle: 'PACS-Version', questionText: 'PACS version', questionType: 'text', placeholder: 'Version number' },
  { questionId: 'A.3', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 3, shortTitle: 'RIS-Vendor', questionText: 'RIS vendor', questionType: 'text', placeholder: 'e.g., Epic, Cerner, Meditech' },
  { questionId: 'A.4', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 4, shortTitle: 'RIS-Version', questionText: 'RIS version', questionType: 'text', placeholder: 'Version number' },
  { questionId: 'A.5', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 5, shortTitle: 'Modality-List', questionText: 'Modality list', questionType: 'multi-select', options: JSON.stringify(['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Mammography', 'Nuclear Medicine', 'PET', 'Fluoroscopy', 'Other']) },
  { questionId: 'A.6', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 6, shortTitle: 'Modality-Count', questionText: 'Number of modalities', questionType: 'text', placeholder: 'Total count' },
  { questionId: 'A.7', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 7, shortTitle: 'Annual-Study-Volume', questionText: 'Annual study volume', questionType: 'text', placeholder: 'Approximate number of studies per year' },
  { questionId: 'A.8', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 8, shortTitle: 'Network-Topology', questionText: 'Network topology', questionType: 'dropdown', options: JSON.stringify(['Single site', 'Multi-site with VPN', 'Multi-site with MPLS', 'Cloud-based', 'Hybrid']) },
  { questionId: 'A.9', sectionId: 'overview-arch', sectionTitle: 'Overview & Architecture', questionNumber: 9, shortTitle: 'Firewall-Details', questionText: 'Firewall details', questionType: 'textarea', placeholder: 'Vendor, model, configuration notes' },

  // Data & Integration (D.1 - D.14)
  { questionId: 'D.1', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 1, shortTitle: 'HL7-Interface-Engine', questionText: 'HL7 interface engine', questionType: 'text', placeholder: 'e.g., Mirth, Rhapsody, Cloverleaf' },
  { questionId: 'D.2', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 2, shortTitle: 'HL7-Version', questionText: 'HL7 version', questionType: 'dropdown', options: JSON.stringify(['2.3', '2.4', '2.5', '2.6', '2.7', 'Other']) },
  { questionId: 'D.3', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 3, shortTitle: 'ADT-Feed', questionText: 'ADT feed available?', questionType: 'dropdown', options: JSON.stringify(['Yes', 'No', 'Partial']) },
  { questionId: 'D.4', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 4, shortTitle: 'ORM-Feed', questionText: 'ORM feed available?', questionType: 'dropdown', options: JSON.stringify(['Yes', 'No', 'Partial']) },
  { questionId: 'D.5', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 5, shortTitle: 'ORU-Feed', questionText: 'ORU feed available?', questionType: 'dropdown', options: JSON.stringify(['Yes', 'No', 'Partial']) },
  { questionId: 'D.6', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 6, shortTitle: 'Patient-Demographics', questionText: 'Patient demographics source', questionType: 'text', placeholder: 'System name' },
  { questionId: 'D.7', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 7, shortTitle: 'Accession-Number-Format', questionText: 'Accession number format', questionType: 'textarea', placeholder: 'Describe format and example' },
  { questionId: 'D.8', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 8, shortTitle: 'MRN-Format', questionText: 'MRN format', questionType: 'textarea', placeholder: 'Describe format and example' },
  { questionId: 'D.9', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 9, shortTitle: 'Facility-ID', questionText: 'Facility ID', questionType: 'text', placeholder: 'Unique identifier' },
  { questionId: 'D.10', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 10, shortTitle: 'Institution-Name', questionText: 'Institution name', questionType: 'text', placeholder: 'Official name' },
  { questionId: 'D.11', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 11, shortTitle: 'Referring-Physician-List', questionText: 'Referring physician list', questionType: 'upload', notes: 'Upload CSV or Excel file' },
  { questionId: 'D.12', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 12, shortTitle: 'Radiologist-List', questionText: 'Radiologist list', questionType: 'upload', notes: 'Upload CSV or Excel file' },
  { questionId: 'D.13', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 13, shortTitle: 'Procedure-Code-List', questionText: 'Procedure code list', questionType: 'upload', notes: 'Upload CSV or Excel file' },
  { questionId: 'D.14', sectionId: 'data-integration', sectionTitle: 'Data & Integration', questionNumber: 14, shortTitle: 'Custom-Fields', questionText: 'Custom fields required', questionType: 'textarea', placeholder: 'List any custom data fields needed' },

  // Configuration Files (C.1 - C.5)
  { questionId: 'C.1', sectionId: 'config-files', sectionTitle: 'Configuration Files', questionNumber: 1, shortTitle: 'DICOM-Config-Export', questionText: 'DICOM configuration export', questionType: 'upload-download', notes: 'Download template, fill, and upload' },
  { questionId: 'C.2', sectionId: 'config-files', sectionTitle: 'Configuration Files', questionNumber: 2, shortTitle: 'AE-Title-List', questionText: 'AE title list', questionType: 'upload', notes: 'List of all DICOM AE titles' },
  { questionId: 'C.3', sectionId: 'config-files', sectionTitle: 'Configuration Files', questionNumber: 3, shortTitle: 'Modality-Worklist-Config', questionText: 'Modality worklist configuration', questionType: 'upload', notes: 'MWL settings and mappings' },
  { questionId: 'C.4', sectionId: 'config-files', sectionTitle: 'Configuration Files', questionNumber: 4, shortTitle: 'Routing-Rules', questionText: 'Routing rules', questionType: 'upload', notes: 'Study routing configuration' },
  { questionId: 'C.5', sectionId: 'config-files', sectionTitle: 'Configuration Files', questionNumber: 5, shortTitle: 'Archive-Policy', questionText: 'Archive policy', questionType: 'textarea', placeholder: 'Retention periods and rules' },

  // Connectivity (N.1 - N.8)
  { questionId: 'N.1', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 1, shortTitle: 'VPN-Type', questionText: 'VPN type', questionType: 'dropdown', options: JSON.stringify(['Site-to-site', 'Client VPN', 'Both', 'None']) },
  { questionId: 'N.2', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 2, shortTitle: 'VPN-Vendor', questionText: 'VPN vendor', questionType: 'text', placeholder: 'e.g., Cisco, Palo Alto, FortiGate' },
  { questionId: 'N.3', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 3, shortTitle: 'Public-IP-Address', questionText: 'Public IP address', questionType: 'text', placeholder: 'xxx.xxx.xxx.xxx' },
  { questionId: 'N.4', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 4, shortTitle: 'Internal-IP-Range', questionText: 'Internal IP range', questionType: 'text', placeholder: 'e.g., 10.0.0.0/24' },
  { questionId: 'N.5', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 5, shortTitle: 'DICOM-Ports', questionText: 'DICOM ports', questionType: 'text', placeholder: 'e.g., 104, 11112' },
  { questionId: 'N.6', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 6, shortTitle: 'HL7-Ports', questionText: 'HL7 ports', questionType: 'text', placeholder: 'e.g., 2575, 6661' },
  { questionId: 'N.7', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 7, shortTitle: 'Bandwidth', questionText: 'Bandwidth', questionType: 'text', placeholder: 'e.g., 100 Mbps, 1 Gbps' },
  { questionId: 'N.8', sectionId: 'connectivity', sectionTitle: 'Connectivity', questionNumber: 8, shortTitle: 'Network-Diagram', questionText: 'Network diagram', questionType: 'upload', notes: 'Upload network topology diagram' },

  // DICOM Data Validation (V.1 - V.5)
  { questionId: 'V.1', sectionId: 'dicom-validation', sectionTitle: 'DICOM Data Validation', questionNumber: 1, shortTitle: 'Sample-Studies', questionText: 'Sample studies', questionType: 'upload', notes: 'Upload 3-5 representative DICOM studies' },
  { questionId: 'V.2', sectionId: 'dicom-validation', sectionTitle: 'DICOM Data Validation', questionNumber: 2, shortTitle: 'Modality-Coverage', questionText: 'Modality coverage', questionType: 'multi-select', options: JSON.stringify(['CT', 'MRI', 'X-Ray', 'Ultrasound', 'Mammography', 'Nuclear Medicine', 'PET', 'Fluoroscopy']) },
  { questionId: 'V.3', sectionId: 'dicom-validation', sectionTitle: 'DICOM Data Validation', questionNumber: 3, shortTitle: 'Known-Issues', questionText: 'Known DICOM issues', questionType: 'textarea', placeholder: 'Describe any known problems with DICOM data' },
  { questionId: 'V.4', sectionId: 'dicom-validation', sectionTitle: 'DICOM Data Validation', questionNumber: 4, shortTitle: 'Character-Set', questionText: 'Character set', questionType: 'text', placeholder: 'e.g., ISO_IR 100, UTF-8' },
  { questionId: 'V.5', sectionId: 'dicom-validation', sectionTitle: 'DICOM Data Validation', questionNumber: 5, shortTitle: 'Special-Requirements', questionText: 'Special requirements', questionType: 'textarea', placeholder: 'Any special handling needed for DICOM data' },
];

console.log(`Seeding ${questionsData.length} questions...`);

for (const q of questionsData) {
  await db.insert(schema.questions).values(q);
}

console.log('✓ Questions seeded successfully!');
await connection.end();
