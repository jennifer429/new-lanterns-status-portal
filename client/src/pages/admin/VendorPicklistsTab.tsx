import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Edit, ListChecks, ChevronRight, Check, AlertCircle, X, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Normalized form for fuzzy comparison: lowercase, strip non-alphanumeric.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Bounded Levenshtein — returns Infinity once distance exceeds `max` so we stop early.
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// Find existing vendors that look like a typo or near-duplicate of `name`.
function findSimilar(name: string, existing: { vendorName: string }[]): string[] {
  const trimmed = name.trim();
  if (trimmed.length < 2) return [];
  const target = normalize(trimmed);
  const targetLower = trimmed.toLowerCase();
  const hits: { name: string; score: number }[] = [];
  for (const e of existing) {
    const candLower = e.vendorName.toLowerCase();
    if (candLower === targetLower) continue;
    const cand = normalize(e.vendorName);
    if (!cand) continue;
    if (cand.includes(target) || target.includes(cand)) {
      hits.push({ name: e.vendorName, score: 0 });
      continue;
    }
    const max = target.length <= 4 ? 1 : target.length <= 8 ? 2 : 3;
    const dist = levenshtein(target, cand, max);
    if (dist <= max) hits.push({ name: e.vendorName, score: dist });
  }
  hits.sort((a, b) => a.score - b.score);
  return Array.from(new Set(hits.map(h => h.name))).slice(0, 3);
}

function sortVendors<T extends { vendorName: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.vendorName.toLowerCase() === "other") return 1;
    if (b.vendorName.toLowerCase() === "other") return -1;
    return a.vendorName.localeCompare(b.vendorName);
  });
}

export function VendorPicklistsTab() {
  const [addInputs, setAddInputs] = useState<Record<string, string>>({});
  const [newSystemTypeName, setNewSystemTypeName] = useState("");
  const [newSystemTypeVendors, setNewSystemTypeVendors] = useState("");
  const [editVendorId, setEditVendorId] = useState<number | null>(null);
  const [editVendorName, setEditVendorName] = useState("");

  const { data: vendorOptions, refetch: refetchVendorOptions } = trpc.admin.getSystemVendorOptions.useQuery();

  const vendorsByType = useMemo(() => {
    if (!vendorOptions) return {} as Record<string, typeof vendorOptions>;
    const grouped: Record<string, typeof vendorOptions> = {};
    for (const opt of vendorOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt);
    }
    for (const key of Object.keys(grouped)) grouped[key] = sortVendors(grouped[key]);
    return grouped;
  }, [vendorOptions]);

  const addVendorMutation = trpc.admin.addVendorOption.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(`Added "${vars.vendorName.trim()}" to ${vars.systemType}`);
      setAddInputs(prev => ({ ...prev, [vars.systemType]: "" }));
      refetchVendorOptions();
    },
    onError: (error: any) => toast.error(error.message || "Failed to add vendor"),
  });

  const updateVendorMutation = trpc.admin.updateVendorOption.useMutation({
    onSuccess: () => { toast.success("Vendor updated"); setEditVendorId(null); setEditVendorName(""); refetchVendorOptions(); },
    onError: (error: any) => toast.error(error.message || "Failed to update vendor"),
  });

  const deleteVendorMutation = trpc.admin.deleteVendorOption.useMutation({
    onSuccess: () => { toast.success("Vendor removed"); refetchVendorOptions(); },
    onError: (error: any) => toast.error(error.message || "Failed to remove vendor"),
  });

  const toggleVendorMutation = trpc.admin.toggleVendorOption.useMutation({
    onSuccess: () => { refetchVendorOptions(); },
    onError: (error: any) => toast.error(error.message || "Failed to toggle vendor"),
  });

  const addSystemTypeMutation = trpc.admin.addSystemType.useMutation({
    onSuccess: (result: any) => {
      const added = result?.added ?? 0;
      const skipped = result?.skipped ?? 0;
      toast.success(`Added ${added} vendor${added === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped as duplicate)` : ""}`);
      setNewSystemTypeName(""); setNewSystemTypeVendors("");
      refetchVendorOptions();
    },
    onError: (error: any) => toast.error(error.message || "Failed to add system type"),
  });

  const seedVendorsMutation = trpc.admin.seedDefaultVendorOptions.useMutation({
    onSuccess: (result) => { toast.success(result.message || "Defaults seeded"); refetchVendorOptions(); },
    onError: (error: any) => toast.error(error.message || "Failed to seed defaults"),
  });

  const submitAdd = (systemType: string) => {
    const raw = addInputs[systemType] ?? "";
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) return;
    const list = vendorsByType[systemType] || [];
    const exact = list.find(v => v.vendorName.toLowerCase() === name.toLowerCase());
    if (exact) {
      toast.error(`"${exact.vendorName}" is already in ${systemType}${exact.isActive ? "" : " (hidden — toggle it back on)"}.`);
      return;
    }
    addVendorMutation.mutate({ systemType, vendorName: name });
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Vendor Picklists</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage vendor dropdown options for the Architecture section of the intake questionnaire.
            Lists are alphabetized with "Other" pinned to the bottom.
          </p>
        </div>
        <div className="flex gap-2">
          {(!vendorOptions || vendorOptions.length === 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedVendorsMutation.mutate()}
              disabled={seedVendorsMutation.isPending}
            >
              {seedVendorsMutation.isPending ? "Seeding..." : "Seed Defaults"}
            </Button>
          )}
        </div>
      </div>

      {/* Add New System Type */}
      <Card className="mb-6 border-dashed border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Add New System Type
          </CardTitle>
          <CardDescription className="text-xs">Create a new category with its vendors (comma-separated). Names are trimmed and de-duplicated.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Category Name</Label>
              <Input
                placeholder="e.g., Cloud PACS, Dose Monitoring"
                value={newSystemTypeName}
                onChange={(e) => setNewSystemTypeName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex-[2]">
              <Label className="text-xs text-muted-foreground mb-1 block">Vendors (comma-separated)</Label>
              <Input
                placeholder="e.g., Vendor A, Vendor B, Vendor C, Other"
                value={newSystemTypeVendors}
                onChange={(e) => setNewSystemTypeVendors(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={() => {
                  if (!newSystemTypeName.trim()) {
                    toast.error("Please enter a system type name");
                    return;
                  }
                  const vendors = newSystemTypeVendors.split(",").map(v => v.trim()).filter(Boolean);
                  if (vendors.length === 0) {
                    toast.error("Please enter at least one vendor");
                    return;
                  }
                  addSystemTypeMutation.mutate({ systemType: newSystemTypeName.trim(), vendors });
                }}
                disabled={addSystemTypeMutation.isPending}
                className="h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {addSystemTypeMutation.isPending ? "Adding..." : "Create"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Type Cards - Collapsible */}
      {Object.keys(vendorsByType).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No vendor options configured</p>
            <p className="text-sm">Click "Seed Defaults" to load the standard vendor lists, or add system types manually above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {Object.entries(vendorsByType).sort(([a], [b]) => a.localeCompare(b)).map(([systemType, vendorsRaw]) => {
            const vendors = vendorsRaw ?? [];
            const inputValue = addInputs[systemType] ?? "";
            const trimmed = inputValue.trim();
            const exactDup = trimmed
              ? vendors.find(v => v.vendorName.toLowerCase() === trimmed.toLowerCase())
              : undefined;
            const similar = trimmed && !exactDup ? findSimilar(trimmed, vendors) : [];
            const activeCount = vendors.filter(v => v.isActive).length;
            const hiddenCount = vendors.length - activeCount;

            return (
              <Collapsible key={systemType} defaultOpen>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3">
                        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        <span className="font-semibold text-sm">{systemType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-normal px-2 py-0.5">
                          {activeCount} vendor{activeCount !== 1 ? "s" : ""}
                        </Badge>
                        {hiddenCount > 0 && (
                          <Badge variant="outline" className="text-xs font-normal px-2 py-0.5 text-muted-foreground">
                            {hiddenCount} hidden
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border/40 px-5 py-4">
                      {/* Add vendor input */}
                      <div className="mb-4">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            <Input
                              placeholder={`Add a vendor to ${systemType}…`}
                              value={inputValue}
                              onChange={(e) => setAddInputs(prev => ({ ...prev, [systemType]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); submitAdd(systemType); }
                                if (e.key === "Escape") setAddInputs(prev => ({ ...prev, [systemType]: "" }));
                              }}
                              className="h-8 text-sm"
                            />
                            {/* Duplicate warning */}
                            {exactDup && (
                              <div className="mt-1.5 flex items-center gap-2 text-xs text-amber-400">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>
                                  "{exactDup.vendorName}" already exists
                                  {!exactDup.isActive && (
                                    <>
                                      {" "}(hidden — {" "}
                                      <button
                                        type="button"
                                        onClick={() => toggleVendorMutation.mutate({ id: exactDup.id, isActive: 1 })}
                                        className="underline hover:text-amber-300"
                                      >re-enable</button>
                                      ?)
                                    </>
                                  )}
                                </span>
                              </div>
                            )}
                            {/* Similarity warning */}
                            {!exactDup && similar.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-amber-400">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Similar:</span>
                                {similar.map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setAddInputs(prev => ({ ...prev, [systemType]: s }))}
                                    className="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => submitAdd(systemType)}
                            disabled={!trimmed || !!exactDup || addVendorMutation.isPending}
                            className="h-8"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {/* Vendor list as compact cards/chips */}
                      <div className="space-y-1.5">
                        {vendors.map((vendor) => (
                          <div
                            key={vendor.id}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-md border transition-colors",
                              vendor.isActive
                                ? "bg-card border-border/50 hover:border-border"
                                : "bg-muted/20 border-border/20 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {editVendorId === vendor.id ? (
                                <div className="flex gap-2 items-center flex-1">
                                  <Input
                                    value={editVendorName}
                                    onChange={(e) => setEditVendorName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && editVendorName.trim()) updateVendorMutation.mutate({ id: vendor.id, vendorName: editVendorName.trim() });
                                      if (e.key === "Escape") setEditVendorId(null);
                                    }}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => { if (editVendorName.trim()) updateVendorMutation.mutate({ id: vendor.id, vendorName: editVendorName.trim() }); }}
                                    className="p-1 rounded hover:bg-primary/20 text-primary"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditVendorId(null)}
                                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-sm font-medium truncate">{vendor.vendorName}</span>
                              )}
                            </div>

                            {editVendorId !== vendor.id && (
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                {/* Toggle visibility */}
                                <button
                                  onClick={() => toggleVendorMutation.mutate({ id: vendor.id, isActive: vendor.isActive ? 0 : 1 })}
                                  className={cn(
                                    "p-1.5 rounded transition-colors",
                                    vendor.isActive
                                      ? "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                      : "hover:bg-green-500/10 text-muted-foreground hover:text-green-400"
                                  )}
                                  title={vendor.isActive ? "Hide from dropdown" : "Show in dropdown"}
                                >
                                  {vendor.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                {/* Edit */}
                                <button
                                  onClick={() => { setEditVendorId(vendor.id); setEditVendorName(vendor.vendorName); }}
                                  className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Rename vendor"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() => { if (confirm(`Remove "${vendor.vendorName}" from ${systemType}?`)) deleteVendorMutation.mutate({ id: vendor.id }); }}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                                  title="Remove vendor"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </>
  );
}
