/**
 * Organization Management Component
 * Allows admins to view, create, and rename organizations
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function OrganizationManagement() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [editOrgName, setEditOrgName] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<{ id: number; name: string } | null>(null);

  const trpcUtils = trpc.useUtils();
  const { data: organizations, isLoading, refetch } = trpc.organizations.getAll.useQuery();
  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: () => {
      refetch();
      setCreateDialogOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      alert("Organization created successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    },
  });

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      refetch();
      // Invalidate all organization queries to update Dashboard tab
      trpcUtils.organizations.getMetrics.invalidate();
      setEditDialogOpen(false);
      setSelectedOrg(null);
      setEditOrgName("");
      alert("Organization renamed successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    },
  });

  const inactivateMutation = trpc.organizations.inactivate.useMutation({
    onSuccess: () => {
      refetch();
      // Invalidate all organization queries to update Dashboard tab
      trpcUtils.organizations.getMetrics.invalidate();
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
      alert("Organization inactivated successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) {
      alert("Please enter both organization name and slug");
      return;
    }
    createMutation.mutate({ name: newOrgName.trim(), slug: newOrgSlug.trim() });
  };

  const handleUpdate = () => {
    if (!selectedOrg || !editOrgName.trim()) {
      alert("Please enter an organization name");
      return;
    }
    updateMutation.mutate({ id: selectedOrg.id, name: editOrgName.trim() });
  };

  const openEditDialog = (org: { id: number; name: string; slug: string }) => {
    setSelectedOrg(org);
    setEditOrgName(org.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (org: { id: number; name: string }) => {
    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const handleInactivate = () => {
    if (!orgToDelete) return;
    inactivateMutation.mutate({ id: orgToDelete.id });
  };

  if (isLoading) {
    return (
      <Card className="card-elevated overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">Loading organizations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle className="text-xl">Update Organizations</CardTitle>
            <CardDescription>
              Manage client organizations and their names
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create New Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Enter the name for the new organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-org-name">Organization Name</Label>
                  <Input
                    id="new-org-name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g., Memorial Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-org-slug">URL Slug</Label>
                  <Input
                    id="new-org-slug"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="e.g., memorial-hospital"
                  />
                  <p className="text-xs text-muted-foreground">Only lowercase letters, numbers, and hyphens</p>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="table-pro border-t border-border/60 rounded-none border-x-0 border-b-0">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '42%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '32%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                {['Organization', 'Slug', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organizations && organizations.length > 0 ? (
                organizations.map((org: any) => (
                  <tr key={org.id} className="border-b border-border/40">
                    <td className="px-4 py-2 font-medium truncate">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-primary shrink-0" />
                        {org.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground font-mono truncate">{org.slug}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-1">
                        <button onClick={() => openEditDialog(org)}
                          className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary border border-border/70 hover:bg-accent transition-colors">
                          <Edit className="w-2.5 h-2.5" /> Rename
                        </button>
                        <button onClick={() => openDeleteDialog(org)}
                          className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-destructive border border-border/70 hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-2.5 h-2.5" /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic text-xs">
                    No organizations found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Organization</DialogTitle>
            <DialogDescription>
              Update the organization name (this will update everywhere)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input
                id="edit-org-name"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                placeholder="e.g., Memorial Hospital"
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inactivate Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to inactivate <span className="font-semibold text-foreground">{orgToDelete?.name}</span>?
              This will hide the organization from the dashboard and portal, but data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInactivate}
              disabled={inactivateMutation.isPending}
              variant="destructive"
              className="flex-1"
            >
              {inactivateMutation.isPending ? "Inactivating..." : "Inactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
