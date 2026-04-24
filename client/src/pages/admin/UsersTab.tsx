import { useMemo, useState, useRef } from "react";
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
import { Plus, Edit, RotateCcw, Upload, Send, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AdminDataTable, type Column } from "@/components/AdminDataTable";
import type { SharedAdminProps } from "./types";

type UsersTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients" | "allUsers" | "refetchUsers">;

type UserRow = NonNullable<UsersTabProps["allUsers"]>[number];

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

  // ── Create user state ──────────────────────────────────────────────────────
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserOrgId, setNewUserOrgId] = useState<number | undefined>();
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [newUserClientId, setNewUserClientId] = useState<number | null>(null);

  // ── Edit user state ────────────────────────────────────────────────────────
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "admin">("user");
  const [editUserOrgId, setEditUserOrgId] = useState<number | null>(null);
  const [editUserClientId, setEditUserClientId] = useState<number | null>(null);

  // ── Reactivate user state ──────────────────────────────────────────────────
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);
  const [reactivateUserId, setReactivateUserId] = useState<number | null>(null);
  const [reactivateUserName, setReactivateUserName] = useState("");
  const [reactivateOrgId, setReactivateOrgId] = useState<number | undefined>();

  // ── CSV import state ───────────────────────────────────────────────────────
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<{ name: string; email: string; role: string; orgName: string; partnerName: string }>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.inviteTriggered
          ? "User created. Invite email sent."
          : "User created. Invite will be sent on the next automation run."
      );
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

  const resendInviteMutation = trpc.admin.resendInvite.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.inviteTriggered
          ? `Invite email sent to ${data.email}.`
          : `Invite queued for ${data.email}. It will be sent on the next automation run.`
      );
    },
    onError: (error: any) => toast.error(error.message || "Failed to resend invite"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserName) { toast.error("Please fill in email and name"); return; }
    if (newUserRole === "user" && !newUserOrgId) { toast.error("Organization is required for non-admin users"); return; }
    const clientIdToUse = isPlatformAdmin ? newUserClientId : user?.clientId;
    if (isPlatformAdmin && !clientIdToUse) { toast.error("Please select a partner"); return; }
    createUserMutation.mutate({ email: newUserEmail, name: newUserName, organizationId: newUserOrgId || undefined, role: newUserRole, clientId: clientIdToUse ?? null });
  };

  const handleEditUser = (u: UserRow) => {
    setEditUserId(u.id); setEditUserName(u.name || ""); setEditUserEmail(u.email || "");
    setEditUserRole(u.role as "user" | "admin"); setEditUserOrgId(u.organizationId || null);
    setEditUserClientId(u.clientId || null); setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editUserId || !editUserName || !editUserEmail) { toast.error("Please fill in all required fields"); return; }
    updateUserMutation.mutate({ id: editUserId, name: editUserName, email: editUserEmail, role: editUserRole, organizationId: editUserOrgId, clientId: editUserClientId });
  };

  const handleReactivateUser = (u: UserRow) => {
    setReactivateUserId(u.id); setReactivateUserName(u.name || "Unknown"); setReactivateOrgId(undefined); setIsReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = () => {
    if (!reactivateUserId || !reactivateOrgId) { toast.error("Please select an organization"); return; }
    reactivateUserMutation.mutate({ userId: reactivateUserId, organizationId: reactivateOrgId });
  };

  // ── CSV Import ─────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setImportErrors(["CSV must have a header row and at least one data row"]);
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const nameIdx = header.findIndex((h) => h === "name");
      const emailIdx = header.findIndex((h) => h === "email");
      const roleIdx = header.findIndex((h) => h === "role");
      const orgIdx = header.findIndex((h) => h.includes("org"));
      const partnerIdx = header.findIndex((h) => h.includes("partner") || h.includes("client"));

      if (nameIdx === -1 || emailIdx === -1) {
        setImportErrors(["CSV must have 'name' and 'email' columns"]);
        return;
      }

      const errors: string[] = [];
      const preview: typeof importPreview = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const name = cols[nameIdx] || "";
        const email = cols[emailIdx] || "";
        const role = roleIdx !== -1 ? cols[roleIdx] || "user" : "user";
        const orgName = orgIdx !== -1 ? cols[orgIdx] || "" : "";
        const partnerName = partnerIdx !== -1 ? cols[partnerIdx] || "" : "";

        if (!name || !email) {
          errors.push(`Row ${i + 1}: Missing name or email`);
          continue;
        }
        if (!email.includes("@")) {
          errors.push(`Row ${i + 1}: Invalid email "${email}"`);
          continue;
        }

        preview.push({ name, email, role: role.toLowerCase(), orgName, partnerName });
      }

      setImportPreview(preview);
      setImportErrors(errors);
      setIsImportDialogOpen(true);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    setIsImporting(true);
    let successCount = 0;
    const failedRows: string[] = [];

    for (const row of importPreview) {
      try {
        // Resolve org by name
        const org = orgs?.find((o) => o.name.toLowerCase() === row.orgName.toLowerCase());
        // Resolve partner by name
        const partner = clients?.find((c) => c.name.toLowerCase() === row.partnerName.toLowerCase());
        const clientIdToUse = isPlatformAdmin ? (partner?.id ?? null) : (user?.clientId ?? null);

        const role = row.role === "admin" ? "admin" as const : "user" as const;

        await createUserMutation.mutateAsync({
          email: row.email,
          name: row.name,
          organizationId: org?.id,
          role,
          clientId: clientIdToUse,
        });
        successCount++;
      } catch (err: any) {
        failedRows.push(`${row.email}: ${err.message || "Failed"}`);
      }
    }

    setIsImporting(false);
    setIsImportDialogOpen(false);
    setImportPreview([]);
    refetchUsers();

    if (failedRows.length === 0) {
      toast.success(`Successfully imported ${successCount} users`);
    } else {
      toast.error(`Imported ${successCount}, failed ${failedRows.length}: ${failedRows.slice(0, 3).join("; ")}${failedRows.length > 3 ? "..." : ""}`);
    }
  };

  // ── Column definitions ─────────────────────────────────────────────────────

  const activeColumns: Column<UserRow>[] = useMemo(() => {
    const cols: Column<UserRow>[] = [
      {
        key: "name",
        label: "Name",
        width: isPlatformAdmin ? "14%" : "18%",
        getValue: (u) => u.name,
        render: (u) => <span className="font-medium">{u.name}</span>,
      },
      {
        key: "email",
        label: "Email",
        width: isPlatformAdmin ? "18%" : "25%",
        getValue: (u) => u.email,
        render: (u) => <span className="text-muted-foreground">{u.email}</span>,
      },
      {
        key: "organization",
        label: "Organization",
        width: isPlatformAdmin ? "14%" : "20%",
        getValue: (u) => orgMap[u.organizationId || 0] || "",
        render: (u) => <span className="text-muted-foreground">{orgMap[u.organizationId || 0] || "—"}</span>,
      },
    ];

    if (isPlatformAdmin) {
      cols.push(
        {
          key: "partner",
          label: "Partner",
          width: "10%",
          getValue: (u) => {
            const org = orgs?.find((o) => o.id === u.organizationId);
            const cid = u.clientId || org?.clientId || null;
            return cid ? clientMap[cid] || "" : "";
          },
          render: (u) => {
            const org = orgs?.find((o) => o.id === u.organizationId);
            const cid = u.clientId || org?.clientId || null;
            return <span className="text-muted-foreground">{cid ? clientMap[cid] || "—" : "—"}</span>;
          },
        },
        {
          key: "clientId",
          label: "CID",
          width: "6%",
          getValue: (u) => {
            const org = orgs?.find((o) => o.id === u.organizationId);
            return u.clientId || org?.clientId || null;
          },
          render: (u) => {
            const org = orgs?.find((o) => o.id === u.organizationId);
            const cid = u.clientId || org?.clientId || null;
            return <span className="text-muted-foreground">{cid ?? "—"}</span>;
          },
        }
      );
    }

    cols.push(
      {
        key: "role",
        label: "Role",
        width: "7%",
        getValue: (u) => u.role,
        render: (u) => (
          <span className={cn("px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border",
            u.role === "admin" ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/40")}>
            {u.role}
          </span>
        ),
      },
      {
        key: "lastLogin",
        label: "Last Login",
        width: isPlatformAdmin ? "14%" : "16%",
        getValue: (u) => u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "",
        render: (u) => <span className="text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</span>,
      }
    );

    return cols;
  }, [isPlatformAdmin, orgMap, clientMap, orgs]);

  const inactiveColumns: Column<UserRow>[] = useMemo(() => {
    const cols: Column<UserRow>[] = [
      {
        key: "name",
        label: "Name",
        width: isPlatformAdmin ? "18%" : "22%",
        getValue: (u) => u.name,
        render: (u) => <span className="font-medium">{u.name}</span>,
      },
      {
        key: "email",
        label: "Email",
        width: isPlatformAdmin ? "22%" : "32%",
        getValue: (u) => u.email,
        render: (u) => <span className="text-muted-foreground">{u.email}</span>,
      },
    ];

    if (isPlatformAdmin) {
      cols.push(
        {
          key: "partner",
          label: "Partner",
          width: "14%",
          getValue: (u) => u.clientId ? clientMap[u.clientId] || "" : "",
          render: (u) => <span className="text-muted-foreground">{u.clientId ? clientMap[u.clientId] || "—" : "—"}</span>,
        },
        {
          key: "clientId",
          label: "CID",
          width: "8%",
          getValue: (u) => u.clientId,
          render: (u) => <span className="text-muted-foreground">{u.clientId ?? "—"}</span>,
        }
      );
    }

    cols.push({
      key: "role",
      label: "Role",
      width: "8%",
      getValue: (u) => u.role,
      render: (u) => (
        <span className="px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border bg-muted/30 text-muted-foreground border-border/40">{u.role}</span>
      ),
    });

    return cols;
  }, [isPlatformAdmin, clientMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">User Management</h2>
        <div className="flex items-center gap-2">
          {/* CSV Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 px-2 sm:px-3">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>

          {/* Create User */}
          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 px-2 sm:px-3">
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Create User</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to an organization</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email <span className="text-destructive">*</span></Label>
                  <Input id="userEmail" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@hospital.org" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userName">Name <span className="text-destructive">*</span></Label>
                  <Input id="userName" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userOrg">Organization <span className="text-destructive">*</span></Label>
                  <Select value={newUserOrgId?.toString()} onValueChange={(value) => setNewUserOrgId(parseInt(value))}>
                    <SelectTrigger id="userOrg"><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {activeOrgs
                        .filter(org => {
                          const selectedClientId = isPlatformAdmin ? newUserClientId : user?.clientId;
                          if (!selectedClientId) return true;
                          return org.clientId === selectedClientId;
                        })
                        .map(org => (
                          <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userPartner">Client ID <span className="text-destructive">*</span></Label>
                  <Select
                    value={!isPlatformAdmin ? (user?.clientId?.toString() || "") : (newUserClientId?.toString() || "")}
                    onValueChange={(value) => setNewUserClientId(parseInt(value))}
                    disabled={!isPlatformAdmin}
                  >
                    <SelectTrigger id="userPartner"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients?.map(client => (
                        <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isPlatformAdmin && (
                    <p className="text-xs text-muted-foreground">Auto-assigned to your partner</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userRole">Role</Label>
                  <Select value={newUserRole} onValueChange={(value: "user" | "admin") => setNewUserRole(value)}>
                    <SelectTrigger id="userRole"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} disabled={createUserMutation.isPending} className="w-full">
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details, role, and organization assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editUserName">Name <span className="text-destructive">*</span></Label>
              <Input id="editUserName" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUserEmail">Email <span className="text-destructive">*</span></Label>
              <Input id="editUserEmail" type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} placeholder="user@hospital.org" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUserRole">Role</Label>
              <Select value={editUserRole} onValueChange={(value: "user" | "admin") => setEditUserRole(value)}>
                <SelectTrigger id="editUserRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUserOrg">Organization</Label>
              <Select value={editUserOrgId?.toString() || "none"} onValueChange={(value) => setEditUserOrgId(value === "none" ? null : parseInt(value))}>
                <SelectTrigger id="editUserOrg"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization (Partner-level)</SelectItem>
                  {activeOrgs.map(org => (
                    <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending} className="w-full">
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
            <DialogDescription>Reactivate {reactivateUserName} by assigning them to an organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reactivateOrg">Organization <span className="text-destructive">*</span></Label>
              <Select value={reactivateOrgId?.toString()} onValueChange={(value) => setReactivateOrgId(parseInt(value))}>
                <SelectTrigger id="reactivateOrg"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {activeOrgs.map(org => (
                    <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConfirmReactivate} disabled={reactivateUserMutation.isPending} className="w-full">
              {reactivateUserMutation.isPending ? "Reactivating..." : "Reactivate User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Preview Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Users from CSV</DialogTitle>
            <DialogDescription>
              Review the users to be imported. {importPreview.length} valid row(s) found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {importErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Warnings ({importErrors.length}):</p>
                <ul className="text-xs text-destructive/80 space-y-0.5">
                  {importErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                  {importErrors.length > 5 && <li>...and {importErrors.length - 5} more</li>}
                </ul>
              </div>
            )}
            {importPreview.length > 0 && (
              <div className="max-h-[300px] overflow-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 sticky top-0">
                    <tr>
                      {["Name", "Email", "Role", "Organization", "Partner"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i} className="border-t border-border/20">
                        <td className="px-3 py-1.5">{row.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.email}</td>
                        <td className="px-3 py-1.5">{row.role}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.orgName || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.partnerName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleImportConfirm}
                disabled={isImporting || importPreview.length === 0}
                className="flex-1"
              >
                {isImporting ? `Importing (${importPreview.length})...` : `Import ${importPreview.length} Users`}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Expected CSV format: <code>name,email,role,organization,partner</code> — role defaults to "user" if omitted.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Users Table */}
      <div className="mb-6">
        <AdminDataTable<UserRow>
          columns={activeColumns}
          data={activeUsers}
          getRowKey={(u) => u.id}
          title={`Active Users (${activeUsers.length})`}
          exportFilename="active-users"
          searchPlaceholder="Search users..."
          emptyMessage="No active users"
          minWidth={isPlatformAdmin ? 850 : 700}
          renderActions={(u) => (
            <div className="flex items-center gap-1">
              <button onClick={() => handleEditUser(u)}
                title="Edit"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                <Edit className="w-2.5 h-2.5" /> <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Resend invite to ${u.email}? This will queue a new invitation email.`)) {
                    resendInviteMutation.mutate({ userId: u.id });
                  }
                }}
                disabled={resendInviteMutation.isPending}
                title="Resend Invite"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                <Send className="w-2.5 h-2.5" /> <span className="hidden sm:inline">Resend Invite</span>
              </button>
              <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateUserMutation.mutate({ userId: u.id }); }}
                title="Deactivate"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 text-muted-foreground hover:bg-muted/50 transition-colors">
                <Ban className="w-2.5 h-2.5 sm:hidden shrink-0" /><span className="hidden sm:inline">Deactivate</span>
              </button>
            </div>
          )}
        />
      </div>

      {/* Inactive Users Table */}
      {inactiveUsers.length > 0 && (
        <AdminDataTable<UserRow>
          columns={inactiveColumns}
          data={inactiveUsers}
          getRowKey={(u) => u.id}
          rowClassName={() => "opacity-60"}
          title={`Inactive Users (${inactiveUsers.length})`}
          exportFilename="inactive-users"
          searchPlaceholder="Search inactive users..."
          emptyMessage="No inactive users"
          minWidth={isPlatformAdmin ? 700 : 550}
          renderActions={(u) => (
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
          )}
        />
      )}
    </>
  );
}
