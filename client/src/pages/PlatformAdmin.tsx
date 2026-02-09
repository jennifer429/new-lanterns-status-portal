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
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "organizations">("dashboard");
  
  // User creation dialog state
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserOrgId, setNewUserOrgId] = useState<number | undefined>();
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  // Organization management state
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgClientId, setNewOrgClientId] = useState<number | undefined>();
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false);
  const [editOrgId, setEditOrgId] = useState<number | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editOrgClientId, setEditOrgClientId] = useState<number | null>(null);

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

  const createOrgMutation = trpc.admin.createOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization created successfully!");
      setIsCreateOrgDialogOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgClientId(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const deactivateOrgMutation = trpc.admin.deactivateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization deactivated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to deactivate organization");
    },
  });

  const deactivateUserMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => {
      toast.success("User deactivated successfully!");
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to deactivate user");
    },
  });

  const updateOrgMutation = trpc.admin.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization updated successfully!");
      setIsEditOrgDialogOpen(false);
      setEditOrgId(null);
      setEditOrgName("");
      setEditOrgSlug("");
      setEditOrgClientId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update organization");
    },
  });

  const handleCreateOrg = () => {
    if (!newOrgName || !newOrgSlug || !newOrgClientId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createOrgMutation.mutate({
      name: newOrgName,
      slug: newOrgSlug,
      clientId: newOrgClientId,
    });
  };

  const handleDeactivateOrg = (orgId: number) => {
    if (confirm("Are you sure you want to deactivate this organization?")) {
      deactivateOrgMutation.mutate({ organizationId: orgId });
    }
  };

  const handleEditOrg = (org: NonNullable<typeof orgs>[number]) => {
    setEditOrgId(org.id);
    setEditOrgName(org.name);
    setEditOrgSlug(org.slug);
    setEditOrgClientId(org.clientId);
    setIsEditOrgDialogOpen(true);
  };

  const handleUpdateOrg = () => {
    if (!editOrgId || !editOrgName || !editOrgSlug || !editOrgClientId) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateOrgMutation.mutate({
      id: editOrgId,
      name: editOrgName,
      slug: editOrgSlug,
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {activeTab === "dashboard" && (
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
                  const sectionsComplete = orgMetrics?.sectionsComplete || 0;
                  const totalSections = 9;
                  const filesCount = orgMetrics?.files.length || 0;
                  const userCount = orgMetrics?.userCount || 0;

                  // Get section progress
                  const sectionProgress = [
                    { name: "Organization Information", progress: orgMetrics?.sectionProgress?.organizationInfo || 0 },
                    { name: "Orders Workflow", progress: orgMetrics?.sectionProgress?.ordersWorkflow || 0 },
                    { name: "Images Workflow", progress: orgMetrics?.sectionProgress?.imagesWorkflow || 0 },
                    { name: "Priors Workflow", progress: orgMetrics?.sectionProgress?.priorsWorkflow || 0 },
                    { name: "Reports Out", progress: orgMetrics?.sectionProgress?.reportsOutWorkflow || 0 },
                    { name: "Data & Integration", progress: orgMetrics?.sectionProgress?.dataIntegration || 0 },
                    { name: "Configuration Files", progress: orgMetrics?.sectionProgress?.configurationFiles || 0 },
                    { name: "VPN & Connectivity", progress: orgMetrics?.sectionProgress?.vpnConnectivity || 0 },
                    { name: "HL7 Configuration", progress: orgMetrics?.sectionProgress?.hl7Configuration || 0 },
                  ];

                  // Show only sections in progress (> 0%)
                  const inProgressSections = sectionProgress.filter(s => s.progress > 0);

                  return (
                    <Card key={org.id} className="border-2 border-primary/30 bg-gradient-to-b from-card to-card/50">
                      <CardContent className="p-6">
                        {/* Header with Organization Name and Partner Badge */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <ClipboardList className="w-6 h-6 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-bold truncate">{org.name}</h3>
                              <Badge variant="outline" className="text-xs mt-1">
                                {partnerName}
                              </Badge>
                            </div>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="text-xl font-bold">{completionPercent}%</div>
                              <div className="text-xs text-muted-foreground">Complete</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="text-xl font-bold">{userCount}</div>
                              <div className="text-xs text-muted-foreground">Users</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="text-xl font-bold">{filesCount}</div>
                              <div className="text-xs text-muted-foreground">Files</div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-border/50 pt-4">
                          {/* Overall Progress Section */}
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold mb-1">Overall Progress</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                              {sectionsComplete} of {totalSections} sections complete
                            </p>

                            {/* Big Percentage Box */}
                            <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 mb-4">
                              <div className="text-5xl font-bold text-primary mb-1">
                                {completionPercent}%
                              </div>
                              <div className="text-sm text-muted-foreground">Complete</div>
                            </div>

                            {/* Section List - Only show sections in progress */}
                            {inProgressSections.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {inProgressSections.map((section, index) => (
                                  <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {section.progress === 100 ? (
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-muted-foreground" />
                                      )}
                                      <span className="text-xs">{section.name}</span>
                                    </div>
                                    <span className="text-xs font-bold">{section.progress}%</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Status */}
                            <div className="text-xs text-muted-foreground mb-4">
                              In Progress
                            </div>
                          </div>

                          {/* Uploaded Files Section */}
                          <div className="border-t border-border/50 pt-4 mb-4">
                            <h5 className="text-xs font-semibold mb-2">Uploaded Files:</h5>
                            {filesCount === 0 ? (
                              <p className="text-xs text-muted-foreground">No files uploaded yet</p>
                            ) : (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {orgMetrics?.files.slice(0, 3).map((file) => (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    download
                                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span className="truncate">{file.fileName}</span>
                                  </a>
                                ))}
                                {filesCount > 3 && (
                                  <p className="text-xs text-muted-foreground">+{filesCount - 3} more files</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Open Portal Button */}
                          <Button 
                            size="lg" 
                            className="w-full"
                            onClick={() => setLocation(`/org/${org.slug}/intake`)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open Portal
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === "organizations" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Organization Management</h2>
              <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>
                      Add a new hospital or healthcare organization to the onboarding portal.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="Memorial General Hospital"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="org-slug">URL Slug</Label>
                      <Input
                        id="org-slug"
                        placeholder="memorial-general"
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="org-partner">Partner</Label>
                      <Select value={newOrgClientId?.toString()} onValueChange={(val) => setNewOrgClientId(parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(clientMap).map(([id, name]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateOrg}
                      disabled={createOrgMutation.isPending}
                      className="w-full"
                    >
                      {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Organization Dialog */}
              <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                    <DialogDescription>
                      Update organization details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="edit-org-name">Organization Name</Label>
                      <Input
                        id="edit-org-name"
                        placeholder="Memorial General Hospital"
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-org-slug">URL Slug</Label>
                      <Input
                        id="edit-org-slug"
                        placeholder="memorial-general"
                        value={editOrgSlug}
                        onChange={(e) => setEditOrgSlug(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateOrg}
                      disabled={updateOrgMutation.isPending}
                      className="w-full"
                    >
                      {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <h3 className="text-lg font-semibold mb-4">Active Organizations ({activeOrgs.length})</h3>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOrgs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No active organizations
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeOrgs.map(org => {
                      const orgMetrics = metricsMap[org.id];
                      const partnerName = org.clientId ? clientMap[org.clientId] : "N/A";
                      const completionPercent = orgMetrics?.completionPercent || 0;
                      const userCount = orgMetrics?.userCount || 0;

                      return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell>{partnerName}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell>{userCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{completionPercent}%</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditOrgId(org.id);
                                  setEditOrgName(org.name);
                                  setEditOrgSlug(org.slug);
                                  setEditOrgClientId(org.clientId);
                                  setIsEditOrgDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeactivateOrg(org.id)}
                                disabled={deactivateOrgMutation.isPending}
                              >
                                Deactivate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
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
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toast.info("Edit user functionality coming soon")}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  if (confirm(`Deactivate user ${u.name}?`)) {
                                    deactivateUserMutation.mutate({ userId: u.id });
                                  }
                                }}
                              >
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
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toast.info("Reactivate user functionality coming soon")}
                              >
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
