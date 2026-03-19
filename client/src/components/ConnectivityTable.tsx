import { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, Plus, Copy, Download, Upload, Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegrationSystem } from './IntegrationWorkflows';

export interface ConnectivityRow {
  id: string;
  trafficType: string;
  sourceSystem: string;
  destinationSystem: string;
  sourceIp: string;
  sourcePort: string;
  destIp: string;
  destPort: string;
  sourceAeTitle: string;
  destAeTitle: string;
  envTest: boolean;
  envProd: boolean;
  notes: string;
  // Legacy fields for backward compat
  ip?: string;
  port?: string;
  aeTitle?: string;
}

interface ConnectivityTableProps {
  rows: ConnectivityRow[];
  onChange: (rows: ConnectivityRow[]) => void;
  systems?: IntegrationSystem[];
}

const DEFAULT_TRAFFIC_TYPES = [
  'HL7 - Orders (ORM)',
  'HL7 - Results (ORU)',
  'HL7 - ADT',
  'DICOM - C-STORE (Images)',
  'DICOM - C-FIND/C-MOVE (Query/Retrieve)',
] as const;

const COMMON_SYSTEMS = [
  'Cerner', 'Cloverleaf', 'Epic', 'Epic Radiant', 'Fuji Synapse',
  'GE PACS', 'Mirth Connect', 'New Lantern PACS', 'Nuance PowerScribe',
  'Rhapsody', 'Sectra',
] as const;

function makeId() {
  return 'conn_' + Math.random().toString(36).slice(2, 10);
}

function emptyRow(): ConnectivityRow {
  return {
    id: makeId(), trafficType: '', sourceSystem: '', destinationSystem: '',
    sourceIp: '', sourcePort: '', destIp: '', destPort: '',
    sourceAeTitle: '', destAeTitle: '', envTest: false, envProd: false, notes: '',
  };
}

function migrateRow(r: ConnectivityRow): ConnectivityRow {
  return {
    ...r,
    sourceIp: r.sourceIp || r.ip || '',
    sourcePort: r.sourcePort || r.port || '',
    destIp: r.destIp || '',
    destPort: r.destPort || '',
    sourceAeTitle: r.sourceAeTitle || '',
    destAeTitle: r.destAeTitle || r.aeTitle || '',
  };
}

// ── Inline text cell — no chrome until focused ────────────────────────────────
function InlineCell({
  value, onChange, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full bg-transparent border-none outline-none text-[11px] text-foreground',
        'placeholder:text-muted-foreground/35 focus:bg-primary/5 rounded px-1 h-[22px]',
        className
      )}
    />
  );
}

// ── Combobox — inline-styled, no chrome until open ────────────────────────────
function InlineCombobox({
  value, onChange, options, placeholder, popoverWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  popoverWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  const showAdd = search.trim() && !options.some(s => s.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between text-[11px] text-left',
            'bg-transparent border-none outline-none rounded px-1 h-[22px]',
            'hover:bg-primary/5 focus:bg-primary/5 transition-colors',
            !value && 'text-muted-foreground/35'
          )}
        >
          <span className="truncate flex-1 leading-none">{value || placeholder}</span>
          <ChevronsUpDown className="ml-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', popoverWidth || 'w-[220px]')} align="start">
        <Command>
          <CommandInput placeholder="Search or type..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {search.trim() ? 'No match' : 'Type to search'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(opt => (
                <CommandItem key={opt} value={opt}
                  onSelect={() => { onChange(opt); setOpen(false); setSearch(''); }}>
                  <Check className={cn('mr-2 h-3 w-3', value === opt ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-xs">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showAdd && (
              <CommandGroup>
                <CommandItem value={`__add__${search.trim()}`}
                  onSelect={() => { onChange(search.trim()); setOpen(false); setSearch(''); }}>
                  <PlusCircle className="mr-2 h-3 w-3 text-primary" />
                  <span className="text-xs">Add "{search.trim()}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Import Dialog ─────────────────────────────────────────────────────────────
function ImportDialog({ open, onOpenChange, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ConnectivityRow[]) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    setError('');
    try {
      const parsed = JSON.parse(text);
      onImport((Array.isArray(parsed) ? parsed : [parsed]).map(mapImportRow));
      setText(''); onOpenChange(false);
    } catch {
      try {
        const rows = parseCSV(text);
        if (!rows.length) { setError('No valid rows found.'); return; }
        onImport(rows); setText(''); onOpenChange(false);
      } catch (e: any) {
        setError(e.message || 'Invalid format — use JSON array or CSV.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Endpoints</DialogTitle>
          <DialogDescription>Paste JSON or CSV, or upload a file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/20 p-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
            <pre>{`[{ "trafficType": "DICOM - C-STORE (Images)", "sourceSystem": "CT Scanner",
  "destinationSystem": "New Lantern PACS", "sourceIp": "10.1.2.3",
  "sourcePort": "104", "destIp": "10.1.2.50", "destPort": "11112",
  "environment": "both" }]`}</pre>
          </div>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste JSON or CSV here..."
            className="w-full h-28 rounded-md border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader();
                r.onload = ev => setText(ev.target?.result as string || '');
                r.readAsText(f); e.target.value = '';
              }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setText(''); onOpenChange(false); }}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!text.trim()} className="gap-1.5">
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV / JSON helpers ────────────────────────────────────────────────────────
function parseCSV(text: string): ConnectivityRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV needs a header row + at least one data row.');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return mapImportRow(obj);
  });
}

function mapImportRow(obj: any): ConnectivityRow {
  const env = (obj.environment || obj.env || '').toLowerCase().trim();
  const legacyAe = obj.aeTitle || obj.aetitle || obj['ae title'] || obj.ae_title || '';
  return {
    id: makeId(),
    trafficType:       obj.trafficType || obj.traffictype || obj['traffic type'] || obj.type || '',
    sourceSystem:      obj.sourceSystem || obj.sourcesystem || obj['source system'] || obj.source || '',
    destinationSystem: obj.destinationSystem || obj.destinationsystem || obj['destination system'] || obj.destination || '',
    sourceIp:          obj.sourceIp || obj.sourceip || obj['source ip'] || obj.ip || '',
    sourcePort:        String(obj.sourcePort || obj.sourceport || obj['source port'] || obj.port || ''),
    destIp:            obj.destIp || obj.destip || obj['dest ip'] || obj.destinationIp || obj['destination ip'] || '',
    destPort:          String(obj.destPort || obj.destport || obj['dest port'] || obj.destinationPort || ''),
    sourceAeTitle:     obj.sourceAeTitle || obj.sourceaetitle || obj['source ae title'] || obj['source ae'] || '',
    destAeTitle:       obj.destAeTitle || obj.destaetitle || obj['dest ae title'] || obj['dest ae'] || legacyAe,
    envTest: env === 'test' || env === 'both' || obj.envTest === true || obj.test === true,
    envProd: env === 'production' || env === 'prod' || env === 'both' || obj.envProd === true || obj.prod === true,
    notes: obj.notes || '',
  };
}

function exportCSV(rows: ConnectivityRow[]) {
  const headers = ['Traffic Type','Source System','Destination System','Source IP','Source Port','Dest IP','Dest Port','Source AE Title','Dest AE Title','Environment','Notes'];
  const csvRows = [headers.join(','), ...rows.map(r => {
    const env = r.envTest && r.envProd ? 'Both' : r.envTest ? 'Test' : r.envProd ? 'Production' : '';
    return [r.trafficType,r.sourceSystem,r.destinationSystem,r.sourceIp,r.sourcePort,r.destIp,r.destPort,r.sourceAeTitle,r.destAeTitle,env,r.notes]
      .map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',');
  })];
  dlBlob(new Blob([csvRows.join('\n')], { type: 'text/csv' }), 'connectivity-endpoints.csv');
}

function exportJSON(rows: ConnectivityRow[]) {
  const data = rows.map(r => ({
    trafficType: r.trafficType, sourceSystem: r.sourceSystem, destinationSystem: r.destinationSystem,
    sourceIp: r.sourceIp, sourcePort: r.sourcePort, destIp: r.destIp, destPort: r.destPort,
    sourceAeTitle: r.sourceAeTitle, destAeTitle: r.destAeTitle,
    environment: r.envTest && r.envProd ? 'both' : r.envTest ? 'test' : r.envProd ? 'production' : '',
    notes: r.notes,
  }));
  dlBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'connectivity-endpoints.json');
}

function dlBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────
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

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden lg:block rounded-md border border-border/50 overflow-hidden">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {/* Traffic Type */}  <col style={{ width: '16%' }} />
              {/* Source */}        <col style={{ width: '11%' }} />
              {/* Destination */}   <col style={{ width: '11%' }} />
              {/* Src IP:Port */}   <col style={{ width: '13%' }} />
              {/* Dst IP:Port */}   <col style={{ width: '13%' }} />
              {/* Src AE */}        <col style={{ width: '7%'  }} />
              {/* Dst AE */}        <col style={{ width: '7%'  }} />
              {/* Env */}           <col style={{ width: '5%'  }} />
              {/* Notes */}         <col style={{ width: '14%' }} />
              {/* Actions */}       <col style={{ width: '3%'  }} />
            </colgroup>

            {/* ── Header ── */}
            <thead>
              <tr className="bg-muted/25 border-b border-border/50">
                {[
                  'Traffic Type', 'Source', 'Destination',
                  'Src IP : Port', 'Dst IP : Port',
                  'Src AE', 'Dst AE', 'Env', 'Notes', '',
                ].map((h, i) => (
                  <th key={i} className="text-left px-1.5 py-[5px] text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide whitespace-nowrap select-none">
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
                  className="group border-b border-border/25 last:border-b-0 hover:bg-muted/8 transition-colors"
                  style={{ height: 28 }}>

                  {/* Traffic Type */}
                  <td className="px-1 align-middle">
                    <InlineCombobox
                      value={row.trafficType} onChange={v => setField(idx, 'trafficType', v)}
                      options={trafficTypes} placeholder="Type…" popoverWidth="w-[260px]"
                    />
                  </td>

                  {/* Source System */}
                  <td className="px-1 align-middle">
                    <InlineCombobox
                      value={row.sourceSystem} onChange={v => setField(idx, 'sourceSystem', v)}
                      options={systemNames} placeholder="Source…"
                    />
                  </td>

                  {/* Dest System */}
                  <td className="px-1 align-middle">
                    <InlineCombobox
                      value={row.destinationSystem} onChange={v => setField(idx, 'destinationSystem', v)}
                      options={systemNames} placeholder="Dest…"
                    />
                  </td>

                  {/* Source IP : Port */}
                  <td className="px-1 align-middle">
                    <div className="flex items-center gap-0.5">
                      <InlineCell value={row.sourceIp} onChange={v => setField(idx, 'sourceIp', v)}
                        placeholder="10.1.2.3" className="flex-1 min-w-0" />
                      <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                      <InlineCell value={row.sourcePort} onChange={v => setField(idx, 'sourcePort', v)}
                        placeholder="104" className="w-9 shrink-0 text-right" />
                    </div>
                  </td>

                  {/* Dest IP : Port */}
                  <td className="px-1 align-middle">
                    <div className="flex items-center gap-0.5">
                      <InlineCell value={row.destIp} onChange={v => setField(idx, 'destIp', v)}
                        placeholder="10.1.2.50" className="flex-1 min-w-0" />
                      <span className="text-[10px] text-muted-foreground/30 shrink-0">:</span>
                      <InlineCell value={row.destPort} onChange={v => setField(idx, 'destPort', v)}
                        placeholder="11112" className="w-9 shrink-0 text-right" />
                    </div>
                  </td>

                  {/* Src AE Title */}
                  <td className="px-1 align-middle">
                    <InlineCell value={row.sourceAeTitle} onChange={v => setField(idx, 'sourceAeTitle', v)}
                      placeholder="SRC_AE" />
                  </td>

                  {/* Dst AE Title */}
                  <td className="px-1 align-middle">
                    <InlineCell value={row.destAeTitle} onChange={v => setField(idx, 'destAeTitle', v)}
                      placeholder="DST_AE" />
                  </td>

                  {/* Env — T / P clickable badges */}
                  <td className="px-1 align-middle">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setField(idx, 'envTest', !row.envTest)}
                        title={row.envTest ? 'Test (click to remove)' : 'Add test env'}
                        className={cn(
                          'px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                          row.envTest
                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/35 hover:bg-yellow-500/25'
                            : 'text-muted-foreground/25 border-border/20 hover:text-muted-foreground/50 hover:border-border/40'
                        )}>T</button>
                      <button onClick={() => setField(idx, 'envProd', !row.envProd)}
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
                    <InlineCell value={row.notes} onChange={v => setField(idx, 'notes', v)} placeholder="Notes…" />
                  </td>

                  {/* Row actions — appear on hover */}
                  <td className="px-1 align-middle">
                    <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => dupRow(idx)} title="Duplicate"
                        className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeRow(idx)} title="Delete"
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
        <button onClick={addRow}
          className="flex w-full items-center gap-1.5 px-3 py-[5px] text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors border-t border-border/30 select-none">
          <Plus className="w-3 h-3" />
          New row
        </button>
      </div>

      {/* ── Mobile cards ── */}
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
                <button onClick={() => setField(idx, 'envTest', !row.envTest)}
                  className={cn('px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                    row.envTest ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/35' : 'text-muted-foreground/30 border-border/20')}>T</button>
                <button onClick={() => setField(idx, 'envProd', !row.envProd)}
                  className={cn('px-[5px] rounded text-[10px] font-bold leading-[17px] border transition-colors',
                    row.envProd ? 'bg-green-500/15 text-green-400 border-green-500/35' : 'text-muted-foreground/30 border-border/20')}>P</button>
                <button onClick={() => dupRow(idx)} className="p-0.5 text-muted-foreground/60 hover:text-foreground"><Copy className="w-3 h-3" /></button>
                <button onClick={() => removeRow(idx)} className="p-0.5 text-muted-foreground/60 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="space-y-0.5">
                <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Source</div>
                <InlineCombobox value={row.sourceSystem} onChange={v => setField(idx,'sourceSystem',v)} options={systemNames} placeholder="Source…" />
                <InlineCell value={row.sourceIp} onChange={v => setField(idx,'sourceIp',v)} placeholder="IP" />
                <InlineCell value={row.sourcePort} onChange={v => setField(idx,'sourcePort',v)} placeholder="Port" />
                <InlineCell value={row.sourceAeTitle} onChange={v => setField(idx,'sourceAeTitle',v)} placeholder="AE Title" />
              </div>
              <div className="space-y-0.5">
                <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Destination</div>
                <InlineCombobox value={row.destinationSystem} onChange={v => setField(idx,'destinationSystem',v)} options={systemNames} placeholder="Dest…" />
                <InlineCell value={row.destIp} onChange={v => setField(idx,'destIp',v)} placeholder="IP" />
                <InlineCell value={row.destPort} onChange={v => setField(idx,'destPort',v)} placeholder="Port" />
                <InlineCell value={row.destAeTitle} onChange={v => setField(idx,'destAeTitle',v)} placeholder="AE Title" />
              </div>
            </div>
            <InlineCell value={row.notes} onChange={v => setField(idx,'notes',v)} placeholder="Notes…" className="w-full" />
          </div>
        ))}
        <button onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground/50 border border-dashed border-border/40 rounded hover:border-primary/40 hover:text-foreground transition-colors">
          <Plus className="w-3 h-3" /> New row
        </button>
      </div>

    </div>
  );
}
