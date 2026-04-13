import { SwimLaneRow } from './SwimLaneRow';
import { WorkflowConfiguration } from '../WorkflowDiagram';

export interface WorkflowSubProps {
  configuration: WorkflowConfiguration;
  onCheckboxChange: (key: string, checked: boolean) => void;
  onNoteChange: (key: string, value: string) => void;
  onSystemChange: (key: string, value: string) => void;
}

export const OrdersWorkflow: React.FC<WorkflowSubProps> = ({
  configuration,
  onCheckboxChange,
  onNoteChange,
}) => {
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
        onCheckChange={(checked) => onCheckboxChange('ordersFromRIS', checked)}
        onNoteChange={(value) => onNoteChange('ordersFromRIS_note', value)}
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
        onCheckChange={(checked) => onCheckboxChange('ordersFromEHR', checked)}
        onNoteChange={(value) => onNoteChange('ordersFromEHR_note', value)}
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
        onCheckChange={(checked) => onCheckboxChange('manualEntry', checked)}
        onNoteChange={(value) => onNoteChange('manualEntry_note', value)}
      />
    </div>
  );
};
