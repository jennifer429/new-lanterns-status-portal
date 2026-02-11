import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { transformSectionProgress } from "@/lib/adminUtils";
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
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download, Plus, Mail, Edit, RotateCcw, LogOut, UserCircle } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Unified Admin Dashboard
 * Works for all admin roles:
 * - Platform Admin (New Lantern staff, clientId = null) → sees all partners, orgs, users
 * - Partner Admin (SRV, RadOne, etc., clientId set) → sees only their partner's orgs and users
 * Backend automatically filters data by the logged-in user's clientId.
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
  const [newUserClientId, setNewUserClientId] = useState<number | null>(null);

  // Edit user dialog state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "admin">("user");
  const [editUserOrgId, setEditUserOrgId] = useState<number | null>(null);
  const [editUserClientId, setEditUserClientId] = useState<number | null>(null);

  // Reactivate user dialog state
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);
  const [reactivateUserId, setReactivateUserId] = useState<number | null>(null);
  const [reactivateUserName, setReactivateUserName] = useState("");
  const [reactivateOrgId, setReactivateOrgId] = useState<number | undefined>();

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

  // Sorting state for organizations
  const [orgSortBy, setOrgSortBy] = useState<"name" | "completion" | "partner">("name");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc">("asc");

  // Access control: Must be an admin (any admin - platform or partner)
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  // Determine if this is a platform admin (no clientId) or partner admin
  const isPlatformAdmin = user?.clientId === null || user?.clientId === undefined;

  const { data: orgs, isLoading, refetch: refetchOrgs } = trpc.admin.getAllOrganizations.useQuery();
  // Platform admins need the full clients list; partner admins see their own client name from the query
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  // Logout mutation
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

  // Helper to get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Export All: exports all organizations, users, and metrics as CSV
  const handleExportAll = () => {
    const lines = ['Type,Name,Email,Organization,Partner,Role,Status,Completion %,Last Login'];

    // Export organizations
    orgs?.forEach(org => {
      const orgMetrics = metrics?.find(m => m.organizationId === org.id);
      const partnerName = org.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || 'N/A' : 'N/A';
      lines.push(`"Organization","${org.name}","","","${partnerName}","","${org.status}","${orgMetrics?.completionPercent || 0}%",""`);
    });

    // Export users
    allUsers?.forEach(u => {
      const org = orgs?.find(o => o.id === u.organizationId);
      const partnerName = org?.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || 'N/A' : 'N/A';
      const orgName = org?.name || 'N/A';
      const status = u.organizationId ? 'Active' : 'Inactive';
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never';
      lines.push(`"User","${u.name}","${u.email}","${orgName}","${partnerName}","${u.role}","${status}","","${lastLogin}"`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded successfully');
  };

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

    // Platform admins must select a partner; partner admins use their own clientId
    const clientIdToUse = isPlatformAdmin ? newUserClientId : user?.clientId;
    
    if (isPlatformAdmin && !clientIdToUse) {
      toast.error("Please select a partner");
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail,
      name: newUserName,
      organizationId: newUserOrgId,
      role: newUserRole,
      clientId: clientIdToUse,
    });
  };

  // Edit user mutation using trpc.users.update
  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("User updated successfully!");
      setIsEditUserDialogOpen(false);
      setEditUserId(null);
      setEditUserName("");
      setEditUserEmail("");
      setEditUserRole("user");
      setEditUserOrgId(null);
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const handleEditUser = (u: NonNullable<typeof allUsers>[number]) => {
    setEditUserId(u.id);
    setEditUserName(u.name || "");
    setEditUserEmail(u.email || "");
    setEditUserRole(u.role as "user" | "admin");
    setEditUserOrgId(u.organizationId || null);
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editUserId || !editUserName || !editUserEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateUserMutation.mutate({
      id: editUserId,
      name: editUserName,
      email: editUserEmail,
      role: editUserRole,
      organizationId: editUserOrgId,
    });
  };

  // Reactivate user mutation
  const reactivateUserMutation = trpc.admin.reactivateUser.useMutation({
    onSuccess: () => {
      toast.success("User reactivated successfully!");
      setIsReactivateDialogOpen(false);
      setReactivateUserId(null);
      setReactivateUserName("");
      setReactivateOrgId(undefined);
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reactivate user");
    },
  });

  const handleReactivateUser = (u: NonNullable<typeof allUsers>[number]) => {
    setReactivateUserId(u.id);
    setReactivateUserName(u.name || "Unknown");
    setReactivateOrgId(undefined);
    setIsReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = () => {
    if (!reactivateUserId || !reactivateOrgId) {
      toast.error("Please select an organization");
      return;
    }

    reactivateUserMutation.mutate({
      userId: reactivateUserId,
      organizationId: reactivateOrgId,
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
      toast.success("Organization deactivated");
      refetchOrgs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to deactivate organization");
    },
  });

  const reactivateOrgMutation = trpc.admin.reactivateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization reactivated");
      refetchOrgs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reactivate organization");
    },
  });

  const markCompleteMutation = trpc.admin.markOrganizationComplete.useMutation({
    onSuccess: () => {
      toast.success("Organization marked as complete");
      refetchOrgs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark organization as complete");
    },
  });

  const reopenOrgMutation = trpc.admin.reopenOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization reopened");
      refetchOrgs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reopen organization");
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
      refetchOrgs(); // Refresh organization list to show updated name
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
  // For partner admins who can't fetch all clients, build from org data
  const clientMap = isPlatformAdmin
    ? (clients?.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<number, string>) || {})
    : (orgs?.reduce((acc, o) => {
        if (o.clientId && !acc[o.clientId]) {
          // Derive partner name from the user context or org data
          acc[o.clientId] = user?.clientId === o.clientId ? getPartnerDisplayName(user) : `Partner ${o.clientId}`;
        }
        return acc;
      }, {} as Record<number, string>) || {});

  // Create a map of organizationId -> organization name
  const orgMap = orgs?.reduce((acc, o) => {
    acc[o.id] = o.name;
    return acc;
  }, {} as Record<number, string>) || {};

  // Sort function for organizations
  const sortOrgs = (orgList: typeof orgs) => {
    if (!orgList) return [];
    
    return [...orgList].sort((a, b) => {
      let compareValue = 0;
      
      if (orgSortBy === "name") {
        compareValue = a.name.localeCompare(b.name);
      } else if (orgSortBy === "completion") {
        const aCompletion = metricsMap[a.id]?.completionPercent || 0;
        const bCompletion = metricsMap[b.id]?.completionPercent || 0;
        compareValue = aCompletion - bCompletion;
      } else if (orgSortBy === "partner") {
        const aPartner = a.clientId ? clientMap[a.clientId] || "" : "";
        const bPartner = b.clientId ? clientMap[b.clientId] || "" : "";
        compareValue = aPartner.localeCompare(bPartner);
      }
      
      return orgSortOrder === "asc" ? compareValue : -compareValue;
    });
  };

  const activeOrgs = sortOrgs(orgs?.filter(o => o.status === "active"));
  const completedOrgs = sortOrgs(orgs?.filter(o => o.status === "completed"));
  const inactiveOrgs = sortOrgs(orgs?.filter(o => o.status === "inactive" || o.status === "paused"));
  
  // Separate active and inactive users based on isActive field
  // isActive: 1 = active, 0 = deactivated (works for all user types including admins)
  const activeUsers = allUsers?.filter(u => u.isActive === 1) || [];
  const inactiveUsers = allUsers?.filter(u => u.isActive === 0) || [];

  // Dynamic header based on user's role
  const headerTitle = isPlatformAdmin ? "Platform Admin" : `${getPartnerDisplayName(user)} Admin`;
  const headerSubtitle = isPlatformAdmin ? "New Lantern - All Partners" : `Manage your organizations`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-12" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">{headerTitle}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {headerSubtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Export All Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAll}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export All
              </Button>

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-10 rounded-full bg-purple-600 border-purple-400 hover:bg-purple-500 text-white font-semibold"
                  >
                    {user?.name ? getInitials(user.name) : "AD"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name || "Admin"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={handleExportAll}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export All Data
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

                  // Convert sectionProgress using shared utility
                  const sectionProgress = transformSectionProgress(orgMetrics?.sectionProgress);

                  return (
                    <Card key={org.id} className="border-2 border-primary/30 bg-gradient-to-b from-card to-card/50">
                      <CardContent className="p-6">
                        {/* Header with Organization Name and Partner Badge */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <ClipboardList className="w-6 h-6 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-bold truncate">{org.name}</h3>
                              {isPlatformAdmin && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {partnerName}
                                </Badge>
                              )}
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

                            {/* Section List - Show all sections */}
                              <div className="space-y-2 mb-4">
                                {sectionProgress.map((section, index) => (
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
                {orgMetrics?.files.map((file) => (
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
                    {isPlatformAdmin && (
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
                    )}
                    <Button
                      onClick={() => {
                        // For partner admins, auto-assign their clientId
                        const clientId = isPlatformAdmin ? newOrgClientId : user?.clientId;
                        if (!newOrgName || !newOrgSlug || !clientId) {
                          toast.error("Please fill in all required fields");
                          return;
                        }
                        createOrgMutation.mutate({
                          name: newOrgName,
                          slug: newOrgSlug,
                          clientId: clientId,
                        });
                      }}
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

            {/* Sorting Controls */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-sm font-medium">Sort by:</Label>
                <Select value={orgSortBy} onValueChange={(value: "name" | "completion" | "partner") => setOrgSortBy(value)}>
                  <SelectTrigger id="sort-by" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="completion">Completion %</SelectItem>
                    {isPlatformAdmin && <SelectItem value="partner">Partner</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-order" className="text-sm font-medium">Order:</Label>
                <Select value={orgSortOrder} onValueChange={(value: "asc" | "desc") => setOrgSortOrder(value)}>
                  <SelectTrigger id="sort-order" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4">Active Organizations ({activeOrgs.length})</h3>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {isPlatformAdmin && <TableHead>Partner</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOrgs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isPlatformAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
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
                          {isPlatformAdmin && <TableCell>{partnerName}</TableCell>}
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
                                onClick={() => {
                                  if (confirm(`Mark ${org.name} as complete?`)) {
                                    markCompleteMutation.mutate({ organizationId: org.id });
                                  }
                                }}
                                disabled={markCompleteMutation.isPending}
                                className="bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Mark Complete
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

            {/* Completed Organizations Section */}
            {completedOrgs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4">Completed Organizations ({completedOrgs.length})</h3>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        {isPlatformAdmin && <TableHead>Partner</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedOrgs.map(org => {
                        const orgMetrics = metricsMap[org.id];
                        const partnerName = org.clientId ? clientMap[org.clientId] : "N/A";
                        const completionPercent = orgMetrics?.completionPercent || 0;
                        const userCount = orgMetrics?.userCount || 0;
                        
                        return (
                          <TableRow key={org.id} className="opacity-75">
                            <TableCell className="font-medium">{org.name}</TableCell>
                            {isPlatformAdmin && <TableCell>{partnerName}</TableCell>}
                            <TableCell>
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                Completed
                              </Badge>
                            </TableCell>
                            <TableCell>{userCount}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{completionPercent}%</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  if (confirm(`Reopen ${org.name}?`)) {
                                    reopenOrgMutation.mutate({ organizationId: org.id });
                                  }
                                }}
                                disabled={reopenOrgMutation.isPending}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reopen
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}

            {/* Deactivated Organizations Section */}
            {inactiveOrgs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4">Deactivated Organizations ({inactiveOrgs.length})</h3>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        {isPlatformAdmin && <TableHead>Partner</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveOrgs.map(org => {
                        const partnerName = org.clientId ? clientMap[org.clientId] : "N/A";
                        
                        return (
                          <TableRow key={org.id} className="opacity-60">
                            <TableCell className="font-medium">{org.name}</TableCell>
                            {isPlatformAdmin && <TableCell>{partnerName}</TableCell>}
                            <TableCell>
                              <Badge variant="secondary">Deactivated</Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  if (confirm(`Reactivate ${org.name}?`)) {
                                    reactivateOrgMutation.mutate({ organizationId: org.id });
                                  }
                                }}
                                disabled={reactivateOrgMutation.isPending}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reactivate
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}
          </>
        )}

        {activeTab === "users" && (
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
                          {activeOrgs.map(org => (
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
            <Card className="mb-8">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Active Users ({activeUsers.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Organization</TableHead>
                      {isPlatformAdmin && <TableHead>Partner</TableHead>}
                      {isPlatformAdmin && <TableHead>Client ID</TableHead>}
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeUsers.map(u => {
                      const org = orgs?.find(o => o.id === u.organizationId);
                      // For admins without org, use their direct clientId; for regular users, use org's clientId
                      const userClientId = u.clientId || org?.clientId || null;
                      const partner = userClientId ? clientMap[userClientId] : "N/A";
                      
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{orgMap[u.organizationId || 0] || "N/A"}</TableCell>
                          {isPlatformAdmin && <TableCell>{partner}</TableCell>}
                          {isPlatformAdmin && <TableCell>{userClientId ?? "N/A"}</TableCell>}
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
                                onClick={() => handleEditUser(u)}
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
                        {isPlatformAdmin && <TableHead>Partner</TableHead>}
                        {isPlatformAdmin && <TableHead>Client ID</TableHead>}
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveUsers.map(u => {
                        const partner = u.clientId ? clientMap[u.clientId] : "N/A";
                        
                        return (
                          <TableRow key={u.id} className="opacity-60">
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            {isPlatformAdmin && <TableCell>{partner}</TableCell>}
                            {isPlatformAdmin && <TableCell>{u.clientId ?? "N/A"}</TableCell>}
                            <TableCell>
                              <Badge variant="secondary">{u.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleReactivateUser(u)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
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

/**
 * Helper to get a display name for the partner based on user context.
 * Maps known clientIds to display names.
 */
function getPartnerDisplayName(user: any): string {
  if (!user?.clientId) return "Platform";
  // Known partner mappings
  const partnerNames: Record<number, string> = {
    1: "RadOne",
    2: "SRV",
  };
  return partnerNames[user.clientId] || `Partner ${user.clientId}`;
}
