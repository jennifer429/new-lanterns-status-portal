import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { SharedAdminProps, Metric } from "./types";

type OrgsTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients" | "refetchOrgs"> & {
  metrics: Metric[] | undefined;
};

export function OrgsTab({ isPlatformAdmin, orgs, clients, refetchOrgs, metrics }: OrgsTabProps) {
  const { user } = useAuth();
  // Computed maps
  const metricsMap = useMemo(() =>
    metrics?.reduce((acc, m) => { acc[m.organizationId] = m; return acc; }, {} as Record<number, Metric>) || {},
    [metrics]
  );

  const clientMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );

  const [orgSortBy, setOrgSortBy] = useState<"name" | "completion" | "partner">("name");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc">("asc");

  const sortOrgs = (orgList: typeof orgs) => {
    if (!orgList) return [];
    return [...orgList].sort((a, b) => {
      let compareValue = 0;
      if (orgSortBy === "name") compareValue = a.name.localeCompare(b.name);
      else if (orgSortBy === "completion") compareValue = (metricsMap[a.id]?.completionPercent || 0) - (metricsMap[b.id]?.completionPercent || 0);
      else if (orgSortBy === "partner") compareValue = (a.clientId ? clientMap[a.clientId] || "" : "").localeCompare(b.clientId ? clientMap[b.clientId] || "" : "");
      return orgSortOrder === "asc" ? compareValue : -compareValue;
    });
  };

  const activeOrgs = sortOrgs(orgs?.filter(o => o.status === "active"));
  const completedOrgs = sortOrgs(orgs?.filter(o => o.status === "completed"));
  const inactiveOrgs = sortOrgs(orgs?.filter(o => o.status === "inactive" || o.status === "paused"));

  // Create org state
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgClientId, setNewOrgClientId] = useState<number | undefined>();

  // Edit org state
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false);
  const [editOrgId, setEditOrgId] = useState<number | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editOrgClientId, setEditOrgClientId] = useState<number | null>(null);

  const createOrgMutation = trpc.admin.createOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization created successfully!");
      setIsCreateOrgDialogOpen(false); setNewOrgName(""); setNewOrgSlug(""); setNewOrgClientId(undefined);
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to create organization"),
  });

  const updateOrgMutation = trpc.admin.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization updated successfully!");
      setIsEditOrgDialogOpen(false); setEditOrgId(null); setEditOrgName(""); setEditOrgSlug(""); setEditOrgClientId(null);
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update organization"),
  });

  const deactivateOrgMutation = trpc.admin.deactivateOrganization.useMutation({
    onSuccess: () => { toast.success("Organization deactivated"); refetchOrgs(); },
    onError: (error) => toast.error(error.message || "Failed to deactivate organization"),
  });

  const reactivateOrgMutation = trpc.admin.reactivateOrganization.useMutation({
    onSuccess: () => { toast.success("Organization reactivated"); refetchOrgs(); },
    onError: (error) => toast.error(error.message || "Failed to reactivate organization"),
  });

  const markCompleteMutation = trpc.admin.markOrganizationComplete.useMutation({
    onSuccess: () => { toast.success("Organization marked as complete"); refetchOrgs(); },
    onError: (error) => toast.error(error.message || "Failed to mark organization as complete"),
  });

  const reopenOrgMutation = trpc.admin.reopenOrganization.useMutation({
    onSuccess: () => { toast.success("Organization reopened"); refetchOrgs(); },
    onError: (error) => toast.error(error.message || "Failed to reopen organization"),
  });

  const handleCreateOrg = () => {
    if (!newOrgName || !newOrgSlug || !newOrgClientId) { toast.error("Please fill in all required fields"); return; }
    createOrgMutation.mutate({ name: newOrgName, slug: newOrgSlug, clientId: newOrgClientId });
  };

  const handleDeactivateOrg = (orgId: number) => {
    if (confirm("Are you sure you want to deactivate this organization?")) deactivateOrgMutation.mutate({ organizationId: orgId });
  };

  const handleEditOrg = (org: NonNullable<typeof orgs>[number]) => {
    setEditOrgId(org.id); setEditOrgName(org.name); setEditOrgSlug(org.slug); setEditOrgClientId(org.clientId); setIsEditOrgDialogOpen(true);
  };

  const handleUpdateOrg = () => {
    if (!editOrgId || !editOrgName || !editOrgSlug || !editOrgClientId) { toast.error("Please fill in all required fields"); return; }
    updateOrgMutation.mutate({ id: editOrgId, name: editOrgName, slug: editOrgSlug, clientId: editOrgClientId });
  };

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Organization Management</h2>
              <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>
                      Add a new hospital or healthcare organization to the onboarding portal.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="Memorial General Hospital"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="org-slug">URL Slug</Label>
                      <Input
                        id="org-slug"
                        placeholder="memorial-general"
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                      />
                    </div>
                    {isPlatformAdmin && (
                      <div>
                        <Label htmlFor="org-partner">Partner</Label>
                        <Select value={newOrgClientId?.toString()} onValueChange={(val) => setNewOrgClientId(parseInt(val))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(clientMap).map(([id, name]) => (
                              <SelectItem key={id} value={id}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        // For partner admins, auto-assign their clientId
                        const clientId = isPlatformAdmin ? newOrgClientId : user?.clientId;
                        if (!newOrgName || !newOrgSlug || !clientId) {
                          toast.error("Please fill in all required fields");
                          return;
                        }
                        createOrgMutation.mutate({
                          name: newOrgName,
                          slug: newOrgSlug,
                          clientId: clientId,
                        });
                      }}
                      disabled={createOrgMutation.isPending}
                      className="w-full"
                    >
                      {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Organization Dialog */}
              <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                    <DialogDescription>
                      Update organization details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="edit-org-name">Organization Name</Label>
                      <Input
                        id="edit-org-name"
                        placeholder="Memorial General Hospital"
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-org-slug">URL Slug</Label>
                      <Input
                        id="edit-org-slug"
                        placeholder="memorial-general"
                        value={editOrgSlug}
                        onChange={(e) => setEditOrgSlug(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateOrg}
                      disabled={updateOrgMutation.isPending}
                      className="w-full"
                    >
                      {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-sm font-medium">Sort by:</Label>
                <Select value={orgSortBy} onValueChange={(value: "name" | "completion" | "partner") => setOrgSortBy(value)}>
                  <SelectTrigger id="sort-by" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="completion">Completion %</SelectItem>
                    {isPlatformAdmin && <SelectItem value="partner">Partner</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-order" className="text-sm font-medium">Order:</Label>
                <Select value={orgSortOrder} onValueChange={(value: "asc" | "desc") => setOrgSortOrder(value)}>
                  <SelectTrigger id="sort-order" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Active Organizations ({activeOrgs.length})</h3>
            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: isPlatformAdmin ? '30%' : '38%' }} />
                  {isPlatformAdmin && <col style={{ width: '16%' }} />}
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: isPlatformAdmin ? '20%' : '24%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/30 bg-muted/15">
                    {['Name', ...(isPlatformAdmin ? ['Partner'] : []), 'Status', 'Users', ''].map((h,i) => (
                      <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeOrgs.length === 0 ? (
                    <tr><td colSpan={isPlatformAdmin ? 5 : 4} className="text-center py-8 text-xs text-muted-foreground italic">No active organizations</td></tr>
                  ) : activeOrgs.map(org => {
                    const orgMetrics = metricsMap[org.id];
                    const partnerName = org.clientId ? clientMap[org.clientId] : "—";
                    const userCount = orgMetrics?.userCount || 0;
                    return (
                      <tr key={org.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-1.5 font-medium truncate">{org.name}</td>
                        {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{partnerName}</td>}
                        <td className="px-3 py-1.5"><span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-green-500/15 text-green-400 border border-green-500/30">Active</span></td>
                        <td className="px-3 py-1.5 text-muted-foreground">{userCount}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditOrgId(org.id); setEditOrgName(org.name); setEditOrgSlug(org.slug); setEditOrgClientId(org.clientId); setIsEditOrgDialogOpen(true); }}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                              <Edit className="w-2.5 h-2.5" /> Edit
                            </button>
                            <button onClick={() => handleDeactivateOrg(org.id)} disabled={deactivateOrgMutation.isPending}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 text-muted-foreground hover:bg-muted/50 transition-colors">
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Completed Organizations Section */}
            {completedOrgs.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-6 mb-2 text-muted-foreground uppercase tracking-wide">Completed ({completedOrgs.length})</h3>
                <Card className="overflow-hidden">
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isPlatformAdmin ? '30%' : '38%' }} />
                      {isPlatformAdmin && <col style={{ width: '16%' }} />}
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: isPlatformAdmin ? '20%' : '24%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/15">
                        {['Name', ...(isPlatformAdmin ? ['Partner'] : []), 'Status', 'Users', ''].map((h,i) => (
                          <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrgs.map(org => {
                        const orgMetrics = metricsMap[org.id];
                        const partnerName = org.clientId ? clientMap[org.clientId] : "—";
                        const userCount = orgMetrics?.userCount || 0;
                        return (
                          <tr key={org.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors opacity-80">
                            <td className="px-3 py-1.5 font-medium truncate">{org.name}</td>
                            {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{partnerName}</td>}
                            <td className="px-3 py-1.5"><span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-blue-500/15 text-blue-400 border border-blue-500/30">Done</span></td>
                            <td className="px-3 py-1.5 text-muted-foreground">{userCount}</td>
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditOrgId(org.id); setEditOrgName(org.name); setEditOrgSlug(org.slug); setEditOrgClientId(org.clientId); setIsEditOrgDialogOpen(true); }}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                  <Edit className="w-2.5 h-2.5" /> Edit
                                </button>
                                <button onClick={() => { if (confirm(`Reopen ${org.name}?`)) reopenOrgMutation.mutate({ organizationId: org.id }); }} disabled={reopenOrgMutation.isPending}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                  <RotateCcw className="w-2.5 h-2.5" /> Reopen
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </>
            )}

            {/* Deactivated Organizations Section */}
            {inactiveOrgs.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-6 mb-2 text-muted-foreground uppercase tracking-wide">Deactivated ({inactiveOrgs.length})</h3>
                <Card className="overflow-hidden">
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isPlatformAdmin ? '35%' : '45%' }} />
                      {isPlatformAdmin && <col style={{ width: '20%' }} />}
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '30%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/15">
                        {['Name', ...(isPlatformAdmin ? ['Partner'] : []), 'Status', ''].map((h,i) => (
                          <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveOrgs.map(org => {
                        const partnerName = org.clientId ? clientMap[org.clientId] : "—";
                        return (
                          <tr key={org.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors opacity-60">
                            <td className="px-3 py-1.5 font-medium truncate">{org.name}</td>
                            {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{partnerName}</td>}
                            <td className="px-3 py-1.5"><span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-muted/40 text-muted-foreground border border-border/40">Inactive</span></td>
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditOrgId(org.id); setEditOrgName(org.name); setEditOrgSlug(org.slug); setEditOrgClientId(org.clientId); setIsEditOrgDialogOpen(true); }}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                  <Edit className="w-2.5 h-2.5" /> Edit
                                </button>
                                <button onClick={() => { if (confirm(`Reactivate ${org.name}?`)) reactivateOrgMutation.mutate({ organizationId: org.id }); }} disabled={reactivateOrgMutation.isPending}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                  <RotateCcw className="w-2.5 h-2.5" /> Activate
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </>
    </>
  );
}
