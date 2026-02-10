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
  middlewareSystem?: string; // Optional middleware (e.g., Manual push to New Lantern)
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
        
        {/* Modalities → Current PACS → Manual push to New Lantern → New Lantern */}
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

          {/* Arrow to Manual push to New Lantern */}
          <ArrowRight className={`w-5 h-5 ${configuration.paths.imagesFromModalities ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Manual push to New Lantern (Middleware) */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
              ${configuration.paths.imagesFromModalities 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Manual push to New Lantern
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

        <SwimLaneRow
          id="imagesFromPACS"
          label="Images from Existing PACS"
          sourceSystem="Current PACS"
          middlewareSystem="Manual push to New Lantern"
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
          middlewareSystem="Manual push to New Lantern"
          destinationSystem="New Lantern"
          isActive={configuration.paths.imagesViaVNA || false}
          noteValue={configuration.notes.imagesViaVNA_note || ''}
          notePlaceholder="e.g., Enterprise imaging archive integration"
          onCheckChange={(checked) => handleCheckboxChange('imagesViaVNA', checked)}
          onNoteChange={(value) => handleNoteChange('imagesViaVNA_note', value)}
        />

        {/* Viz.ai 3-Column Workflow: Modality→Viz.ai → Manual push to New Lantern → New Lantern */}
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

          {/* Client Site: Modalities → Viz.ai */}
          <div className="flex items-center gap-2">
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaVizAI 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Modality
            </div>
            <ArrowRight
              className={`w-5 h-5 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <div
              className={`
                px-4 py-2 rounded-md font-medium min-w-[100px] text-center text-sm
                ${configuration.paths.imagesViaVizAI 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}
            >
              Viz.ai
            </div>
          </div>

          {/* Arrow to Manual push to New Lantern */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Manual push to New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.imagesViaVizAI 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Manual push to New Lantern
          </div>

          {/* Arrow to New Lantern */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesViaVizAI ? 'text-primary' : 'text-muted-foreground'}`}
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
            placeholder="e.g., CT/MR modalities send to Viz.ai for AI analysis, then forward through Manual push to New Lantern to New Lantern"
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

        {/* Silverback C-FIND/C-MOVE Workflow: [Source] ↔ Silverback → New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.imagesSilverbackQuery ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          {/* Checkbox */}
          <Checkbox
            id="imagesSilverbackQuery"
            checked={configuration.paths.imagesSilverbackQuery || false}
            onCheckedChange={(checked) => handleCheckboxChange('imagesSilverbackQuery', checked as boolean)}
            className={configuration.paths.imagesSilverbackQuery ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Source System Input (unlabeled fill-in box) */}
          <Input
            placeholder="Source system"
            value={configuration.systems.silverbackQuerySource || ''}
            onChange={(e) => handleSystemChange('silverbackQuerySource', e.target.value)}
            disabled={!configuration.paths.imagesSilverbackQuery}
            className={`
              w-[140px] text-center font-medium
              ${configuration.paths.imagesSilverbackQuery 
                ? 'bg-primary/20 border-primary text-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          />

          {/* Bidirectional Arrow (C-FIND query → / ← C-MOVE retrieve) */}
          <div className="flex items-center gap-1">
            <ArrowRight
              className={`w-5 h-5 ${configuration.paths.imagesSilverbackQuery ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <ArrowRight
              className={`w-5 h-5 rotate-180 ${configuration.paths.imagesSilverbackQuery ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </div>

          {/* Silverback Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.imagesSilverbackQuery 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          {/* Arrow to New Lantern */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.imagesSilverbackQuery ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.imagesSilverbackQuery 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes Input Field */}
          <Input
            placeholder="e.g., Silverback queries VNA using C-FIND/C-MOVE to retrieve historical studies"
            value={configuration.notes.imagesSilverbackQuery_note || ''}
            onChange={(e) => handleNoteChange('imagesSilverbackQuery_note', e.target.value)}
            disabled={!configuration.paths.imagesSilverbackQuery}
            className={`
              flex-1
              ${configuration.paths.imagesSilverbackQuery 
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
        
        {/* Option 1: Fill-in Box → Silverback → New Lantern (unidirectional) */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsOption1 ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsOption1"
            checked={configuration.paths.priorsOption1 || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsOption1', checked as boolean)}
            className={configuration.paths.priorsOption1 ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Source System Input */}
          <Input
            placeholder="Source system"
            value={configuration.systems.priorsOption1Source || ''}
            onChange={(e) => handleSystemChange('priorsOption1Source', e.target.value)}
            disabled={!configuration.paths.priorsOption1}
            className={`
              w-[140px] text-center font-medium
              ${configuration.paths.priorsOption1 
                ? 'bg-primary/20 border-primary text-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          />

          {/* Unidirectional Arrow */}
          <ArrowRight
            className={`w-5 h-5 ${configuration.paths.priorsOption1 ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Silverback Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption1 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.priorsOption1 ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption1 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Input
            placeholder="e.g., Query/Retrieve from legacy PACS for comparison studies"
            value={configuration.notes.priorsOption1_note || ''}
            onChange={(e) => handleNoteChange('priorsOption1_note', e.target.value)}
            disabled={!configuration.paths.priorsOption1}
            className={`
              flex-1
              ${configuration.paths.priorsOption1 
                ? 'border-primary bg-background' 
                : 'bg-muted/50 text-muted-foreground'}
            `}
          />
        </div>

        {/* Option 2: Fill-in Box ↔ Silverback → New Lantern (bidirectional C-FIND/C-MOVE) */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsOption2 ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsOption2"
            checked={configuration.paths.priorsOption2 || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsOption2', checked as boolean)}
            className={configuration.paths.priorsOption2 ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Source System Input */}
          <Input
            placeholder="Source system"
            value={configuration.systems.priorsOption2Source || ''}
            onChange={(e) => handleSystemChange('priorsOption2Source', e.target.value)}
            disabled={!configuration.paths.priorsOption2}
            className={`
              w-[140px] text-center font-medium
              ${configuration.paths.priorsOption2 
                ? 'bg-primary/20 border-primary text-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          />

          {/* Bidirectional Arrow */}
          <div className="flex items-center gap-1">
            <ArrowRight
              className={`w-5 h-5 ${configuration.paths.priorsOption2 ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <ArrowRight
              className={`w-5 h-5 rotate-180 ${configuration.paths.priorsOption2 ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </div>

          {/* Silverback Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption2 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.priorsOption2 ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption2 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Input
            placeholder="e.g., Enterprise archive for historical studies across facilities"
            value={configuration.notes.priorsOption2_note || ''}
            onChange={(e) => handleNoteChange('priorsOption2_note', e.target.value)}
            disabled={!configuration.paths.priorsOption2}
            className={`
              flex-1
              ${configuration.paths.priorsOption2 
                ? 'border-primary bg-background' 
                : 'bg-muted/50 text-muted-foreground'}
            `}
          />
        </div>

        {/* Option 3: "Manual" → Silverback → New Lantern (fixed text) */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.priorsOption3 ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="priorsOption3"
            checked={configuration.paths.priorsOption3 || false}
            onCheckedChange={(checked) => handleCheckboxChange('priorsOption3', checked as boolean)}
            className={configuration.paths.priorsOption3 ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* Fixed "Manual" Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[140px] text-center
              ${configuration.paths.priorsOption3 
                ? 'bg-primary/20 border-2 border-primary text-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Manual
          </div>

          {/* Unidirectional Arrow */}
          <ArrowRight
            className={`w-5 h-5 ${configuration.paths.priorsOption3 ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Silverback Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption3 
                ? 'bg-purple-600 text-white' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            Silverback
          </div>

          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.priorsOption3 ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.priorsOption3 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Notes */}
          <Input
            placeholder="e.g., Outside studies brought in by patients on CD/DVD"
            value={configuration.notes.priorsOption3_note || ''}
            onChange={(e) => handleNoteChange('priorsOption3_note', e.target.value)}
            disabled={!configuration.paths.priorsOption3}
            className={`
              flex-1
              ${configuration.paths.priorsOption3 
                ? 'border-primary bg-background' 
                : 'bg-muted/50 text-muted-foreground'}
            `}
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
          middlewareSystem="Manual push to New Lantern"
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
          middlewareSystem="Manual push to New Lantern"
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
          middlewareSystem="Manual push to New Lantern"
          destinationSystem="Patient Portal"
          isActive={configuration.paths.reportsToPortal || false}
          noteValue={configuration.notes.reportsToPortal_note || ''}
          notePlaceholder="e.g., MyChart integration for patient access to imaging reports"
          onCheckChange={(checked) => handleCheckboxChange('reportsToPortal', checked)}
          onNoteChange={(value) => handleNoteChange('reportsToPortal_note', value)}
        />

        {/* Manual Download Option: New Lantern → [Site] - Manual download from New Lantern */}
        <div
          className={`
            flex items-center gap-4 p-4 rounded-lg transition-all
            ${configuration.paths.reportsManualDownload ? 'bg-primary/10' : 'bg-muted/30'}
          `}
        >
          <Checkbox
            id="reportsManualDownload"
            checked={configuration.paths.reportsManualDownload || false}
            onCheckedChange={(checked) => handleCheckboxChange('reportsManualDownload', checked as boolean)}
            className={configuration.paths.reportsManualDownload ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
          />

          {/* New Lantern Box */}
          <div
            className={`
              px-4 py-2 rounded-md font-medium min-w-[120px] text-center
              ${configuration.paths.reportsManualDownload 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          >
            New Lantern
          </div>

          {/* Arrow */}
          <ArrowRight
            className={`w-6 h-6 flex-shrink-0 ${configuration.paths.reportsManualDownload ? 'text-primary' : 'text-muted-foreground'}`}
          />

          {/* Site Name Input */}
          <Input
            placeholder="Site name"
            value={configuration.systems.reportsManualDownloadSite || ''}
            onChange={(e) => handleSystemChange('reportsManualDownloadSite', e.target.value)}
            disabled={!configuration.paths.reportsManualDownload}
            className={`
              w-[140px] text-center font-medium
              ${configuration.paths.reportsManualDownload 
                ? 'bg-primary/20 border-primary text-foreground' 
                : 'bg-muted text-muted-foreground'}
            `}
          />

          {/* Description Text */}
          <span
            className={`
              text-sm font-medium
              ${configuration.paths.reportsManualDownload 
                ? 'text-foreground' 
                : 'text-muted-foreground'}
            `}
          >
            Manual download from New Lantern
          </span>

          {/* Notes */}
          <Input
            placeholder="e.g., Referring physicians download reports directly from New Lantern portal"
            value={configuration.notes.reportsManualDownload_note || ''}
            onChange={(e) => handleNoteChange('reportsManualDownload_note', e.target.value)}
            disabled={!configuration.paths.reportsManualDownload}
            className={`
              flex-1
              ${configuration.paths.reportsManualDownload 
                ? 'border-primary bg-background' 
                : 'bg-muted/50 text-muted-foreground'}
            `}
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
