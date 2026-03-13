import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, Plus, Upload, FileText, Loader2, CheckCircle2, ArrowLeft, ChevronRight, X, CloudUpload, ChevronsUpDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export const SYSTEM_TYPES = ['RIS', 'PACS', 'VNA', 'Interface Engine', 'AI', 'EHR', 'Router', 'Other'] as const;

export const TYPE_COLORS: Record<string, string> = {
  'EHR':               'bg-violet-500/20 text-violet-300 border border-violet-500/40',
  'RIS':               'bg-teal-500/20 text-teal-300 border border-teal-500/40',
  'PACS':              'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  'Interface Engine':  'bg-green-500/20 text-green-300 border border-green-500/40',
  'AI':                'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  'VNA':               'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
  'Router':            'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  'Other':             'bg-gray-500/20 text-gray-300 border border-gray-500/40',
};

export interface IntegrationSystem {
  id: string;
  name: string;
  type: string;
  notes: string;
}

interface SystemsMultiSelectProps {
  selectedNames: string[];
  allSystems: IntegrationSystem[];
  onChange: (names: string[]) => void;
}

function SystemsMultiSelect({ selectedNames, allSystems, onChange }: SystemsMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const available = allSystems.filter(s => s.name && !selectedNames.includes(s.name));
  const selected = selectedNames
    .map(n => allSystems.find(s => s.name === n))
    .filter((s): s is IntegrationSystem => !!s);

  const filtered = available.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(sys => (
            <span
              key={sys.name}
              className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', TYPE_COLORS[sys.type] || TYPE_COLORS['Other'])}
            >
              {sys.name}
              <button
                onClick={() => onChange(selectedNames.filter(n => n !== sys.name))}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Popover-based dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm',
              'hover:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50',
              !available.length && 'opacity-50 cursor-not-allowed'
            )}
            disabled={!available.length && !allSystems.filter(s => s.name).length}
          >
            <span className="text-muted-foreground">
              {allSystems.filter(s => s.name).length > 0
                ? available.length > 0
                  ? 'Select systems...'
                  : 'All systems selected'
                : 'Add systems above first'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search systems..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                No matching systems
              </CommandEmpty>
              <CommandGroup>
                {filtered.map(sys => (
                  <CommandItem
                    key={sys.name}
                    value={sys.name}
                    onSelect={() => {
                      onChange([...selectedNames, sys.name]);
                      setSearch('');
                      // Keep open so user can select multiple
                    }}
                  >
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium mr-2', TYPE_COLORS[sys.type] || TYPE_COLORS['Other'])}>
                      {sys.type || '?'}
                    </span>
                    {sys.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface IntegrationWorkflowsProps {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  organizationId: number;
  onBack?: () => void;
  onContinue?: () => void;
}

export function IntegrationWorkflows({ values, onChange, organizationId, onBack, onContinue }: IntegrationWorkflowsProps) {
  const [isUploadingDiagram, setIsUploadingDiagram] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const diagramInputRef = useRef<HTMLInputElement>(null);
  const uploadFileMutation = trpc.files.upload.useMutation();

  // ── Systems ──────────────────────────────────────────────────────────────────
  const systems: IntegrationSystem[] = (() => {
    try {
      const s = values['IW.systems'];
      if (!s) return [];
      return typeof s === 'string' ? JSON.parse(s) : s;
    } catch { return []; }
  })();

  const updateSystems = (next: IntegrationSystem[]) => onChange('IW.systems', next);
  const addSystem = () => updateSystems([...systems, { id: crypto.randomUUID(), name: '', type: '', notes: '' }]);
  const updateSystem = (id: string, field: keyof IntegrationSystem, val: string) =>
    updateSystems(systems.map(s => s.id === id ? { ...s, [field]: val } : s));
  const deleteSystem = (id: string) => updateSystems(systems.filter(s => s.id !== id));

  // ── Diagram upload ────────────────────────────────────────────────────────────
  const handleDiagramFile = useCallback(async (file: File) => {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.pdf'].includes(ext)) {
      alert('Only PNG, JPG, JPEG, and PDF files are allowed.');
      return;
    }
    setIsUploadingDiagram(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const result = await uploadFileMutation.mutateAsync({
          organizationId,
          taskId: 'IW.diagram',
          taskName: 'Architecture Diagram',
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
        // Ensure the URL is properly encoded for browser display
        const encodedUrl = result.fileUrl.replace(/ /g, '%20');
        onChange('IW.diagram', encodedUrl);
        onChange('IW.diagram_filename', file.name);
        onChange('IW.diagram_uploaded_at', new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      } catch {
        alert('Diagram upload failed. Please try again.');
      } finally {
        setIsUploadingDiagram(false);
      }
    };
    reader.readAsDataURL(file);
  }, [organizationId, uploadFileMutation, onChange]);

  const rawDiagramUrl: string | undefined = values['IW.diagram'];
  // Encode spaces and special chars in the URL path (S3 keys may contain spaces)
  const diagramUrl = rawDiagramUrl ? rawDiagramUrl.replace(/ /g, '%20') : undefined;
  const diagramFilename: string | undefined = values['IW.diagram_filename'];
  const diagramUploadedAt: string | undefined = values['IW.diagram_uploaded_at'];
  const isImageDiagram = diagramFilename && /\.(png|jpg|jpeg)$/i.test(diagramFilename);

  // ── Overlay PACS example upload ──────────────────────────────────────────────
  const [isUploadingOverlayExample, setIsUploadingOverlayExample] = useState(false);
  const overlayExampleInputRef = useRef<HTMLInputElement>(null);

  const handleOverlayExampleFile = useCallback(async (file: File) => {
    setIsUploadingOverlayExample(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const result = await uploadFileMutation.mutateAsync({
          organizationId,
          taskId: 'IW.overlay_example',
          taskName: 'Overlay PACS Example Report',
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
        onChange('IW.overlay_example_url', result.fileUrl.replace(/ /g, '%20'));
        onChange('IW.overlay_example_filename', file.name);
      } catch {
        alert('Upload failed. Please try again.');
      } finally {
        setIsUploadingOverlayExample(false);
      }
    };
    reader.readAsDataURL(file);
  }, [organizationId, uploadFileMutation, onChange]);

  // ── Completion ───────────────────────────────────────────────────────────────
  const systemNames = systems.map(s => s.name).filter(Boolean);
  const wfKeys = ['orders', 'images', 'priors', 'reports'] as const;
  const completedWorkflows = wfKeys.filter(wf => {
    const v = values[`IW.${wf}_description`];
    return v && String(v).trim().length > 0;
  }).length;
  const diagramDone = !!diagramUrl;
  const systemsDone = systems.length > 0;
  const historicDone = !!(values['IW.historic_results_description'] && String(values['IW.historic_results_description']).trim().length > 0);
  const techSheetsDone = !!(values['IW.tech_sheets_description'] && String(values['IW.tech_sheets_description']).trim().length > 0);
  const overlayDone = !!(values['IW.overlay_pacs_description'] && String(values['IW.overlay_pacs_description']).trim().length > 0);
  const ctDoseDone = !!(values['IW.ct_dose_description'] && String(values['IW.ct_dose_description']).trim().length > 0);
  const totalComplete = (diagramDone ? 1 : 0) + (systemsDone ? 1 : 0) + completedWorkflows + (historicDone ? 1 : 0) + (techSheetsDone ? 1 : 0) + (overlayDone ? 1 : 0) + (ctDoseDone ? 1 : 0);
  const allComplete = totalComplete === 10;

  // ── Workflow block ────────────────────────────────────────────────────────────
  const WorkflowBlock = ({
    id, label, description, placeholder,
  }: { id: string; label: string; description: string; placeholder: string }) => {
    const descKey = `IW.${id}_description`;
    const sysKey  = `IW.${id}_systems`;
    const selectedNames: string[] = (() => {
      try {
        const v = values[sysKey];
        if (!v) return [];
        return Array.isArray(v) ? v : JSON.parse(v);
      } catch { return []; }
    })();
    const isFilled = !!(values[descKey] && String(values[descKey]).trim().length > 0);

    return (
      <div className={cn('space-y-3 p-5 rounded-xl border bg-card transition-colors', isFilled && 'border-primary/50')}>
        <div className="flex items-center gap-2">
          {isFilled
            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
          }
          <h3 className="font-semibold text-base">{label}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Textarea
          value={values[descKey] || ''}
          onChange={(e) => onChange(descKey, e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="resize-y"
        />
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Systems involved:</p>
          <SystemsMultiSelect
            selectedNames={selectedNames}
            allSystems={systems}
            onChange={(v) => onChange(sysKey, v)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integration Workflows</h2>
          <p className="text-muted-foreground mt-1">Define your systems and how data flows between them</p>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border',
          allComplete
            ? 'bg-green-500/10 text-green-500 border-green-500/30'
            : 'bg-muted text-muted-foreground border-border',
        )}>
          {allComplete && <CheckCircle2 className="w-4 h-4" />}
          {totalComplete}/10 Complete
        </div>
      </div>

      <hr className="border-border" />

      {/* Architecture Diagram — full width, prominent when uploaded */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Architecture Diagram</h3>
          {diagramUrl && (
            <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Uploaded</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a network or workflow diagram showing how orders, images, priors, and reports move through your systems.
        </p>
        <input
          ref={diagramInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDiagramFile(f); e.target.value = ''; }}
        />
        {!diagramUrl ? (
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/20',
            )}
            onClick={() => diagramInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleDiagramFile(f); }}
          >
            {isUploadingDiagram
              ? <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
              : <CloudUpload className="w-10 h-10 text-muted-foreground" />
            }
            <div className="text-center">
              <p className="text-sm font-medium">Drop file here or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, PDF accepted</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isImageDiagram ? (
              <a href={diagramUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors bg-black/20">
                <img src={diagramUrl} alt="Architecture diagram" className="w-full object-contain" style={{ minHeight: '300px', maxHeight: '70vh' }} />
              </a>
            ) : (
              <div className="flex items-center gap-3 p-6 rounded-lg border bg-muted/20">
                <FileText className="w-10 h-10 text-muted-foreground flex-shrink-0" />
                <a href={diagramUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-base">View PDF Document</a>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{diagramFilename}</p>
                {diagramUploadedAt && <p className="text-xs text-muted-foreground">Uploaded: {diagramUploadedAt}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => diagramInputRef.current?.click()} disabled={isUploadingDiagram} className="gap-1.5 flex-shrink-0">
                {isUploadingDiagram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Replace
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Systems Table — now full width below diagram */}
      <div className="space-y-0">
        {/* Systems Table */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Systems in Your Environment</h3>
            {systems.length > 0 && (
              <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Populated</span>
            )}
          </div>
          {systems.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">System Name</th>
                    <th className="text-left px-3 py-2 font-medium w-36">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Notes</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {systems.map((sys, idx) => (
                    <tr key={sys.id} className={cn('border-t border-border/40', idx % 2 === 1 && 'bg-muted/10')}>
                      <td className="px-2 py-1">
                        <Input
                          value={sys.name}
                          onChange={(e) => updateSystem(sys.id, 'name', e.target.value)}
                          placeholder="e.g. Epic"
                          className="h-7 text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/50"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select value={sys.type} onValueChange={(v) => updateSystem(sys.id, 'type', v)}>
                          <SelectTrigger
                            className={cn(
                              'h-7 text-xs rounded-full px-2.5 font-medium w-full',
                              sys.type ? TYPE_COLORS[sys.type] : 'border-dashed',
                            )}
                          >
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={sys.notes}
                          onChange={(e) => updateSystem(sys.id, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="h-7 text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/50"
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => deleteSystem(sys.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {systems.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">No systems added yet</p>
          )}
          <Button variant="outline" size="sm" onClick={addSystem} className="gap-1.5 w-full">
            <Plus className="w-4 h-4" />
            Add System
          </Button>
        </div>
      </div>

      {/* Workflow blocks — 2×2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WorkflowBlock
          id="orders"
          label="Orders Workflow"
          description="Describe how imaging orders reach the platform."
          placeholder="e.g., Orders originate in Epic, sent via HL7 ORM through Mirth Connect to New Lantern..."
        />
        <WorkflowBlock
          id="images"
          label="Images Workflow"
          description="Describe how imaging studies are routed."
          placeholder="e.g., Studies acquired on modalities (CT, MR, XR) and sent via DICOM C-STORE to PACS, then forwarded to New Lantern..."
        />
        <WorkflowBlock
          id="priors"
          label="Priors Workflow"
          description="Describe how prior studies are retrieved."
          placeholder="e.g., New Lantern queries prior PACS via C-FIND/C-MOVE for relevant prior studies when a new order arrives..."
        />
        <WorkflowBlock
          id="reports"
          label="Reports Workflow"
          description="Describe how reports are delivered back."
          placeholder="e.g., Finalized reports sent via HL7 ORU through Mirth Connect back to Epic Radiant..."
        />
      </div>

      <hr className="border-border" />

      {/* Additional Integration Sections */}
      <div className="space-y-6">

        {/* Historic Results */}
        <div className={cn('space-y-4 p-5 rounded-xl border bg-card transition-colors', historicDone && 'border-primary/50')}>
          <div className="flex items-center gap-2">
            {historicDone
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
            }
            <h3 className="font-semibold text-base">Historic Results Migration</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            5 years of prior results is typical. HL7 or flat file is the preferred format for migration. Describe what historic data needs to be migrated and the source system.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">How many years of historic results?</label>
              <Select
                value={values['IW.historic_results_years'] || ''}
                onValueChange={(v) => onChange('IW.historic_results_years', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 year</SelectItem>
                  <SelectItem value="2">2 years</SelectItem>
                  <SelectItem value="3">3 years</SelectItem>
                  <SelectItem value="5">5 years (typical)</SelectItem>
                  <SelectItem value="7">7 years</SelectItem>
                  <SelectItem value="10">10+ years</SelectItem>
                  <SelectItem value="all">All available</SelectItem>
                  <SelectItem value="none">None needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery method</label>
              <Select
                value={values['IW.historic_results_delivery_method'] || ''}
                onValueChange={(v) => onChange('IW.historic_results_delivery_method', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hl7">HL7 (preferred)</SelectItem>
                  <SelectItem value="flat_file">Flat File</SelectItem>
                  <SelectItem value="dicom">DICOM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={values['IW.historic_results_description'] || ''}
            onChange={(e) => onChange('IW.historic_results_description', e.target.value)}
            placeholder="Describe the source system, volume of data, any special considerations for the migration..."
            rows={4}
            className="resize-y"
          />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Source system(s):</p>
            <SystemsMultiSelect
              selectedNames={(() => { try { const v = values['IW.historic_results_systems']; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })()}
              allSystems={systems}
              onChange={(v) => onChange('IW.historic_results_systems', v)}
            />
          </div>
        </div>

        {/* Tech Sheets / DICOM-wrapped Documents */}
        <div className={cn('space-y-4 p-5 rounded-xl border bg-card transition-colors', techSheetsDone && 'border-primary/50')}>
          <div className="flex items-center gap-2">
            {techSheetsDone
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
            }
            <h3 className="font-semibold text-base">Tech Sheets &amp; Documents</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Are tech sheets and other documents sent as DICOM-wrapped objects? Describe how non-image documents (tech sheets, requisitions, consent forms) are handled in your environment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Are documents sent as DICOM-wrapped?</label>
              <Select
                value={values['IW.tech_sheets_dicom_wrapped'] || ''}
                onValueChange={(v) => onChange('IW.tech_sheets_dicom_wrapped', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes — DICOM-wrapped</SelectItem>
                  <SelectItem value="no">No — sent separately</SelectItem>
                  <SelectItem value="some">Some are, some aren't</SelectItem>
                  <SelectItem value="unsure">Not sure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tech sheets input method</label>
              <Select
                value={values['IW.tech_sheets_input_method'] || ''}
                onValueChange={(v) => onChange('IW.tech_sheets_input_method', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_with_images">Automatically with images</SelectItem>
                  <SelectItem value="manual_pdf">Manually as PDF</SelectItem>
                  <SelectItem value="both">Both (varies by modality)</SelectItem>
                  <SelectItem value="not_applicable">Not applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={values['IW.tech_sheets_description'] || ''}
            onChange={(e) => onChange('IW.tech_sheets_description', e.target.value)}
            placeholder="Describe which document types are generated, how they are stored/routed, and whether they need to be available in New Lantern..."
            rows={4}
            className="resize-y"
          />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Systems involved:</p>
            <SystemsMultiSelect
              selectedNames={(() => { try { const v = values['IW.tech_sheets_systems']; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })()}
              allSystems={systems}
              onChange={(v) => onChange('IW.tech_sheets_systems', v)}
            />
          </div>
        </div>

        {/* Overlay PACS */}
        <div className={cn('space-y-4 p-5 rounded-xl border bg-card transition-colors', overlayDone && 'border-primary/50')}>
          <div className="flex items-center gap-2">
            {overlayDone
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
            }
            <h3 className="font-semibold text-base">Overlay PACS — External Reports</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            If not all reports are read in New Lantern, can you send a copy of reports read outside of New Lantern to the platform? If so, describe the source system and workflow.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Can external reports be sent to New Lantern?</label>
              <Select
                value={values['IW.overlay_pacs_can_send'] || ''}
                onValueChange={(v) => onChange('IW.overlay_pacs_can_send', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="not_applicable">N/A — all reports read in New Lantern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source system for external reports</label>
              <Input
                value={values['IW.overlay_pacs_source_system'] || ''}
                onChange={(e) => onChange('IW.overlay_pacs_source_system', e.target.value)}
                placeholder="e.g., PowerScribe 360, external PACS"
              />
            </div>
          </div>
          <Textarea
            value={values['IW.overlay_pacs_description'] || ''}
            onChange={(e) => onChange('IW.overlay_pacs_description', e.target.value)}
            placeholder="Describe how external reports are generated and how they could be routed to New Lantern (HL7 ORU, DICOM SR, PDF, etc.)..."
            rows={4}
            className="resize-y"
          />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Systems involved:</p>
            <SystemsMultiSelect
              selectedNames={(() => { try { const v = values['IW.overlay_pacs_systems']; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })()}
              allSystems={systems}
              onChange={(v) => onChange('IW.overlay_pacs_systems', v)}
            />
          </div>
          {/* Example upload */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <label className="text-sm font-medium">Upload an example report</label>
            <input
              ref={overlayExampleInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.hl7,.txt,.dcm"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOverlayExampleFile(f); e.target.value = ''; }}
            />
            {values['IW.overlay_example_url'] ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <a href={(values['IW.overlay_example_url'] || '').replace(/ /g, '%20')} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                    {values['IW.overlay_example_filename'] || 'Example report'}
                  </a>
                </div>
                <Button variant="outline" size="sm" onClick={() => overlayExampleInputRef.current?.click()} disabled={isUploadingOverlayExample} className="gap-1.5">
                  {isUploadingOverlayExample ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Replace
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => overlayExampleInputRef.current?.click()} disabled={isUploadingOverlayExample} className="gap-1.5">
                {isUploadingOverlayExample ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload Example
              </Button>
            )}
          </div>
        </div>

        {/* CT Dose Information */}
        <div className={cn('space-y-4 p-5 rounded-xl border bg-card transition-colors', ctDoseDone && 'border-primary/50')}>
          <div className="flex items-center gap-2">
            {ctDoseDone
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
            }
            <h3 className="font-semibold text-base">CT Dose Information</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            CT dose data (DLP, CTDIvol, etc.) needs to be captured and routed. Will this information be included in HL7 messages, or will it come as a DICOM Radiation Dose Structured Report (RDSR) / DICOM-wrapped dose sheet?
          </p>
          <div className="space-y-2 max-w-xs">
            <label className="text-sm font-medium">How is CT dose data delivered?</label>
            <Select
              value={values['IW.ct_dose_delivery_method'] || ''}
              onValueChange={(v) => onChange('IW.ct_dose_delivery_method', v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hl7">HL7</SelectItem>
                <SelectItem value="dicom">DICOM</SelectItem>
                <SelectItem value="hl7_and_dicom">HL7 & DICOM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={values['IW.ct_dose_description'] || ''}
            onChange={(e) => onChange('IW.ct_dose_description', e.target.value)}
            placeholder="Describe how CT dose information is currently captured, which systems generate it, and how it should be routed to New Lantern. Include any third-party dose tracking tools (e.g., Radimetrics, DoseWatch) if applicable..."
            rows={4}
            className="resize-y"
          />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Systems involved:</p>
            <SystemsMultiSelect
              selectedNames={(() => { try { const v = values['IW.ct_dose_systems']; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })()}
              allSystems={systems}
              onChange={(v) => onChange('IW.ct_dose_systems', v)}
            />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 pb-6">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-primary hover:text-primary">
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Button>
        <div className="flex items-center gap-3">
          {allComplete && (
            <div className="flex items-center gap-1.5 text-sm text-green-500">
              <CheckCircle2 className="w-4 h-4" />
              Section Complete
            </div>
          )}
          <Button onClick={onContinue} className="gap-2">
            Save &amp; Continue
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
