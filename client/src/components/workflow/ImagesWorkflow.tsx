import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight } from 'lucide-react';
import { WorkflowConfiguration } from '../WorkflowDiagram';
import { WorkflowSubProps } from './OrdersWorkflow';

export const ImagesWorkflow: React.FC<WorkflowSubProps> = ({
  configuration,
  onCheckboxChange,
  onNoteChange,
}) => {
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
          onCheckedChange={(checked) => onCheckboxChange('imagesFromModalities', checked as boolean)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('imagesFromModalities_note', e.target.value)}
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
          onCheckedChange={(checked) => onCheckboxChange('imagesViaVNA', checked as boolean)}
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
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange('imagesViaVNA_note', e.target.value)}
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
          onCheckedChange={(checked) => onCheckboxChange('imagesViaAI', checked as boolean)}
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
          onChange={(e) => onNoteChange('imagesViaAI_note', e.target.value)}
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
