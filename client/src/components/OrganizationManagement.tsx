/**
 * Organization Management Component
 * Allows admins to view, create, and rename organizations
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function OrganizationManagement() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [editOrgName, setEditOrgName] = useState("");

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
    updateMutation.mutate({ id: selectedOrg.id.toString(), name: editOrgName.trim() });
  };

  const openEditDialog = (org: { id: number; name: string; slug: string }) => {
    setSelectedOrg(org);
    setEditOrgName(org.name);
    setEditDialogOpen(true);
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white text-xl">Update Organizations</CardTitle>
            <CardDescription className="text-gray-300">
              Manage client organizations and their names
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-500 text-white">
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
      <CardContent>
        <div className="space-y-3">
          {organizations && organizations.length > 0 ? (
            organizations.map((org: any) => (
              <div
                key={org.id}
                className="flex items-center justify-between p-4 rounded-lg bg-purple-900/20 border border-purple-500/20 hover:bg-purple-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-white font-medium">{org.name}</p>
                    <p className="text-sm text-gray-400">Slug: {org.slug}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(org)}
                  className="border-purple-500/30 hover:bg-purple-600 hover:text-white text-gray-300"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              No organizations found. Create one to get started.
            </div>
          )}
        </div>
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
    </Card>
  );
}
