import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, CheckCircle2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConnectivityRow {
  id: string;
  ip: string;
  port: string;
  protocol: string;       // DICOM, HL7, FHIR, VPN, Other
  aeTitle: string;         // AE Title (DICOM only)
  trafficType: string;     // Orders, Images, Reports, Priors, ADT, etc.
  sourceSystem: string;    // e.g., "Epic Radiant", "CT Scanner 1"
  destinationSystem: string; // e.g., "New Lantern PACS"
  environment: string;     // Test, Production
  notes: string;
}

interface ConnectivityTableProps {
  rows: ConnectivityRow[];
  onChange: (rows: ConnectivityRow[]) => void;
}

const PROTOCOLS = ['DICOM', 'HL7', 'FHIR', 'VPN', 'HTTPS/API', 'Other'] as const;
const TRAFFIC_TYPES = ['Orders (ORM)', 'Images (C-STORE)', 'Priors (C-FIND/C-MOVE)', 'Reports (ORU)', 'ADT', 'Query/Retrieve', 'Dose Reports', 'Tech Sheets', 'Other'] as const;
const ENVIRONMENTS = ['Test', 'Production', 'Both'] as const;

const PROTOCOL_COLORS: Record<string, string> = {
  'DICOM': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'HL7': 'bg-green-500/20 text-green-300 border-green-500/40',
  'FHIR': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'VPN': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  'HTTPS/API': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'Other': 'bg-gray-500/20 text-gray-300 border-gray-500/40',
};

const ENV_COLORS: Record<string, string> = {
  'Test': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  'Production': 'bg-red-500/20 text-red-300 border-red-500/40',
  'Both': 'bg-teal-500/20 text-teal-300 border-teal-500/40',
};

function makeId() {
  return 'conn_' + Math.random().toString(36).slice(2, 10);
}

function emptyRow(): ConnectivityRow {
  return {
    id: makeId(),
    ip: '',
    port: '',
    protocol: '',
    aeTitle: '',
    trafficType: '',
    sourceSystem: '',
    destinationSystem: '',
    environment: '',
    notes: '',
  };
}

export function ConnectivityTable({ rows, onChange }: ConnectivityTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  const updateField = useCallback((idx: number, field: keyof ConnectivityRow, value: string) => {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    onChange(updated);
  }, [rows, onChange]);

  const filledRows = rows.filter(r => r.ip || r.port || r.protocol || r.sourceSystem || r.destinationSystem);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {filledRows.length > 0 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          <span className="text-sm text-muted-foreground">
            {filledRows.length} endpoint{filledRows.length !== 1 ? 's' : ''} configured
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Endpoint
        </Button>
      </div>

      {/* Table — desktop */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[110px]">IP Address</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[80px]">Port</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[120px]">Protocol</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[100px]">AE Title</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[140px]">Traffic Type</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Source System</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Destination System</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-[110px]">Environment</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No endpoints configured yet. Click "Add Endpoint" to get started.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                <td className="px-2 py-1.5">
                  <Input
                    value={row.ip}
                    onChange={(e) => updateField(idx, 'ip', e.target.value)}
                    placeholder="10.1.2.3"
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={row.port}
                    onChange={(e) => updateField(idx, 'port', e.target.value)}
                    placeholder="104"
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select value={row.protocol} onValueChange={(v) => updateField(idx, 'protocol', v)}>
                    <SelectTrigger className="h-8 text-xs border-border/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map(p => (
                        <SelectItem key={p} value={p}>
                          <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium border', PROTOCOL_COLORS[p] || PROTOCOL_COLORS['Other'])}>
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={row.aeTitle}
                    onChange={(e) => updateField(idx, 'aeTitle', e.target.value)}
                    placeholder={row.protocol === 'DICOM' ? 'AE_TITLE' : 'N/A'}
                    disabled={row.protocol !== 'DICOM' && row.protocol !== ''}
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select value={row.trafficType} onValueChange={(v) => updateField(idx, 'trafficType', v)}>
                    <SelectTrigger className="h-8 text-xs border-border/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAFFIC_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={row.sourceSystem}
                    onChange={(e) => updateField(idx, 'sourceSystem', e.target.value)}
                    placeholder="e.g., Epic Radiant"
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={row.destinationSystem}
                    onChange={(e) => updateField(idx, 'destinationSystem', e.target.value)}
                    placeholder="e.g., New Lantern"
                    className="h-8 text-xs bg-transparent border-border/50 focus:border-primary"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select value={row.environment} onValueChange={(v) => updateField(idx, 'environment', v)}>
                    <SelectTrigger className="h-8 text-xs border-border/50">
                      <SelectValue placeholder="Env" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENVIRONMENTS.map(e => (
                        <SelectItem key={e} value={e}>
                          <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium border', ENV_COLORS[e] || '')}>
                            {e}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
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
            No endpoints configured yet. Tap "Add Endpoint" to get started.
          </div>
        )}
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                {row.protocol && (
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', PROTOCOL_COLORS[row.protocol] || PROTOCOL_COLORS['Other'])}>
                    {row.protocol}
                  </span>
                )}
                {row.environment && (
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', ENV_COLORS[row.environment] || '')}>
                    {row.environment}
                  </span>
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
                <Input value={row.ip} onChange={(e) => updateField(idx, 'ip', e.target.value)} placeholder="10.1.2.3" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Port</label>
                <Input value={row.port} onChange={(e) => updateField(idx, 'port', e.target.value)} placeholder="104" className="h-8 text-xs" />
              </div>
            </div>

            {(expandedRow === row.id || !row.ip) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Protocol</label>
                    <Select value={row.protocol} onValueChange={(v) => updateField(idx, 'protocol', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {PROTOCOLS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">AE Title</label>
                    <Input
                      value={row.aeTitle}
                      onChange={(e) => updateField(idx, 'aeTitle', e.target.value)}
                      placeholder={row.protocol === 'DICOM' ? 'AE_TITLE' : 'N/A'}
                      disabled={row.protocol !== 'DICOM' && row.protocol !== ''}
                      className="h-8 text-xs disabled:opacity-40"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Traffic Type</label>
                  <Select value={row.trafficType} onValueChange={(v) => updateField(idx, 'trafficType', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select traffic type" /></SelectTrigger>
                    <SelectContent>
                      {TRAFFIC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Source System</label>
                    <Input value={row.sourceSystem} onChange={(e) => updateField(idx, 'sourceSystem', e.target.value)} placeholder="e.g., Epic" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Destination System</label>
                    <Input value={row.destinationSystem} onChange={(e) => updateField(idx, 'destinationSystem', e.target.value)} placeholder="e.g., New Lantern" className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Environment</label>
                  <Select value={row.environment} onValueChange={(v) => updateField(idx, 'environment', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select environment" /></SelectTrigger>
                    <SelectContent>
                      {ENVIRONMENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
