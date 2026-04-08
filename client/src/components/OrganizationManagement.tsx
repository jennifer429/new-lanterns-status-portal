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
      <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
        <CardContent className="py-12">
          <div className="text-center text-gray-400">Loading organizations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle className="text-white text-xl">Update Organizations</CardTitle>
            <CardDescription className="text-gray-300">
              Manage client organizations and their names
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-500 text-white w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-purple-500/30">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Organization</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Enter the name for the new organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-org-name" className="text-white">Organization Name</Label>
                  <Input
                    id="new-org-name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g., Memorial Hospital"
                    className="bg-black/50 border-purple-500/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-org-slug" className="text-white">URL Slug</Label>
                  <Input
                    id="new-org-slug"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="e.g., memorial-hospital"
                    className="bg-black/50 border-purple-500/30 text-white"
                  />
                  <p className="text-xs text-gray-400">Only lowercase letters, numbers, and hyphens</p>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-500"
                >
                  {createMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '42%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '32%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-purple-500/20 bg-purple-950/20">
              {['Organization', 'Slug', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organizations && organizations.length > 0 ? (
              organizations.map((org: any) => (
                <tr key={org.id} className="border-b border-purple-500/10 hover:bg-purple-900/20 transition-colors">
                  <td className="px-4 py-2 text-white font-medium truncate">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                      {org.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono truncate">{org.slug}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-1">
                      <button onClick={() => openEditDialog(org)}
                        className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] text-purple-300 hover:text-white border border-purple-500/30 hover:bg-purple-600 transition-colors">
                        <Edit className="w-2.5 h-2.5" /> Rename
                      </button>
                      <button onClick={() => openDeleteDialog(org)}
                        className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] text-red-400/70 hover:text-white border border-red-500/20 hover:bg-red-600 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 italic text-xs">
                  No organizations found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-black border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Organization</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the organization name (this will update everywhere)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-org-name" className="text-white">Organization Name</Label>
              <Input
                id="edit-org-name"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                placeholder="e.g., Memorial Hospital"
                className="bg-black/50 border-purple-500/30 text-white"
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-500"
            >
              {updateMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-black border-red-500/30">
          <DialogHeader>
            <DialogTitle className="text-white">Inactivate Organization</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to inactivate <span className="font-semibold text-white">{orgToDelete?.name}</span>?
              This will hide the organization from the dashboard and portal, but data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 border-purple-500/30 hover:bg-purple-600 hover:text-white text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInactivate}
              disabled={inactivateMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white"
            >
              {inactivateMutation.isPending ? "Inactivating..." : "Inactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
