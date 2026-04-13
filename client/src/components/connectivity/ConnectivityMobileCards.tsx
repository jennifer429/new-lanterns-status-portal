import { Copy, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineCell } from './InlineCell';
import { InlineCombobox } from './InlineCombobox';
import type { ConnectivityRow } from './connectivityUtils';

export interface ConnectivityMobileCardsProps {
  rows: ConnectivityRow[];
  trafficTypes: string[];
  systemNames: string[];
  onAddRow: () => void;
  onDupRow: (i: number) => void;
  onRemoveRow: (i: number) => void;
  onSetField: (i: number, f: keyof ConnectivityRow, v: string | boolean) => void;
}

export function ConnectivityMobileCards({
  rows, systemNames, onAddRow, onDupRow, onRemoveRow, onSetField,
}: ConnectivityMobileCardsProps) {
  return (
    <div className="lg:hidden space-y-2">
      {rows.length === 0 && (
        <p className="text-center py-6 text-[11px] text-muted-foreground/40 italic">
          No endpoints yet.
        </p>
      )}
      {rows.map((row, idx) => (
        <div key={row.id} className="rounded border border-border/50 bg-card p-3 space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('font-medium truncate', row.trafficType ? 'text-primary' : 'text-muted-foreground italic')}>
              {row.trafficType || 'No type set'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onSetField(idx, 'envTest', !row.envTest)}
                className={cn('px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                  row.envTest ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/35' : 'text-muted-foreground/30 border-border/20')}>T</button>
              <button onClick={() => onSetField(idx, 'envProd', !row.envProd)}
                className={cn('px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                  row.envProd ? 'bg-green-500/15 text-green-400 border-green-500/35' : 'text-muted-foreground/30 border-border/20')}>P</button>
              <button onClick={() => onDupRow(idx)} className="p-0.5 text-muted-foreground/60 hover:text-foreground"><Copy className="w-3 h-3" /></button>
              <button onClick={() => onRemoveRow(idx)} className="p-0.5 text-muted-foreground/60 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="space-y-0.5">
              <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Source</div>
              <InlineCombobox value={row.sourceSystem} onChange={v => onSetField(idx,'sourceSystem',v)} options={systemNames} placeholder="Source…" />
              <InlineCell value={row.sourceIp} onChange={v => onSetField(idx,'sourceIp',v)} placeholder="IP" />
              <InlineCell value={row.sourcePort} onChange={v => onSetField(idx,'sourcePort',v)} placeholder="Port" />
              <InlineCell value={row.sourceAeTitle} onChange={v => onSetField(idx,'sourceAeTitle',v)} placeholder="AE Title" />
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Destination</div>
              <InlineCombobox value={row.destinationSystem} onChange={v => onSetField(idx,'destinationSystem',v)} options={systemNames} placeholder="Dest…" />
              <InlineCell value={row.destIp} onChange={v => onSetField(idx,'destIp',v)} placeholder="IP" />
              <InlineCell value={row.destPort} onChange={v => onSetField(idx,'destPort',v)} placeholder="Port" />
              <InlineCell value={row.destAeTitle} onChange={v => onSetField(idx,'destAeTitle',v)} placeholder="AE Title" />
            </div>
          </div>
          <InlineCell value={row.notes} onChange={v => onSetField(idx,'notes',v)} placeholder="Notes…" className="w-full" />
        </div>
      ))}
      <button onClick={onAddRow}
        className="flex w-full items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground/50 border border-dashed border-border/40 rounded hover:border-primary/40 hover:text-foreground transition-colors">
        <Plus className="w-3 h-3" /> New row
      </button>
    </div>
  );
}
