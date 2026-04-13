import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight } from 'lucide-react';
import { WorkflowSubProps } from './OrdersWorkflow';

export const PriorsWorkflow: React.FC<WorkflowSubProps> = ({
  configuration,
  onCheckboxChange,
  onNoteChange,
  onSystemChange,
}) => {
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
          onCheckedChange={(checked) => onCheckboxChange('priorsPush', checked as boolean)}
          className={configuration.paths.priorsPush ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
        />

        {/* VNA or PACS Input */}
        <Input
          placeholder="VNA or PACS"
          value={configuration.systems.priorsPushSource || ''}
          onChange={(e) => onSystemChange('priorsPushSource', e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('priorsPush_note', e.target.value)}
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
          onCheckedChange={(checked) => onCheckboxChange('priorsQuery', checked as boolean)}
          className={configuration.paths.priorsQuery ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : 'border-white bg-transparent'}
        />

        {/* VNA or PACS Input */}
        <Input
          placeholder="VNA or PACS"
          value={configuration.systems.priorsQuerySource || ''}
          onChange={(e) => onSystemChange('priorsQuerySource', e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('priorsQuery_note', e.target.value)}
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
          onCheckedChange={(checked) => onCheckboxChange('priorsManual', checked as boolean)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('priorsManual_note', e.target.value)}
          disabled={!configuration.paths.priorsManual}
          className={`flex-1 min-w-[200px] ${!configuration.paths.priorsManual ? 'opacity-50' : ''}`}
        />
      </div>
    </div>
  );
};
