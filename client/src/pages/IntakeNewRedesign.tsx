import { useState, useEffect, useRef, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Upload, CheckCircle2, Circle, LogOut, FileText, Shield, FileUp, Network, ClipboardCheck, Star, X, File, CloudUpload, Trash2, Paperclip, FileIcon, Menu, Pencil, Plus, RefreshCw, Import, FileDown, FileUp as FileUpIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { questionnaireSections, type Question, type Section } from "@shared/questionnaireData";
import { toast } from "sonner";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { IntegrationWorkflows } from "@/components/IntegrationWorkflows";
import { ConnectivityTable, type ConnectivityRow } from "@/components/ConnectivityTable";
import { UserMenu } from "@/components/UserMenu";
import { UploadedFilesList } from "@/components/UploadedFileRow";

// Section icons mapping
const sectionIcons: Record<string, any> = {
  "org-info": FileText,
  "architecture": Network,
  "integration-workflows": Network,
  "connectivity": FileUp,
  "config-files": FileUp,
  "hl7-dicom": ClipboardCheck,
};

// Helper to get file extension icon color
function getFileIconColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'text-green-400';
  if (['pdf'].includes(ext)) return 'text-red-400';
  if (['doc', 'docx'].includes(ext)) return 'text-blue-400';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'text-yellow-400';
  return 'text-purple-400';
}

function getFileExtLabel(fileName: string): string {
  return (fileName.split('.').pop()?.toUpperCase() || 'FILE');
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── System type badge config ──────────────────────────────────────────────────
const SYSTEM_TYPES = ['PACS', 'VNA', 'Router', 'EHR', 'RIS', 'Integration Engine', 'AI', 'Modality', 'Other'] as const;
type SystemType = typeof SYSTEM_TYPES[number];

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  'PACS':             'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'VNA':              'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Router':           'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'EHR':              'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'RIS':              'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Integration Engine': 'bg-green-500/20 text-green-300 border-green-500/30',
  'AI':               'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'Modality':         'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Reporting':        'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Other':            'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

// Vendor/product options per system type
const VENDOR_OPTIONS: Record<string, string[]> = {
  'PACS':             ['Agfa', 'Carestream', 'Cerner', 'Fujifilm Synapse', 'GE Centricity', 'Horos', 'Infinitt', 'McKesson', 'Merge', 'Philips IntelliSpace', 'Sectra', 'Siemens syngo.plaza', 'Visage', 'Other'],
  'VNA':              ['Agfa', 'Fujifilm', 'GE', 'Hyland', 'Merge', 'Philips', 'Umbra', 'Other'],
  'Router':           ['DCM4J proxy', 'Laurel Bridge', 'Mercure', 'Merge', 'Silverback', 'Other'],
  'EHR':              ['AllScripts', 'Athena', 'Cerner', 'eClinicalWorks', 'Epic', 'Meditech', 'NextGen', 'Other'],
  'RIS':              ['Abbadox', 'Agfa', 'Cerner', 'Epic', 'Fujifilm', 'Meditech', 'Sectra', 'Other'],
  'Integration Engine': ['Cloverleaf', 'MetInformatics', 'Mirth Connect', 'Rhapsody', 'Other'],
  'AI':               ['Aidoc', 'Arterys', 'Bayer (Calantic)', 'CADstream', 'Enlitic', 'HeartFlow', 'iCAD', 'Koios', 'Lunit', 'Nuance', 'Qure.ai', 'RapidAI', 'Viz.AI', 'Zebra Medical', 'Other'],
  'Reporting':        ['Fluency', 'mModal', 'Nuance PowerScribe', 'PowerScribe 360', 'RadReport', 'Speechnotes', 'Other'],
  'Modality':         ['Canon', 'Fujifilm', 'GE', 'Hologic', 'Philips', 'Siemens', 'Other'],
  'Other':            ['Abbadox', 'DataFirst', 'Fluency', 'Google Cloud DCM', 'Nuance PowerScribe', 'Other'],
};

// Default system rows that are always shown (pre-loaded)
const DEFAULT_SYSTEM_ROWS: { type: string; label: string; multiSelect?: boolean }[] = [
  { type: 'PACS', label: 'PACS' },
  { type: 'VNA', label: 'VNA' },
  { type: 'Router', label: 'Router / Middleware' },
  { type: 'EHR', label: 'EHR' },
  { type: 'RIS', label: 'RIS' },
  { type: 'Integration Engine', label: 'Integration Engine' },
  { type: 'AI', label: 'AI Platforms', multiSelect: true },
  { type: 'Reporting', label: 'Reporting / Dictation' },
];

interface SystemEntry { id: string; name: string; type: string; description: string; }

interface ArchitectureOverviewProps {
  slug: string;
  diagramFiles: Array<{ id: number; fileName: string; fileUrl: string; mimeType?: string | null; createdAt?: string | Date | null }>;
  isDiagramUploading: boolean;
  onDiagramUpload: (file: File) => void;
  onDiagramDelete: (fileId: number) => void;
  systemsJson: any;
  onSystemsChange: (json: string) => void;
}

function ArchitectureOverview({
  diagramFiles,
  isDiagramUploading,
  onDiagramUpload,
  onDiagramDelete,
  systemsJson,
  onSystemsChange,
}: ArchitectureOverviewProps) {
  const diagramInputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic vendor options from database (falls back to hardcoded if unavailable)
  const { data: dynamicVendors } = trpc.intake.getActiveVendorOptions.useQuery();
  const vendorOptions = dynamicVendors && Object.keys(dynamicVendors).length > 0 ? dynamicVendors : VENDOR_OPTIONS;

  // Parse systems from JSON
  const systems: SystemEntry[] = (() => {
    try {
      const raw = systemsJson ? (typeof systemsJson === 'string' ? JSON.parse(systemsJson) : systemsJson) : [];
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  const saveSystems = (updated: SystemEntry[]) => {
    onSystemsChange(JSON.stringify(updated));
  };

  // Helper: get system entry for a default row type
  const getSystemForType = (type: string) => systems.find(s => s.type === type);
  // Helper: get all AI entries (multi-select)
  const getAISystems = () => systems.filter(s => s.type === 'AI');
  // Helper: get custom (non-default) systems
  const customSystems = systems.filter(s => !DEFAULT_SYSTEM_ROWS.some(d => d.type === s.type));

  // Update a default row's vendor selection
  const setDefaultRowVendor = (type: string, vendor: string) => {
    const existing = getSystemForType(type);
    if (existing) {
      saveSystems(systems.map(s => s.id === existing.id ? { ...s, name: vendor, description: '' } : s));
    } else {
      saveSystems([...systems, { id: crypto.randomUUID(), name: vendor, type, description: '' }]);
    }
  };

  // Clear a default row
  const clearDefaultRow = (type: string) => {
    saveSystems(systems.filter(s => s.type !== type));
  };

  // Toggle AI vendor (multi-select)
  const toggleAIVendor = (vendor: string) => {
    const aiSystems = getAISystems();
    const existing = aiSystems.find(s => s.name === vendor);
    if (existing) {
      saveSystems(systems.filter(s => s.id !== existing.id));
    } else {
      saveSystems([...systems, { id: crypto.randomUUID(), name: vendor, type: 'AI', description: '' }]);
    }
  };

  // Custom row add/edit/delete
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('Other');
  const [editDesc, setEditDesc] = useState('');

  const startAdd = () => { setIsAdding(true); setEditName(''); setEditType('Other'); setEditDesc(''); };
  const startEdit = (s: SystemEntry) => { setEditingId(s.id); setEditName(s.name); setEditType(s.type); setEditDesc(s.description); };
  const cancelEdit = () => { setEditingId(null); setIsAdding(false); };

  const saveEdit = () => {
    if (!editName.trim()) return;
    if (isAdding) {
      saveSystems([...systems, { id: crypto.randomUUID(), name: editName.trim(), type: editType, description: editDesc.trim() }]);
      setIsAdding(false);
    } else {
      saveSystems(systems.map(s => s.id === editingId ? { ...s, name: editName.trim(), type: editType, description: editDesc.trim() } : s));
      setEditingId(null);
    }
    setEditName(''); setEditType('Other'); setEditDesc('');
  };

  const deleteSystem = (id: string) => saveSystems(systems.filter(s => s.id !== id));

  // Import/Export systems
  const systemsImportRef = useRef<HTMLInputElement>(null);
  const exportSystems = () => {
    const blob = new Blob([JSON.stringify(systems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'systems-export.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const importSystems = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          // Merge: add imported systems that don't already exist
          // Supports both native format { name, type, description } and
          // external format { vendor_product, system_type, notes }
          const merged = [...systems];
          for (const item of imported) {
            const name = item.name || item.vendor_product || '';
            const type = item.type || item.system_type || '';
            const description = item.description || item.notes || '';
            if (name && type && !merged.some(s => s.name === name && s.type === type)) {
              merged.push({ id: crypto.randomUUID(), name, type, description });
            }
          }
          saveSystems(merged);
        }
      } catch { /* ignore bad JSON */ }
    };
    reader.readAsText(file);
  };

  // allUploadedFiles is ordered DESC — index 0 is the newest file
  const latestDiagram = diagramFiles[0];
  const isImage = latestDiagram
    ? (latestDiagram.mimeType?.startsWith('image/') ?? /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(latestDiagram.fileName))
    : false;
  const [imgError, setImgError] = useState(false);
  // Reset error state when a new file is uploaded
  const lastFileId = useRef<number | undefined>(undefined);
  if (latestDiagram?.id !== lastFileId.current) {
    lastFileId.current = latestDiagram?.id;
    if (imgError) setImgError(false);
  }
  const uploadedDate = latestDiagram?.createdAt
    ? new Date(latestDiagram.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6 mt-4">
      {/* ── Architecture Diagram (full width) ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Architecture Diagram</h3>
          {latestDiagram && (
            <span className="text-xs font-semibold tracking-wide text-green-400 uppercase">Uploaded</span>
          )}
        </div>

        {latestDiagram ? (
          <>
            {/* Diagram preview */}
            <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/20 flex items-center justify-center min-h-40">
              {isImage && !imgError ? (
                <a href={latestDiagram.fileUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                  <img
                    src={latestDiagram.fileUrl}
                    alt={latestDiagram.fileName}
                    className="w-full object-contain max-h-[60vh]"
                    onError={() => setImgError(true)}
                  />
                </a>
              ) : (
                <a
                  href={latestDiagram.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-8 text-muted-foreground hover:text-purple-400 transition-colors"
                >
                  <FileText className="w-10 h-10" />
                  <span className="text-sm">Click to view {latestDiagram.fileName}</span>
                </a>
              )}
            </div>
            {/* File info + actions */}
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium truncate">{latestDiagram.fileName}</p>
                {uploadedDate && <p className="text-xs text-muted-foreground">Uploaded: {uploadedDate}</p>}
              </div>
              <div className="flex gap-2">
                <a
                  href={latestDiagram.fileUrl}
                  download={latestDiagram.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="ghost" className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground">
                    <FileDown className="w-3.5 h-3.5" /> Export
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => diagramInputRef.current?.click()}
                  disabled={isDiagramUploading}
                  className="shrink-0 gap-1.5"
                >
                  {isDiagramUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Replace
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Upload drop zone */
          <div
            className="flex-1 border-2 border-dashed border-border/50 rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
            onClick={() => diagramInputRef.current?.click()}
          >
            {isDiagramUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <CloudUpload className="w-10 h-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Upload Architecture Diagram</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, PDF supported</p>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={diagramInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (latestDiagram) onDiagramDelete(latestDiagram.id);
              onDiagramUpload(file);
            }
            e.target.value = '';
          }}
        />
      </div>

      {/* ── Systems in Your Environment (full width below diagram) ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-base flex-1 min-w-0">Systems in Your Environment</h3>
          <div className="flex items-center gap-1 shrink-0">
            {systems.length > 0 && (
              <span className="text-xs font-semibold tracking-wide text-green-400 uppercase mr-1">Populated</span>
            )}
            <Button size="sm" variant="ghost" onClick={exportSystems} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" title="Export systems">
              <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => systemsImportRef.current?.click()} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" title="Import systems">
              <Import className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import</span>
            </Button>
            <input ref={systemsImportRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importSystems(f); e.target.value = ''; }} />
          </div>
        </div>

        {/* Pre-loaded system rows */}
        <div className="flex flex-col divide-y divide-border/40">
          {DEFAULT_SYSTEM_ROWS.map(row => {
            if (row.multiSelect) {
              // AI row: multi-select checkboxes
              const selectedAI = getAISystems().map(s => s.name);
              const vendors = vendorOptions[row.type] || VENDOR_OPTIONS[row.type] || [];
              return (
                <div key={row.type} className="py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${SYSTEM_TYPE_COLORS[row.type] || SYSTEM_TYPE_COLORS['Other']}`}>{row.label}</span>
                    {selectedAI.length > 0 && (
                      <span className="text-xs text-muted-foreground">{selectedAI.length} selected</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vendors.filter(v => v !== 'Other').map(vendor => (
                      <button
                        key={vendor}
                        onClick={() => toggleAIVendor(vendor)}
                        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                          selectedAI.includes(vendor)
                            ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-200'
                            : 'bg-background/30 border-border/50 text-muted-foreground hover:border-indigo-500/30 hover:text-indigo-300'
                        }`}
                      >
                        {vendor}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            // Single-select row with vendor dropdown
            const current = getSystemForType(row.type);
            const vendors = vendorOptions[row.type] || VENDOR_OPTIONS[row.type] || [];
            return (
              <div key={row.type} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border self-start sm:w-[130px] sm:text-center ${SYSTEM_TYPE_COLORS[row.type] || SYSTEM_TYPE_COLORS['Other']}`}>{row.label}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <select
                    value={current?.name || ''}
                    onChange={e => {
                      if (e.target.value) setDefaultRowVendor(row.type, e.target.value);
                      else clearDefaultRow(row.type);
                    }}
                    className="flex-1 h-8 text-sm rounded-md border border-input bg-background/50 px-2 text-foreground"
                  >
                    <option value="">Select {row.label}...</option>
                    {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {current && (
                    <button onClick={() => clearDefaultRow(row.type)} className="text-muted-foreground hover:text-red-400 shrink-0" title="Clear">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom (additional) systems */}
        {customSystems.length > 0 && (
          <>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Additional Systems</div>
            <div className="flex flex-col divide-y divide-border/40">
              {customSystems.map(s => (
                <div key={s.id} className="py-3">
                  {editingId === s.id ? (
                    <SystemEditRow
                      name={editName} type={editType} description={editDesc}
                      onNameChange={setEditName} onTypeChange={setEditType} onDescChange={setEditDesc}
                      onSave={saveEdit} onCancel={cancelEdit}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${SYSTEM_TYPE_COLORS[s.type] || SYSTEM_TYPE_COLORS['Other']}`}>{s.type}</span>
                      <span className="font-medium text-sm flex-1 min-w-0 truncate">{s.name}</span>
                      {s.description && <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate hidden sm:block">{s.description}</span>}
                      <button onClick={() => startEdit(s)} className="text-muted-foreground hover:text-foreground shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteSystem(s.id)} className="text-muted-foreground hover:text-red-400 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add custom system row */}
        {isAdding ? (
          <SystemEditRow
            name={editName} type={editType} description={editDesc}
            onNameChange={setEditName} onTypeChange={setEditType} onDescChange={setEditDesc}
            onSave={saveEdit} onCancel={cancelEdit}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={startAdd}
            className="self-start gap-1.5 bg-purple-600/20 border-purple-500/30 hover:bg-purple-600/30 text-purple-300"
          >
            <Plus className="w-4 h-4" />
            Add Custom System
          </Button>
        )}
      </div>
    </div>
  );
}

function SystemEditRow({
  name, type, description,
  onNameChange, onTypeChange, onDescChange,
  onSave, onCancel,
}: {
  name: string; type: string; description: string;
  onNameChange: (v: string) => void; onTypeChange: (v: string) => void; onDescChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="System name"
          className="flex-1 h-8 text-sm bg-background/50"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        />
        <select
          value={type}
          onChange={e => onTypeChange(e.target.value)}
          className="h-8 text-sm rounded-md border border-input bg-background/50 px-2 text-foreground"
        >
          {SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Input
        value={description}
        onChange={e => onDescChange(e.target.value)}
        placeholder="Description (optional)"
        className="h-8 text-sm bg-background/50"
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs">Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

// Local-state wrappers so typing doesn't re-render the whole page.
// They update global state only on blur.
function LocalInput({
  value,
  onCommit,
  placeholder,
  className,
  type = "text",
}: {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setLocal(value);
    }
  }, [value]);
  return (
    <Input
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { committed.current = local; onCommit(local); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

function LocalTextarea({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setLocal(value);
    }
  }, [value]);
  return (
    <Textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { committed.current = local; onCommit(local); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

export default function IntakeNewRedesign() {
  const [, params] = useRoute("/org/:slug/intake");
  const slug = params?.slug;
  const [, setLocation] = useLocation();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [currentSection, setCurrentSection] = useState<string>(() => {
    // Honor ?section= query param for deep-linking from Implementation page
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section");
    return s && questionnaireSections.find(sec => sec.id === s) ? s : "org-info";
  });
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [unansweredQuestions, setUnansweredQuestions] = useState<Set<string>>(new Set());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasNavigatedRef = useRef(false); // Track if we've already auto-navigated
  const { user } = useAuth();

  // Fetch organization
  const { data: org } = trpc.organizations.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch existing responses
  const { data: existingResponses, isLoading: orgLoading } = trpc.intake.getResponses.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch file count from database
  const { data: fileCount = 0 } = trpc.intake.getFileCount.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch all uploaded files to check validation
  const { data: allUploadedFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Notion connectivity — live read/write
  const { data: notionConnData } = trpc.connectivity.getForOrg.useQuery(
    { organizationSlug: slug || "", organizationName: org?.name },
    { enabled: !!slug && !!org }
  );

  const [connRows, setConnRows] = useState<ConnectivityRow[]>([]);
  const notionPageIds = useRef<Set<string>>(new Set());

  // Seed from Notion on load; fall back to local DB if Notion has no rows
  useEffect(() => {
    if (notionConnData?.rows && notionConnData.rows.length > 0) {
      setConnRows(notionConnData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(notionConnData.rows.map((r: any) => r.id));
    } else if (notionConnData !== undefined) {
      // Notion configured but empty — fall back to local DB data
      try {
        const v = responses['CONN.endpoints'];
        if (v) setConnRows(typeof v === 'string' ? JSON.parse(v) : v);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionConnData]);

  const createConnRow = trpc.connectivity.createRow.useMutation();
  const updateConnRow = trpc.connectivity.updateRow.useMutation();
  const archiveConnRow = trpc.connectivity.archiveRow.useMutation();

  const handleConnChange = async (newRows: ConnectivityRow[]) => {
    const oldIds = new Set(connRows.map(r => r.id));
    const newIds = new Set(newRows.map(r => r.id));
    setConnRows(newRows); // optimistic

    // Always keep local DB in sync as backup
    if (slug && user?.email) {
      saveMutation.mutate({ organizationSlug: slug, questionId: 'CONN.endpoints', response: JSON.stringify(newRows), userEmail: user.email });
    }

    // Write-through to Notion if configured
    if (!notionConnData?.configured || !org?.name) return;

    for (const row of connRows) {
      if (!newIds.has(row.id) && notionPageIds.current.has(row.id)) {
        archiveConnRow.mutate({ pageId: row.id });
        notionPageIds.current.delete(row.id);
      }
    }
    for (const row of newRows) {
      if (!oldIds.has(row.id)) {
        createConnRow.mutate(
          { organizationName: org.name, row },
          { onSuccess: ({ pageId }) => {
              notionPageIds.current.add(pageId);
              setConnRows(prev => prev.map(r => r.id === row.id ? { ...r, id: pageId } : r));
            }
          }
        );
      } else if (notionPageIds.current.has(row.id)) {
        const old = connRows.find(r => r.id === row.id);
        if (JSON.stringify(old) !== JSON.stringify(row)) {
          updateConnRow.mutate({ pageId: row.id, organizationName: org.name, row });
        }
      }
    }
  };

  // Fetch partner templates from database
  const { data: dbTemplates = [] } = trpc.intake.getTemplatesForOrg.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Build a map of questionId -> template(s) from database
  const dbTemplateMap = useMemo(() => {
    const map = new Map<string, Array<{ label: string; fileName: string; fileUrl: string }>>(); 
    dbTemplates.forEach(t => {
      const existing = map.get(t.questionId) || [];
      existing.push({ label: t.label, fileName: t.fileName, fileUrl: t.fileUrl });
      map.set(t.questionId, existing);
    });
    return map;
  }, [dbTemplates]);

  // Create a map of questionId -> file count for validation
  const uploadedFilesMap = useMemo(() => {
    const map = new Map<string, number>();
    allUploadedFiles.forEach(file => {
      const count = map.get(file.questionId) || 0;
      map.set(file.questionId, count + 1);
    });
    return map;
  }, [allUploadedFiles]);

  // Load existing responses
  useEffect(() => {
    if (existingResponses) {
      const loadedResponses: Record<string, any> = {};
      existingResponses.forEach((resp) => {
        // Skip responses with null questionId (orphaned data)
        if (!resp.questionId) return;
        
        try {
          const value = typeof resp.response === 'string' ? JSON.parse(resp.response) : resp.response;
          loadedResponses[resp.questionId] = value;
        } catch {
          loadedResponses[resp.questionId] = resp.response;
        }
      });
      setResponses(loadedResponses);
    }
  }, [existingResponses]);

  // Auto-navigate to first incomplete section ONLY on first load (skipped when ?section= is present)
  // Handle deep-link query params (?section=xxx&q=yyy) from Implementation/Validation pages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('section');
    const questionParam = params.get('q');

    if (sectionParam) {
      const validSection = questionnaireSections.find(s => s.id === sectionParam);
      if (validSection) {
        // Section already set synchronously by useState initializer; just block auto-navigate
        hasNavigatedRef.current = true;

        // If a specific question is targeted, scroll to it after render
        if (questionParam) {
          setTimeout(() => {
            const el = document.getElementById(`question-${questionParam}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background', 'rounded-lg');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background', 'rounded-lg');
              }, 3000);
            }
          }, 500);
        }
      }
    }
  }, []); // Run once on mount
  useEffect(() => {
    // Skip if already navigated, responses not loaded, or explicit section param given
    const urlSection = new URLSearchParams(window.location.search).get("section");
    if (hasNavigatedRef.current || Object.keys(responses).length === 0 || urlSection) return;
    
    // Find first section that is not 100% complete
    const firstIncompleteSection = questionnaireSections.find(section => {
      const progress = calculateSectionProgress(section);
      return progress < 100;
    });
    
    if (firstIncompleteSection) {
      setCurrentSection(firstIncompleteSection.id);
    }
    
    // Mark that we've done the initial navigation
    hasNavigatedRef.current = true;
  }, [responses]); // Run when responses are loaded

  // Save mutation
  const saveMutation = trpc.intake.saveResponse.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  // Feedback submission mutation
  const submitFeedbackMutation = trpc.intake.submitFeedback.useMutation({
    onSuccess: () => {
      setShowFeedbackModal(false);
      setFeedbackRating(0);
      setFeedbackComments("");
      setLocation(`/org/${slug}/complete`);
    },
    onError: () => {
      toast.error('Failed to submit feedback. Please try again.');
    },
  });

  // Auto-save on response change
  useEffect(() => {
    if (!slug || Object.keys(responses).length === 0) return;
    
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      console.log('[VPN Debug] Auto-saving responses:', Object.keys(responses));
      Object.entries(responses).forEach(([questionId, value]) => {
        console.log(`[VPN Debug] Saving ${questionId}:`, value);
        saveMutation.mutate({
          organizationSlug: slug,
          questionId,
          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
          userEmail: user?.email || '',
        });
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [responses, slug]);

  // File upload mutation
  const uploadMutation = trpc.intake.uploadFile.useMutation({
    onSuccess: (data, variables) => {
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      // Refetch files for this question
      utils.intake.getUploadedFiles.invalidate({
        organizationSlug: slug || "",
        questionId: variables.questionId,
      });
      // Refetch all uploaded files to update validation map
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      // Refetch file count
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
    onError: (error, variables) => {
      // Clear uploading state even on error
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      // Show error toast
      console.error('File upload failed:', error);
      alert(`File upload failed: ${error.message}. Please try again.`);
    },
  });

  // Delete file mutation
  const deleteMutation = trpc.intake.deleteFile.useMutation({
    onSuccess: (_, variables) => {
      // Refetch files after deletion
      utils.intake.getUploadedFiles.invalidate();
      // Refetch all uploaded files to update validation map
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      // Refetch file count
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
  });

  const utils = trpc.useUtils();

  // Calculate section progress (including uploaded files)
  const calculateSectionProgress = (section: Section) => {
    // Handle integration-workflows section (workflow descriptions only — diagram & systems are in Architecture)
    if (section.type === 'integration-workflows') {
      const wfKeys = ['orders', 'images', 'priors', 'reports'] as const;
      const completedWorkflows = wfKeys.filter(wf => {
        const v = responses[`IW.${wf}_description`];
        return v && String(v).trim().length > 0;
      }).length;
      return Math.round((completedWorkflows / 4) * 100);
    }

    // Handle connectivity-table section
    if (section.type === 'connectivity-table') {
      // Count: D.1 answered + endpoints table has rows + file uploads
      let total = 0;
      let answered = 0;
      // Standard questions (D.1, etc.)
      const stdQuestions = (section.questions || []).filter(q => q.type !== 'upload' && q.type !== 'upload-download' && !q.inactive);
      total += stdQuestions.length;
      answered += stdQuestions.filter(q => {
        const r = responses[q.id];
        return r !== undefined && r !== '' && r !== null;
      }).length;
      // Endpoints table
      total += 1;
      try {
        const v = responses['CONN.endpoints'];
        const rows = v ? (typeof v === 'string' ? JSON.parse(v) : v) : [];
        if (Array.isArray(rows) && rows.length > 0 && rows.some((r: any) => r.ip || r.sourceSystem)) answered += 1;
      } catch { /* empty */ }
      // File uploads
      const uploadQuestions = (section.questions || []).filter(q => q.type === 'upload' || q.type === 'upload-download');
      total += uploadQuestions.length;
      answered += uploadQuestions.filter(q => allUploadedFiles.some(f => f.questionId === q.id)).length;
      return total > 0 ? Math.round((answered / total) * 100) : 100;
    }

    // Handle workflow sections differently
    if (section.type === 'workflow') {
      const configKey = section.id + '_config';
      const savedConfig = responses[configKey];
      
      if (!savedConfig) return 0;
      
      try {
        const config = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
        
        // Get all selected path keys
        const selectedPathKeys = Object.keys(config.paths || {}).filter(key => config.paths[key]);
        
        if (selectedPathKeys.length === 0) return 0;
        
        // Orders and Images workflows have fixed systems (no input fields)
        // Only Priors and Reports workflows require system name inputs
        const workflowsRequiringSystemNames = ['priors-workflow', 'reports-out-workflow'];
        
        if (!workflowsRequiringSystemNames.includes(section.id)) {
          // For Orders/Images: complete if at least one path is selected
          return 100;
        }
        
        // For Priors/Reports: check if all selected paths have their system names filled in
        const pathToSystemKeyMap: Record<string, string> = {
          'priorsPush': 'priorsPushSource',
          'priorsQuery': 'priorsQuerySource',
          'reportsToPortal': 'reportsPortalDestination'
        };
        
        const allSystemsFilled = selectedPathKeys.every(pathKey => {
          const systemKey = pathToSystemKeyMap[pathKey];
          if (!systemKey) return true; // Path doesn't require system name
          const systemValue = config.systems?.[systemKey];
          return systemValue && systemValue.trim() !== '';
        });
        
        // Complete only if at least one path is selected AND all selected paths have system names
        return allSystemsFilled ? 100 : Math.round((selectedPathKeys.length / (selectedPathKeys.length + 1)) * 100);
      } catch {
        return 0;
      }
    }
    
    // Standard sections with questions
    if (!section.questions) return 0;
    
    // Filter out inactive and hidden conditional questions first
    const visibleQuestions = section.questions.filter(q => {
      if (q.inactive) return false;
      if (q.conditionalOn) {
        const parentResponse = responses[q.conditionalOn.questionId];
        return parentResponse === q.conditionalOn.value;
      }
      return true;
    });
    
    const answered = visibleQuestions.filter(q => {
      const response = responses[q.id];

      // systems-list: complete if at least one system has been added
      if (q.type === 'systems-list') {
        try {
          const data = response ? (typeof response === 'string' ? JSON.parse(response) : response) : [];
          return Array.isArray(data) && data.length > 0;
        } catch { return false; }
      }

      // contacts-table: complete if any contact field is non-empty
      if (q.type === 'contacts-table') {
        try {
          const data = response ? (typeof response === 'string' ? JSON.parse(response) : response) : {};
          return Object.values(data).some((row: any) =>
            Object.values(row || {}).some((v: any) => v && String(v).trim() !== '')
          );
        } catch { return false; }
      }

      const hasResponse = Array.isArray(response)
        ? response.length > 0
        : (response !== undefined && response !== '' && response !== null);
      const hasUploadedFile = allUploadedFiles.some(f => f.questionId === q.id);
      return hasResponse || hasUploadedFile;
    }).length;
    
    return visibleQuestions.length > 0 
      ? Math.round((answered / visibleQuestions.length) * 100)
      : 100; // If no visible questions, consider section complete
  };

  // Handle file upload
  const handleFileUpload = async (questionId: string, file: File) => {
    if (!slug) return;
    
    setUploadingFiles(prev => new Set(prev).add(questionId));
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      // Strip the data URL prefix (e.g., "data:text/csv;base64,") to get just the base64 string
      const base64 = dataUrl.split(',')[1];
      await uploadMutation.mutateAsync({
        organizationSlug: slug,
        questionId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        userEmail: user?.email || '',
      });
    };
    reader.readAsDataURL(file);
  };

  // Export pipe-delimited file (excludes upload, upload-download, and workflow types)
  const handleExportCSV = () => {
    // Build a structured JSON export so all types (contacts, multi-select, dropdowns, etc.)
    // round-trip perfectly and are human-readable / editable.
    const exportResponses: Record<string, any> = {};
    const meta: Record<string, { section: string; text: string; type: string; options?: string[] }> = {};

    questionnaireSections.forEach(section => {
      if (section.type === 'workflow' || !section.questions) return;
      section.questions.forEach(q => {
        if (q.type === 'upload' || q.type === 'upload-download') return;
        const raw = responses[q.id];
        // Store value as-is (objects stay objects, arrays stay arrays, strings stay strings)
        // null/undefined → omit from export so file stays clean
        if (raw !== undefined && raw !== null && raw !== '') {
          exportResponses[q.id] = typeof raw === 'string'
            ? (() => { try { return JSON.parse(raw); } catch { return raw; } })()
            : raw;
        }
        meta[q.id] = {
          section: section.title,
          text: q.text,
          type: q.type,
          ...(q.options ? { options: q.options } : {}),
        };
      });
    });

    const payload = {
      exported: new Date().toISOString(),
      org: slug,
      responses: exportResponses,
      meta,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-intake-responses.json`;
    a.click();
  };

  // Import responses — supports JSON (new) and legacy pipe-delimited (txt/csv) formats
  const handleImportFile = async () => {
    if (!importFile || !slug) return;

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const importedResponses: Record<string, any> = {};

      // ── JSON format (new) ─────────────────────────────────────────────────
      if (importFile.name.endsWith('.json') || text.trimStart().startsWith('{')) {
        const payload = JSON.parse(text);
        const src = payload.responses ?? payload; // support both { responses: {...} } and bare object
        if (typeof src !== 'object' || src === null) throw new Error('Invalid JSON format');
        Object.entries(src).forEach(([qid, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            importedResponses[qid] = val;
          }
        });

      // ── Legacy pipe-delimited (txt / csv) ────────────────────────────────
      } else {
        const lines = text.split('\n').filter(l => l.trim());
        const header = lines[0] || '';
        const hasOptionsColumn = header.split('|').length >= 6;
        lines.slice(1).forEach(line => {
          const parts = line.split('|');
          const questionId  = hasOptionsColumn ? parts[1]?.trim() : parts[1]?.trim();
          const responseType = hasOptionsColumn ? parts[3]?.trim() : parts[3]?.trim();
          const responseValue = hasOptionsColumn ? parts[5]?.trim() : parts[4]?.trim();
          if (!questionId || !responseValue) return;
          if (responseType === 'workflow') return;
          if (responseType === 'contacts-table' || responseType === 'systems-list') {
            try { importedResponses[questionId] = JSON.parse(responseValue); }
            catch { importedResponses[questionId] = responseValue; }
          } else if (responseType === 'multi-select' || responseType === 'multiple-choice') {
            importedResponses[questionId] = responseValue.split('; ').map((v: string) => v.trim()).filter(Boolean);
          } else {
            importedResponses[questionId] = responseValue;
          }
        });
      }

      const importCount = Object.keys(importedResponses).length;
      if (importCount === 0) throw new Error('No responses found in file');

      // Merge into state and persist to DB
      setResponses(prev => ({ ...prev, ...importedResponses }));
      await Promise.all(Object.entries(importedResponses).map(([questionId, value]) =>
        saveMutation.mutateAsync({
          organizationSlug: slug,
          questionId,
          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
          userEmail: user?.email || '',
        })
      ));

      toast.success('Import successful', { description: `Imported ${importCount} responses` });
      setImportDialogOpen(false);
      setImportFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Failed to parse import file'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Render question input
  const renderQuestion = (question: Question) => {
    const value = responses[question.id];
    const isUploading = uploadingFiles.has(question.id);

    switch (question.type) {
      case 'text':
        return (
          <LocalInput
            value={value || ''}
            onCommit={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
            placeholder={question.placeholder}
            className="!bg-white !text-black"
          />
        );

      case 'textarea':
        return (
          <LocalTextarea
            value={value || ''}
            onCommit={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
            placeholder={question.placeholder}
            className="!bg-white !text-black min-h-[100px]"
          />
        );

      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
          >
            <SelectTrigger className="!bg-white !text-black">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        return (
          <LocalInput
            type="date"
            value={value || ''}
            onCommit={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
            className="!bg-white !text-black"
          />
        );

      case 'multi-select':
        return (
          <div className="flex flex-wrap gap-2">
            {question.options?.map(opt => {
              const checked = Array.isArray(value) && value.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    const updated = checked ? current.filter(v => v !== opt) : [...current, opt];
                    setResponses(prev => ({ ...prev, [question.id]: updated }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    checked
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      case 'upload':
      case 'upload-download': {
        // Render inline file upload for upload and upload-download questions.
        const inlineTemplates = dbTemplateMap.get(question.id) || [];
        const questionFiles = allUploadedFiles.filter(f => f.questionId === question.id);
        const uploadInputRef = { current: null as HTMLInputElement | null };
        
        return (
          <div className="space-y-3">
            {/* Template download buttons */}
            {inlineTemplates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {inlineTemplates.map((tmpl, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = tmpl.fileUrl;
                      link.download = tmpl.fileName;
                      link.click();
                    }}
                    className="bg-purple-600/80 hover:bg-purple-700 text-white border-purple-500/50 text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {tmpl.label} ({tmpl.fileName})
                  </Button>
                ))}
              </div>
            )}

            {/* Upload button row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {questionFiles.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    <CheckCircle2 className="w-3 h-3" /> {questionFiles.length} file{questionFiles.length !== 1 ? 's' : ''} uploaded
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FileIcon className="w-3.5 h-3.5" /> No file uploaded
                  </span>
                )}
              </div>
              <div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(question.id, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Upload className="w-4 h-4 mr-1.5" /> Upload</>
                  )}
                </Button>
              </div>
            </div>

            {/* Clean vertical file list with preview/download/remove */}
            {questionFiles.length > 0 && (
              <UploadedFilesList
                files={questionFiles.map(f => ({
                  id: f.id,
                  fileName: f.fileName,
                  fileUrl: f.fileUrl,
                  fileSize: f.fileSize,
                  createdAt: f.createdAt,
                  uploadedBy: f.uploadedBy,
                }))}
                onRemove={(fileId) => deleteMutation.mutate({ organizationSlug: slug || '', fileId })}
                isRemoving={deleteMutation.isPending}
                compact
              />
            )}
          </div>
        );
      }

      case 'contacts-table': {
        const CONTACT_ROWS = [
          { key: 'admin',        label: 'Administrative (A.1)' },
          { key: 'it',           label: 'IT — Connectivity & Systems (A.2)' },
          { key: 'it_post_prod', label: 'IT — Post-Production Support' },
          { key: 'clinical',     label: 'Clinical / Technologist (A.3)' },
          { key: 'radiologist',  label: 'Radiologist Champion (A.4)' },
          { key: 'pm',           label: 'Project Manager (A.5)' },
        ] as const;

        type ContactKey = typeof CONTACT_ROWS[number]['key'];
        type ContactRow = { name: string; phone: string; email: string };
        type ContactsData = Record<ContactKey, ContactRow>;

        const empty: ContactRow = { name: '', phone: '', email: '' };
        let parsed: ContactsData;
        try {
          parsed = value ? (typeof value === 'string' ? JSON.parse(value) : value) : {} as ContactsData;
        } catch { parsed = {} as ContactsData; }

        const updateContact = (rowKey: ContactKey, field: keyof ContactRow, val: string) => {
          setResponses(prev => {
            // Always read from latest state to avoid stale closure overwriting parallel edits
            const current = prev[question.id];
            let prevParsed: ContactsData;
            try {
              prevParsed = current
                ? (typeof current === 'string' ? JSON.parse(current) : current)
                : {} as ContactsData;
            } catch { prevParsed = {} as ContactsData; }

            const next: ContactsData = {
              ...prevParsed,
              [rowKey]: { ...empty, ...(prevParsed[rowKey] || {}), [field]: val },
            } as ContactsData;
            const hasContent = Object.values(next).some(r =>
              Object.values(r as ContactRow).some(v => (v as string).trim() !== '')
            );
            // Store as object — auto-save will JSON.stringify it
            return { ...prev, [question.id]: hasContent ? next : '' };
          });
        };

        return (
          <div className="overflow-x-auto rounded-lg border border-border col-span-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-56">Contact</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                </tr>
              </thead>
              <tbody>
                {CONTACT_ROWS.map(({ key, label }, idx) => {
                  const row: ContactRow = { ...empty, ...(parsed[key as ContactKey] || {}) };
                  return (
                    <tr key={key} className={idx % 2 === 1 ? 'bg-muted/10' : ''}>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground font-medium align-middle">{label}</td>
                      {(['name', 'phone', 'email'] as (keyof ContactRow)[]).map(field => (
                        <td key={field} className="px-2 py-1">
                          <LocalInput
                            value={row[field]}
                            onCommit={(val) => updateContact(key as ContactKey, field, val)}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                            className="h-8 text-sm !bg-white !text-black border-0 shadow-none focus-visible:ring-1 focus-visible:ring-primary/50"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const currentSectionData = questionnaireSections.find(s => s.id === currentSection);
  const currentSectionIndex = questionnaireSections.findIndex(s => s.id === currentSection);
  const isLastSection = currentSectionIndex === questionnaireSections.length - 1;

  const handleNext = async () => {
    // Validate workflow sections
    if (currentSectionData?.type === 'workflow') {
      const configKey = currentSectionData.id + '_config';
      const savedConfig = responses[configKey];
      let isValid = false;
      let errorMessage = 'Please select at least one workflow path';
      if (savedConfig) {
        try {
          const config = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
          const selectedPathKeys = Object.keys(config.paths || {}).filter(key => config.paths[key]);
          if (selectedPathKeys.length === 0) {
            errorMessage = 'Please select at least one workflow path';
          } else {
            const workflowsRequiringSystemNames = ['priors-workflow', 'reports-out-workflow'];
            const requiresSystemNames = workflowsRequiringSystemNames.includes(currentSectionData.id);
            if (requiresSystemNames) {
              const pathToSystemKeyMap: Record<string, string> = {
                'priorsPush': 'priorsPushSource',
                'priorsQuery': 'priorsQuerySource',
                'reportsToPortal': 'reportsPortalDestination',
              };
              const missingSystems = selectedPathKeys.filter(pathKey => {
                const systemKey = pathToSystemKeyMap[pathKey];
                if (!systemKey) return false;
                const systemValue = config.systems?.[systemKey];
                return !systemValue || systemValue.trim() === '';
              });
              if (missingSystems.length > 0) {
                errorMessage = 'Please fill in system names for all selected workflow paths';
              } else {
                isValid = true;
              }
            } else {
              isValid = true;
            }
          }
        } catch (e) {
          errorMessage = 'Invalid workflow configuration';
        }
      }
      if (!isValid) {
        toast.error(errorMessage);
        return;
      }
      if (!isLastSection) {
        setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
      } else {
        setShowFeedbackModal(true);
      }
      return;
    }

    // Check for unanswered questions in current section
    const currentQuestions = currentSectionData?.questions || [];
    const unanswered = currentQuestions
      .filter(q => {
        if (q.conditionalOn) {
          const parentResponse = responses[q.conditionalOn.questionId];
          if (parentResponse !== q.conditionalOn.value) return false;
        }
        if (q.type === 'upload' || q.type === 'upload-download') {
          return !uploadedFilesMap.has(q.id) || uploadedFilesMap.get(q.id) === 0;
        }
        return !responses[q.id] || responses[q.id] === '';
      })
      .map(q => q.id);

    if (unanswered.length > 0) {
      setUnansweredQuestions(new Set(unanswered));
      const firstUnanswered = document.querySelector(`[data-question-id="${unanswered[0]}"]`);
      firstUnanswered?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setUnansweredQuestions(new Set());

    try {
      setSaveStatus('saving');
      const savePromises = Object.entries(responses).map(([questionId, value]) =>
        saveMutation.mutateAsync({
          organizationSlug: slug || '',
          questionId,
          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
          userEmail: user?.email || '',
        })
      );
      await Promise.all(savePromises);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save responses:', error);
      toast.error('Failed to save responses. Please try again.');
      return;
    }

    if (!isLastSection) {
      setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
    } else {
      setShowFeedbackModal(true);
    }
  };

  // Show loading until responses are loaded into state
  // This ensures calculateSectionProgress has data to work with
  if (orgLoading || existingResponses === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-black border-r border-purple-500/20 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:static md:translate-x-0 md:shrink-0
      `}>
        {/* Logo - links back to dashboard */}
        <div className="p-6 border-b flex items-center justify-between">
          <Link href={`/org/${slug}`}>
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-10 cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <button
            className="md:hidden text-muted-foreground hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Overview Card */}
        <div className="p-4 border-b border-purple-500/20">
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 rounded-lg p-4 border border-purple-500/30">
            {/* Section completion count */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Overall Progress</div>
              <div className="text-lg font-bold text-white">
                {questionnaireSections.filter(s => calculateSectionProgress(s) === 100).length} of {questionnaireSections.length} sections complete
              </div>
            </div>
            
            {/* Section Progress List */}
            <div className="space-y-2 mb-3">
              {questionnaireSections.map((section, index) => {
                const progress = calculateSectionProgress(section);
                const isComplete = progress === 100;
                return (
                  <div key={section.id} className="flex items-center gap-2 text-xs">
                    {isComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className={`truncate ${isComplete ? 'text-green-400 font-medium' : 'text-muted-foreground'}`}>{section.title}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Files Count */}
            <div className="pt-3 border-t border-purple-500/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Files Uploaded</span>
                <span className="font-bold text-white">{fileCount} files</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {questionnaireSections.map((section, index) => {
            const Icon = sectionIcons[section.id] || FileText;
            const progress = calculateSectionProgress(section);
            const isActive = currentSection === section.id;
            const isComplete = progress === 100;

            return (
              <button
                key={section.id}
                onClick={() => { setCurrentSection(section.id); setSidebarOpen(false); }}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                ) : (
                  <Icon className="w-5 h-5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {index + 1}. {section.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-transparent">
        {/* Header */}
        <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-md sticky top-0 z-30">
          <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden text-muted-foreground hover:text-white flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0 hidden md:block" />
              <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
                <div className="text-sm font-bold tracking-tight truncate">Questionnaire</div>
                {org?.name && <div className="text-xs text-muted-foreground truncate">{org.name}{org.clientName ? ` · ${org.clientName}` : ""}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 hidden sm:flex"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
                className="gap-2 hidden sm:flex"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <div className="w-px h-5 bg-border/40 mx-1" />
              <Link href={`/org/${slug}`} className="text-sm text-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
                Site Dashboard
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
                  Admin
                </Link>
              )}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Overall Stats Banner */}
        <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border-b border-purple-500/20 px-4 md:px-8 py-3 md:py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Sections Completed</div>
                <div className="text-base md:text-lg font-bold">
                  {questionnaireSections.filter(s => calculateSectionProgress(s) === 100).length} of {questionnaireSections.length}
                </div>
              </div>
              <div className="hidden sm:block h-12 w-px bg-border" />
              <div>
                <div className="text-sm text-muted-foreground mb-1">Files Uploaded</div>
                <div className="text-base md:text-lg font-bold">
                  {fileCount} files
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-3 pb-20 sm:pb-8 md:p-8">
          <Card className="max-w-6xl mx-auto bg-black/40 backdrop-blur-sm border-purple-500/20">
            <div className="p-4 md:p-8">
              {/* Integration Workflows section — renders its own header */}
              {currentSectionData?.type === 'integration-workflows' ? (
                <IntegrationWorkflows
                  values={responses}
                  onChange={(key, value) => {
                    setResponses(prev => ({ ...prev, [key]: value }));
                    // Persist to DB
                    if (slug && user?.email) {
                      saveMutation.mutate({
                        organizationSlug: slug,
                        questionId: key,
                        response: typeof value === 'object' ? JSON.stringify(value) : String(value),
                        userEmail: user.email,
                      });
                    }
                  }}
                  organizationId={org?.id ?? 0}
                  onBack={() => setLocation(`/org/${slug}`)}
                  onContinue={() => {
                    const idx = questionnaireSections.findIndex(s => s.id === currentSection);
                    if (idx < questionnaireSections.length - 1) {
                      setCurrentSection(questionnaireSections[idx + 1].id);
                    } else {
                      setShowFeedbackModal(true);
                    }
                  }}
                />
              ) : (
              <>
              {/* Section Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{currentSectionData?.title}</h2>
                {currentSectionData?.description && (
                  <p className="text-sm mb-2 text-muted-foreground">
                    {currentSectionData.description}
                  </p>
                )}
                {currentSectionData?.questions && currentSectionData?.type !== 'architecture-overview' && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>
                      {Math.round(calculateSectionProgress(currentSectionData) / 100 * currentSectionData.questions.filter(q => !q.inactive).length)}/{currentSectionData.questions.filter(q => !q.inactive).length} questions answered
                    </span>
                  </div>
                )}
                {currentSectionData?.id === 'connectivity' && (
                  <p className="text-xs text-yellow-400/80 mt-1.5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>De-identify all files before uploading. Do not share PHI or patient data.</span>
                  </p>
                )}
              </div>

              {/* Questions Grid / Workflow Diagram / Architecture Overview / Connectivity Table */}
              {currentSectionData?.type === 'architecture-overview' ? (
                <ArchitectureOverview
                  slug={slug || ''}
                  diagramFiles={allUploadedFiles.filter(f => f.questionId === 'ARCH.diagram')}
                  isDiagramUploading={uploadingFiles.has('ARCH.diagram')}
                  onDiagramUpload={(file) => handleFileUpload('ARCH.diagram', file)}
                  onDiagramDelete={(fileId) => deleteMutation.mutate({ organizationSlug: slug || '', fileId })}
                  systemsJson={responses['ARCH.systems']}
                  onSystemsChange={(json) => {
                    setResponses(prev => ({ ...prev, 'ARCH.systems': json }));
                    if (slug && user?.email) {
                      saveMutation.mutate({ organizationSlug: slug, questionId: 'ARCH.systems', response: json, userEmail: user.email });
                    }
                  }}
                />
              ) : currentSectionData?.type === 'connectivity-table' ? (
                <div className="mt-6 space-y-8">
                  {/* Render D.1 and other standard questions first */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-5 md:gap-y-6">
                    {currentSectionData?.questions?.filter((question) => {
                      if (question.inactive) return false;
                      if (question.type === 'upload' || question.type === 'upload-download') return false;
                      if (question.conditionalOn) {
                        const parentResponse = responses[question.conditionalOn.questionId];
                        if (parentResponse !== question.conditionalOn.value) return false;
                      }
                      return true;
                    }).map((question) => (
                      <div key={question.id} id={`question-${question.id}`} className={question.type === 'textarea' ? 'col-span-1 md:col-span-2' : 'col-span-1'}>
                        <Label className="mb-3 block text-base">
                          <span className="text-purple-400 font-bold mr-2">[{question.id}]</span>
                          {question.text}
                        </Label>
                        {renderQuestion(question)}
                        {question.notes && <p className="text-xs text-muted-foreground mt-1">{question.notes}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Endpoint Table */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Network Endpoints</h3>
                    <ConnectivityTable
                      rows={connRows}
                      systems={(() => {
                        try {
                          const v = responses['ARCH.systems'];
                          if (!v) return [];
                          return typeof v === 'string' ? JSON.parse(v) : v;
                        } catch { return []; }
                      })()}
                      onChange={handleConnChange}
                    />
                  </div>

                  {/* File uploads section */}
                  <div className="space-y-5">
                    <h3 className="text-lg font-semibold">Configuration File Uploads</h3>
                    <p className="text-xs text-yellow-400/80 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>De-identify all files before uploading. Do not share PHI or patient data.</span>
                    </p>
                    <div className="grid grid-cols-1 gap-y-5">
                      {currentSectionData?.questions?.filter(q => q.type === 'upload' || q.type === 'upload-download').map((question) => (
                        <div key={question.id} id={`question-${question.id}`} className="p-4 rounded-lg bg-purple-900/10 border border-purple-500/15 col-span-1">
                          <Label className="mb-3 block text-base">
                            <span className="text-purple-400 font-bold mr-2">[{question.id}]</span>
                            {question.text}
                          </Label>
                          {question.notes && <p className="text-xs text-muted-foreground mb-3">{question.notes}</p>}
                          {renderQuestion(question)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : currentSectionData?.type === 'workflow' ? (
                <div className="mt-6">
                  <WorkflowDiagram 
                    workflowType={currentSectionData.workflowType as any}
                    configuration={(() => {
                      const configKey = currentSectionData.id + '_config';
                      const savedConfig = responses[configKey];
                      if (!savedConfig) return { paths: {}, systems: {}, notes: {} };
                      if (typeof savedConfig === 'string') {
                        try {
                          return JSON.parse(savedConfig);
                        } catch {
                          return { paths: {}, systems: {}, notes: {} };
                        }
                      }
                      // Already an object (parsed during response load)
                      return savedConfig;
                    })()}
                    onConfigurationChange={(config) => {
                      console.log('[Workflow Debug] Configuration changed:', currentSectionData.id, config);
                      console.log('[Workflow Debug] slug:', slug, 'user.email:', user?.email);
                      
                      // Store workflow configuration in responses
                      setResponses(prev => ({ ...prev, [currentSectionData.id + '_config']: JSON.stringify(config) }));
                      
                      // Also trigger save mutation
                      if (slug && user?.email) {
                        console.log('[Workflow Debug] Calling save mutation for:', currentSectionData.id + '_config');
                        saveMutation.mutate({
                          organizationSlug: slug,
                          questionId: currentSectionData.id + '_config',
                          response: JSON.stringify(config),
                          userEmail: user.email,
                        }, {
                          onSuccess: () => {
                            console.log('[Workflow Debug] Save successful for:', currentSectionData.id + '_config');
                          },
                          onError: (error) => {
                            console.error('[Workflow Debug] Save failed:', error);
                          }
                        });
                      } else {
                        console.warn('[Workflow Debug] Cannot save - missing slug or user.email');
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-5 md:gap-y-6">
                  {currentSectionData?.questions?.filter((question) => {
                    // Filter out inactive and hidden conditional questions
                    if (question.inactive) return false;
                    if (question.conditionalOn) {
                      const parentResponse = responses[question.conditionalOn.questionId];
                      if (parentResponse !== question.conditionalOn.value) {
                        return false;
                      }
                    }
                    return true;
                  }).map((question, qIndex) => {
                    const isUnanswered = unansweredQuestions.has(question.id);
                    const hasTemplate = (question.type === 'upload' || question.type === 'upload-download') &&
                      (dbTemplateMap.get(question.id) || []).length > 0;

                    const isUploadType = question.type === 'upload' || question.type === 'upload-download';

                    return (
                      <div
                        key={question.id}
                        data-question-id={question.id}
                        className={`${
                          question.type === 'textarea' || question.type === 'contacts-table' || isUploadType ? 'col-span-1 md:col-span-2' : 'col-span-1'
                        } ${
                          isUnanswered ? 'p-4 border-2 border-red-500 rounded-lg bg-red-500/5' : ''
                        } ${
                          isUploadType ? 'p-4 rounded-lg bg-purple-900/10 border border-purple-500/15' : ''
                        }`}
                      >
                        <Label className="mb-3 block text-base">
                          <span className="text-purple-400 font-bold mr-2">[{question.id}]</span>
                          {question.text}
                          {isUnanswered && <span className="text-red-500 ml-2 font-semibold">* Required</span>}
                        </Label>
                        {question.notes && isUploadType && (
                          <p className="text-xs text-muted-foreground mb-3">{question.notes}</p>
                        )}

                        {renderQuestion(question)}
                        {question.notes && !isUploadType && (
                          <p className="text-xs text-muted-foreground mt-1">{question.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between border-t mt-8 pt-6">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/org/${slug}`)}
                >
                  Back to Overview
                </Button>
                <Button onClick={handleNext}>
                  {isLastSection ? 'Complete' : 'Save & Continue'}
                </Button>
              </div>
              </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How was your experience?</DialogTitle>
            <DialogDescription>
              Quick feedback on the onboarding questionnaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= feedbackRating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Any comments? (optional)"
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowFeedbackModal(false);
                  setLocation(`/org/${slug}/complete`);
                }}
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  submitFeedbackMutation.mutate({
                    organizationSlug: slug || '',
                    rating: feedbackRating,
                    comments: feedbackComments || undefined,
                  });
                }}
                disabled={feedbackRating === 0 || submitFeedbackMutation.isPending}
              >
                {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Questionnaire Data</DialogTitle>
            <DialogDescription>
              Upload a <strong>.json</strong> export file to restore responses. Legacy <code>.txt</code> / <code>.csv</code> pipe-delimited files are also accepted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Select File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".json,.txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setImportFile(file || null);
                }}
                className="!bg-white !text-black"
              />
              {importFile && (
                <div className="text-sm text-muted-foreground">
                  Selected: {importFile.name}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportFile(null);
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportFile}
                disabled={!importFile || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile sticky bottom nav — hidden on sm+ where sidebar + in-card nav are accessible */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          disabled={currentSectionIndex === 0}
          onClick={() => setCurrentSection(questionnaireSections[currentSectionIndex - 1].id)}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>
        <span className="text-xs text-muted-foreground font-medium">
          {currentSectionIndex + 1} / {questionnaireSections.length}
        </span>
        <Button
          size="sm"
          disabled={isLastSection}
          onClick={() => setCurrentSection(questionnaireSections[currentSectionIndex + 1].id)}
          className="gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
