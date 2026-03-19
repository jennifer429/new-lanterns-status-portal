/**
 * User Management Component - CRUD interface for managing users
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UserPlus, Pencil, Trash2, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";


export function UserManagement() {

  const utils = trpc.useUtils();

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filterOrg, setFilterOrg] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "user" as "admin" | "user",
    organizationId: null as number | null,
  });

  // Queries
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: organizations } = trpc.organizations.list.useQuery();

  // Mutations
  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      alert("User created successfully");
      utils.users.list.invalidate();
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      alert("User updated successfully");
      utils.users.list.invalidate();
      setIsEditOpen(false);
      resetForm();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      alert("User deleted successfully");
      utils.users.list.invalidate();
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Handlers
  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      name: "",
      role: "user",
      organizationId: null,
    });
    setSelectedUser(null);
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    const updateData: any = {
      id: selectedUser.id,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      organizationId: formData.organizationId,
    };
    if (formData.password) {
      updateData.password = formData.password;
    }
    updateMutation.mutate(updateData);
  };

  const handleDelete = (user: any) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate({ id: selectedUser.id });
  };

  // Filter users
  const filteredUsers = users?.filter((user) => {
    if (filterOrg === "all") return true;
    if (filterOrg === "none") return user.organizationId === null;
    return user.organizationId?.toString() === filterOrg;
  });

  if (usersLoading) {
    return <div className="text-white">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl">User Management</CardTitle>
              <CardDescription className="text-gray-300">
                Manage all portal users and their access
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="mb-4 flex items-center gap-3">
            <Label className="text-gray-300">Filter by Organization:</Label>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-64 bg-purple-950/30 border-purple-500/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                <SelectItem value="none">No Organization</SelectItem>
                {organizations?.map((org) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border border-purple-500/20 overflow-hidden">
            <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '9%'  }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%'  }} />
              </colgroup>
              <thead>
                <tr className="bg-purple-950/30 border-b border-purple-500/20">
                  {['Name','Email','Role','Organization','Last Login',''].map((h,i) => (
                    <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers?.map((user) => (
                  <tr key={user.id} className="border-b border-purple-500/10 hover:bg-purple-950/20 transition-colors">
                    <td className="px-3 py-1.5 text-white font-medium truncate">{user.name}</td>
                    <td className="px-3 py-1.5 text-gray-300 truncate">{user.email}</td>
                    <td className="px-3 py-1.5">
                      <span className={cn(
                        "inline-block px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border",
                        user.role === "admin"
                          ? "bg-purple-600/80 text-white border-purple-500/50"
                          : "border-purple-500/30 text-purple-300"
                      )}>{user.role}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-300">
                      {user.organizationName ? (
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="truncate">{user.organizationName}</span>
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">None</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">
                      {user.lastLoginAt
                        ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                        : "Never"}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => handleEdit(user)}
                          className="p-1 rounded hover:bg-purple-950/50 text-purple-400 hover:text-purple-200 transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(user)}
                          className="p-1 rounded hover:bg-red-950/40 text-red-500/60 hover:text-red-300 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new user to the portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name" className="text-gray-300">Name</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="create-email" className="text-gray-300">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="create-password" className="text-gray-300">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="create-role" className="text-gray-300">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: "admin" | "user") => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-org" className="text-gray-300">Organization</Label>
              <Select
                value={formData.organizationId?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, organizationId: value === "none" ? null : parseInt(value) })
                }
              >
                <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update user information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-gray-300">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-email" className="text-gray-300">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-password" className="text-gray-300">
                New Password (leave blank to keep current)
              </Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-role" className="text-gray-300">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: "admin" | "user") => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-org" className="text-gray-300">Organization</Label>
              <Select
                value={formData.organizationId?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, organizationId: value === "none" ? null : parseInt(value) })
                }
              >
                <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {updateMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
