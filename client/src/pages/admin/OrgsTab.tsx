import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
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
import { Plus, Edit, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, type Column } from "@/components/AdminDataTable";
import type { SharedAdminProps, Metric } from "./types";

type OrgsTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients" | "refetchOrgs"> & {
  metrics: Metric[] | undefined;
};

type OrgRow = NonNullable<OrgsTabProps["orgs"]>[number];

export function OrgsTab({ isPlatformAdmin, orgs, clients, refetchOrgs, metrics }: OrgsTabProps) {
  const { user } = useAuth();

  const metricsMap = useMemo(() =>
    metrics?.reduce((acc, m) => { acc[m.organizationId] = m; return acc; }, {} as Record<number, Metric>) || {},
    [metrics]
  );

  const clientMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );

  const activeOrgs = useMemo(() => orgs?.filter(o => o.status === "active") || [], [orgs]);
  const completedOrgs = useMemo(() => orgs?.filter(o => o.status === "completed") || [], [orgs]);
  const inactiveOrgs = useMemo(() => orgs?.filter(o => o.status === "inactive" || o.status === "paused") || [], [orgs]);

  // ── Create org state ───────────────────────────────────────────────────────
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgClientId, setNewOrgClientId] = useState<number | undefined>();

  // ── Edit org state ─────────────────────────────────────────────────────────
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false);
  const [editOrgId, setEditOrgId] = useState<number | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editOrgClientId, setEditOrgClientId] = useState<number | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  const reopenOrgMutation = trpc.admin.reopenOrganization.useMutation({
    onSuccess: () => { toast.success("Organization reopened"); refetchOrgs(); },
    onError: (error) => toast.error(error.message || "Failed to reopen organization"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleEditOrg = (org: OrgRow) => {
    setEditOrgId(org.id); setEditOrgName(org.name); setEditOrgSlug(org.slug); setEditOrgClientId(org.clientId); setIsEditOrgDialogOpen(true);
  };

  const handleUpdateOrg = () => {
    if (!editOrgId || !editOrgName || !editOrgClientId) { toast.error("Please fill in all required fields"); return; }
    updateOrgMutation.mutate({ id: editOrgId, name: editOrgName, clientId: editOrgClientId });
  };

  const handleDeactivateOrg = (orgId: number) => {
    if (confirm("Are you sure you want to deactivate this organization?")) deactivateOrgMutation.mutate({ organizationId: orgId });
  };

  // ── Column definitions ─────────────────────────────────────────────────────

  const activeColumns: Column<OrgRow>[] = useMemo(() => {
    const cols: Column<OrgRow>[] = [
      {
        key: "name",
        label: "Name",
        width: isPlatformAdmin ? "30%" : "38%",
        getValue: (o) => o.name,
        render: (o) => <span className="font-medium">{o.name}</span>,
      },
    ];

    if (isPlatformAdmin) {
      cols.push({
        key: "partner",
        label: "Partner",
        width: "16%",
        getValue: (o) => o.clientId ? clientMap[o.clientId] || "" : "",
        render: (o) => <span className="text-muted-foreground">{o.clientId ? clientMap[o.clientId] || "—" : "—"}</span>,
      });
    }

    cols.push(
      {
        key: "status",
        label: "Status",
        width: "10%",
        getValue: (o) => o.status,
        render: (o) => (
          <span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-green-500/15 text-green-400 border border-green-500/30">Active</span>
        ),
      },
      {
        key: "users",
        label: "Users",
        width: "8%",
        getValue: (o) => metricsMap[o.id]?.userCount || 0,
        render: (o) => <span className="text-muted-foreground">{metricsMap[o.id]?.userCount || 0}</span>,
      }
    );

    return cols;
  }, [isPlatformAdmin, clientMap, metricsMap]);

  const completedColumns: Column<OrgRow>[] = useMemo(() => {
    const cols: Column<OrgRow>[] = [
      {
        key: "name",
        label: "Name",
        width: isPlatformAdmin ? "30%" : "38%",
        getValue: (o) => o.name,
        render: (o) => <span className="font-medium">{o.name}</span>,
      },
    ];

    if (isPlatformAdmin) {
      cols.push({
        key: "partner",
        label: "Partner",
        width: "16%",
        getValue: (o) => o.clientId ? clientMap[o.clientId] || "" : "",
        render: (o) => <span className="text-muted-foreground">{o.clientId ? clientMap[o.clientId] || "—" : "—"}</span>,
      });
    }

    cols.push(
      {
        key: "status",
        label: "Status",
        width: "10%",
        getValue: () => "completed",
        render: () => (
          <span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-blue-500/15 text-blue-400 border border-blue-500/30">Done</span>
        ),
      },
      {
        key: "users",
        label: "Users",
        width: "8%",
        getValue: (o) => metricsMap[o.id]?.userCount || 0,
        render: (o) => <span className="text-muted-foreground">{metricsMap[o.id]?.userCount || 0}</span>,
      }
    );

    return cols;
  }, [isPlatformAdmin, clientMap, metricsMap]);

  const inactiveColumns: Column<OrgRow>[] = useMemo(() => {
    const cols: Column<OrgRow>[] = [
      {
        key: "name",
        label: "Name",
        width: isPlatformAdmin ? "35%" : "45%",
        getValue: (o) => o.name,
        render: (o) => <span className="font-medium">{o.name}</span>,
      },
    ];

    if (isPlatformAdmin) {
      cols.push({
        key: "partner",
        label: "Partner",
        width: "20%",
        getValue: (o) => o.clientId ? clientMap[o.clientId] || "" : "",
        render: (o) => <span className="text-muted-foreground">{o.clientId ? clientMap[o.clientId] || "—" : "—"}</span>,
      });
    }

    cols.push({
      key: "status",
      label: "Status",
      width: "15%",
      getValue: () => "inactive",
      render: () => (
        <span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 bg-muted/40 text-muted-foreground border border-border/40">Inactive</span>
      ),
    });

    return cols;
  }, [isPlatformAdmin, clientMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">Organization Management</h2>
        <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 px-2 sm:px-3 shrink-0">
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Organization</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>Add a new hospital or healthcare organization to the onboarding portal.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" placeholder="Memorial General Hospital" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="org-slug">URL Slug</Label>
                <Input id="org-slug" placeholder="memorial-general" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} />
              </div>
              {isPlatformAdmin && (
                <div>
                  <Label htmlFor="org-partner">Partner</Label>
                  <Select value={newOrgClientId?.toString()} onValueChange={(val) => setNewOrgClientId(parseInt(val))}>
                    <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
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
                  const clientId = isPlatformAdmin ? newOrgClientId : user?.clientId;
                  if (!newOrgName || !newOrgSlug || !clientId) { toast.error("Please fill in all required fields"); return; }
                  createOrgMutation.mutate({ name: newOrgName, slug: newOrgSlug, clientId });
                }}
                disabled={createOrgMutation.isPending}
                className="w-full"
              >
                {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update organization details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input id="edit-org-name" placeholder="Memorial General Hospital" value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-org-slug">URL Slug</Label>
              <Input id="edit-org-slug" value={editOrgSlug} readOnly disabled className="font-mono opacity-70" />
              <p className="text-[11px] text-muted-foreground mt-1">Slug is permanent — it's the org's URL identifier. Rename via the Name field above instead.</p>
            </div>
            <Button onClick={handleUpdateOrg} disabled={updateOrgMutation.isPending} className="w-full">
              {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Orgs */}
      <div className="mb-6">
        <AdminDataTable<OrgRow>
          columns={activeColumns}
          data={activeOrgs}
          getRowKey={(o) => o.id}
          title={`Active Organizations (${activeOrgs.length})`}
          exportFilename="active-organizations"
          searchPlaceholder="Search organizations..."
          emptyMessage="No active organizations"
          renderActions={(org) => (
            <div className="flex items-center gap-1">
              <button onClick={() => handleEditOrg(org)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                <Edit className="w-2.5 h-2.5" /> Edit
              </button>
              <button onClick={() => handleDeactivateOrg(org.id)} disabled={deactivateOrgMutation.isPending}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 text-muted-foreground hover:bg-muted/50 transition-colors">
                Deactivate
              </button>
            </div>
          )}
        />
      </div>

      {/* Completed Orgs */}
      {completedOrgs.length > 0 && (
        <div className="mb-6">
          <AdminDataTable<OrgRow>
            columns={completedColumns}
            data={completedOrgs}
            getRowKey={(o) => o.id}
            rowClassName={() => "opacity-80"}
            title={`Completed (${completedOrgs.length})`}
            exportFilename="completed-organizations"
            searchPlaceholder="Search completed..."
            emptyMessage="No completed organizations"
            renderActions={(org) => (
              <div className="flex items-center gap-1">
                <button onClick={() => handleEditOrg(org)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                  <Edit className="w-2.5 h-2.5" /> Edit
                </button>
                <button onClick={() => { if (confirm(`Reopen ${org.name}?`)) reopenOrgMutation.mutate({ organizationId: org.id }); }} disabled={reopenOrgMutation.isPending}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" /> Reopen
                </button>
              </div>
            )}
          />
        </div>
      )}

      {/* Deactivated Orgs */}
      {inactiveOrgs.length > 0 && (
        <AdminDataTable<OrgRow>
          columns={inactiveColumns}
          data={inactiveOrgs}
          getRowKey={(o) => o.id}
          rowClassName={() => "opacity-60"}
          title={`Deactivated (${inactiveOrgs.length})`}
          exportFilename="deactivated-organizations"
          searchPlaceholder="Search deactivated..."
          emptyMessage="No deactivated organizations"
          renderActions={(org) => (
            <div className="flex items-center gap-1">
              <button onClick={() => handleEditOrg(org)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                <Edit className="w-2.5 h-2.5" /> Edit
              </button>
              <button onClick={() => { if (confirm(`Reactivate ${org.name}?`)) reactivateOrgMutation.mutate({ organizationId: org.id }); }} disabled={reactivateOrgMutation.isPending}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                <RotateCcw className="w-2.5 h-2.5" /> Activate
              </button>
            </div>
          )}
        />
      )}
    </>
  );
}
