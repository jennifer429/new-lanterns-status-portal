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
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download, Upload, Plus, Mail, Edit, RotateCcw, LogOut, UserCircle, FileUp } from "lucide-react";
import { questionnaireSections } from "@shared/questionnaireData";
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "organizations" | "templates" | "partners" | "specs">("dashboard");

  // Template management state
  const [isUploadTemplateDialogOpen, setIsUploadTemplateDialogOpen] = useState(false);
  const [templateClientId, setTemplateClientId] = useState<number | undefined>();
  const [templateQuestionId, setTemplateQuestionId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isReplaceTemplateDialogOpen, setIsReplaceTemplateDialogOpen] = useState(false);
  const [replaceTemplateId, setReplaceTemplateId] = useState<number | null>(null);
  const [replaceTemplateFile, setReplaceTemplateFile] = useState<File | null>(null);
  const [replaceTemplateLabel, setReplaceTemplateLabel] = useState("");
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false);
  
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

  // Partner management state
  const [isCreatePartnerDialogOpen, setIsCreatePartnerDialogOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerSlug, setNewPartnerSlug] = useState("");
  const [newPartnerDescription, setNewPartnerDescription] = useState("");
  const [isEditPartnerDialogOpen, setIsEditPartnerDialogOpen] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<number | null>(null);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerSlug, setEditPartnerSlug] = useState("");
  const [editPartnerDescription, setEditPartnerDescription] = useState("");

  // Specifications management state
  const [isUploadSpecDialogOpen, setIsUploadSpecDialogOpen] = useState(false);
  const [specTitle, setSpecTitle] = useState("");
  const [specDescription, setSpecDescription] = useState("");
  const [specCategory, setSpecCategory] = useState("");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [isEditSpecDialogOpen, setIsEditSpecDialogOpen] = useState(false);
  const [editSpecId, setEditSpecId] = useState<number | null>(null);
  const [editSpecTitle, setEditSpecTitle] = useState("");
  const [editSpecDescription, setEditSpecDescription] = useState("");
  const [editSpecCategory, setEditSpecCategory] = useState("");

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
  const { data: templates, refetch: refetchTemplates } = trpc.admin.getTemplates.useQuery();
  const { data: inactiveTemplates, refetch: refetchInactiveTemplates } = trpc.admin.getInactiveTemplates.useQuery();
  const { data: specs, refetch: refetchSpecs } = trpc.admin.getSpecifications.useQuery();

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
  // Helper to escape CSV field values (handles commas, quotes, newlines)
  const csvEscape = (value: string | number | null | undefined): string => {
    const str = String(value ?? '');
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportAll = () => {
    const lines = ['Type,Name,Email,Organization,Partner,Role,Status,Completion %,Last Login'];

    // Export organizations
    orgs?.forEach(org => {
      const orgMetrics = metrics?.find(m => m.organizationId === org.id);
      const partnerName = org.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || 'N/A' : 'N/A';
      lines.push([csvEscape('Organization'), csvEscape(org.name), '', '', csvEscape(partnerName), '', csvEscape(org.status), `${orgMetrics?.completionPercent || 0}%`, ''].join(','));
    });

    // Export users
    allUsers?.forEach(u => {
      const org = orgs?.find(o => o.id === u.organizationId);
      const partnerName = org?.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || 'N/A' : 'N/A';
      const orgName = org?.name || 'N/A';
      const status = u.organizationId ? 'Active' : 'Inactive';
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never';
      lines.push([csvEscape('User'), csvEscape(u.name), csvEscape(u.email), csvEscape(orgName), csvEscape(partnerName), csvEscape(u.role), csvEscape(status), '', csvEscape(lastLogin)].join(','));
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
    if (!newUserEmail || !newUserName) {
      toast.error("Please fill in email and name");
      return;
    }

    // Regular users must have an organization
    if (newUserRole === "user" && !newUserOrgId) {
      toast.error("Organization is required for non-admin users");
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
      organizationId: newUserOrgId || undefined,
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
    setEditUserClientId(u.clientId || null);
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
      clientId: editUserClientId,
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
      refetchOrgs();
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

  // Template mutations
  const uploadTemplateMutation = trpc.admin.uploadTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template uploaded successfully!");
      setIsUploadTemplateDialogOpen(false);
      setTemplateClientId(undefined);
      setTemplateQuestionId("");
      setTemplateLabel("");
      setTemplateFile(null);
      refetchTemplates();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload template");
    },
  });

  const replaceTemplateMutation = trpc.admin.replaceTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template replaced successfully!");
      setIsReplaceTemplateDialogOpen(false);
      setReplaceTemplateId(null);
      setReplaceTemplateFile(null);
      setReplaceTemplateLabel("");
      refetchTemplates();
      refetchInactiveTemplates();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to replace template");
    },
  });

  // Build list of questions that support templates (upload-download and upload types)
  const templateQuestions = questionnaireSections.flatMap(section =>
    (section.questions || []).filter(q => q.type === 'upload-download' || q.type === 'upload').map(q => ({
      id: q.id,
      text: q.text,
      sectionTitle: section.title,
    }))
  );

  const handleUploadTemplate = async () => {
    const clientIdToUse = isPlatformAdmin ? templateClientId : user?.clientId;
    if (!clientIdToUse || !templateQuestionId || !templateLabel || !templateFile) {
      toast.error("Please fill in all required fields and select a file");
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadTemplateMutation.mutate({
        clientId: clientIdToUse,
        questionId: templateQuestionId,
        label: templateLabel,
        fileName: templateFile.name,
        fileData: base64,
        mimeType: templateFile.type || 'application/octet-stream',
      });
    };
    reader.readAsDataURL(templateFile);
  };

  const handleReplaceTemplate = async () => {
    if (!replaceTemplateId || !replaceTemplateFile || !replaceTemplateLabel) {
      toast.error("Please provide a label and select a new file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      replaceTemplateMutation.mutate({
        id: replaceTemplateId,
        label: replaceTemplateLabel,
        fileName: replaceTemplateFile.name,
        fileData: base64,
        mimeType: replaceTemplateFile.type || 'application/octet-stream',
      });
    };
    reader.readAsDataURL(replaceTemplateFile);
  };

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

  // Partner mutations
  const createClientMutation = trpc.admin.createClient.useMutation({
    onSuccess: () => {
      toast.success("Partner created successfully!");
      setIsCreatePartnerDialogOpen(false);
      setNewPartnerName("");
      setNewPartnerSlug("");
      setNewPartnerDescription("");
      refetchOrgs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create partner");
    },
  });

  const updateClientMutation = trpc.admin.updateClient.useMutation({
    onSuccess: () => {
      toast.success("Partner updated successfully!");
      setIsEditPartnerDialogOpen(false);
      setEditPartnerId(null);
      refetchOrgs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update partner");
    },
  });

  const deactivateClientMutation = trpc.admin.deactivateClient.useMutation({
    onSuccess: () => {
      toast.success("Partner deactivated");
      refetchOrgs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to deactivate partner");
    },
  });

  const reactivateClientMutation = trpc.admin.reactivateClient.useMutation({
    onSuccess: () => {
      toast.success("Partner reactivated");
      refetchOrgs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reactivate partner");
    },
  });

  const handleCreatePartner = () => {
    if (!newPartnerName || !newPartnerSlug) {
      toast.error("Please fill in name and slug");
      return;
    }
    createClientMutation.mutate({
      name: newPartnerName,
      slug: newPartnerSlug,
      description: newPartnerDescription || undefined,
    });
  };

  const handleEditPartner = (client: NonNullable<typeof clients>[number]) => {
    setEditPartnerId(client.id);
    setEditPartnerName(client.name);
    setEditPartnerSlug(client.slug);
    setEditPartnerDescription(client.description || "");
    setIsEditPartnerDialogOpen(true);
  };

  const handleUpdatePartner = () => {
    if (!editPartnerId || !editPartnerName || !editPartnerSlug) {
      toast.error("Please fill in name and slug");
      return;
    }
    updateClientMutation.mutate({
      id: editPartnerId,
      name: editPartnerName,
      slug: editPartnerSlug,
      description: editPartnerDescription || undefined,
    });
  };

  const handleDeactivatePartner = (id: number) => {
    if (confirm("Are you sure you want to deactivate this partner? This will not affect their organizations.")) {
      deactivateClientMutation.mutate({ id });
    }
  };

  const handleReactivatePartner = (id: number) => {
    reactivateClientMutation.mutate({ id });
  };

  // Specifications mutations
  const uploadSpecMutation = trpc.admin.uploadSpecification.useMutation({
    onSuccess: () => {
      toast.success("Specification uploaded successfully!");
      setIsUploadSpecDialogOpen(false);
      setSpecTitle("");
      setSpecDescription("");
      setSpecCategory("");
      setSpecFile(null);
      refetchSpecs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload specification");
    },
  });

  const updateSpecMutation = trpc.admin.updateSpecification.useMutation({
    onSuccess: () => {
      toast.success("Specification updated!");
      setIsEditSpecDialogOpen(false);
      setEditSpecId(null);
      refetchSpecs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update specification");
    },
  });

  const deactivateSpecMutation = trpc.admin.deactivateSpecification.useMutation({
    onSuccess: () => {
      toast.success("Specification removed");
      refetchSpecs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove specification");
    },
  });

  const handleUploadSpec = async () => {
    if (!specTitle || !specFile) {
      toast.error("Please provide a title and file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadSpecMutation.mutate({
        title: specTitle,
        description: specDescription || undefined,
        category: specCategory || undefined,
        fileName: specFile.name,
        fileData: base64,
        mimeType: specFile.type,
      });
    };
    reader.readAsDataURL(specFile);
  };

  const handleEditSpec = (spec: NonNullable<typeof specs>[number]) => {
    setEditSpecId(spec.id);
    setEditSpecTitle(spec.title);
    setEditSpecDescription(spec.description || "");
    setEditSpecCategory(spec.category || "");
    setIsEditSpecDialogOpen(true);
  };

  const handleUpdateSpec = () => {
    if (!editSpecId || !editSpecTitle) {
      toast.error("Please provide a title");
      return;
    }
    updateSpecMutation.mutate({
      id: editSpecId,
      title: editSpecTitle,
      description: editSpecDescription || undefined,
      category: editSpecCategory || undefined,
    });
  };

  const handleDeactivateSpec = (id: number) => {
    if (confirm("Are you sure you want to remove this specification? Clients will no longer see it.")) {
      deactivateSpecMutation.mutate({ id });
    }
  };

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
      clientId: editOrgClientId,
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
          acc[o.clientId] = user?.clientId === o.clientId ? getPartnerDisplayName(user, clients) : `Partner ${o.clientId}`;
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
  const headerTitle = isPlatformAdmin ? "Platform Admin" : `${getPartnerDisplayName(user, clients)} Admin`;
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
            <button
              onClick={() => setActiveTab("templates")}
              className={`pb-3 px-1 font-medium transition-colors relative ${
                activeTab === "templates"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Templates
              {activeTab === "templates" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            {isPlatformAdmin && (
              <button
                onClick={() => setActiveTab("partners")}
                className={`pb-3 px-1 font-medium transition-colors relative ${
                  activeTab === "partners"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Partners
                {activeTab === "partners" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            )}
            {isPlatformAdmin && (
              <button
                onClick={() => setActiveTab("specs")}
                className={`pb-3 px-1 font-medium transition-colors relative ${
                  activeTab === "specs"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Specifications
                {activeTab === "specs" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            )}
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

        {activeTab === "templates" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Partner Templates ({templates?.length || 0})</h2>
              <Dialog open={isUploadTemplateDialogOpen} onOpenChange={setIsUploadTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload New Template</DialogTitle>
                    <DialogDescription>
                      Upload a template file that will be available for download on the intake form for the selected partner's organizations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {isPlatformAdmin && (
                      <div className="space-y-2">
                        <Label>Partner <span className="text-destructive">*</span></Label>
                        <Select
                          value={templateClientId?.toString() || ""}
                          onValueChange={(value) => setTemplateClientId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map(client => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!isPlatformAdmin && (
                      <div className="space-y-2">
                        <Label>Partner</Label>
                        <Input value={getPartnerDisplayName(user, clients)} disabled />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Question <span className="text-destructive">*</span></Label>
                      <Select
                        value={templateQuestionId}
                        onValueChange={(value) => setTemplateQuestionId(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select question" />
                        </SelectTrigger>
                        <SelectContent>
                          {templateQuestions.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.id} - {q.text.substring(0, 60)}{q.text.length > 60 ? '...' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Label <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., VPN Configuration Form"
                        value={templateLabel}
                        onChange={(e) => setTemplateLabel(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>File <span className="text-destructive">*</span></Label>
                      <Input
                        type="file"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                      />
                      {templateFile && (
                        <p className="text-xs text-muted-foreground">
                          {templateFile.name} ({(templateFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleUploadTemplate}
                      disabled={uploadTemplateMutation.isPending}
                      className="w-full"
                    >
                      {uploadTemplateMutation.isPending ? "Uploading..." : "Upload Template"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Replace Template Dialog */}
            <Dialog open={isReplaceTemplateDialogOpen} onOpenChange={setIsReplaceTemplateDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Replace Template</DialogTitle>
                  <DialogDescription>
                    This will replace the current template file. The old version will be kept in the inactive history for reference.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                    <p className="text-sm text-yellow-400 font-medium">⚠ Warning: This will deactivate the current template and replace it with a new file.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Label <span className="text-destructive">*</span></Label>
                    <Input
                      value={replaceTemplateLabel}
                      onChange={(e) => setReplaceTemplateLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New File <span className="text-destructive">*</span></Label>
                    <Input
                      type="file"
                      onChange={(e) => setReplaceTemplateFile(e.target.files?.[0] || null)}
                    />
                    {replaceTemplateFile && (
                      <p className="text-xs text-muted-foreground">
                        {replaceTemplateFile.name} ({(replaceTemplateFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleReplaceTemplate}
                    disabled={replaceTemplateMutation.isPending || !replaceTemplateFile}
                    className="w-full"
                  >
                    {replaceTemplateMutation.isPending ? "Replacing..." : "Replace Template"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Active Templates Table */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Active Templates</h3>
                {!templates || templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No templates yet</p>
                    <p className="text-sm">Upload a template to make it available on the intake form for your organizations.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isPlatformAdmin && <TableHead>Partner</TableHead>}
                        <TableHead>Question</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map(t => (
                        <TableRow key={t.id}>
                          {isPlatformAdmin && (
                            <TableCell>
                              <Badge variant="outline">{clientMap[t.clientId] || `Client ${t.clientId}`}</Badge>
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-sm">{t.questionId}</TableCell>
                          <TableCell className="font-medium">{t.label}</TableCell>
                          <TableCell>
                            <a
                              href={t.fileUrl}
                              download={t.fileName}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              {t.fileName}
                            </a>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.fileSize ? `${(t.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.uploadedBy || 'N/A'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(t.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <a
                                href={t.fileUrl}
                                download={t.fileName}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </a>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReplaceTemplateId(t.id);
                                  setReplaceTemplateLabel(t.label);
                                  setReplaceTemplateFile(null);
                                  setIsReplaceTemplateDialogOpen(true);
                                }}
                              >
                                <Upload className="w-3 h-3 mr-1" />
                                Replace
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Inactive Templates History */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Inactive Templates History</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInactiveTemplates(!showInactiveTemplates)}
                  >
                    {showInactiveTemplates ? 'Hide' : 'Show'} ({inactiveTemplates?.length || 0})
                  </Button>
                </div>
                {showInactiveTemplates && (
                  <>
                    {!inactiveTemplates || inactiveTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No inactive templates.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isPlatformAdmin && <TableHead>Partner</TableHead>}
                            <TableHead>Question</TableHead>
                            <TableHead>Label</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Deactivated By</TableHead>
                            <TableHead>Deactivated At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inactiveTemplates.map(t => (
                            <TableRow key={t.id} className="opacity-60">
                              {isPlatformAdmin && (
                                <TableCell>
                                  <Badge variant="secondary">{clientMap[t.clientId] || `Client ${t.clientId}`}</Badge>
                                </TableCell>
                              )}
                              <TableCell className="font-mono text-sm">{t.questionId}</TableCell>
                              <TableCell className="font-medium">{t.label}</TableCell>
                              <TableCell>
                                <a
                                  href={t.fileUrl}
                                  download={t.fileName}
                                  className="text-muted-foreground hover:underline flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  {t.fileName}
                                </a>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.uploadedBy || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(t.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.deactivatedBy || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {t.deactivatedAt ? new Date(t.deactivatedAt).toLocaleDateString() : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "partners" && isPlatformAdmin && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Partners ({clients?.length || 0})</h2>
              <Dialog open={isCreatePartnerDialogOpen} onOpenChange={setIsCreatePartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Partner
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Partner</DialogTitle>
                    <DialogDescription>
                      Add a new partner organization (e.g., RadOne, SRV).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., RadOne"
                        value={newPartnerName}
                        onChange={(e) => {
                          setNewPartnerName(e.target.value);
                          setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., radone"
                        value={newPartnerSlug}
                        onChange={(e) => setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      />
                      <p className="text-xs text-muted-foreground">URL-safe identifier. Auto-generated from name.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        placeholder="Optional description"
                        value={newPartnerDescription}
                        onChange={(e) => setNewPartnerDescription(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleCreatePartner}
                      disabled={createClientMutation.isPending || !newPartnerName || !newPartnerSlug}
                      className="w-full"
                    >
                      {createClientMutation.isPending ? "Creating..." : "Create Partner"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Partner Dialog */}
            <Dialog open={isEditPartnerDialogOpen} onOpenChange={setIsEditPartnerDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Partner</DialogTitle>
                  <DialogDescription>
                    Update partner details.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={editPartnerName}
                      onChange={(e) => setEditPartnerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug <span className="text-destructive">*</span></Label>
                    <Input
                      value={editPartnerSlug}
                      onChange={(e) => setEditPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={editPartnerDescription}
                      onChange={(e) => setEditPartnerDescription(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePartner}
                    disabled={updateClientMutation.isPending || !editPartnerName || !editPartnerSlug}
                    className="w-full"
                  >
                    {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                {!clients || clients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-medium">No partners yet</p>
                    <p className="text-sm">Create a partner to start organizing your clients.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Organizations</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map(c => {
                        const orgCount = orgs?.filter(o => o.clientId === c.id).length || 0;
                        return (
                          <TableRow key={c.id} className={c.status === 'inactive' ? 'opacity-50' : ''}>
                            <TableCell className="font-mono text-sm">{c.id}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.description || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{orgCount}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditPartner(c)}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                {c.status === 'active' ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeactivatePartner(c.id)}
                                  >
                                    Deactivate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReactivatePartner(c.id)}
                                  >
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    Reactivate
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "specs" && isPlatformAdmin && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">New Lantern Specifications</h2>
              <Dialog open={isUploadSpecDialogOpen} onOpenChange={setIsUploadSpecDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Specification
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Specification</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Title *</Label>
                      <Input
                        placeholder="e.g., HL7 Integration Guide"
                        value={specTitle}
                        onChange={(e) => setSpecTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        placeholder="e.g., Integration, Security, Setup"
                        value={specCategory}
                        onChange={(e) => setSpecCategory(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        placeholder="Optional description"
                        value={specDescription}
                        onChange={(e) => setSpecDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>File *</Label>
                      <Input
                        type="file"
                        onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <Button
                      onClick={handleUploadSpec}
                      disabled={uploadSpecMutation.isPending || !specTitle || !specFile}
                      className="w-full"
                    >
                      {uploadSpecMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Spec Dialog */}
            <Dialog open={isEditSpecDialogOpen} onOpenChange={setIsEditSpecDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Specification</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={editSpecTitle}
                      onChange={(e) => setEditSpecTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={editSpecCategory}
                      onChange={(e) => setEditSpecCategory(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={editSpecDescription}
                      onChange={(e) => setEditSpecDescription(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleUpdateSpec}
                    disabled={updateSpecMutation.isPending || !editSpecTitle}
                    className="w-full"
                  >
                    {updateSpecMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                {!specs || specs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-medium">No specifications uploaded yet</p>
                    <p className="text-sm">Upload specification documents for clients to download.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specs.map(spec => (
                        <TableRow key={spec.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{spec.title}</div>
                              {spec.description && (
                                <div className="text-sm text-muted-foreground">{spec.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {spec.category ? (
                              <Badge variant="outline">{spec.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{spec.fileName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {spec.fileSize ? `${(spec.fileSize / 1024).toFixed(0)} KB` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{spec.uploadedBy}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(spec.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <a href={spec.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3 h-3 mr-1" />
                                  Download
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSpec(spec)}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeactivateSpec(spec.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to get a display name for the partner based on user context.
 * Uses the clients data when available, falls back to clientId.
 */
function getPartnerDisplayName(user: any, clients?: any[]): string {
  if (!user?.clientId) return "Platform";
  if (clients) {
    const client = clients.find((c: any) => c.id === user.clientId);
    if (client) return client.name;
  }
  return `Partner ${user.clientId}`;
}
