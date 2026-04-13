import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

/**
 * Swim Lane Row Component
 * Represents one pathway: Checkbox → Source → Arrow → Destination → Notes Input
 */
export interface SwimLaneRowProps {
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

export const SwimLaneRow: React.FC<SwimLaneRowProps> = ({
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
