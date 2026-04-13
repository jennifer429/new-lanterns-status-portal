import { Copy, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineCell } from './InlineCell';
import { InlineCombobox } from './InlineCombobox';
import type { ConnectivityRow } from './connectivityUtils';

export interface ConnectivityDesktopTableProps {
  rows: ConnectivityRow[];
  trafficTypes: string[];
  systemNames: string[];
  onAddRow: () => void;
  onDupRow: (i: number) => void;
  onRemoveRow: (i: number) => void;
  onSetField: (i: number, f: keyof ConnectivityRow, v: string | boolean) => void;
}

export function ConnectivityDesktopTable({
  rows, trafficTypes, systemNames, onAddRow, onDupRow, onRemoveRow, onSetField,
}: ConnectivityDesktopTableProps) {
  return (
    <div className="hidden lg:block rounded-md border border-border/60 overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
          <colgroup>
            {/* Traffic Type */}  <col style={{ width: '120px' }} />
            {/* Source */}        <col style={{ width: '140px' }} />
            {/* Destination */}   <col style={{ width: '140px' }} />
            {/* Src IP:Port */}   <col style={{ width: '160px' }} />
            {/* Dst IP:Port */}   <col style={{ width: '160px' }} />
            {/* Src AE */}        <col style={{ width: '90px'  }} />
            {/* Dst AE */}        <col style={{ width: '90px'  }} />
            {/* Env */}           <col style={{ width: '60px'  }} />
            {/* Notes */}         <col style={{ minWidth: '180px' }} />
            {/* Actions */}       <col style={{ width: '50px'  }} />
          </colgroup>

          {/* ── Header ── */}
          <thead>
            <tr className="bg-muted/25 border-b border-border/50">
              {[
                'Traffic Type', 'Source', 'Destination',
                'Src IP : Port', 'Dst IP : Port',
                'Src AE', 'Dst AE', 'Env', 'Notes', '',
              ].map((h, i) => (
                <th key={i} className="text-left px-2 py-2 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide whitespace-nowrap select-none border-b border-border/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-[11px] text-muted-foreground/40 italic">
                  No endpoints yet — click "+ New row" to add one, or use Import.
                </td>
              </tr>
            )}

            {rows.map((row, idx) => (
              <tr key={row.id}
                className="group border-b border-border/30 last:border-b-0 hover:bg-muted/10 transition-colors">

                {/* Traffic Type */}
                <td className="px-1 align-middle">
                  <InlineCombobox
                    value={row.trafficType} onChange={v => onSetField(idx, 'trafficType', v)}
                    options={trafficTypes} placeholder="Type…" popoverWidth="w-[260px]"
                  />
                </td>

                {/* Source System */}
                <td className="px-1 align-middle">
                  <InlineCombobox
                    value={row.sourceSystem} onChange={v => onSetField(idx, 'sourceSystem', v)}
                    options={systemNames} placeholder="Source…"
                  />
                </td>

                {/* Dest System */}
                <td className="px-1 align-middle">
                  <InlineCombobox
                    value={row.destinationSystem} onChange={v => onSetField(idx, 'destinationSystem', v)}
                    options={systemNames} placeholder="Dest…"
                  />
                </td>

                {/* Source IP : Port */}
                <td className="px-1 align-middle">
                  <div className="flex items-center gap-0.5">
                    <InlineCell value={row.sourceIp} onChange={v => onSetField(idx, 'sourceIp', v)}
                      placeholder="10.1.2.3" className="flex-1 min-w-0" />
                    <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                    <InlineCell value={row.sourcePort} onChange={v => onSetField(idx, 'sourcePort', v)}
                      placeholder="104" className="w-9 shrink-0 text-right" />
                  </div>
                </td>

                {/* Dest IP : Port */}
                <td className="px-1 align-middle">
                  <div className="flex items-center gap-0.5">
                    <InlineCell value={row.destIp} onChange={v => onSetField(idx, 'destIp', v)}
                      placeholder="10.1.2.50" className="flex-1 min-w-0" />
                    <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                    <InlineCell value={row.destPort} onChange={v => onSetField(idx, 'destPort', v)}
                      placeholder="11112" className="w-9 shrink-0 text-right" />
                  </div>
                </td>

                {/* Src AE Title */}
                <td className="px-1 align-middle">
                  <InlineCell value={row.sourceAeTitle} onChange={v => onSetField(idx, 'sourceAeTitle', v)}
                    placeholder="SRC_AE" />
                </td>

                {/* Dst AE Title */}
                <td className="px-1 align-middle">
                  <InlineCell value={row.destAeTitle} onChange={v => onSetField(idx, 'destAeTitle', v)}
                    placeholder="DST_AE" />
                </td>

                {/* Env — T / P clickable badges */}
                <td className="px-1 align-middle">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => onSetField(idx, 'envTest', !row.envTest)}
                      title={row.envTest ? 'Test (click to remove)' : 'Add test env'}
                      className={cn(
                        'px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                        row.envTest
                          ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/35 hover:bg-yellow-500/25'
                          : 'text-muted-foreground/25 border-border/20 hover:text-muted-foreground/50 hover:border-border/40'
                      )}>T</button>
                    <button onClick={() => onSetField(idx, 'envProd', !row.envProd)}
                      title={row.envProd ? 'Prod (click to remove)' : 'Add prod env'}
                      className={cn(
                        'px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                        row.envProd
                          ? 'bg-green-500/15 text-green-400 border-green-500/35 hover:bg-green-500/25'
                          : 'text-muted-foreground/25 border-border/20 hover:text-muted-foreground/50 hover:border-border/40'
                      )}>P</button>
                  </div>
                </td>

                {/* Notes */}
                <td className="px-1 align-middle">
                  <InlineCell value={row.notes} onChange={v => onSetField(idx, 'notes', v)} placeholder="Notes…" />
                </td>

                {/* Row actions — appear on hover */}
                <td className="px-1 align-middle">
                  <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onDupRow(idx)} title="Duplicate"
                      className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={() => onRemoveRow(idx)} title="Delete"
                      className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground/60 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      {/* Notion-style "+ New row" footer */}
      <button onClick={onAddRow}
        className="flex w-full items-center gap-1.5 px-3 py-[5px] text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors border-t border-border/30 select-none">
        <Plus className="w-3 h-3" />
        New row
      </button>
    </div>
  );
}
