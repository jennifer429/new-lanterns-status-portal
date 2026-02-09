import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download, Plus, Mail, Edit } from "lucide-react";
import { toast } from "sonner";

/**
 * Platform Admin Dashboard - New Lantern staff only (@newlantern.ai)
 * Tabbed interface: Organizations | Users
 */
export default function PlatformAdmin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "organizations" | "users">("dashboard");
  
  // User creation dialog state
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserOrgId, setNewUserOrgId] = useState<number | undefined>();
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  // Access control: Only New Lantern staff (clientId = NULL)
  useEffect(() => {
    if (!authLoading && (!user || user.clientId !== null)) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const { data: orgs, isLoading } = trpc.admin.getAllOrganizations.useQuery();
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully!");
      setIsCreateUserDialogOpen(false);
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Create a map of organizationId -> metrics for quick lookup
  const metricsMap = metrics?.reduce((acc, m) => {
    acc[m.organizationId] = m;
    return acc;
  }, {} as Record<number, typeof metrics[number]>) || {};

  // Create a map of clientId -> client name
  const clientMap = clients?.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {} as Record<number, string>) || {};

  // Create a map of organizationId -> organization name
  const orgMap = orgs?.reduce((acc, o) => {
    acc[o.id] = o.name;
    return acc;
  }, {} as Record<number, string>) || {};

  const activeOrgs = orgs?.filter(o => o.status === "active") || [];
  const activeUsers = allUsers || [];
  const inactiveUsers: typeof allUsers = [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-12" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Platform Admin</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  New Lantern - All Partners
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === "organizations" && (
                <Button onClick={() => setLocation("/org/admin/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              )}
              {activeTab === "users" && (
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
                            {activeOrgs.map(org => (
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
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-6 mt-6 border-b border-border">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`pb-3 px-1 font-medium transition-colors relative ${
                activeTab === "dashboard"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Dashboard
              {activeTab === "dashboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("organizations")}
              className={`pb-3 px-1 font-medium transition-colors relative ${
                activeTab === "organizations"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Organizations
              {activeTab === "organizations" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 px-1 font-medium transition-colors relative ${
                activeTab === "users"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Users
              {activeTab === "users" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {activeTab === "dashboard" && (
          <>
            <h2 className="text-2xl font-bold mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Organizations</p>
                      <p className="text-3xl font-bold">{activeOrgs.length}</p>
                    </div>
                    <ClipboardList className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                      <p className="text-3xl font-bold">{activeUsers.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Completion</p>
                      <p className="text-3xl font-bold">
                        {Math.round(
                          (metrics?.reduce((sum, m) => sum + m.completionPercent, 0) || 0) /
                          (metrics?.length || 1)
                        )}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Activity feed coming soon...</p>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "organizations" && (
          <>
            <h2 className="text-2xl font-bold mb-6">Active Organizations ({activeOrgs.length})</h2>
            
            {/* Organization Portal Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeOrgs.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No active organizations
                </div>
              ) : (
                activeOrgs.map(org => {
                  const orgMetrics = metricsMap[org.id];
                  const partnerName = org.clientId ? clientMap[org.clientId] : "Unknown";
                  const completionPercent = orgMetrics?.completionPercent || 0;
                  const userCount = orgMetrics?.userCount || 0;
                  const fileCount = orgMetrics?.files?.length || 0;
                  const sectionProgress = orgMetrics?.sectionProgress || {};

                  // Get sections that are in progress (> 0% but < 100%)
                  const inProgressSections = Object.entries(sectionProgress)
                    .filter(([_, percent]) => percent > 0 && percent < 100)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2);

                  return (
                    <Card key={org.id} className="relative">
                      <CardContent className="p-6">
                        {/* Organization Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <ClipboardList className="w-5 h-5 text-primary" />
                            <div>
                              <h3 className="font-semibold text-lg">{org.name}</h3>
                              <p className="text-sm text-muted-foreground">{partnerName}</p>
                            </div>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{completionPercent}%</div>
                            <div className="text-xs text-muted-foreground">Complete</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{userCount}</div>
                            <div className="text-xs text-muted-foreground">Users</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{fileCount}</div>
                            <div className="text-xs text-muted-foreground">Files</div>
                          </div>
                        </div>

                        {/* Overall Progress */}
                        <div className="mb-4">
                          <div className="text-sm font-medium mb-2">Overall Progress</div>
                          <div className="text-xs text-muted-foreground mb-2">0 of 9 sections complete</div>
                          <div className="bg-primary/10 rounded-lg p-6 text-center">
                            <div className="text-5xl font-bold text-primary mb-1">{completionPercent}%</div>
                            <div className="text-sm text-muted-foreground">Complete</div>
                          </div>
                        </div>

                        {/* Section Progress */}
                        {inProgressSections.length > 0 && (
                          <div className="mb-4">
                            {inProgressSections.map(([sectionId, percent]) => (
                              <div key={sectionId} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                  <Circle className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm capitalize">{sectionId.replace(/([A-Z])/g, ' $1').trim()}</span>
                                </div>
                                <span className="text-sm font-medium">{percent}%</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mb-4">In Progress</div>

                        {/* Uploaded Files */}
                        <div className="mb-4">
                          <div className="text-sm font-medium mb-2">Uploaded Files:</div>
                          {fileCount > 0 ? (
                            <div className="text-sm text-muted-foreground">{fileCount} files uploaded</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No files uploaded yet</div>
                          )}
                        </div>

                        {/* Last Login */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                          <Activity className="w-3 h-3" />
                          <span>Last login: about 5 hours ago</span>
                        </div>

                        {/* Open Portal Button */}
                        <Button
                          className="w-full"
                          onClick={() => setLocation(`/org/${org.slug}/intake`)}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Portal
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === "users" && (
          <>
            <h2 className="text-2xl font-bold mb-6">User Management</h2>

            {/* Active Users Table */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Active Users ({activeUsers.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeUsers.map(u => {
                      const org = orgs?.find(o => o.id === u.organizationId);
                      const partner = org?.clientId ? clientMap[org.clientId] : "N/A";
                      
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{orgMap[u.organizationId || 0] || "N/A"}</TableCell>
                          <TableCell>{partner}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button size="sm" variant="outline">
                                Deactivate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Inactive Users Table */}
            {inactiveUsers.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Inactive Users ({inactiveUsers.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveUsers.map(u => {
                        const org = orgs?.find(o => o.id === u.organizationId);
                        const partner = org?.clientId ? clientMap[org.clientId] : "N/A";
                        
                        return (
                          <TableRow key={u.id} className="opacity-60">
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{orgMap[u.organizationId || 0] || "N/A"}</TableCell>
                            <TableCell>{partner}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{u.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                Reactivate
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
