import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  CloudUpload,
  FileText,
  Loader2,
  RefreshCw,
  FileDown,
  Import,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  VENDOR_OPTIONS,
  DEFAULT_SYSTEM_ROWS,
  SYSTEM_TYPE_COLORS,
  type SystemEntry,
} from "./systemConstants";
import { SystemEditRow } from "./SystemEditRow";
import { VendorCombobox } from "./VendorCombobox";

export interface ArchitectureOverviewProps {
  slug: string;
  diagramFiles: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    createdAt?: string | Date | null;
  }>;
  isDiagramUploading: boolean;
  onDiagramUpload: (file: File) => void;
  onDiagramDelete: (fileId: number) => void;
  systemsJson: any;
  onSystemsChange: (json: string) => void;
}

export function ArchitectureOverview({
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
  const vendorOptions =
    dynamicVendors && Object.keys(dynamicVendors).length > 0
      ? dynamicVendors
      : VENDOR_OPTIONS;

  // Parse systems from JSON
  const systems: SystemEntry[] = (() => {
    try {
      const raw = systemsJson
        ? typeof systemsJson === "string"
          ? JSON.parse(systemsJson)
          : systemsJson
        : [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  })();

  const saveSystems = (updated: SystemEntry[]) => {
    onSystemsChange(JSON.stringify(updated));
  };

  // Helper: get system entry for a default row type
  const getSystemForType = (type: string) => systems.find((s) => s.type === type);
  // Helper: get all AI entries (multi-select)
  const getAISystems = () => systems.filter((s) => s.type === "AI");
  // Helper: get custom (non-default) systems
  const customSystems = systems.filter(
    (s) => !DEFAULT_SYSTEM_ROWS.some((d) => d.type === s.type)
  );

  // Update a default row's vendor selection
  const setDefaultRowVendor = (type: string, vendor: string) => {
    const existing = getSystemForType(type);
    if (existing) {
      saveSystems(
        systems.map((s) =>
          s.id === existing.id ? { ...s, name: vendor, description: "" } : s
        )
      );
    } else {
      saveSystems([
        ...systems,
        { id: crypto.randomUUID(), name: vendor, type, description: "" },
      ]);
    }
  };

  // Clear a default row
  const clearDefaultRow = (type: string) => {
    saveSystems(systems.filter((s) => s.type !== type));
  };

  // Toggle AI vendor (multi-select)
  const toggleAIVendor = (vendor: string) => {
    const aiSystems = getAISystems();
    const existing = aiSystems.find((s) => s.name === vendor);
    if (existing) {
      saveSystems(systems.filter((s) => s.id !== existing.id));
    } else {
      saveSystems([
        ...systems,
        { id: crypto.randomUUID(), name: vendor, type: "AI", description: "" },
      ]);
    }
  };

  // Inline custom AI vendor input
  const [customAIInput, setCustomAIInput] = useState("");
  const addCustomAI = () => {
    const name = customAIInput.trim();
    if (!name) return;
    // Don't add duplicates
    const aiSystems = getAISystems();
    if (!aiSystems.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      saveSystems([
        ...systems,
        { id: crypto.randomUUID(), name, type: "AI", description: "" },
      ]);
    }
    setCustomAIInput("");
  };

  // Custom row add/edit/delete
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("Other");
  const [editDesc, setEditDesc] = useState("");

  const startAdd = () => {
    setIsAdding(true);
    setEditName("");
    setEditType("Other");
    setEditDesc("");
  };
  const startEdit = (s: SystemEntry) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditType(s.type);
    setEditDesc(s.description);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    if (isAdding) {
      saveSystems([
        ...systems,
        {
          id: crypto.randomUUID(),
          name: editName.trim(),
          type: editType,
          description: editDesc.trim(),
        },
      ]);
      setIsAdding(false);
    } else {
      saveSystems(
        systems.map((s) =>
          s.id === editingId
            ? { ...s, name: editName.trim(), type: editType, description: editDesc.trim() }
            : s
        )
      );
      setEditingId(null);
    }
    setEditName("");
    setEditType("Other");
    setEditDesc("");
  };

  const deleteSystem = (id: string) =>
    saveSystems(systems.filter((s) => s.id !== id));

  // Import/Export systems
  const systemsImportRef = useRef<HTMLInputElement>(null);
  const exportSystems = () => {
    const blob = new Blob([JSON.stringify(systems, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "systems-export.json";
    a.click();
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
            const name = item.name || item.vendor_product || "";
            const type = item.type || item.system_type || "";
            const description = item.description || item.notes || "";
            if (
              name &&
              type &&
              !merged.some((s) => s.name === name && s.type === type)
            ) {
              merged.push({ id: crypto.randomUUID(), name, type, description });
            }
          }
          saveSystems(merged);
        }
      } catch {
        /* ignore bad JSON */
      }
    };
    reader.readAsText(file);
  };

  // allUploadedFiles is ordered DESC — index 0 is the newest file
  const latestDiagram = diagramFiles[0];
  const isImage = latestDiagram
    ? (latestDiagram.mimeType?.startsWith("image/") ??
        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(latestDiagram.fileName))
    : false;
  const [imgError, setImgError] = useState(false);
  // Reset error state when a new file is uploaded
  const lastFileId = useRef<number | undefined>(undefined);
  if (latestDiagram?.id !== lastFileId.current) {
    lastFileId.current = latestDiagram?.id;
    if (imgError) setImgError(false);
  }
  const uploadedDate = latestDiagram?.createdAt
    ? new Date(latestDiagram.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 mt-4">
      {/* ── Architecture Diagram (full width) ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Architecture Diagram</h3>
          {latestDiagram && (
            <span className="text-xs font-semibold tracking-wide text-green-400 uppercase">
              Uploaded
            </span>
          )}
        </div>

        {latestDiagram ? (
          <>
            {/* Diagram preview */}
            <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/20 flex items-center justify-center min-h-40">
              {isImage && !imgError ? (
                <a
                  href={latestDiagram.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
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
                  <span className="text-sm">
                    Click to view {latestDiagram.fileName}
                  </span>
                </a>
              )}
            </div>
            {/* File info + actions */}
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium truncate">
                  {latestDiagram.fileName}
                </p>
                {uploadedDate && (
                  <p className="text-xs text-muted-foreground">
                    Uploaded: {uploadedDate}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={latestDiagram.fileUrl}
                  download={latestDiagram.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
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
                  {isDiagramUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
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
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, SVG, PDF supported
                  </p>
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
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Systems in Your Environment (full width below diagram) ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-base flex-1 min-w-0">
            Systems in Your Environment
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {systems.length > 0 && (
              <span className="text-xs font-semibold tracking-wide text-green-400 uppercase mr-1">
                Populated
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={exportSystems}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Export systems"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => systemsImportRef.current?.click()}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Import systems"
            >
              <Import className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <input
              ref={systemsImportRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importSystems(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Pre-loaded system rows */}
        <div className="flex flex-col divide-y divide-border/40">
          {DEFAULT_SYSTEM_ROWS.map((row) => {
            if (row.multiSelect) {
              // AI row: multi-select checkboxes with inline custom add
              const selectedAI = getAISystems().map((s) => s.name);
              const vendors =
                vendorOptions[row.type] || VENDOR_OPTIONS[row.type] || [];
              // Combine known vendors with any custom-added AI vendors not in the list
              const knownVendorNames = vendors.filter((v) => v !== "Other");
              const customAIVendors = selectedAI.filter(
                (name) => !knownVendorNames.includes(name)
              );
              return (
                <div key={row.type} className="py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${SYSTEM_TYPE_COLORS[row.type] || SYSTEM_TYPE_COLORS["Other"]}`}
                    >
                      {row.label}
                    </span>
                    {selectedAI.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {selectedAI.length} selected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {knownVendorNames.map((vendor) => (
                        <button
                          key={vendor}
                          onClick={() => toggleAIVendor(vendor)}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            selectedAI.includes(vendor)
                              ? "bg-indigo-500/30 border-indigo-500/50 text-indigo-200"
                              : "bg-background/30 border-border/50 text-muted-foreground hover:border-indigo-500/30 hover:text-indigo-300"
                          }`}
                        >
                          {vendor}
                        </button>
                      ))}
                    {/* Show custom-added AI vendors as removable chips */}
                    {customAIVendors.map((vendor) => (
                      <button
                        key={vendor}
                        onClick={() => toggleAIVendor(vendor)}
                        className="px-3 py-1.5 text-xs rounded-md border transition-colors bg-purple-500/30 border-purple-500/50 text-purple-200 flex items-center gap-1"
                      >
                        {vendor}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                    {/* Inline add input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={customAIInput}
                        onChange={(e) => setCustomAIInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomAI();
                          }
                        }}
                        placeholder="Add other..."
                        className="h-[30px] w-28 text-xs rounded-md border border-dashed border-border/50 bg-background/30 px-2 text-foreground placeholder:text-muted-foreground/60 focus:border-purple-500/50 focus:outline-none"
                      />
                      {customAIInput.trim() && (
                        <button
                          onClick={addCustomAI}
                          className="h-[30px] px-2 text-xs rounded-md border border-purple-500/30 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Single-select row with searchable combobox (supports custom entry)
            const current = getSystemForType(row.type);
            const vendors =
              vendorOptions[row.type] || VENDOR_OPTIONS[row.type] || [];
            return (
              <div
                key={row.type}
                className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border self-start sm:w-[130px] sm:text-center ${SYSTEM_TYPE_COLORS[row.type] || SYSTEM_TYPE_COLORS["Other"]}`}
                >
                  {row.label}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <VendorCombobox
                    vendors={vendors}
                    value={current?.name || ""}
                    onChange={(v) => {
                      if (v) setDefaultRowVendor(row.type, v);
                      else clearDefaultRow(row.type);
                    }}
                    placeholder={`Select ${row.label}...`}
                  />
                  {current && (
                    <button
                      onClick={() => clearDefaultRow(row.type)}
                      className="text-muted-foreground hover:text-red-400 shrink-0"
                      title="Clear"
                    >
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
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
              Additional Systems
            </div>
            <div className="flex flex-col divide-y divide-border/40">
              {customSystems.map((s) => (
                <div key={s.id} className="py-3">
                  {editingId === s.id ? (
                    <SystemEditRow
                      name={editName}
                      type={editType}
                      description={editDesc}
                      onNameChange={setEditName}
                      onTypeChange={setEditType}
                      onDescChange={setEditDesc}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <span
                        className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${SYSTEM_TYPE_COLORS[s.type] || SYSTEM_TYPE_COLORS["Other"]}`}
                      >
                        {s.type}
                      </span>
                      <span className="font-medium text-sm flex-1 min-w-0 truncate">
                        {s.name}
                      </span>
                      {s.description && (
                        <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate hidden sm:block">
                          {s.description}
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(s)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSystem(s.id)}
                        className="text-muted-foreground hover:text-red-400 shrink-0"
                      >
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
            name={editName}
            type={editType}
            description={editDesc}
            onNameChange={setEditName}
            onTypeChange={setEditType}
            onDescChange={setEditDesc}
            onSave={saveEdit}
            onCancel={cancelEdit}
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
