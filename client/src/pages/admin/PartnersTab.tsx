import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AdminDataTable, type Column } from "@/components/AdminDataTable";
import type { SharedAdminProps } from "./types";

type PartnersTabProps = Pick<SharedAdminProps, "clients" | "orgs" | "refetchOrgs">;

type ClientRow = NonNullable<PartnersTabProps["clients"]>[number];

export function PartnersTab({ clients, orgs, refetchOrgs }: PartnersTabProps) {
  const [isCreatePartnerDialogOpen, setIsCreatePartnerDialogOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerSlug, setNewPartnerSlug] = useState("");
  const [newPartnerDescription, setNewPartnerDescription] = useState("");
  const [isEditPartnerDialogOpen, setIsEditPartnerDialogOpen] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<number | null>(null);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerSlug, setEditPartnerSlug] = useState("");
  const [editPartnerDescription, setEditPartnerDescription] = useState("");

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createClientMutation = trpc.admin.createClient.useMutation({
    onSuccess: () => {
      toast.success("Partner created successfully!");
      setIsCreatePartnerDialogOpen(false); setNewPartnerName(""); setNewPartnerSlug(""); setNewPartnerDescription("");
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to create partner"),
  });

  const updateClientMutation = trpc.admin.updateClient.useMutation({
    onSuccess: () => {
      toast.success("Partner updated successfully!");
      setIsEditPartnerDialogOpen(false); setEditPartnerId(null);
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update partner"),
  });

  const deactivateClientMutation = trpc.admin.deactivateClient.useMutation({
    onSuccess: () => { toast.success("Partner deactivated"); refetchOrgs(); },
    onError: (error: any) => toast.error(error.message || "Failed to deactivate partner"),
  });

  const reactivateClientMutation = trpc.admin.reactivateClient.useMutation({
    onSuccess: () => { toast.success("Partner reactivated"); refetchOrgs(); },
    onError: (error: any) => toast.error(error.message || "Failed to reactivate partner"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreatePartner = () => {
    if (!newPartnerName || !newPartnerSlug) { toast.error("Please fill in name and slug"); return; }
    createClientMutation.mutate({ name: newPartnerName, slug: newPartnerSlug, description: newPartnerDescription || undefined });
  };

  const handleEditPartner = (client: ClientRow) => {
    setEditPartnerId(client.id); setEditPartnerName(client.name); setEditPartnerSlug(client.slug);
    setEditPartnerDescription(client.description || ""); setIsEditPartnerDialogOpen(true);
  };

  const handleUpdatePartner = () => {
    if (!editPartnerId || !editPartnerName || !editPartnerSlug) { toast.error("Please fill in name and slug"); return; }
    updateClientMutation.mutate({ id: editPartnerId, name: editPartnerName, slug: editPartnerSlug, description: editPartnerDescription || undefined });
  };

  const handleDeactivatePartner = (id: number) => {
    if (confirm("Are you sure you want to deactivate this partner? This will not affect their organizations.")) deactivateClientMutation.mutate({ id });
  };

  const handleReactivatePartner = (id: number) => {
    reactivateClientMutation.mutate({ id });
  };

  // ── Org count helper ───────────────────────────────────────────────────────

  const orgCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    orgs?.forEach((o) => {
      if (o.clientId) map[o.clientId] = (map[o.clientId] || 0) + 1;
    });
    return map;
  }, [orgs]);

  // ── Column definitions ─────────────────────────────────────────────────────

  const columns: Column<ClientRow>[] = useMemo(() => [
    {
      key: "id",
      label: "ID",
      width: "5%",
      getValue: (c) => c.id,
      render: (c) => <span className="font-mono text-muted-foreground">{c.id}</span>,
    },
    {
      key: "name",
      label: "Name",
      width: "16%",
      getValue: (c) => c.name,
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: "slug",
      label: "Slug",
      width: "14%",
      getValue: (c) => c.slug,
      render: (c) => <span className="font-mono text-muted-foreground">{c.slug}</span>,
    },
    {
      key: "description",
      label: "Description",
      width: "20%",
      getValue: (c) => c.description || "",
      render: (c) => <span className="text-muted-foreground">{c.description || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "8%",
      getValue: (c) => c.status,
      render: (c) => (
        <span className={cn("px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border",
          c.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-muted/30 text-muted-foreground border-border/40")}>
          {c.status}
        </span>
      ),
    },
    {
      key: "orgs",
      label: "Orgs",
      width: "7%",
      getValue: (c) => orgCountMap[c.id] || 0,
      render: (c) => <span className="text-muted-foreground">{orgCountMap[c.id] || 0}</span>,
    },
    {
      key: "created",
      label: "Created",
      width: "10%",
      getValue: (c) => c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
      render: (c) => <span className="text-muted-foreground whitespace-nowrap">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</span>,
    },
  ], [orgCountMap]);

  const allClients = clients || [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">Partners ({allClients.length})</h2>
        <Dialog open={isCreatePartnerDialogOpen} onOpenChange={setIsCreatePartnerDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 px-2 sm:px-3 shrink-0">
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Partner</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Partner</DialogTitle>
              <DialogDescription>Add a new partner organization (e.g., RadOne, SRV).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g., RadOne"
                  value={newPartnerName}
                  onChange={(e) => {
                    setNewPartnerName(e.target.value);
                    setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g., radone"
                  value={newPartnerSlug}
                  onChange={(e) => setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                <p className="text-xs text-muted-foreground">URL-safe identifier. Auto-generated from name.</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Optional description" value={newPartnerDescription} onChange={(e) => setNewPartnerDescription(e.target.value)} />
              </div>
              <Button onClick={handleCreatePartner} disabled={createClientMutation.isPending || !newPartnerName || !newPartnerSlug} className="w-full">
                {createClientMutation.isPending ? "Creating..." : "Create Partner"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Partner Dialog */}
      <Dialog open={isEditPartnerDialogOpen} onOpenChange={setIsEditPartnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>Update partner details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={editPartnerName} onChange={(e) => setEditPartnerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input value={editPartnerSlug} onChange={(e) => setEditPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editPartnerDescription} onChange={(e) => setEditPartnerDescription(e.target.value)} />
            </div>
            <Button onClick={handleUpdatePartner} disabled={updateClientMutation.isPending || !editPartnerName || !editPartnerSlug} className="w-full">
              {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partners Table */}
      <AdminDataTable<ClientRow>
        columns={columns}
        data={allClients}
        getRowKey={(c) => c.id}
        rowClassName={(c) => c.status === "inactive" ? "opacity-50" : ""}
        title={`All Partners`}
        exportFilename="partners"
        searchPlaceholder="Search partners..."
        emptyMessage="No partners yet. Create a partner to start organizing your clients."
        minWidth={750}
        renderActions={(c) => (
          <div className="flex gap-1">
            <button onClick={() => handleEditPartner(c)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
              <Edit className="w-2.5 h-2.5" /> Edit
            </button>
            {c.status === "active" ? (
              <button onClick={() => handleDeactivatePartner(c.id)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 text-muted-foreground hover:bg-muted/50 transition-colors">
                Deactivate
              </button>
            ) : (
              <button onClick={() => handleReactivatePartner(c.id)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                <RotateCcw className="w-2.5 h-2.5" /> Activate
              </button>
            )}
          </div>
        )}
      />
    </>
  );
}
