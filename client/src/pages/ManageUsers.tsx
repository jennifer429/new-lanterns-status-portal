import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, ArrowLeft, Mail } from "lucide-react";

interface ManageUsersProps {
  partnerName?: string; // "SRV" or "RadOne" for partner admins, undefined for platform admins
}

/**
 * User Management Page
 * - Platform admins can manage users across all organizations
 * - Partner admins can only manage users for their partner's organizations
 */
export default function ManageUsers({ partnerName }: ManageUsersProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserOrgId, setNewUserOrgId] = useState<number | undefined>();
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  // Get organizations (filtered by clientId for partner admins)
  const { data: orgs } = trpc.admin.getAllOrganizations.useQuery();
  
  // Get all users for the organizations
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully! They will receive an email with login instructions.");
      setIsCreateDialogOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserOrgId(undefined);
      setNewUserRole("user");
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserName || !newUserOrgId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail,
      name: newUserName,
      organizationId: newUserOrgId,
      role: newUserRole,
      clientId: user?.clientId || null,
    });
  };

  // Group users by organization
  const usersByOrg = allUsers?.reduce((acc: any, user: any) => {
    const orgId = user.organizationId;
    if (!orgId) return acc;
    if (!acc[orgId]) acc[orgId] = [];
    acc[orgId].push(user);
    return acc;
  }, {} as Record<number, typeof allUsers>);

  const backUrl = partnerName ? `/org/${partnerName}/admin` : "/org/admin";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(backUrl)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {partnerName ? `${partnerName} Users` : "All Users"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage user access and permissions
                </p>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
                        {orgs?.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="userRole">Role</Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(value) => setNewUserRole(value as "user" | "admin")}
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

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateUser}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Stats Card */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {orgs?.length || 0} organizations
            </p>
          </CardContent>
        </Card>

        {/* Users by Organization */}
        <div className="space-y-6">
          {orgs?.map((org) => {
            const orgUsers = usersByOrg?.[org.id] || [];
            return (
              <Card key={org.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{org.name}</CardTitle>
                      <CardDescription>
                        {orgUsers.length} {orgUsers.length === 1 ? "user" : "users"}
                      </CardDescription>
                    </div>
                    <Badge variant={org.status === "active" ? "default" : "secondary"}>
                      {org.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {orgUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No users yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orgUsers.map((user: any) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{user.name || "No name"}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={user.role === "admin" ? "default" : "outline"}>
                              {user.role}
                            </Badge>
                            {user.lastLoginAt && (
                              <p className="text-xs text-muted-foreground">
                                Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
