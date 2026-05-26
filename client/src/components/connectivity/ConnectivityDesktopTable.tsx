import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2, ArrowRight } from 'lucide-react';
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

/** Group rows by trafficType for the collapsible section layout. */
function groupByTrafficType(rows: ConnectivityRow[]): Map<string, { rows: ConnectivityRow[]; indices: number[] }> {
  const groups = new Map<string, { rows: ConnectivityRow[]; indices: number[] }>();
  rows.forEach((row, idx) => {
    const key = row.trafficType || 'Uncategorized';
    if (!groups.has(key)) groups.set(key, { rows: [], indices: [] });
    groups.get(key)!.rows.push(row);
    groups.get(key)!.indices.push(idx);
  });
  return groups;
}

/** Get a color class for the traffic type badge. */
function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('order') || t.includes('orm')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (t.includes('report') || t.includes('oru')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (t.includes('adt')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (t.includes('image') || t.includes('dicom')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  if (t.includes('hl7')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  if (t.includes('billing')) return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
  return 'bg-muted/30 text-muted-foreground border-border/40';
}

export function ConnectivityDesktopTable({
  rows, trafficTypes, systemNames, onAddRow, onDupRow, onRemoveRow, onSetField,
}: ConnectivityDesktopTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  const groups = useMemo(() => groupByTrafficType(rows), [rows]);

  // Start with all groups expanded
  const isExpanded = (key: string) => expandedGroups.has('all') || expandedGroups.has(key);
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has('all')) {
        // First toggle: remove 'all', add all groups except the one being collapsed
        next.delete('all');
        for (const k of groups.keys()) {
          if (k !== key) next.add(k);
        }
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="hidden lg:block">
      {/* Grouped sections */}
      <div className="divide-y divide-border/30">
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground/60 italic">
              No endpoints yet — click "+ New row" to add one, or use Import.
            </p>
          </div>
        )}

        {Array.from(groups.entries()).map(([type, group]) => (
          <div key={type} className="group/section">
            {/* Section header — collapsible */}
            <button
              onClick={() => toggleGroup(type)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors text-left"
            >
              {isExpanded(type) ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              )}
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded border',
                getTypeColor(type)
              )}>
                {type}
              </span>
              <span className="text-xs text-muted-foreground/50">
                {group.rows.length} {group.rows.length === 1 ? 'connection' : 'connections'}
              </span>
            </button>

            {/* Section content — connection rows with horizontal scroll */}
            {isExpanded(type) && (
              <div className="pb-3 overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
                  <colgroup>
                    {/* Source System */}  <col style={{ width: '200px' }} />
                    {/* Arrow */}          <col style={{ width: '36px' }} />
                    {/* Dest System */}    <col style={{ width: '200px' }} />
                    {/* Src IP:Port */}    <col style={{ width: '180px' }} />
                    {/* Dst IP:Port */}    <col style={{ width: '180px' }} />
                    {/* Src AE */}         <col style={{ width: '110px' }} />
                    {/* Dst AE */}         <col style={{ width: '110px' }} />
                    {/* Env */}            <col style={{ width: '70px' }} />
                    {/* Notes */}          <col style={{ minWidth: '200px' }} />
                    {/* Actions */}        <col style={{ width: '56px' }} />
                  </colgroup>

                  {/* Sub-header */}
                  <thead>
                    <tr className="border-b border-border/20">
                      {[
                        'Source', '', 'Destination',
                        'Source IP:Port', 'Dest IP:Port',
                        'Src AE', 'Dst AE', 'Env', 'Notes', '',
                      ].map((h, i) => (
                        <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap select-none">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {group.rows.map((row, localIdx) => {
                      const globalIdx = group.indices[localIdx];
                      return (
                        <tr key={row.id}
                          className="group border-b border-border/10 last:border-b-0 hover:bg-muted/8 transition-colors">

                          {/* Source System */}
                          <td className="px-3 py-1.5 align-middle">
                            <InlineCombobox
                              value={row.sourceSystem} onChange={v => onSetField(globalIdx, 'sourceSystem', v)}
                              options={systemNames} placeholder="Source…"
                            />
                          </td>

                          {/* Arrow */}
                          <td className="px-1 align-middle text-center">
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />
                          </td>

                          {/* Dest System */}
                          <td className="px-3 py-1.5 align-middle">
                            <InlineCombobox
                              value={row.destinationSystem} onChange={v => onSetField(globalIdx, 'destinationSystem', v)}
                              options={systemNames} placeholder="Dest…"
                            />
                          </td>

                          {/* Source IP:Port (merged) */}
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex items-center gap-1">
                              <InlineCell value={row.sourceIp} onChange={v => onSetField(globalIdx, 'sourceIp', v)}
                                placeholder="10.1.2.3" className="flex-1 min-w-0 font-mono text-[11px]" />
                              <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                              <InlineCell value={row.sourcePort} onChange={v => onSetField(globalIdx, 'sourcePort', v)}
                                placeholder="104" className="w-14 shrink-0 text-right font-mono text-[11px]" />
                            </div>
                          </td>

                          {/* Dest IP:Port (merged) */}
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex items-center gap-1">
                              <InlineCell value={row.destIp} onChange={v => onSetField(globalIdx, 'destIp', v)}
                                placeholder="10.1.2.50" className="flex-1 min-w-0 font-mono text-[11px]" />
                              <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                              <InlineCell value={row.destPort} onChange={v => onSetField(globalIdx, 'destPort', v)}
                                placeholder="11112" className="w-14 shrink-0 text-right font-mono text-[11px]" />
                            </div>
                          </td>

                          {/* Src AE Title */}
                          <td className="px-3 py-1.5 align-middle">
                            <InlineCell value={row.sourceAeTitle} onChange={v => onSetField(globalIdx, 'sourceAeTitle', v)}
                              placeholder="SRC_AE" className="font-mono text-[11px]" />
                          </td>

                          {/* Dst AE Title */}
                          <td className="px-3 py-1.5 align-middle">
                            <InlineCell value={row.destAeTitle} onChange={v => onSetField(globalIdx, 'destAeTitle', v)}
                              placeholder="DST_AE" className="font-mono text-[11px]" />
                          </td>

                          {/* Env — single badge style */}
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex items-center gap-1">
                              <button onClick={() => onSetField(globalIdx, 'envTest', !row.envTest)}
                                title={row.envTest ? 'Test (click to remove)' : 'Add test env'}
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                                  row.envTest
                                    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                    : 'text-muted-foreground/20 border-transparent hover:text-muted-foreground/40'
                                )}>T</button>
                              <button onClick={() => onSetField(globalIdx, 'envProd', !row.envProd)}
                                title={row.envProd ? 'Prod (click to remove)' : 'Add prod env'}
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                                  row.envProd
                                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                    : 'text-muted-foreground/20 border-transparent hover:text-muted-foreground/40'
                                )}>P</button>
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="px-3 py-1.5 align-middle">
                            <InlineCell value={row.notes} onChange={v => onSetField(globalIdx, 'notes', v)} placeholder="Notes…" />
                          </td>

                          {/* Row actions — appear on hover */}
                          <td className="px-2 py-1.5 align-middle">
                            <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => onDupRow(globalIdx)} title="Duplicate"
                                className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => onRemoveRow(globalIdx)} title="Delete"
                                className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground/50 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notion-style "+ New row" footer */}
      <button onClick={onAddRow}
        className="flex w-full items-center gap-1.5 px-5 py-2.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors border-t border-border/30 select-none">
        <Plus className="w-3.5 h-3.5" />
        New row
      </button>
    </div>
  );
}
