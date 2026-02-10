/**
 * Workflow-Based Questionnaire Structure
 * 
 * MAJOR CHANGE: Replaces text-based "Overview & Architecture" section
 * with 4 interactive visual workflow diagrams
 * 
 * New Structure (9 sections total):
 * 1. Organization Information
 * 2. Orders Workflow (NEW - visual diagram)
 * 3. Images Workflow (NEW - visual diagram)
 * 4. Priors Workflow (NEW - visual diagram)
 * 5. Reports Out Workflow (NEW - visual diagram)
 * 6. Data & Integration
 * 7. Configuration Files
 * 8. VPN & Connectivity
 * 9. HL7 Configuration
 * 
 * Each workflow section uses the WorkflowDiagram component instead of
 * traditional text questions. Users configure architecture visually
 * with checkboxes and conditional fields.
 */

import { Section } from './questionnaireData';

/**
 * Workflow section definition
 * Special section type that renders WorkflowDiagram component
 */
export interface WorkflowSection extends Omit<Section, 'questions'> {
  type: 'workflow';
  workflowType: 'orders' | 'images' | 'priors' | 'reports';
  // Workflow sections don't have traditional questions
  // Configuration is stored as JSON in a single response record
}

/**
 * Orders Workflow Section
 * 
 * Replaces questions:
 * - A.9: Do you have a RIS?
 * - A.9.1: What is your RIS system name?
 * - A.10: Do you have an EHR system?
 * - A.10.1: What is your EHR system name?
 * 
 * Visual diagram shows:
 * - RIS → Silverback → New Lantern (if checked)
 * - EHR → Silverback → New Lantern (if checked)
 * - Manual Entry annotation (if checked)
 */
export const ordersWorkflowSection: WorkflowSection = {
  id: 'orders-workflow',
  type: 'workflow',
  workflowType: 'orders',
  title: 'Orders Workflow',
  description: 'Configure how imaging orders reach New Lantern',
};

/**
 * Images Workflow Section
 * 
 * Replaces questions:
 * - A.11: What is your PACS system?
 * - A.12: What is your current archive system (VNA)?
 * - A.14: Please list all AI integrations
 * - A.16: Will your modality worklist system be impacted?
 * - A.16.1: What is your modality worklist system name?
 * 
 * Visual diagram shows:
 * - Modality Worklist: RIS/PACS → Modalities (if checked)
 * - AI Routing: Modalities → AI Systems → PACS (if checked)
 * - Standard Path: Modalities → PACS → VNA → Silverback → New Lantern
 * - OR Direct Routing: Modalities → VNA + Silverback → New Lantern (PACS grayed out)
 */
export const imagesWorkflowSection: WorkflowSection = {
  id: 'images-workflow',
  type: 'workflow',
  workflowType: 'images',
  title: 'Images Workflow (DICOM)',
  description: 'Configure how new images flow to New Lantern',
};

/**
 * Priors Workflow Section
 * 
 * Replaces questions:
 * - D.5: How will comparison images for priors be obtained?
 * - D.7: How will prior reports be obtained?
 * - A.13: System that produces DICOM SR
 * 
 * Visual diagram shows:
 * - Prior Images (DICOM): VNA → Silverback → New Lantern (if checked)
 * - Prior Reports (HL7) from EHR: EHR → Silverback → New Lantern (if checked)
 * - Prior Reports (HL7) from RIS: RIS → Silverback → New Lantern (if checked)
 * - Prior Reports (DICOM SR/PDF): VNA → Silverback → New Lantern (if checked)
 */
export const priorsWorkflowSection: WorkflowSection = {
  id: 'priors-workflow',
  type: 'workflow',
  workflowType: 'priors',
  title: 'Priors Workflow',
  description: 'Configure how prior images and reports reach New Lantern',
};

/**
 * Reports Out Workflow Section
 * 
 * New section - previously not explicitly diagrammed
 * 
 * Visual diagram shows:
 * - New Lantern → Silverback → EHR (if checked)
 * - New Lantern → Silverback → RIS (if checked)
 * - HL7 ORU message configuration
 */
export const reportsOutWorkflowSection: WorkflowSection = {
  id: 'reports-out-workflow',
  type: 'workflow',
  workflowType: 'reports',
  title: 'Reports Out Workflow',
  description: 'Configure where finalized reports are sent',
};

/**
 * All workflow sections in order
 */
export const workflowSections: WorkflowSection[] = [
  ordersWorkflowSection,
  imagesWorkflowSection,
  priorsWorkflowSection,
  reportsOutWorkflowSection,
];
