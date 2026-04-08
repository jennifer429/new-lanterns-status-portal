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
import { Plus, Edit, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SharedAdminProps } from "./types";

type UsersTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients" | "allUsers" | "refetchUsers">;

export function UsersTab({ isPlatformAdmin, orgs, clients, allUsers, refetchUsers }: UsersTabProps) {
  const { user } = useAuth();

  // Computed maps
  const clientMap = useMemo(() => {
    if (isPlatformAdmin) {
      return clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {};
    }
    return orgs?.reduce((acc, o) => {
      if (o.clientId && !acc[o.clientId]) acc[o.clientId] = `Partner ${o.clientId}`;
      return acc;
    }, {} as Record<number, string>) || {};
  }, [isPlatformAdmin, clients, orgs]);

  const orgMap = useMemo(() =>
    orgs?.reduce((acc, o) => { acc[o.id] = o.name; return acc; }, {} as Record<number, string>) || {},
    [orgs]
  );

  const activeOrgs = useMemo(() => orgs?.filter(o => o.status === "active") || [], [orgs]);
  const activeUsers = useMemo(() => allUsers?.filter(u => u.isActive === 1) || [], [allUsers]);
  const inactiveUsers = useMemo(() => allUsers?.filter(u => u.isActive === 0) || [], [allUsers]);

  // Create user state
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserOrgId, setNewUserOrgId] = useState<number | undefined>();
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [newUserClientId, setNewUserClientId] = useState<number | null>(null);

  // Edit user state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "admin">("user");
  const [editUserOrgId, setEditUserOrgId] = useState<number | null>(null);
  const [editUserClientId, setEditUserClientId] = useState<number | null>(null);

  // Reactivate user state
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);
  const [reactivateUserId, setReactivateUserId] = useState<number | null>(null);
  const [reactivateUserName, setReactivateUserName] = useState("");
  const [reactivateOrgId, setReactivateOrgId] = useState<number | undefined>();

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully!");
      setIsCreateUserDialogOpen(false);
      setNewUserEmail(""); setNewUserName(""); setNewUserOrgId(undefined); setNewUserRole("user");
      refetchUsers();
    },
    onError: (error: any) => toast.error(error.message || "Failed to create user"),
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("User updated successfully!");
      setIsEditUserDialogOpen(false);
      setEditUserId(null); setEditUserName(""); setEditUserEmail(""); setEditUserRole("user"); setEditUserOrgId(null);
      refetchUsers();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update user"),
  });

  const reactivateUserMutation = trpc.admin.reactivateUser.useMutation({
    onSuccess: () => {
      toast.success("User reactivated successfully!");
      setIsReactivateDialogOpen(false);
      setReactivateUserId(null); setReactivateUserName(""); setReactivateOrgId(undefined);
      refetchUsers();
    },
    onError: (error: any) => toast.error(error.message || "Failed to reactivate user"),
  });

  const deactivateUserMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => { toast.success("User deactivated successfully!"); refetchUsers(); },
    onError: (error: any) => toast.error(error.message || "Failed to deactivate user"),
  });

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserName) { toast.error("Please fill in email and name"); return; }
    if (newUserRole === "user" && !newUserOrgId) { toast.error("Organization is required for non-admin users"); return; }
    const clientIdToUse = isPlatformAdmin ? newUserClientId : user?.clientId;
    if (isPlatformAdmin && !clientIdToUse) { toast.error("Please select a partner"); return; }
    createUserMutation.mutate({ email: newUserEmail, name: newUserName, organizationId: newUserOrgId || undefined, role: newUserRole, clientId: clientIdToUse ?? null });
  };

  const handleEditUser = (u: NonNullable<typeof allUsers>[number]) => {
    setEditUserId(u.id); setEditUserName(u.name || ""); setEditUserEmail(u.email || "");
    setEditUserRole(u.role as "user" | "admin"); setEditUserOrgId(u.organizationId || null);
    setEditUserClientId(u.clientId || null); setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editUserId || !editUserName || !editUserEmail) { toast.error("Please fill in all required fields"); return; }
    updateUserMutation.mutate({ id: editUserId, name: editUserName, email: editUserEmail, role: editUserRole, organizationId: editUserOrgId, clientId: editUserClientId });
  };

  const handleReactivateUser = (u: NonNullable<typeof allUsers>[number]) => {
    setReactivateUserId(u.id); setReactivateUserName(u.name || "Unknown"); setReactivateOrgId(undefined); setIsReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = () => {
    if (!reactivateUserId || !reactivateOrgId) { toast.error("Please select an organization"); return; }
    reactivateUserMutation.mutate({ userId: reactivateUserId, organizationId: reactivateOrgId });
  };

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">User Management</h2>
              <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to an organization
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="userEmail">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="userEmail"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@hospital.org"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userName">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="userName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userOrg">
                        Organization <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={newUserOrgId?.toString()}
                        onValueChange={(value) => setNewUserOrgId(parseInt(value))}
                      >
                        <SelectTrigger id="userOrg">
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeOrgs
                            .filter(org => {
                              const selectedClientId = isPlatformAdmin ? newUserClientId : user?.clientId;
                              if (!selectedClientId) return true;
                              return org.clientId === selectedClientId;
                            })
                            .map(org => (
                            <SelectItem key={org.id} value={org.id.toString()}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userPartner">
                        Client ID <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={!isPlatformAdmin ? (user?.clientId?.toString() || "") : (newUserClientId?.toString() || "")}
                        onValueChange={(value) => setNewUserClientId(parseInt(value))}
                        disabled={!isPlatformAdmin}
                      >
                        <SelectTrigger id="userPartner">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map(client => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isPlatformAdmin && (
                        <p className="text-xs text-muted-foreground">Auto-assigned to your partner</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userRole">Role</Label>
                      <Select
                        value={newUserRole}
                        onValueChange={(value: "user" | "admin") => setNewUserRole(value)}
                      >
                        <SelectTrigger id="userRole">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleCreateUser}
                      disabled={createUserMutation.isPending}
                      className="w-full"
                    >
                      {createUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit User Dialog */}
            <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user details, role, and organization assignment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="editUserName">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="editUserName"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editUserEmail">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="editUserEmail"
                      type="email"
                      value={editUserEmail}
                      onChange={(e) => setEditUserEmail(e.target.value)}
                      placeholder="user@hospital.org"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editUserRole">Role</Label>
                    <Select
                      value={editUserRole}
                      onValueChange={(value: "user" | "admin") => setEditUserRole(value)}
                    >
                      <SelectTrigger id="editUserRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editUserOrg">Organization</Label>
                    <Select
                      value={editUserOrgId?.toString() || "none"}
                      onValueChange={(value) => setEditUserOrgId(value === "none" ? null : parseInt(value))}
                    >
                      <SelectTrigger id="editUserOrg">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Organization (Partner-level)</SelectItem>
                        {activeOrgs.map(org => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleUpdateUser}
                    disabled={updateUserMutation.isPending}
                    className="w-full"
                  >
                    {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Reactivate User Dialog */}
            <Dialog open={isReactivateDialogOpen} onOpenChange={setIsReactivateDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reactivate User</DialogTitle>
                  <DialogDescription>
                    Reactivate {reactivateUserName} by assigning them to an organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reactivateOrg">
                      Organization <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={reactivateOrgId?.toString()}
                      onValueChange={(value) => setReactivateOrgId(parseInt(value))}
                    >
                      <SelectTrigger id="reactivateOrg">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeOrgs.map(org => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleConfirmReactivate}
                    disabled={reactivateUserMutation.isPending}
                    className="w-full"
                  >
                    {reactivateUserMutation.isPending ? "Reactivating..." : "Reactivate User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Active Users Table */}
            <Card className="mb-6 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/30 bg-muted/10">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Users ({activeUsers.length})</h3>
              </div>
              <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: isPlatformAdmin ? '14%' : '18%' }} />
                  <col style={{ width: isPlatformAdmin ? '18%' : '25%' }} />
                  <col style={{ width: isPlatformAdmin ? '14%' : '20%' }} />
                  {isPlatformAdmin && <><col style={{ width: '10%' }} /><col style={{ width: '6%' }} /></>}
                  <col style={{ width: '7%'  }} />
                  <col style={{ width: isPlatformAdmin ? '14%' : '18%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/30 bg-muted/15">
                    {['Name','Email','Organization',...(isPlatformAdmin?['Partner','CID']:[]),'Role','Last Login',''].map((h,i) => (
                      <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map(u => {
                    const org = orgs?.find(o => o.id === u.organizationId);
                    const userClientId = u.clientId || org?.clientId || null;
                    const partner = userClientId ? clientMap[userClientId] : "—";
                    return (
                      <tr key={u.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-1.5 font-medium truncate">{u.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate">{u.email}</td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate">{orgMap[u.organizationId || 0] || "—"}</td>
                        {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{partner}</td>}
                        {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground">{userClientId ?? "—"}</td>}
                        <td className="px-3 py-1.5">
                          <span className={cn("px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border",
                            u.role === "admin" ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/40")}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex gap-1">
                            <button onClick={() => handleEditUser(u)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                              <Edit className="w-2.5 h-2.5" /> Edit
                            </button>
                            <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateUserMutation.mutate({ userId: u.id }); }}
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

            {/* Inactive Users Table */}
            {inactiveUsers.length > 0 && (
              <Card className="overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/30 bg-muted/10">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inactive Users ({inactiveUsers.length})</h3>
                </div>
                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: isPlatformAdmin ? '18%' : '22%' }} />
                    <col style={{ width: isPlatformAdmin ? '22%' : '32%' }} />
                    {isPlatformAdmin && <><col style={{ width: '14%' }} /><col style={{ width: '8%' }} /></>}
                    <col style={{ width: '8%' }} />
                    <col style={{ width: isPlatformAdmin ? '18%' : '28%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/15">
                      {['Name','Email',...(isPlatformAdmin?['Partner','CID']:[]),'Role',''].map((h,i) => (
                        <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.map(u => {
                      const partner = u.clientId ? clientMap[u.clientId] : "—";
                      return (
                        <tr key={u.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors opacity-60">
                          <td className="px-3 py-1.5 font-medium truncate">{u.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate">{u.email}</td>
                          {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{partner}</td>}
                          {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground">{u.clientId ?? "—"}</td>}
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border bg-muted/30 text-muted-foreground border-border/40">{u.role}</span>
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              <button onClick={() => handleEditUser(u)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                <Edit className="w-2.5 h-2.5" /> Edit
                              </button>
                              <button onClick={() => handleReactivateUser(u)}
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
            )}
          </>
    </>
  );
}
