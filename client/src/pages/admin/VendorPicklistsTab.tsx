import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Edit, History, ListChecks, ChevronDown, Check, AlertCircle } from "lucide-react";
import { TYPE_COLORS, type IntegrationSystem } from "@/components/IntegrationWorkflows";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function VendorPicklistsTab() {
  const [newVendorType, setNewVendorType] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [newSystemTypeName, setNewSystemTypeName] = useState("");
  const [newSystemTypeVendors, setNewSystemTypeVendors] = useState("");
  const [editVendorId, setEditVendorId] = useState<number | null>(null);
  const [editVendorName, setEditVendorName] = useState("");

  const { data: vendorOptions, refetch: refetchVendorOptions } = trpc.admin.getSystemVendorOptions.useQuery();
  const { data: vendorAuditLogs, refetch: refetchVendorAuditLogs } = trpc.admin.getVendorAuditLog.useQuery({ limit: 100 });

  const vendorsByType = useMemo(() => {
    if (!vendorOptions) return {} as Record<string, typeof vendorOptions>;
    const grouped: Record<string, typeof vendorOptions> = {};
    for (const opt of vendorOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        if (a.vendorName === 'Other') return 1;
        if (b.vendorName === 'Other') return -1;
        return a.vendorName.localeCompare(b.vendorName);
      });
    }
    return grouped;
  }, [vendorOptions]);

  const addVendorMutation = trpc.admin.addVendorOption.useMutation({
    onSuccess: () => { toast.success("Vendor added!"); setNewVendorName(""); refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to add vendor"),
  });

  const updateVendorMutation = trpc.admin.updateVendorOption.useMutation({
    onSuccess: () => { toast.success("Vendor updated!"); setEditVendorId(null); setEditVendorName(""); refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to update vendor"),
  });

  const deleteVendorMutation = trpc.admin.deleteVendorOption.useMutation({
    onSuccess: () => { toast.success("Vendor removed"); refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to remove vendor"),
  });

  const toggleVendorMutation = trpc.admin.toggleVendorOption.useMutation({
    onSuccess: () => { refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to toggle vendor"),
  });

  const addSystemTypeMutation = trpc.admin.addSystemType.useMutation({
    onSuccess: () => { toast.success("System type added!"); setNewSystemTypeName(""); setNewSystemTypeVendors(""); refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to add system type"),
  });

  const seedVendorsMutation = trpc.admin.seedDefaultVendorOptions.useMutation({
    onSuccess: (result) => { toast.success(result.message || "Defaults seeded"); refetchVendorOptions(); refetchVendorAuditLogs(); },
    onError: (error: any) => toast.error(error.message || "Failed to seed defaults"),
  });

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Vendor Picklists</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage the vendor dropdown options shown in the Architecture section of the intake questionnaire.
                </p>
              </div>
              <div className="flex gap-2">
                {(!vendorOptions || vendorOptions.length === 0) && (
                  <Button
                    variant="outline"
                    onClick={() => seedVendorsMutation.mutate()}
                    disabled={seedVendorsMutation.isPending}
                  >
                    {seedVendorsMutation.isPending ? "Seeding..." : "Seed Defaults"}
                  </Button>
                )}
              </div>
            </div>

            {/* Add New System Type */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Add New System Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">System Type Name</Label>
                    <Input
                      placeholder="e.g., Cloud PACS, Dose Monitoring"
                      value={newSystemTypeName}
                      onChange={(e) => setNewSystemTypeName(e.target.value)}
                    />
                  </div>
                  <div className="flex-[2]">
                    <Label className="text-xs text-muted-foreground">Vendors (comma-separated)</Label>
                    <Input
                      placeholder="e.g., Vendor A, Vendor B, Vendor C, Other"
                      value={newSystemTypeVendors}
                      onChange={(e) => setNewSystemTypeVendors(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
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
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {addSystemTypeMutation.isPending ? "Adding..." : "Add System Type"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Type Cards */}
            {Object.keys(vendorsByType).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No vendor options configured</p>
                  <p className="text-sm">Click "Seed Defaults" to load the standard vendor lists, or add system types manually above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Object.entries(vendorsByType).sort(([a], [b]) => a.localeCompare(b)).map(([systemType, vendors]) => (
                  <Collapsible key={systemType} asChild>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg group">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                              <Badge variant="outline" className="text-sm">{systemType}</Badge>
                              <span className="text-sm text-muted-foreground font-normal">
                                {(vendors || []).filter(v => v.isActive).length} active / {(vendors || []).length} total
                              </span>
                            </CardTitle>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                      {/* Add vendor to this type */}
                      <div className="flex gap-2 mb-4">
                        {newVendorType === systemType ? (
                          <>
                            <Input
                              placeholder="New vendor name"
                              value={newVendorName}
                              onChange={(e) => setNewVendorName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newVendorName.trim()) {
                                  addVendorMutation.mutate({ systemType, vendorName: newVendorName.trim() });
                                  setNewVendorType("");
                                }
                              }}
                              className="max-w-xs"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (newVendorName.trim()) {
                                  addVendorMutation.mutate({ systemType, vendorName: newVendorName.trim() });
                                  setNewVendorType("");
                                }
                              }}
                              disabled={addVendorMutation.isPending || !newVendorName.trim()}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setNewVendorType(""); setNewVendorName(""); }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setNewVendorType(systemType); setNewVendorName(""); }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Vendor
                          </Button>
                        )}
                      </div>

                      {/* Vendor list */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '8%' }} /><col style={{ width: '55%' }} />
                            <col style={{ width: '15%' }} /><col style={{ width: '22%' }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border/30 bg-muted/15">
                              {['#','Vendor','Status',''].map((h,i)=>(
                                <th key={i} className={cn("px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide", i===3?"text-right":"text-left")}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(vendors || []).map((vendor, idx) => (
                              <tr key={vendor.id} className={cn("border-b border-border/20 hover:bg-muted/20 transition-colors", !vendor.isActive && "opacity-50")}>
                                <td className="px-3 py-1.5 text-muted-foreground">{idx+1}</td>
                                <td className="px-3 py-1.5">
                                  {editVendorId === vendor.id ? (
                                    <div className="flex gap-2 items-center">
                                      <Input value={editVendorName} onChange={(e)=>setEditVendorName(e.target.value)}
                                        onKeyDown={(e)=>{ if(e.key==="Enter"&&editVendorName.trim()) updateVendorMutation.mutate({id:vendor.id,vendorName:editVendorName.trim()}); if(e.key==="Escape") setEditVendorId(null); }}
                                        className="h-6 text-xs" autoFocus />
                                      <button onClick={()=>{ if(editVendorName.trim()) updateVendorMutation.mutate({id:vendor.id,vendorName:editVendorName.trim()}); }}
                                        className="p-1 rounded hover:bg-muted/50"><Check className="w-3 h-3" /></button>
                                    </div>
                                  ) : (
                                    <span className="font-medium">{vendor.vendorName}</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <button onClick={()=>toggleVendorMutation.mutate({id:vendor.id,isActive:vendor.isActive?0:1})}
                                    className={cn("px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border cursor-pointer transition-colors",
                                      vendor.isActive?"bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25":"bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50")}>
                                    {vendor.isActive?"Active":"Hidden"}
                                  </button>
                                </td>
                                <td className="px-2 py-1 text-right">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={()=>{ setEditVendorId(vendor.id); setEditVendorName(vendor.vendorName); }}
                                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button onClick={()=>{ if(confirm(`Remove "${vendor.vendorName}" from ${systemType}?`)) deleteVendorMutation.mutate({id:vendor.id}); }}
                                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                                      <AlertCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Audit Log Section */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Change History
                </CardTitle>
                <CardDescription>Recent changes to vendor picklists</CardDescription>
              </CardHeader>
              <CardContent>
                {!vendorAuditLogs || vendorAuditLogs.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No changes recorded yet.</p>
                ) : (
                  <div className="rounded-md border max-h-[400px] overflow-y-auto">
                    <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '17%' }} /><col style={{ width: '10%' }} />
                        <col style={{ width: '18%' }} /><col style={{ width: '35%' }} />
                        <col style={{ width: '20%' }} />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                        <tr className="border-b border-border/30">
                          {['Date','Action','System Type','Details','By'].map((h,i)=>(
                            <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vendorAuditLogs.map((log) => {
                          const actionLabel: Record<string, string> = { add:'Added', update:'Renamed', toggle:'Toggled', delete:'Deleted', add_system_type:'New Type', seed_defaults:'Seeded' };
                          const actionColor: Record<string, string> = { add:'text-green-400', update:'text-blue-400', toggle:'text-yellow-400', delete:'text-red-400', add_system_type:'text-purple-400', seed_defaults:'text-muted-foreground' };
                          let details = '';
                          if (log.action==='add') details=`Added "${log.vendorName}"`;
                          else if (log.action==='update') details=`"${log.previousValue}" → "${log.newValue}"`;
                          else if (log.action==='toggle') details=`"${log.vendorName}" ${log.newValue==='active'?'activated':'deactivated'}`;
                          else if (log.action==='delete') details=`Removed "${log.vendorName}"`;
                          else if (log.action==='add_system_type') { try { const v=JSON.parse(log.newValue||'[]'); details=`Added ${v.length} vendors: ${v.join(', ')}`; } catch { details=log.newValue||''; } }
                          else if (log.action==='seed_defaults') { try { const t=JSON.parse(log.newValue||'[]'); details=`Seeded ${t.length} system types`; } catch { details='Seeded defaults'; } }
                          return (
                            <tr key={log.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                {new Date(log.performedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}{' '}
                                {new Date(log.performedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={cn('font-medium', actionColor[log.action]||'text-muted-foreground')}>{actionLabel[log.action]||log.action}</span>
                              </td>
                              <td className="px-3 py-1.5 truncate">{log.systemType}</td>
                              <td className="px-3 py-1.5 truncate text-muted-foreground" title={details}>{details}</td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate">{log.performedBy}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
    </>
  );
}
