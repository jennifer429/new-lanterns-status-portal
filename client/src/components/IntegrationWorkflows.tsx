import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Upload, FileText, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const SYSTEM_TYPES = ['RIS', 'PACS', 'VNA', 'Interface Engine', 'AI', 'EHR', 'Router', 'Other'];

interface System {
  id: string;
  name: string;
  type: string;
  notes: string;
}

interface IntegrationWorkflowsProps {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  organizationId: number;
}

export function IntegrationWorkflows({ values, onChange, organizationId }: IntegrationWorkflowsProps) {
  const [isUploadingDiagram, setIsUploadingDiagram] = useState(false);
  const diagramInputRef = useRef<HTMLInputElement>(null);
  const uploadFileMutation = trpc.files.upload.useMutation();

  const systems: System[] = (() => {
    try {
      const s = values['IW.systems'];
      if (!s) return [];
      return typeof s === 'string' ? JSON.parse(s) : s;
    } catch {
      return [];
    }
  })();

  const updateSystems = (newSystems: System[]) => {
    onChange('IW.systems', newSystems);
  };

  const addSystem = () => {
    updateSystems([...systems, { id: crypto.randomUUID(), name: '', type: '', notes: '' }]);
  };

  const updateSystem = (id: string, field: keyof System, value: string) => {
    updateSystems(systems.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteSystem = (id: string) => {
    updateSystems(systems.filter(s => s.id !== id));
  };

  const handleDiagramUpload = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
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
        onChange('IW.diagram', result.fileUrl);
        onChange('IW.diagram_filename', file.name);
        onChange('IW.diagram_uploaded_at', new Date().toISOString().split('T')[0]);
      } catch {
        alert('Diagram upload failed. Please try again.');
      } finally {
        setIsUploadingDiagram(false);
      }
    };
    reader.readAsDataURL(file);
  }, [organizationId, uploadFileMutation, onChange]);

  const diagramUrl = values['IW.diagram'];
  const diagramFilename = values['IW.diagram_filename'];
  const diagramUploadedAt = values['IW.diagram_uploaded_at'];
  const isImage = diagramFilename && /\.(png|jpg|jpeg)$/i.test(diagramFilename);

  const systemNames = systems.map(s => s.name).filter(Boolean);

  const WorkflowBlock = ({ id, label, description }: { id: string; label: string; description: string }) => {
    const descKey = `IW.${id}_description`;
    const systemsKey = `IW.${id}_systems`;
    const selectedSystems: string[] = (() => {
      try {
        const v = values[systemsKey];
        if (!v) return [];
        return Array.isArray(v) ? v : JSON.parse(v);
      } catch { return []; }
    })();

    return (
      <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
        <h3 className="font-semibold text-base">{label}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Textarea
          value={values[descKey] || ''}
          onChange={(e) => onChange(descKey, e.target.value)}
          placeholder="Describe the workflow..."
          rows={4}
        />
        {systemNames.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Systems involved:</p>
            <div className="flex flex-wrap gap-3">
              {systemNames.map(name => (
                <div key={name} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${id}-${name}`}
                    checked={selectedSystems.includes(name)}
                    onCheckedChange={(checked) => {
                      const updated = checked
                        ? [...selectedSystems, name]
                        : selectedSystems.filter(s => s !== name);
                      onChange(systemsKey, updated);
                    }}
                  />
                  <label htmlFor={`${id}-${name}`} className="text-sm cursor-pointer">{name}</label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* 1. Architecture Diagram Upload */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-base">Architecture Diagram</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a network or workflow diagram showing how orders, images, priors, and reports move through your systems.
          </p>
        </div>
        <input
          ref={diagramInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleDiagramUpload(file);
            e.target.value = '';
          }}
        />
        {!diagramUrl ? (
          <div className="space-y-1">
            <Button
              variant="outline"
              onClick={() => diagramInputRef.current?.click()}
              disabled={isUploadingDiagram}
              className="gap-2"
            >
              {isUploadingDiagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Diagram
            </Button>
            <p className="text-xs text-muted-foreground">Accepted file types: png, jpg, jpeg, pdf</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b">
                <p className="text-xs font-medium text-muted-foreground">Diagram Preview</p>
              </div>
              <div className="p-4">
                {isImage ? (
                  <img src={diagramUrl} alt="Architecture diagram" className="max-w-full rounded" />
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <a href={diagramUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      View PDF
                    </a>
                  </div>
                )}
              </div>
              <div className="px-4 pb-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">File:</span> {diagramFilename}
                {diagramUploadedAt && (
                  <span className="ml-4">
                    <span className="font-medium text-foreground">Uploaded:</span> {diagramUploadedAt}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => diagramInputRef.current?.click()}
              disabled={isUploadingDiagram}
              className="gap-2"
            >
              {isUploadingDiagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Replace Diagram
            </Button>
          </div>
        )}
      </div>

      {/* 2. Systems Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Systems in Your Environment</h3>
          <Button variant="outline" size="sm" onClick={addSystem} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add System
          </Button>
        </div>
        {systems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No systems added yet. Click "Add System" to define the systems in your environment.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">System Name</th>
                  <th className="text-left px-3 py-2 font-medium w-40">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system, idx) => (
                  <tr key={system.id} className={idx % 2 === 1 ? 'bg-muted/10' : ''}>
                    <td className="px-2 py-1.5">
                      <Input
                        value={system.name}
                        onChange={(e) => updateSystem(system.id, 'name', e.target.value)}
                        placeholder="e.g. Epic"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={system.type} onValueChange={(v) => updateSystem(system.id, 'type', v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={system.notes}
                        onChange={(e) => updateSystem(system.id, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => deleteSystem(system.id)}
                        className="p-1.5 hover:bg-destructive/10 rounded text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Workflow Description Blocks */}
      <div className="space-y-4">
        <WorkflowBlock id="orders" label="Orders Workflow" description="Describe how imaging orders reach the platform." />
        <WorkflowBlock id="images" label="Images Workflow" description="Describe how imaging studies are routed." />
        <WorkflowBlock id="priors" label="Priors Workflow" description="Describe how prior studies are retrieved." />
        <WorkflowBlock id="reports" label="Reports Workflow" description="Describe how reports are delivered back." />
      </div>
    </div>
  );
}
