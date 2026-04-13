import { useState, useCallback, useMemo } from 'react';
import { Download, Upload } from 'lucide-react';
import type { IntegrationSystem } from './IntegrationWorkflows';
import {
  ConnectivityRow,
  DEFAULT_TRAFFIC_TYPES,
  COMMON_SYSTEMS,
  makeId,
  emptyRow,
  migrateRow,
  exportCSV,
  exportJSON,
} from './connectivity/connectivityUtils';
import { ConnectivityImportDialog } from './connectivity/ConnectivityImportDialog';
import { ConnectivityDesktopTable } from './connectivity/ConnectivityDesktopTable';
import { ConnectivityMobileCards } from './connectivity/ConnectivityMobileCards';

export type { ConnectivityRow };

interface ConnectivityTableProps {
  rows: ConnectivityRow[];
  onChange: (rows: ConnectivityRow[]) => void;
  systems?: IntegrationSystem[];
}

export function ConnectivityTable({ rows: rawRows, onChange, systems = [] }: ConnectivityTableProps) {
  const [importOpen, setImportOpen] = useState(false);
  const rows = useMemo(() => rawRows.map(migrateRow), [rawRows]);

  const systemNames = useMemo(() => {
    const s = new Set<string>();
    systems.filter(x => x.name).forEach(x => s.add(x.name));
    COMMON_SYSTEMS.forEach(x => s.add(x));
    rows.forEach(r => {
      if (r.sourceSystem) s.add(r.sourceSystem);
      if (r.destinationSystem) s.add(r.destinationSystem);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [systems, rows]);

  const trafficTypes = useMemo(() => {
    const defaults = new Set(DEFAULT_TRAFFIC_TYPES.map(t => t.toLowerCase()));
    const custom = rows.map(r => r.trafficType).filter(t => t && !defaults.has(t.toLowerCase()));
    return [...DEFAULT_TRAFFIC_TYPES, ...custom];
  }, [rows]);

  const addRow    = useCallback(() => onChange([...rows, emptyRow()]), [rows, onChange]);
  const dupRow    = useCallback((i: number) => {
    const n = [...rows]; n.splice(i + 1, 0, { ...rows[i], id: makeId() }); onChange(n);
  }, [rows, onChange]);
  const removeRow = useCallback((i: number) => onChange(rows.filter((_, j) => j !== i)), [rows, onChange]);
  const setField  = useCallback((i: number, f: keyof ConnectivityRow, v: string | boolean) =>
    onChange(rows.map((r, j) => j === i ? { ...r, [f]: v } : r)), [rows, onChange]);
  const handleImport = useCallback((imported: ConnectivityRow[]) =>
    onChange([...rows, ...imported]), [rows, onChange]);

  const filledCount = rows.filter(r =>
    r.sourceIp || r.destIp || r.sourceSystem || r.destinationSystem || r.trafficType
  ).length;

  const sharedProps = {
    rows,
    trafficTypes,
    systemNames,
    onAddRow: addRow,
    onDupRow: dupRow,
    onRemoveRow: removeRow,
    onSetField: setField,
  };

  return (
    <div className="space-y-1.5">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {filledCount > 0
            ? `${filledCount} endpoint${filledCount !== 1 ? 's' : ''} · syncs to Notion`
            : 'No endpoints yet'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/70 transition-colors">
            <Upload className="w-2.5 h-2.5" /> Import
          </button>
          {rows.length > 0 && <>
            <button onClick={() => exportCSV(rows)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/70 transition-colors">
              <Download className="w-2.5 h-2.5" /> CSV
            </button>
            <button onClick={() => exportJSON(rows)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/70 transition-colors">
              <Download className="w-2.5 h-2.5" /> JSON
            </button>
          </>}
        </div>
      </div>

      <ConnectivityImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />

      <ConnectivityDesktopTable {...sharedProps} />

      <ConnectivityMobileCards {...sharedProps} />

    </div>
  );
}
