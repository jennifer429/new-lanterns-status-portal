import { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus, CheckCircle2, Copy, ChevronDown, ChevronUp, Download, Upload, Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegrationSystem } from './IntegrationWorkflows';

export interface ConnectivityRow {
  id: string;
  ip: string;
  port: string;
  aeTitle: string;
  trafficType: string;
  sourceSystem: string;
  destinationSystem: string;
  envTest: boolean;
  envProd: boolean;
  notes: string;
}

interface ConnectivityTableProps {
  rows: ConnectivityRow[];
  onChange: (rows: ConnectivityRow[]) => void;
  systems?: IntegrationSystem[];
}

// Pre-canned traffic types — common in radiology/PACS integrations
const DEFAULT_TRAFFIC_TYPES = [
  'Orders (ORM)',
  'Images (C-STORE)',
  'Priors (C-FIND/C-MOVE)',
  'Reports (ORU)',
  'ADT',
  'Query/Retrieve',
  'Dose Reports',
  'Tech Sheets',
  'Worklist (MWL)',
  'MPPS',
  'Storage Commitment',
] as const;

// Common systems that always appear as suggestions
const COMMON_SYSTEMS = [
  'New Lantern PACS',
  'Epic Radiant',
  'Epic',
  'Cerner',
  'GE PACS',
  'Fuji Synapse',
  'Sectra',
  'Nuance PowerScribe',
  'Mirth Connect',
  'Rhapsody',
  'Cloverleaf',
] as const;

function makeId() {
  return 'conn_' + Math.random().toString(36).slice(2, 10);
}

function emptyRow(): ConnectivityRow {
  return {
    id: makeId(),
    ip: '',
    port: '',
    aeTitle: '',
    trafficType: '',
    sourceSystem: '',
    destinationSystem: '',
    envTest: false,
    envProd: false,
    notes: '',
  };
}

// ── Combobox for system selection ────────────────────────────────────────────
function SystemCombobox({
  value,
  onChange,
  systems,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  systems: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Merge common systems + org systems, deduplicate
  const allSystems = useMemo(() => {
    const set = new Set<string>();
    systems.forEach(s => { if (s) set.add(s); });
    COMMON_SYSTEMS.forEach(s => set.add(s));
    return Array.from(set).sort();
  }, [systems]);

  const filtered = allSystems.filter(s =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  const showAddCustom = search.trim() && !allSystems.some(s => s.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-8 w-full items-center justify-between rounded-md border border-border/50 bg-transparent px-2 text-xs',
            'hover:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type new..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {search.trim() ? 'No match found' : 'Type to search'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(sys => (
                <CommandItem
                  key={sys}
                  value={sys}
                  onSelect={() => {
                    onChange(sys);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', value === sys ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-xs">{sys}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showAddCustom && (
              <CommandGroup>
                <CommandItem
                  value={`__add__${search.trim()}`}
                  onSelect={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <PlusCircle className="mr-2 h-3.5 w-3.5 text-primary" />
                  <span className="text-xs">Add &ldquo;{search.trim()}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Traffic Type Combobox with custom add ────────────────────────────────────
function TrafficTypeCombobox({
  value,
  onChange,
  customTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  customTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_TRAFFIC_TYPES.forEach(t => set.add(t));
    customTypes.forEach(t => { if (t) set.add(t); });
    return Array.from(set);
  }, [customTypes]);

  const filtered = allTypes.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const showAddCustom = search.trim() && !allTypes.some(t => t.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-8 w-full items-center justify-between rounded-md border border-border/50 bg-transparent px-2 text-xs',
            'hover:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{value || 'Select type'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type new..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {search.trim() ? 'No match found' : 'Type to search'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(t => (
                <CommandItem
                  key={t}
                  value={t}
                  onSelect={() => {
                    onChange(t);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', value === t ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-xs">{t}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showAddCustom && (
              <CommandGroup>
                <CommandItem
                  value={`__add__${search.trim()}`}
                  onSelect={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <PlusCircle className="mr-2 h-3.5 w-3.5 text-primary" />
                  <span className="text-xs">Add &ldquo;{search.trim()}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Import Dialog ────────────────────────────────────────────────────────────
function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ConnectivityRow[]) => void;
}) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportText = () => {
    setImportError('');
    try {
      // Try JSON first
      const parsed = JSON.parse(importText);
      const rows = (Array.isArray(parsed) ? parsed : [parsed]).map(mapImportRow);
      onImport(rows);
      setImportText('');
      onOpenChange(false);
    } catch {
      // Try CSV
      try {
        const rows = parseCSV(importText);
        if (rows.length === 0) {
          setImportError('No valid rows found. Check your format.');
          return;
        }
        onImport(rows);
        setImportText('');
        onOpenChange(false);
      } catch (e: any) {
        setImportError(e.message || 'Invalid format. Use JSON array or CSV.');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Endpoints</DialogTitle>
          <DialogDescription>
            Paste JSON or CSV data below, or upload a file. AI tools can generate data in this format.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Accepted formats:</p>
            <p><strong>JSON:</strong> Array of objects with keys: ip, port, aeTitle, trafficType, sourceSystem, destinationSystem, environment (test/prod/both), notes</p>
            <p><strong>CSV:</strong> Header row with columns: IP Address, Port, AE Title, Traffic Type, Source System, Destination System, Environment, Notes</p>
          </div>
          <div className="rounded-md border bg-muted/20 p-2 text-xs font-mono text-muted-foreground overflow-x-auto">
            <pre>{`[
  {
    "ip": "10.1.2.3",
    "port": "104",
    "aeTitle": "NL_PACS",
    "trafficType": "Images (C-STORE)",
    "sourceSystem": "CT Scanner",
    "destinationSystem": "New Lantern PACS",
    "environment": "both"
  }
]`}</pre>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste JSON or CSV here..."
            className="w-full h-32 rounded-md border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {importError && (
            <p className="text-xs text-red-400">{importError}</p>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setImportText(''); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImportText} disabled={!importText.trim()} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV parsing helper ───────────────────────────────────────────────────────
function parseCSV(text: string): ConnectivityRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: ConnectivityRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    rows.push(mapImportRow(obj));
  }
  return rows;
}

// ── Map imported data to ConnectivityRow ──────────────────────────────────────
function mapImportRow(obj: any): ConnectivityRow {
  const env = (obj.environment || obj.env || '').toLowerCase().trim();
  return {
    id: makeId(),
    ip: obj.ip || obj.ipaddress || obj.ipAddress || obj['ip address'] || '',
    port: String(obj.port || ''),
    aeTitle: obj.aeTitle || obj.aetitle || obj['ae title'] || obj.ae_title || '',
    trafficType: obj.trafficType || obj.traffictype || obj['traffic type'] || obj.traffic_type || obj.type || '',
    sourceSystem: obj.sourceSystem || obj.sourcesystem || obj['source system'] || obj.source_system || obj.source || '',
    destinationSystem: obj.destinationSystem || obj.destinationsystem || obj['destination system'] || obj.destination_system || obj.destination || '',
    envTest: env === 'test' || env === 'both' || obj.envTest === true || obj.test === true,
    envProd: env === 'production' || env === 'prod' || env === 'both' || obj.envProd === true || obj.prod === true || obj.production === true,
    notes: obj.notes || '',
  };
}

// ── Export helpers ────────────────────────────────────────────────────────────
function exportJSON(rows: ConnectivityRow[]) {
  const data = rows.map(r => ({
    ip: r.ip,
    port: r.port,
    aeTitle: r.aeTitle,
    trafficType: r.trafficType,
    sourceSystem: r.sourceSystem,
    destinationSystem: r.destinationSystem,
    environment: r.envTest && r.envProd ? 'both' : r.envTest ? 'test' : r.envProd ? 'production' : '',
    notes: r.notes,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'connectivity-endpoints.json');
}

function exportCSV(rows: ConnectivityRow[]) {
  const headers = ['IP Address', 'Port', 'AE Title', 'Traffic Type', 'Source System', 'Destination System', 'Environment', 'Notes'];
  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    const env = r.envTest && r.envProd ? 'Both' : r.envTest ? 'Test' : r.envProd ? 'Production' : '';
    csvRows.push([r.ip, r.port, r.aeTitle, r.trafficType, r.sourceSystem, r.destinationSystem, env, r.notes].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, 'connectivity-endpoints.csv');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main Component ───────────────────────────────────────────────────────────
export function ConnectivityTable({ rows, onChange, systems = [] }: ConnectivityTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Build system names list from org's systems inventory
  const systemNames = useMemo(() => {
    return systems.filter(s => s.name).map(s => s.name);
  }, [systems]);

  // Collect any custom traffic types from existing rows
  const customTrafficTypes = useMemo(() => {
    const defaults = new Set(DEFAULT_TRAFFIC_TYPES.map(t => t.toLowerCase()));
    return rows
      .map(r => r.trafficType)
      .filter(t => t && !defaults.has(t.toLowerCase()));
  }, [rows]);

  const addRow = useCallback(() => {
    onChange([...rows, emptyRow()]);
  }, [rows, onChange]);

  const duplicateRow = useCallback((idx: number) => {
    const source = rows[idx];
    const newRow: ConnectivityRow = { ...source, id: makeId() };
    const updated = [...rows];
    updated.splice(idx + 1, 0, newRow);
    onChange(updated);
  }, [rows, onChange]);

  const removeRow = useCallback((idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  }, [rows, onChange]);

  const updateField = useCallback((idx: number, field: keyof ConnectivityRow, value: string | boolean) => {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    onChange(updated);
  }, [rows, onChange]);

  const handleImport = useCallback((imported: ConnectivityRow[]) => {
    onChange([...rows, ...imported]);
  }, [rows, onChange]);

  const filledRows = rows.filter(r => r.ip || r.port || r.sourceSystem || r.destinationSystem);

  return (
    <div className="space-y-4">
      {/* Header with summary + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {filledRows.length > 0 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          <span className="text-sm text-muted-foreground">
            {filledRows.length} endpoint{filledRows.length !== 1 ? 's' : ''} configured
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          {rows.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportCSV(rows)} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportJSON(rows)} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> JSON
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Endpoint
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />

      {/* Table — desktop */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[180px]">IP Address</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[100px]">Port</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[100px]">AE Title</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[180px]">Traffic Type</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Source System</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Destination System</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-[110px]">Environment</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No endpoints configured yet. Click "Add Endpoint" or "Import" to get started.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                {/* IP Address — wider */}
                <td className="px-2 py-1.5">
                  <Input
                    value={row.ip}
                    onChange={(e) => updateField(idx, 'ip', e.target.value)}
                    placeholder="10.1.2.3"
                    className="h-8 text-sm bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                {/* Port — wider */}
                <td className="px-2 py-1.5">
                  <Input
                    value={row.port}
                    onChange={(e) => updateField(idx, 'port', e.target.value)}
                    placeholder="104"
                    className="h-8 text-sm bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                {/* AE Title */}
                <td className="px-2 py-1.5">
                  <Input
                    value={row.aeTitle}
                    onChange={(e) => updateField(idx, 'aeTitle', e.target.value)}
                    placeholder="AE_TITLE"
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                {/* Traffic Type — combobox with custom add */}
                <td className="px-2 py-1.5">
                  <TrafficTypeCombobox
                    value={row.trafficType}
                    onChange={(v) => updateField(idx, 'trafficType', v)}
                    customTypes={customTrafficTypes}
                  />
                </td>
                {/* Source System — combobox from systems inventory */}
                <td className="px-2 py-1.5">
                  <SystemCombobox
                    value={row.sourceSystem}
                    onChange={(v) => updateField(idx, 'sourceSystem', v)}
                    systems={systemNames}
                    placeholder="Select source"
                  />
                </td>
                {/* Destination System — combobox from systems inventory */}
                <td className="px-2 py-1.5">
                  <SystemCombobox
                    value={row.destinationSystem}
                    onChange={(v) => updateField(idx, 'destinationSystem', v)}
                    systems={systemNames}
                    placeholder="Select destination"
                  />
                </td>
                {/* Environment — checkboxes */}
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={row.envTest}
                        onCheckedChange={(checked) => updateField(idx, 'envTest', !!checked)}
                      />
                      <span className="text-xs text-yellow-400">Test</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={row.envProd}
                        onCheckedChange={(checked) => updateField(idx, 'envProd', !!checked)}
                      />
                      <span className="text-xs text-red-400">Prod</span>
                    </label>
                  </div>
                </td>
                {/* Actions */}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => duplicateRow(idx)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="Duplicate row"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile / tablet */}
      <div className="lg:hidden space-y-3">
        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No endpoints configured yet. Tap "Add Endpoint" or "Import" to get started.
          </div>
        )}
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                {(row.envTest || row.envProd) && (
                  <div className="flex gap-1">
                    {row.envTest && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Test</span>}
                    {row.envProd && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/40">Prod</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                >
                  {expandedRow === row.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => duplicateRow(idx)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => removeRow(idx)} className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">IP Address</label>
                <Input value={row.ip} onChange={(e) => updateField(idx, 'ip', e.target.value)} placeholder="10.1.2.3" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Port</label>
                <Input value={row.port} onChange={(e) => updateField(idx, 'port', e.target.value)} placeholder="104" className="h-8 text-sm" />
              </div>
            </div>

            {(expandedRow === row.id || !row.ip) && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">AE Title</label>
                  <Input value={row.aeTitle} onChange={(e) => updateField(idx, 'aeTitle', e.target.value)} placeholder="AE_TITLE" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Traffic Type</label>
                  <TrafficTypeCombobox
                    value={row.trafficType}
                    onChange={(v) => updateField(idx, 'trafficType', v)}
                    customTypes={customTrafficTypes}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Source System</label>
                    <SystemCombobox
                      value={row.sourceSystem}
                      onChange={(v) => updateField(idx, 'sourceSystem', v)}
                      systems={systemNames}
                      placeholder="Select source"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Destination System</label>
                    <SystemCombobox
                      value={row.destinationSystem}
                      onChange={(v) => updateField(idx, 'destinationSystem', v)}
                      systems={systemNames}
                      placeholder="Select dest"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Environment</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={row.envTest} onCheckedChange={(checked) => updateField(idx, 'envTest', !!checked)} />
                      <span className="text-xs text-yellow-400">Test</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={row.envProd} onCheckedChange={(checked) => updateField(idx, 'envProd', !!checked)} />
                      <span className="text-xs text-red-400">Prod</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Input value={row.notes} onChange={(e) => updateField(idx, 'notes', e.target.value)} placeholder="Optional notes" className="h-8 text-xs" />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Quick-add row button at bottom */}
      {rows.length > 0 && (
        <Button size="sm" variant="ghost" onClick={addRow} className="w-full gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50">
          <Plus className="w-4 h-4" /> Add another endpoint
        </Button>
      )}
    </div>
  );
}
