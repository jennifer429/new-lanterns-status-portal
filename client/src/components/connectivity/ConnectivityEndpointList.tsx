import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineCell } from './InlineCell';
import { InlineCombobox } from './InlineCombobox';
import type { ConnectivityRow } from './connectivityUtils';

export interface ConnectivityEndpointListProps {
  rows: ConnectivityRow[];
  trafficTypes: string[];
  systemNames: string[];
  onAddRow: () => void;
  onAddRowOfType: (type: string) => void;
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

/** Small uppercase mono field label. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground/55 mb-1">
      {children}
    </span>
  );
}

/** A field whose input area shows a hairline box so it stays tappable on mobile. */
function Field({
  label, full, children,
}: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(full && 'sm:col-span-2')}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center rounded-md border border-border/40 bg-background/40 focus-within:border-primary/50 transition-colors">
        {children}
      </div>
    </div>
  );
}

/**
 * Responsive endpoint list — one card per connection at all widths.
 * Replaces the old 1100px desktop table + separate mobile cards: the field
 * grid reflows from 2-col to 1-col so nothing is ever clipped or scrolled.
 */
export function ConnectivityEndpointList({
  rows, trafficTypes, systemNames,
  onAddRow, onAddRowOfType, onDupRow, onRemoveRow, onSetField,
}: ConnectivityEndpointListProps) {
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
    <div>
      {/* Quick-add chips — one click adds a pre-typed endpoint */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground/45 mr-0.5">
          Quick add
        </span>
        {trafficTypes.map(t => (
          <button
            key={t}
            onClick={() => onAddRowOfType(t)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors hover:brightness-125',
              getTypeColor(t),
            )}
          >
            <Plus className="w-2.5 h-2.5" /> {t}
          </button>
        ))}
      </div>

      {/* Grouped sections */}
      <div className="divide-y divide-border/30">
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground/60 italic">
              No endpoints yet — use a quick-add chip above, "New endpoint" below, or Import.
            </p>
          </div>
        )}

        {Array.from(groups.entries()).map(([type, group]) => (
          <div key={type} className="group/section">
            {/* Section header — collapsible */}
            <button
              onClick={() => toggleGroup(type)}
              className="w-full flex items-center gap-3 px-2 sm:px-3 py-3 hover:bg-muted/10 transition-colors text-left"
            >
              {isExpanded(type) ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              )}
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded border',
                getTypeColor(type),
              )}>
                {type}
              </span>
              <span className="text-xs text-muted-foreground/50">
                {group.rows.length} {group.rows.length === 1 ? 'connection' : 'connections'}
              </span>
            </button>

            {/* Section content — endpoint cards */}
            {isExpanded(type) && (
              <div className="space-y-2 px-1 sm:px-2 pb-3">
                {group.rows.map((row, localIdx) => {
                  const globalIdx = group.indices[localIdx];
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/50 bg-card/40 p-3 space-y-3"
                    >
                      {/* Row 1 — route: source → destination + actions */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 rounded-md border border-border/40 bg-background/40 focus-within:border-primary/50 transition-colors">
                          <InlineCombobox
                            value={row.sourceSystem}
                            onChange={v => onSetField(globalIdx, 'sourceSystem', v)}
                            options={systemNames} placeholder="Source system…"
                          />
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 min-w-0 rounded-md border border-border/40 bg-background/40 focus-within:border-primary/50 transition-colors">
                          <InlineCombobox
                            value={row.destinationSystem}
                            onChange={v => onSetField(globalIdx, 'destinationSystem', v)}
                            options={systemNames} placeholder="Destination system…"
                          />
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => onDupRow(globalIdx)} title="Duplicate"
                            className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onRemoveRow(globalIdx)} title="Delete"
                            className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground/50 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Field grid — 2-col, collapses to 1-col on narrow widths */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                        <Field label="Source IP : Port">
                          <InlineCell value={row.sourceIp} onChange={v => onSetField(globalIdx, 'sourceIp', v)}
                            placeholder="10.1.2.3" className="flex-1 min-w-0 font-mono text-[11px]" />
                          <span className="text-[10px] text-muted-foreground/30 shrink-0 px-0.5">:</span>
                          <InlineCell value={row.sourcePort} onChange={v => onSetField(globalIdx, 'sourcePort', v)}
                            placeholder="104" className="w-16 shrink-0 text-right font-mono text-[11px]" />
                        </Field>

                        <Field label="Dest IP : Port">
                          <InlineCell value={row.destIp} onChange={v => onSetField(globalIdx, 'destIp', v)}
                            placeholder="10.1.2.50" className="flex-1 min-w-0 font-mono text-[11px]" />
                          <span className="text-[10px] text-muted-foreground/30 shrink-0 px-0.5">:</span>
                          <InlineCell value={row.destPort} onChange={v => onSetField(globalIdx, 'destPort', v)}
                            placeholder="11112" className="w-16 shrink-0 text-right font-mono text-[11px]" />
                        </Field>

                        <Field label="Source AE Title">
                          <InlineCell value={row.sourceAeTitle} onChange={v => onSetField(globalIdx, 'sourceAeTitle', v)}
                            placeholder="SRC_AE" className="font-mono text-[11px]" />
                        </Field>

                        <Field label="Dest AE Title">
                          <InlineCell value={row.destAeTitle} onChange={v => onSetField(globalIdx, 'destAeTitle', v)}
                            placeholder="DST_AE" className="font-mono text-[11px]" />
                        </Field>

                        {/* Environment — full-width Test / Prod toggles */}
                        <div className="sm:col-span-2">
                          <FieldLabel>Environment</FieldLabel>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onSetField(globalIdx, 'envTest', !row.envTest)}
                              className={cn(
                                'py-1.5 rounded-md text-xs font-semibold border transition-colors',
                                row.envTest
                                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/35'
                                  : 'text-muted-foreground/40 border-border/40 hover:text-muted-foreground hover:border-border/70',
                              )}>
                              Test
                            </button>
                            <button onClick={() => onSetField(globalIdx, 'envProd', !row.envProd)}
                              className={cn(
                                'py-1.5 rounded-md text-xs font-semibold border transition-colors',
                                row.envProd
                                  ? 'bg-green-500/15 text-green-400 border-green-500/35'
                                  : 'text-muted-foreground/40 border-border/40 hover:text-muted-foreground hover:border-border/70',
                              )}>
                              Prod
                            </button>
                          </div>
                        </div>

                        {/* Notes — spans both columns */}
                        <Field label="Notes" full>
                          <InlineCell value={row.notes} onChange={v => onSetField(globalIdx, 'notes', v)}
                            placeholder="Notes…" className="w-full" />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notion-style "+ New endpoint" footer */}
      <button onClick={onAddRow}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors border-t border-border/30 select-none">
        <Plus className="w-3.5 h-3.5" />
        New endpoint
      </button>
    </div>
  );
}
