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
import { Textarea } from '@/components/ui/textarea';
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
  middlewareSystem?: string; // Optional middleware (e.g., Silverback)
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
  middlewareSystem,
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

      {/* Middleware System Box (if provided) */}
      {middlewareSystem && (
        <>
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center
              ${isActive 
                ? 'bg-primary/70 text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
              }
            `}
          >
            {middlewareSystem}
          </div>
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
          />
        </>
      )}

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

  const handleSystemChange = (systemKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      systems: {
        ...configuration.systems,
        [systemKey]: value,
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
          middlewareSystem="Silverback"
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
          middlewareSystem="Silverback"
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
          middlewareSystem="Silverback"
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
        
        {/* Modalities → Current PACS → Silverback → New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.imagesFromModalities ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="imagesFromModalities"
            checked={configuration.paths.imagesFromModalities || false}
            onCheckedChange={(checked) => handleCheckboxChange('imagesFromModalities', checked as boolean)}
            className={configuration.paths.imagesFromModalities ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Client Site: Modalities → Current PACS */}
          <div className="flex items-center gap-2">
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesFromModalities 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Modality
            </div>
            <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesFromModalities ? 'text-primary' : 'text-muted-foreground'}`} />
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
                ${configuration.paths.imagesFromModalities 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Current PACS
            </div>
          </div>

          {/* Arrow to Silverback */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesFromModalities ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Silverback (Middleware) */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.imagesFromModalities 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow to New Lantern */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesFromModalities ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* New Lantern (Destination) */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
              ${configuration.paths.imagesFromModalities 
                ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes Input */}
          <Textarea
            placeholder="e.g., All CT, MR, X-ray modalities send to PACS first"
            value={configuration.notes.imagesFromModalities_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('imagesFromModalities_note', e.target.value)}
            disabled={!configuration.paths.imagesFromModalities}
            className={`flex-1 min-w-[200px] ${!configuration.paths.imagesFromModalities ? 'opacity-50' : ''}`}
          />
        </div>



        {/* Modalities → VNA → Silverback → New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.imagesViaVNA ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="imagesViaVNA"
            checked={configuration.paths.imagesViaVNA || false}
            onCheckedChange={(checked) => handleCheckboxChange('imagesViaVNA', checked as boolean)}
            className={configuration.paths.imagesViaVNA ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Client Site: Modalities → VNA */}
          <div className="flex items-center gap-2">
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaVNA 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Modalities
            </div>
            <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesViaVNA ? 'text-primary' : 'text-muted-foreground'}`} />
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaVNA 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              VNA
            </div>
          </div>

          {/* Arrow to Silverback */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesViaVNA ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Silverback (Middleware) */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.imagesViaVNA 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow to New Lantern */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesViaVNA ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* New Lantern (Destination) */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
              ${configuration.paths.imagesViaVNA 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes Input */}
          <Textarea
            placeholder="e.g., Enterprise imaging archive integration"
            value={configuration.notes.imagesViaVNA_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('imagesViaVNA_note', e.target.value)}
            disabled={!configuration.paths.imagesViaVNA}
            className={`flex-1 min-w-[200px] ${!configuration.paths.imagesViaVNA ? 'opacity-50' : ''}`}
          />
        </div>

        {/* AI 3-Column Workflow: Modality→AI → Silverback → New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.imagesViaAI ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          {/* Checkbox */}
          <Checkbox
            id="imagesViaAI"
            checked={configuration.paths.imagesViaAI || false}
            onCheckedChange={(checked) => handleCheckboxChange('imagesViaAI', checked as boolean)}
            className={configuration.paths.imagesViaAI ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Client Site: Modalities → AI */}
          <div className="flex items-center gap-2">
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaAI 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Modality
            </div>
            <ArrowRight
              className={`w-5 h-5 flex-shrink-0 ${configuration.paths.imagesViaAI ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaAI 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              AI
            </div>
          </div>

          {/* Arrow to Silverback */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaAI ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Silverback Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.imagesViaVizAI 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow to New Lantern */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaAI ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.imagesViaVizAI 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes Input Field */}
          <Input
            placeholder="e.g., CT/MR modalities send to AI for analysis, then forward through Silverback to New Lantern"
            value={configuration.notes.imagesViaAI_note || ''}
            onChange={(e) => handleNoteChange('imagesViaAI_note', e.target.value)}
            disabled={!configuration.paths.imagesViaAI}
            className={`
              flex-1
              ${configuration.paths.imagesViaAI 
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
        
        {/* Option 1: VNA or PACS → Silverback → New Lantern (Push) */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsPush ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsPush"
            checked={configuration.paths.priorsPush || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsPush', checked as boolean)}
            className={configuration.paths.priorsPush ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* VNA or PACS Input */}
          <Input
            placeholder="VNA or PACS"
            value={configuration.systems.priorsPushSource || ''}
            onChange={(e) => handleSystemChange('priorsPushSource', e.target.value)}
            disabled={!configuration.paths.priorsPush}
            className={`w-[140px] text-center font-medium ${
              configuration.paths.priorsPush 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
          />

          {/* Arrow */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.priorsPush ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Silverback */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.priorsPush 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.priorsPush ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* New Lantern */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
              ${configuration.paths.priorsPush 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Textarea
            placeholder="e.g., Push from VNA or PACS"
            value={configuration.notes.priorsPush_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('priorsPush_note', e.target.value)}
            disabled={!configuration.paths.priorsPush}
            className={`flex-1 min-w-[200px] ${!configuration.paths.priorsPush ? 'opacity-50' : ''}`}
          />
        </div>

        {/* Option 2: VNA or PACS ↔ Silverback → New Lantern (Query/Retrieve) */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsQuery ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsQuery"
            checked={configuration.paths.priorsQuery || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsQuery', checked as boolean)}
            className={configuration.paths.priorsQuery ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* VNA or PACS Input */}
          <Input
            placeholder="VNA or PACS"
            value={configuration.systems.priorsQuerySource || ''}
            onChange={(e) => handleSystemChange('priorsQuerySource', e.target.value)}
            disabled={!configuration.paths.priorsQuery}
            className={`w-[140px] text-center font-medium ${
              configuration.paths.priorsQuery 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
          />

          {/* Bidirectional Arrow (↔) */}
          <div className={`flex items-center gap-1 ${configuration.paths.priorsQuery ? 'text-primary' : 'text-muted-foreground'}`}>
            <ArrowRight className="w-4 h-4" />
            <ArrowRight className="w-4 h-4 rotate-180" />
          </div>

          {/* Silverback */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.priorsQuery 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.priorsQuery ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* New Lantern */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
              ${configuration.paths.priorsQuery 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Textarea
            placeholder="e.g., Query/Retrieve from VNA or PACS using C-FIND/C-MOVE"
            value={configuration.notes.priorsQuery_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('priorsQuery_note', e.target.value)}
            disabled={!configuration.paths.priorsQuery}
            className={`flex-1 min-w-[200px] ${!configuration.paths.priorsQuery ? 'opacity-50' : ''}`}
          />
        </div>

        {/* Option 3: Manual Push → Silverback → New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsManual ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsManual"
            checked={configuration.paths.priorsManual || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsManual', checked as boolean)}
            className={configuration.paths.priorsManual ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Manual Push */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center text-sm border-2
              ${configuration.paths.priorsManual 
                ? 'border-primary bg-primary/20 text-primary' 
                : 'border-muted bg-muted/30 text-muted-foreground'}
            `}
          >
            Manual Push
          </div>

          {/* Arrow */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.priorsManual ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Silverback */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.priorsManual 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.priorsManual ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* New Lantern */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center text-sm
              ${configuration.paths.priorsManual 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Textarea
            placeholder="e.g., Site manually pushes priors to Silverback"
            value={configuration.notes.priorsManual_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('priorsManual_note', e.target.value)}
            disabled={!configuration.paths.priorsManual}
            className={`flex-1 min-w-[200px] ${!configuration.paths.priorsManual ? 'opacity-50' : ''}`}
          />
        </div>
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
          middlewareSystem="Silverback"
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
          middlewareSystem="Silverback"
          destinationSystem="EHR"
          isActive={configuration.paths.reportsToEHR || false}
          noteValue={configuration.notes.reportsToEHR_note || ''}
          notePlaceholder="e.g., Results interface to Cerner for ordering providers"
          onCheckChange={(checked) => handleCheckboxChange('reportsToEHR', checked)}
          onNoteChange={(value) => handleNoteChange('reportsToEHR_note', value)}
        />

        {/* Manual PDF Download to Client EHR/RIS */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.reportsToPortal ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="reportsToPortal"
            checked={configuration.paths.reportsToPortal || false}
            onCheckedChange={(checked) => handleCheckboxChange('reportsToPortal', checked as boolean)}
            className={configuration.paths.reportsToPortal ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* New Lantern Source */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center text-sm
              ${configuration.paths.reportsToPortal 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Long Dotted Line Arrow */}
          <div className={`flex items-center gap-1 min-w-[120px] ${configuration.paths.reportsToPortal ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'currentColor' }} />
            <ArrowRight className="w-5 h-5 flex-shrink-0" />
          </div>

          {/* Client EHR/RIS Input Field */}
          <Input
            placeholder="Client EHR/RIS"
            value={configuration.systems.reportsPortalDestination || ''}
            onChange={(e) => handleSystemChange('reportsPortalDestination', e.target.value)}
            disabled={!configuration.paths.reportsToPortal}
            className={`w-[160px] text-center font-medium ${
              configuration.paths.reportsToPortal 
                ? 'border-primary bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
          />

          {/* Notes Field */}
          <Textarea
            placeholder="e.g., Manual PDF download from New Lantern for patient portal integration"
            value={configuration.notes.reportsToPortal_note || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleNoteChange('reportsToPortal_note', e.target.value)}
            disabled={!configuration.paths.reportsToPortal}
            className={`flex-1 min-w-[200px] ${!configuration.paths.reportsToPortal ? 'opacity-50' : ''}`}
          />
        </div>
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
