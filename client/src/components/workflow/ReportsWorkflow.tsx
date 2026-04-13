import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight } from 'lucide-react';
import { SwimLaneRow } from './SwimLaneRow';
import { WorkflowSubProps } from './OrdersWorkflow';

export const ReportsWorkflow: React.FC<WorkflowSubProps> = ({
  configuration,
  onCheckboxChange,
  onNoteChange,
  onSystemChange,
}) => {
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
        onCheckChange={(checked) => onCheckboxChange('reportsToRIS', checked)}
        onNoteChange={(value) => onNoteChange('reportsToRIS_note', value)}
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
        onCheckChange={(checked) => onCheckboxChange('reportsToEHR', checked)}
        onNoteChange={(value) => onNoteChange('reportsToEHR_note', value)}
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
          onCheckedChange={(checked) => onCheckboxChange('reportsToPortal', checked as boolean)}
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
          onChange={(e) => onSystemChange('reportsPortalDestination', e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('reportsToPortal_note', e.target.value)}
          disabled={!configuration.paths.reportsToPortal}
          className={`flex-1 min-w-[200px] ${!configuration.paths.reportsToPortal ? 'opacity-50' : ''}`}
        />
      </div>
    </div>
  );
};
