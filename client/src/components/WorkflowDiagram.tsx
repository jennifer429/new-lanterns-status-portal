/**
 * WorkflowDiagram Component - Swim Lane Design
 * 
 * Interactive swim lane workflow diagram for PACS onboarding
 * Each pathway is a horizontal lane showing: Checkbox → Source → Arrow → Destination → Notes
 * 
 * Features:
 * - Swim lane layout: each pathway is a horizontal row
 * - Multi-select: multiple pathways can be active simultaneously
 * - Active state: checked lanes are highlighted in purple with active input fields
 * - Inactive state: unchecked lanes are grayed out with disabled inputs
 * - Supports 4 workflow types: Orders, Images, Priors, Reports Out
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

/**
 * Workflow configuration interface
 */
export interface WorkflowConfiguration {
  paths: {
    [key: string]: boolean;
  };
  systems: {
    [key: string]: string;
  };
  notes: {
    [key: string]: string;
  };
}

interface WorkflowDiagramProps {
  workflowType: 'orders' | 'images' | 'priors' | 'reports';
  configuration: WorkflowConfiguration;
  onConfigurationChange: (config: WorkflowConfiguration) => void;
}

/**
 * Swim Lane Row Component
 * Represents one pathway: Checkbox → Source → Arrow → Destination → Notes Input
 */
interface SwimLaneRowProps {
  id: string;
  label: string;
  sourceSystem: string;
  destinationSystem: string;
  isActive: boolean;
  noteValue: string;
  notePlaceholder: string;
  onCheckChange: (checked: boolean) => void;
  onNoteChange: (value: string) => void;
}

const SwimLaneRow: React.FC<SwimLaneRowProps> = ({
  id,
  label,
  sourceSystem,
  destinationSystem,
  isActive,
  noteValue,
  notePlaceholder,
  onCheckChange,
  onNoteChange,
}) => {
  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-lg transition-all
        ${isActive ? 'bg-primary/10' : 'bg-muted/30'}
      `}
    >
      {/* Checkbox */}
      <Checkbox
        id={id}
        checked={isActive}
        onCheckedChange={(checked) => onCheckChange(checked as boolean)}
        className={isActive ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
      />

      {/* Source System Box */}
      <div
        className={`
          px-4 py-2 rounded-md font-medium min-w-[140px] text-center
          ${isActive 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
          }
        `}
      >
        {sourceSystem}
      </div>

      {/* Arrow */}
      <ArrowRight
        className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
      />

      {/* Destination System Box */}
      <div
        className={`
          px-4 py-2 rounded-md font-medium min-w-[140px] text-center
          ${isActive 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
          }
        `}
      >
        {destinationSystem}
      </div>

      {/* Notes Input Field */}
      <Input
        placeholder={notePlaceholder}
        value={noteValue}
        onChange={(e) => onNoteChange(e.target.value)}
        disabled={!isActive}
        className={`
          flex-1
          ${isActive 
            ? 'border-primary bg-background' 
            : 'bg-muted/50 text-muted-foreground'
          }
        `}
      />
    </div>
  );
};

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  workflowType,
  configuration,
  onConfigurationChange,
}) => {
  const handleCheckboxChange = (pathKey: string, checked: boolean) => {
    onConfigurationChange({
      ...configuration,
      paths: {
        ...configuration.paths,
        [pathKey]: checked,
      },
    });
  };

  const handleNoteChange = (noteKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      notes: {
        ...configuration.notes,
        [noteKey]: value,
      },
    });
  };

  /**
   * Render Orders Workflow
   */
  const renderOrdersWorkflow = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg mb-4">Configure Order Sources</h3>
        
        <SwimLaneRow
          id="ordersFromRIS"
          label="Orders from RIS (HL7)"
          sourceSystem="RIS"
          destinationSystem="New Lantern"
          isActive={configuration.paths.ordersFromRIS || false}
          noteValue={configuration.notes.ordersFromRIS_note || ''}
          notePlaceholder="e.g., Primary workflow - all radiology orders from Epic RIS"
          onCheckChange={(checked) => handleCheckboxChange('ordersFromRIS', checked)}
          onNoteChange={(value) => handleNoteChange('ordersFromRIS_note', value)}
        />

        <SwimLaneRow
          id="ordersFromEHR"
          label="Orders from EHR (HL7)"
          sourceSystem="EHR"
          destinationSystem="New Lantern"
          isActive={configuration.paths.ordersFromEHR || false}
          noteValue={configuration.notes.ordersFromEHR_note || ''}
          notePlaceholder="e.g., Orders from Cerner for outpatient imaging"
          onCheckChange={(checked) => handleCheckboxChange('ordersFromEHR', checked)}
          onNoteChange={(value) => handleNoteChange('ordersFromEHR_note', value)}
        />

        <SwimLaneRow
          id="manualEntry"
          label="Manual Entry in PACS (No HL7)"
          sourceSystem="Manual Entry"
          destinationSystem="New Lantern"
          isActive={configuration.paths.manualEntry || false}
          noteValue={configuration.notes.manualEntry_note || ''}
          notePlaceholder="e.g., Downtime backup - used when RIS is offline"
          onCheckChange={(checked) => handleCheckboxChange('manualEntry', checked)}
          onNoteChange={(value) => handleNoteChange('manualEntry_note', value)}
        />
      </div>
    );
  };

  /**
   * Render Images Workflow
   */
  const renderImagesWorkflow = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg mb-4">Configure Image Sources</h3>
        
        <SwimLaneRow
          id="imagesFromModalities"
          label="Images from Modalities (DICOM)"
          sourceSystem="Modalities"
          destinationSystem="New Lantern"
          isActive={configuration.paths.imagesFromModalities || false}
          noteValue={configuration.notes.imagesFromModalities_note || ''}
          notePlaceholder="e.g., All CT, MR, X-ray modalities send directly to New Lantern"
          onCheckChange={(checked) => handleCheckboxChange('imagesFromModalities', checked)}
          onNoteChange={(value) => handleNoteChange('imagesFromModalities_note', value)}
        />

        <SwimLaneRow
          id="imagesFromPACS"
          label="Images from Existing PACS"
          sourceSystem="Current PACS"
          destinationSystem="New Lantern"
          isActive={configuration.paths.imagesFromPACS || false}
          noteValue={configuration.notes.imagesFromPACS_note || ''}
          notePlaceholder="e.g., Migration from legacy PACS - historical studies"
          onCheckChange={(checked) => handleCheckboxChange('imagesFromPACS', checked)}
          onNoteChange={(value) => handleNoteChange('imagesFromPACS_note', value)}
        />

        <SwimLaneRow
          id="imagesViaVNA"
          label="Images via VNA/Archive"
          sourceSystem="VNA"
          destinationSystem="New Lantern"
          isActive={configuration.paths.imagesViaVNA || false}
          noteValue={configuration.notes.imagesViaVNA_note || ''}
          notePlaceholder="e.g., Enterprise imaging archive integration"
          onCheckChange={(checked) => handleCheckboxChange('imagesViaVNA', checked)}
          onNoteChange={(value) => handleNoteChange('imagesViaVNA_note', value)}
        />

        {/* Viz.ai Dual-Send Workflow - Special rendering for branching flow */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.imagesViaVizAI ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          {/* Checkbox */}
          <Checkbox
            id="imagesViaVizAI"
            checked={configuration.paths.imagesViaVizAI || false}
            onCheckedChange={(checked) => handleCheckboxChange('imagesViaVizAI', checked as boolean)}
            className={configuration.paths.imagesViaVizAI ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Modalities Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center
              ${configuration.paths.imagesViaVizAI 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Modalities
          </div>

          {/* Arrow to Viz.ai */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Viz.ai Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center
              ${configuration.paths.imagesViaVizAI 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Viz.ai
          </div>

          {/* Dual arrows - branching to both destinations */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ArrowRight
                className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <div
                className={`
                  px-3 py-1 rounded-md font-medium text-sm
                  ${configuration.paths.imagesViaVizAI 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}
                `}
              >
                PACS
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight
                className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <div
                className={`
                  px-3 py-1 rounded-md font-medium text-sm
                  ${configuration.paths.imagesViaVizAI 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}
                `}
              >
                New Lantern
              </div>
            </div>
          </div>

          {/* Notes Input Field */}
          <Input
            placeholder="e.g., CT/MR modalities send to Viz.ai for AI analysis, then dual-send results to both legacy PACS and New Lantern"
            value={configuration.notes.imagesViaVizAI_note || ''}
            onChange={(e) => handleNoteChange('imagesViaVizAI_note', e.target.value)}
            disabled={!configuration.paths.imagesViaVizAI}
            className={`
              flex-1
              ${configuration.paths.imagesViaVizAI 
                ? 'border-primary bg-background' 
                : 'bg-muted/50 text-muted-foreground'}
            `}
          />
        </div>
      </div>
    );
  };

  /**
   * Render Priors Workflow
   */
  const renderPriorsWorkflow = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg mb-4">Configure Prior Study Access</h3>
        
        <SwimLaneRow
          id="priorsFromPACS"
          label="Priors from Current PACS"
          sourceSystem="Current PACS"
          destinationSystem="New Lantern"
          isActive={configuration.paths.priorsFromPACS || false}
          noteValue={configuration.notes.priorsFromPACS_note || ''}
          notePlaceholder="e.g., Query/Retrieve from legacy PACS for comparison studies"
          onCheckChange={(checked) => handleCheckboxChange('priorsFromPACS', checked)}
          onNoteChange={(value) => handleNoteChange('priorsFromPACS_note', value)}
        />

        <SwimLaneRow
          id="priorsFromVNA"
          label="Priors from VNA/Archive"
          sourceSystem="VNA"
          destinationSystem="New Lantern"
          isActive={configuration.paths.priorsFromVNA || false}
          noteValue={configuration.notes.priorsFromVNA_note || ''}
          notePlaceholder="e.g., Enterprise archive for historical studies across facilities"
          onCheckChange={(checked) => handleCheckboxChange('priorsFromVNA', checked)}
          onNoteChange={(value) => handleNoteChange('priorsFromVNA_note', value)}
        />

        <SwimLaneRow
          id="priorsFromCDImport"
          label="Priors from CD/External Import"
          sourceSystem="CD Import"
          destinationSystem="New Lantern"
          isActive={configuration.paths.priorsFromCDImport || false}
          noteValue={configuration.notes.priorsFromCDImport_note || ''}
          notePlaceholder="e.g., Outside studies brought in by patients on CD/DVD"
          onCheckChange={(checked) => handleCheckboxChange('priorsFromCDImport', checked)}
          onNoteChange={(value) => handleNoteChange('priorsFromCDImport_note', value)}
        />
      </div>
    );
  };

  /**
   * Render Reports Out Workflow
   */
  const renderReportsWorkflow = () => {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg mb-4">Configure Report Distribution</h3>
        
        <SwimLaneRow
          id="reportsToRIS"
          label="Reports to RIS (HL7)"
          sourceSystem="New Lantern"
          destinationSystem="RIS"
          isActive={configuration.paths.reportsToRIS || false}
          noteValue={configuration.notes.reportsToRIS_note || ''}
          notePlaceholder="e.g., ORU messages sent to Epic Radiant for finalized reports"
          onCheckChange={(checked) => handleCheckboxChange('reportsToRIS', checked)}
          onNoteChange={(value) => handleNoteChange('reportsToRIS_note', value)}
        />

        <SwimLaneRow
          id="reportsToEHR"
          label="Reports to EHR (HL7)"
          sourceSystem="New Lantern"
          destinationSystem="EHR"
          isActive={configuration.paths.reportsToEHR || false}
          noteValue={configuration.notes.reportsToEHR_note || ''}
          notePlaceholder="e.g., Results interface to Cerner for ordering providers"
          onCheckChange={(checked) => handleCheckboxChange('reportsToEHR', checked)}
          onNoteChange={(value) => handleNoteChange('reportsToEHR_note', value)}
        />

        <SwimLaneRow
          id="reportsToPortal"
          label="Reports to Patient Portal"
          sourceSystem="New Lantern"
          destinationSystem="Patient Portal"
          isActive={configuration.paths.reportsToPortal || false}
          noteValue={configuration.notes.reportsToPortal_note || ''}
          notePlaceholder="e.g., MyChart integration for patient access to imaging reports"
          onCheckChange={(checked) => handleCheckboxChange('reportsToPortal', checked)}
          onNoteChange={(value) => handleNoteChange('reportsToPortal_note', value)}
        />
      </div>
    );
  };

  // Render the appropriate workflow based on type
  return (
    <div className="space-y-6">
      {workflowType === 'orders' && renderOrdersWorkflow()}
      {workflowType === 'images' && renderImagesWorkflow()}
      {workflowType === 'priors' && renderPriorsWorkflow()}
      {workflowType === 'reports' && renderReportsWorkflow()}
    </div>
  );
};
