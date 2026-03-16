import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { transformSectionProgress } from "@/lib/adminUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Download, Upload, Plus, Mail, Edit, RotateCcw, LogOut, UserCircle, FileUp, AlertTriangle, AlertCircle, Info, Image, CheckSquare, BarChart3, Copy, Check, Clock, ChevronsUpDown, ChevronLeft, ChevronRight, Settings, ChevronDown, ListChecks, TestTube2, History } from "lucide-react";
import { questionnaireSections } from "@shared/questionnaireData";
import { TYPE_COLORS, type IntegrationSystem } from "@/components/IntegrationWorkflows";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [activeTab, setActiveTab] = useState<"prod-dashboard" | "impl-dashboard" | "orgs" | "users" | "templates" | "partners" | "specs" | "vendor-picklists">("impl-dashboard");

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

  // Vendor picklist management state
  const [newVendorType, setNewVendorType] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [newSystemTypeName, setNewSystemTypeName] = useState("");
  const [newSystemTypeVendors, setNewSystemTypeVendors] = useState("");
  const [editVendorId, setEditVendorId] = useState<number | null>(null);
  const [editVendorName, setEditVendorName] = useState("");

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
  const { data: vendorOptions, refetch: refetchVendorOptions } = trpc.admin.getSystemVendorOptions.useQuery();
  const { data: vendorAuditLogs, refetch: refetchVendorAuditLogs } = trpc.admin.getVendorAuditLog.useQuery({ limit: 100 });

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

  // Vendor picklist mutations
  const addVendorMutation = trpc.admin.addVendorOption.useMutation({
    onSuccess: () => {
      toast.success("Vendor added!");
      setNewVendorName("");
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add vendor");
    },
  });

  const updateVendorMutation = trpc.admin.updateVendorOption.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated!");
      setEditVendorId(null);
      setEditVendorName("");
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update vendor");
    },
  });

  const deleteVendorMutation = trpc.admin.deleteVendorOption.useMutation({
    onSuccess: () => {
      toast.success("Vendor removed");
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove vendor");
    },
  });

  const toggleVendorMutation = trpc.admin.toggleVendorOption.useMutation({
    onSuccess: () => {
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to toggle vendor");
    },
  });

  const addSystemTypeMutation = trpc.admin.addSystemType.useMutation({
    onSuccess: () => {
      toast.success("System type added!");
      setNewSystemTypeName("");
      setNewSystemTypeVendors("");
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add system type");
    },
  });

  const seedVendorsMutation = trpc.admin.seedDefaultVendorOptions.useMutation({
    onSuccess: (result) => {
      toast.success(result.message || "Defaults seeded");
      refetchVendorOptions();
      refetchVendorAuditLogs();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to seed defaults");
    },
  });

  // Group vendor options by system type for display (alphabetized, "Other" last)
  const vendorsByType = useMemo(() => {
    if (!vendorOptions) return {} as Record<string, typeof vendorOptions>;
    const grouped: Record<string, typeof vendorOptions> = {};
    for (const opt of vendorOptions) {
      if (!grouped[opt.systemType]) grouped[opt.systemType] = [];
      grouped[opt.systemType].push(opt);
    }
    // Sort each group alphabetically, keeping "Other" last
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        if (a.vendorName === 'Other') return 1;
        if (b.vendorName === 'Other') return -1;
        return a.vendorName.localeCompare(b.vendorName);
      });
    }
    return grouped;
  }, [vendorOptions]);

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
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="container py-3 sm:py-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 sm:h-12 shrink-0" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center min-w-0">
              <h1 className="text-lg sm:text-3xl font-bold text-foreground truncate">{headerTitle}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {headerSubtitle}
              </p>
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

          {/* Tab Navigation - Main tabs + Admin Menu */}
          <div className="flex items-center gap-4 mt-4 sm:mt-6 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab("prod-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                activeTab === "prod-dashboard"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Connectivity Matrix
              {activeTab === "prod-dashboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("impl-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap shrink-0 ${
                activeTab === "impl-dashboard"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Task List Dashboard
              {activeTab === "impl-dashboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>

            {/* Admin Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1 shrink-0 ${
                    ["users", "orgs", "templates", "partners", "specs"].includes(activeTab)
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Admin
                  <ChevronDown className="w-3 h-3" />
                  {["users", "orgs", "templates", "partners", "specs"].includes(activeTab) && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setActiveTab("users")} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("orgs")} className="cursor-pointer">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Organizations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("templates")} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("vendor-picklists")} className="cursor-pointer">
                  <ListChecks className="mr-2 h-4 w-4" />
                  Vendor Picklists
                </DropdownMenuItem>
                {isPlatformAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveTab("partners")} className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      Partners
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("specs")} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Specifications
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">

        {/* ── CONNECTIVITY MATRIX TAB ── */}
        {activeTab === "prod-dashboard" && (
          <ConnectivityMatrix orgs={(orgs || [])
            .filter(o => o.status === 'active')
            .map(o => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              partnerName: o.clientId && clients ? (clients.find(c => c.id === o.clientId)?.name ?? '') : '',
            }))}
          />
        )}

        {activeTab === "impl-dashboard" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Task List Dashboard</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{activeOrgs.length} active organizations</span>
              </div>
            </div>
            
            {/* Workflow Launcher Table */}
            <Card className="card-elevated overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] text-sm font-semibold">Organization</TableHead>
                      {isPlatformAdmin && <TableHead className="w-[140px] text-sm font-semibold">Partner</TableHead>}
                      <TableHead className="text-center text-sm w-[200px] font-semibold">
                        <span>Questionnaire</span>
                      </TableHead>
                      <TableHead className="text-center text-sm w-[200px] font-semibold">
                        <span>Validation Checklist</span>
                      </TableHead>
                      <TableHead className="text-center text-sm w-[200px] font-semibold">
                        <span>Task List</span>
                      </TableHead>
                      <TableHead className="text-center text-sm w-[70px] font-semibold">Files</TableHead>
                      <TableHead className="text-center text-sm w-[70px] font-semibold">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrgs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isPlatformAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground text-sm">
                          No active organizations
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeOrgs.map(org => {
                        const orgMetrics = metricsMap[org.id];
                        const partnerName = org.clientId ? clientMap[org.clientId] : "—";
                        const sectionProgress = transformSectionProgress(orgMetrics?.sectionProgress);
                        const sectionsComplete = sectionProgress.filter(s => s.progress === 100).length;
                        const totalSections = sectionProgress.length || 6;
                        const filesCount = orgMetrics?.files.length || 0;
                        const userCount = orgMetrics?.userCount || 0;
                        const questionnaireComplete = sectionsComplete === totalSections;
                        // Determine questionnaire button label
                        const qLabel = sectionsComplete === 0 ? "Start" : questionnaireComplete ? "View" : "Continue";
                        // Validation Checklist: 4 phases, placeholder 0 complete for now
                        const testingTotal = 4;
                        const testingComplete = 0;
                        const testingLabel = testingComplete === 0 ? "Start" : testingComplete === testingTotal ? "View" : "Continue";
                        // Task List: 5 sections, placeholder 0 complete for now
                        const implTotal = 5;
                        const implComplete = 0;
                        const implLabel = implComplete === 0 ? "Start" : implComplete === implTotal ? "View" : "Continue";

                        return (
                          <TableRow key={org.id} className="hover:bg-muted/30">
                            {/* Org name → Site Dashboard */}
                            <TableCell>
                              <button
                                onClick={() => setLocation(`/org/${org.slug}`)}
                                className="text-left font-semibold text-sm text-primary hover:underline hover:text-primary/80 transition-colors"
                              >
                                {org.name}
                              </button>
                            </TableCell>
                            {isPlatformAdmin && (
                              <TableCell>
                                <span className="text-sm text-foreground">{partnerName}</span>
                              </TableCell>
                            )}
                            {/* Questionnaire — clickable workflow launcher */}
                            <TableCell className="text-center">
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/intake`)}
                                className="inline-flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/40 rounded-lg px-3 py-2 transition-colors w-full"
                              >
                                <span className={cn(
                                  "text-xs font-bold px-3 py-1 rounded-full transition-all",
                                  qLabel === "Start" && "badge-status-start",
                                  qLabel === "Continue" && "bg-primary/20 text-primary border border-primary/30",
                                  qLabel === "View" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                )}>
                                  {qLabel}
                                </span>
                                <span className="text-sm text-foreground">{sectionsComplete}/{totalSections} complete</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: totalSections }).map((_, i) => (
                                    <span key={i} className={cn(
                                      "progress-dot",
                                      i < sectionsComplete ? "progress-dot-filled" : "progress-dot-empty"
                                    )} />
                                  ))}
                                </div>
                              </button>
                            </TableCell>
                            {/* Validation Checklist — consistent status display */}
                            <TableCell className="text-center">
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/validation`)}
                                className="inline-flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/40 rounded-lg px-3 py-2 transition-colors w-full"
                              >
                                <span className={cn(
                                  "text-xs font-bold px-3 py-1 rounded-full transition-all",
                                  testingLabel === "Start" && "badge-status-start",
                                  testingLabel === "Continue" && "bg-primary/20 text-primary border border-primary/30",
                                  testingLabel === "View" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                )}>
                                  {testingLabel}
                                </span>
                                <span className="text-sm text-foreground">{testingComplete}/{testingTotal} complete</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: testingTotal }).map((_, i) => (
                                    <span key={i} className={cn(
                                      "progress-dot",
                                      i < testingComplete ? "progress-dot-filled" : "progress-dot-empty"
                                    )} />
                                  ))}
                                </div>
                              </button>
                            </TableCell>
                            {/* Task List — consistent status display */}
                            <TableCell className="text-center">
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/implement`)}
                                className="inline-flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/40 rounded-lg px-3 py-2 transition-colors w-full"
                              >
                                <span className={cn(
                                  "text-xs font-bold px-3 py-1 rounded-full transition-all",
                                  implLabel === "Start" && "badge-status-start",
                                  implLabel === "Continue" && "bg-primary/20 text-primary border border-primary/30",
                                  implLabel === "View" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                )}>
                                  {implLabel}
                                </span>
                                <span className="text-sm text-foreground">{implComplete}/{implTotal} complete</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: implTotal }).map((_, i) => (
                                    <span key={i} className={cn(
                                      "progress-dot",
                                      i < implComplete ? "progress-dot-filled" : "progress-dot-empty"
                                    )} />
                                  ))}
                                </div>
                              </button>
                            </TableCell>
                            {/* Files */}
                            <TableCell className="text-center">
                              <span className="text-sm text-foreground">{filesCount}</span>
                            </TableCell>
                            {/* Users */}
                            <TableCell className="text-center">
                              <span className="text-sm text-foreground">{userCount}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "orgs" && (
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
              <div className="overflow-x-auto">
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
              </div>
            </Card>

            {/* Completed Organizations Section */}
            {completedOrgs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4">Completed Organizations ({completedOrgs.length})</h3>
                <Card>
                  <div className="overflow-x-auto">
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
                  </div>
                </Card>
              </>
            )}

            {/* Deactivated Organizations Section */}
            {inactiveOrgs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4">Deactivated Organizations ({inactiveOrgs.length})</h3>
                <Card>
                  <div className="overflow-x-auto">
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
                  </div>
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
                <div className="overflow-x-auto">
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
                </div>
              </CardContent>
            </Card>

            {/* Inactive Users Table */}
            {inactiveUsers.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Inactive Users ({inactiveUsers.length})</h3>
                  <div className="overflow-x-auto">
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
                  </div>
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
                  <div className="overflow-x-auto">
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
                  </div>
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
                      <div className="overflow-x-auto">
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
                      </div>
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
                  <div className="overflow-x-auto">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── VENDOR PICKLISTS TAB ── */}
        {activeTab === "vendor-picklists" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Vendor Picklists</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage the vendor dropdown options shown in the Architecture section of the intake questionnaire.
                </p>
              </div>
              <div className="flex gap-2">
                {(!vendorOptions || vendorOptions.length === 0) && (
                  <Button
                    variant="outline"
                    onClick={() => seedVendorsMutation.mutate()}
                    disabled={seedVendorsMutation.isPending}
                  >
                    {seedVendorsMutation.isPending ? "Seeding..." : "Seed Defaults"}
                  </Button>
                )}
              </div>
            </div>

            {/* Add New System Type */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Add New System Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">System Type Name</Label>
                    <Input
                      placeholder="e.g., Cloud PACS, Dose Monitoring"
                      value={newSystemTypeName}
                      onChange={(e) => setNewSystemTypeName(e.target.value)}
                    />
                  </div>
                  <div className="flex-[2]">
                    <Label className="text-xs text-muted-foreground">Vendors (comma-separated)</Label>
                    <Input
                      placeholder="e.g., Vendor A, Vendor B, Vendor C, Other"
                      value={newSystemTypeVendors}
                      onChange={(e) => setNewSystemTypeVendors(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        if (!newSystemTypeName.trim()) {
                          toast.error("Please enter a system type name");
                          return;
                        }
                        const vendors = newSystemTypeVendors.split(",").map(v => v.trim()).filter(Boolean);
                        if (vendors.length === 0) {
                          toast.error("Please enter at least one vendor");
                          return;
                        }
                        addSystemTypeMutation.mutate({ systemType: newSystemTypeName.trim(), vendors });
                      }}
                      disabled={addSystemTypeMutation.isPending}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {addSystemTypeMutation.isPending ? "Adding..." : "Add System Type"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Type Cards */}
            {Object.keys(vendorsByType).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No vendor options configured</p>
                  <p className="text-sm">Click "Seed Defaults" to load the standard vendor lists, or add system types manually above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Object.entries(vendorsByType).sort(([a], [b]) => a.localeCompare(b)).map(([systemType, vendors]) => (
                  <Collapsible key={systemType} asChild>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg group">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                              <Badge variant="outline" className="text-sm">{systemType}</Badge>
                              <span className="text-sm text-muted-foreground font-normal">
                                {(vendors || []).filter(v => v.isActive).length} active / {(vendors || []).length} total
                              </span>
                            </CardTitle>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                      {/* Add vendor to this type */}
                      <div className="flex gap-2 mb-4">
                        {newVendorType === systemType ? (
                          <>
                            <Input
                              placeholder="New vendor name"
                              value={newVendorName}
                              onChange={(e) => setNewVendorName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newVendorName.trim()) {
                                  addVendorMutation.mutate({ systemType, vendorName: newVendorName.trim() });
                                  setNewVendorType("");
                                }
                              }}
                              className="max-w-xs"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (newVendorName.trim()) {
                                  addVendorMutation.mutate({ systemType, vendorName: newVendorName.trim() });
                                  setNewVendorType("");
                                }
                              }}
                              disabled={addVendorMutation.isPending || !newVendorName.trim()}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setNewVendorType(""); setNewVendorName(""); }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setNewVendorType(systemType); setNewVendorName(""); }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Vendor
                          </Button>
                        )}
                      </div>

                      {/* Vendor list */}
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Vendor Name</TableHead>
                              <TableHead className="w-24 text-center">Status</TableHead>
                              <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(vendors || []).map((vendor, idx) => (
                              <TableRow key={vendor.id} className={cn(!vendor.isActive && "opacity-50")}>
                                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                <TableCell>
                                  {editVendorId === vendor.id ? (
                                    <div className="flex gap-2 items-center">
                                      <Input
                                        value={editVendorName}
                                        onChange={(e) => setEditVendorName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && editVendorName.trim()) {
                                            updateVendorMutation.mutate({ id: vendor.id, vendorName: editVendorName.trim() });
                                          }
                                          if (e.key === "Escape") {
                                            setEditVendorId(null);
                                          }
                                        }}
                                        className="max-w-xs h-8"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => {
                                          if (editVendorName.trim()) {
                                            updateVendorMutation.mutate({ id: vendor.id, vendorName: editVendorName.trim() });
                                          }
                                        }}
                                      >
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-medium">{vendor.vendorName}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant={vendor.isActive ? "default" : "secondary"}
                                    className={cn(
                                      "cursor-pointer text-xs",
                                      vendor.isActive ? "bg-green-600/20 text-green-400 hover:bg-green-600/30" : ""
                                    )}
                                    onClick={() => toggleVendorMutation.mutate({ id: vendor.id, isActive: vendor.isActive ? 0 : 1 })}
                                  >
                                    {vendor.isActive ? "Active" : "Hidden"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setEditVendorId(vendor.id);
                                        setEditVendorName(vendor.vendorName);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm(`Remove "${vendor.vendorName}" from ${systemType}?`)) {
                                          deleteVendorMutation.mutate({ id: vendor.id });
                                        }
                                      }}
                                    >
                                      <AlertCircle className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Audit Log Section */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Change History
                </CardTitle>
                <CardDescription>Recent changes to vendor picklists</CardDescription>
              </CardHeader>
              <CardContent>
                {!vendorAuditLogs || vendorAuditLogs.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No changes recorded yet.</p>
                ) : (
                  <div className="rounded-md border max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-36">Date</TableHead>
                          <TableHead className="w-28">Action</TableHead>
                          <TableHead>System Type</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead className="w-48">Changed By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorAuditLogs.map((log) => {
                          const actionLabel: Record<string, string> = {
                            add: 'Added',
                            update: 'Renamed',
                            toggle: 'Toggled',
                            delete: 'Deleted',
                            add_system_type: 'New Type',
                            seed_defaults: 'Seeded',
                          };
                          const actionColor: Record<string, string> = {
                            add: 'text-green-400',
                            update: 'text-blue-400',
                            toggle: 'text-yellow-400',
                            delete: 'text-red-400',
                            add_system_type: 'text-purple-400',
                            seed_defaults: 'text-muted-foreground',
                          };

                          let details = '';
                          if (log.action === 'add') {
                            details = `Added "${log.vendorName}"`;
                          } else if (log.action === 'update') {
                            details = `"${log.previousValue}" → "${log.newValue}"`;
                          } else if (log.action === 'toggle') {
                            details = `"${log.vendorName}" ${log.newValue === 'active' ? 'activated' : 'deactivated'}`;
                          } else if (log.action === 'delete') {
                            details = `Removed "${log.vendorName}"`;
                          } else if (log.action === 'add_system_type') {
                            try {
                              const vendors = JSON.parse(log.newValue || '[]');
                              details = `Added ${vendors.length} vendors: ${vendors.join(', ')}`;
                            } catch {
                              details = log.newValue || '';
                            }
                          } else if (log.action === 'seed_defaults') {
                            try {
                              const types = JSON.parse(log.newValue || '[]');
                              details = `Seeded ${types.length} system types`;
                            } catch {
                              details = 'Seeded default vendors';
                            }
                          }

                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(log.performedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                                {new Date(log.performedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                <span className={cn('text-xs font-medium', actionColor[log.action] || 'text-muted-foreground')}>
                                  {actionLabel[log.action] || log.action}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">{log.systemType}</TableCell>
                              <TableCell className="text-sm max-w-[300px] truncate" title={details}>{details}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{log.performedBy}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/** HL7 connectivity fields shown per-org in the card layout. */
const HL7_ORDERS_FIELDS = [
  { label: "Org IP",          questionId: "meta.hl7_ord_org_ip" },
  { label: "Org Port",        questionId: "meta.hl7_ord_org_port" },
  { label: "Silverback IP",   questionId: "meta.hl7_ord_sb_ip" },
  { label: "Silverback Port", questionId: "meta.hl7_ord_sb_port" },
  { label: "NL IP",           questionId: "meta.hl7_ord_nl_ip" },
  { label: "NL Port",         questionId: "meta.hl7_ord_nl_port" },
] as const;

const HL7_RESULTS_FIELDS = [
  { label: "NL IP",           questionId: "meta.hl7_res_nl_ip" },
  { label: "NL Port",         questionId: "meta.hl7_res_nl_port" },
  { label: "Silverback IP",   questionId: "meta.hl7_res_sb_ip" },
  { label: "Silverback Port", questionId: "meta.hl7_res_sb_port" },
  { label: "Org IP",          questionId: "meta.hl7_res_org_ip" },
  { label: "Org Port",        questionId: "meta.hl7_res_org_port" },
] as const;

/** A 3-node flow block: [left label + IP/port] → [mid label + IP/port] → [right label + IP/port] */
function HL7FlowRow({
  direction,
  leftLabel, leftIp, leftPort,
  midLabel,  midIp,  midPort,
  rightLabel, rightIp, rightPort,
}: {
  direction: "→" | "←";
  leftLabel: string;  leftIp: string;  leftPort: string;
  midLabel: string;   midIp: string;   midPort: string;
  rightLabel: string; rightIp: string; rightPort: string;
}) {
  const Node = ({ label, ip, port }: { label: string; ip: string; port: string }) => (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="w-full border border-border rounded-md bg-muted/20 px-2 py-1.5 text-center">
        {ip || port ? (
          <>
            {ip && <div className="font-mono text-xs text-foreground leading-tight truncate">{ip}</div>}
            {port && <div className="font-mono text-xs text-primary leading-tight">:{port}</div>}
          </>
        ) : (
          <div className="font-mono text-xs text-muted-foreground/50">—</div>
        )}
      </div>
    </div>
  );

  const Arrow = () => (
    <div className="flex items-center justify-center text-muted-foreground/50 text-lg font-light shrink-0 px-1 mt-5">
      {direction}
    </div>
  );

  return (
    <div className="flex items-start gap-1">
      <Node label={leftLabel}  ip={leftIp}   port={leftPort} />
      <Arrow />
      <Node label={midLabel}   ip={midIp}    port={midPort} />
      <Arrow />
      <Node label={rightLabel} ip={rightIp}  port={rightPort} />
    </div>
  );
}

/** Card for a single organization showing its HL7 Orders + Results flows. */
function HL7OrgCard({
  org,
  responses,
}: {
  org: { id: number; name: string; slug: string };
  responses: Record<string, string>;
}) {
  const get = (qid: string) => responses[qid] ?? "";

  const ordersComplete =
    get("meta.hl7_ord_org_ip") || get("meta.hl7_ord_org_port") ||
    get("meta.hl7_ord_sb_ip")  || get("meta.hl7_ord_nl_ip");

  const resultsComplete =
    get("meta.hl7_res_nl_ip") || get("meta.hl7_res_nl_port") ||
    get("meta.hl7_res_sb_ip") || get("meta.hl7_res_org_ip");

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{org.name}</CardTitle>
          <div className="flex gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ordersComplete ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
              Orders {ordersComplete ? "✓" : "—"}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${resultsComplete ? "bg-blue-500/15 text-blue-400" : "bg-muted text-muted-foreground"}`}>
              Results {resultsComplete ? "✓" : "—"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* HL7 Orders: Site → Silverback → New Lantern */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            HL7 Orders
          </div>
          <HL7FlowRow
            direction="→"
            leftLabel="Client Site"
            leftIp={get("meta.hl7_ord_org_ip")}
            leftPort={get("meta.hl7_ord_org_port")}
            midLabel="Silverback"
            midIp={get("meta.hl7_ord_sb_ip")}
            midPort={get("meta.hl7_ord_sb_port")}
            rightLabel="New Lantern"
            rightIp={get("meta.hl7_ord_nl_ip")}
            rightPort={get("meta.hl7_ord_nl_port")}
          />
        </div>

        <div className="border-t border-border/40" />

        {/* HL7 Results: New Lantern → Silverback → Site */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            HL7 Results
          </div>
          <HL7FlowRow
            direction="→"
            leftLabel="New Lantern"
            leftIp={get("meta.hl7_res_nl_ip")}
            leftPort={get("meta.hl7_res_nl_port")}
            midLabel="Silverback"
            midIp={get("meta.hl7_res_sb_ip")}
            midPort={get("meta.hl7_res_sb_port")}
            rightLabel="Client Site"
            rightIp={get("meta.hl7_res_org_ip")}
            rightPort={get("meta.hl7_res_org_port")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** HL7 Layout view — card per org showing Orders + Results flows. */
function HL7Layout({ orgs }: { orgs: { id: number; name: string; slug: string }[] }) {
  const { data: allResponses = [], isLoading } = trpc.admin.getAllOrgResponses.useQuery();

  // Build per-org response lookup
  const lookup = allResponses.reduce<Record<number, Record<string, string>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = r.response ?? "";
    return acc;
  }, {});

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">HL7 Connectivity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Per-organization HL7 Orders and Results endpoint overview. Edit values in the Connectivity Matrix tab.
        </p>
      </div>

      {orgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations accessible.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgs.map(org => (
            <HL7OrgCard
              key={org.id}
              org={org}
              responses={lookup[org.id] ?? {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connectivity Matrix ──────────────────────────────────────────────────────

/** Rows the matrix always shows, keyed by questionId stored in intakeResponses.
 *  `meta.*` IDs are admin-only fields that don't exist in the client questionnaire
 *  but are stored the same way so they're fully editable and persistent.
 *  `fromQuestionnaire: true` rows pull directly from client intake answers. */
const MATRIX_SECTIONS: { title: string; rows: { label: string; questionId: string; isEmail?: boolean; isPhone?: boolean; fromQuestionnaire?: boolean }[] }[] = [
  {
    title: "Organization",
    rows: [
      { label: "Go-Live Date",   questionId: "D.2",  fromQuestionnaire: true },
      { label: "# Sites",        questionId: "H.1",  fromQuestionnaire: true },
      { label: "Site Names",     questionId: "H.2",  fromQuestionnaire: true },
      { label: "Modalities",     questionId: "D.3",  fromQuestionnaire: true },
      { label: "Studies / Day",  questionId: "D.4",  fromQuestionnaire: true },
    ],
  },
  {
    title: "Contacts",
    rows: [
      { label: "Admin Contact",       questionId: "A.1",  fromQuestionnaire: true },
      { label: "IT Contact",          questionId: "A.2",  fromQuestionnaire: true },
      { label: "Prod Support Contact", questionId: "meta.prod_support_contact" },
    ],
  },
  {
    title: "Systems",
    rows: [
      { label: "PACS",              questionId: "meta.pacs_system" },
      { label: "RIS",               questionId: "meta.ris_system" },
      { label: "EMR",               questionId: "meta.emr_system" },
      { label: "Interface Engine",  questionId: "meta.interface_engine" },
    ],
  },
  {
    title: "DICOM Routing",
    rows: [
      { label: "Test Endpoints",    questionId: "E.2",   fromQuestionnaire: true },
      { label: "Prod Endpoints",    questionId: "E.2.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "HL7 Orders",
    rows: [
      { label: "Test Environment",  questionId: "E.3",   fromQuestionnaire: true },
      { label: "Prod Environment",  questionId: "E.3.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "HL7 Results",
    rows: [
      { label: "Test Environment",  questionId: "E.5",   fromQuestionnaire: true },
      { label: "Prod Environment",  questionId: "E.5.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "Endpoints",
    rows: [
      { label: "Org IP",            questionId: "meta.ep_org_ip" },
      { label: "Org DICOM Port",    questionId: "meta.ep_org_dicom_port" },
      { label: "Org HL7 Port",      questionId: "meta.ep_org_hl7_port" },
      { label: "NL IP",             questionId: "meta.ep_nl_ip" },
      { label: "NL DICOM Port",     questionId: "meta.ep_nl_dicom_port" },
      { label: "NL HL7 Port",       questionId: "meta.ep_nl_hl7_port" },
      { label: "Silverback IP",     questionId: "meta.ep_sb_ip" },
    ],
  },
  {
    title: "Known Gotchas / Exceptions",
    rows: [
      { label: "Accession Format",  questionId: "meta.accession_format" },
      { label: "Priors Available",  questionId: "meta.priors_available" },
      { label: "Downtime Plans",    questionId: "L.11", fromQuestionnaire: true },
      { label: "ORC-1 Values",      questionId: "G.3",  fromQuestionnaire: true },
      { label: "ORC-5 Values",      questionId: "G.4",  fromQuestionnaire: true },
      { label: "Other Notes",       questionId: "meta.other_notes" },
    ],
  },
];


/** Status dot for the prod_status field */
function StatusDot({ value }: { value: string }) {
  const lower = (value ?? "").toLowerCase();
  if (lower === "active")     return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Active</span>;
  if (lower === "monitoring") return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Monitoring</span>;
  if (lower === "pending")    return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50 inline-block" />Pending</span>;
  if (lower === "inactive")   return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Inactive</span>;
  return <span className="text-muted-foreground">{value || "—"}</span>;
}

type AuditMeta = { updatedBy?: string | null; updatedAt?: Date | string | null; createdAt?: Date | string | null };

function fmtDate(d?: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** If a stored value is a JSON array, render it as a comma-separated list; otherwise return as-is. */
function formatCellDisplay(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v: unknown) => String(v)).join(", ");
      }
    } catch {
      // fall through
    }
  }
  return raw;
}

/** Single editable cell — click to edit, hover shows copy + audit tooltip */
function MatrixCell({
  orgId, questionId, initialValue, audit, isEmail, isPhone, isStatus, isGotcha,
  onSaved,
}: {
  orgId: number; questionId: string; initialValue: string; audit?: AuditMeta;
  isEmail?: boolean; isPhone?: boolean; isStatus?: boolean; isGotcha?: boolean;
  onSaved?: (questionId: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(initialValue);
  const [saved, setSaved]     = useState(initialValue);
  const [copied, setCopied]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMutation = trpc.admin.saveOrgResponse.useMutation({
    onSuccess: () => { setSaved(draft); onSaved?.(questionId, draft); },
    onError:   () => { setDraft(saved); toast.error("Failed to save — change reverted"); },
  });

  const commit = () => {
    setEditing(false);
    if (draft !== saved) saveMutation.mutate({ organizationId: orgId, questionId, response: draft });
  };

  const copyValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = saved || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  // Keep in sync when parent data refreshes (e.g. after import)
  useEffect(() => { setDraft(initialValue); setSaved(initialValue); }, [initialValue]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setDraft(saved); setEditing(false); }
        }}
        className="w-full bg-muted/30 border border-primary/40 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  const hasAudit = audit && (audit.updatedBy || audit.updatedAt);

  return (
    <span className="group inline-flex items-center gap-1 min-w-[4rem]">
      {/* Clickable value area */}
      <span
        onClick={() => setEditing(true)}
        className={`cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-muted/40 transition-colors inline-flex items-center gap-1 ${
          isGotcha ? "text-amber-500 dark:text-amber-400" : ""
        }`}
      >
        {isStatus ? (
          <StatusDot value={saved} />
        ) : isEmail && saved ? (
          <a href={`mailto:${saved}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
            {saved}<ExternalLink className="w-3 h-3" />
          </a>
        ) : isPhone && saved ? (
          <a href={`tel:${saved}`} onClick={e => e.stopPropagation()} className="hover:underline">{saved}</a>
        ) : (
          <span className="font-mono text-sm">{formatCellDisplay(saved) || "—"}</span>
        )}
        <Edit className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 shrink-0" />
      </span>

      {/* Copy button — visible on hover */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={copyValue}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60 shrink-0"
            tabIndex={-1}
          >
            {copied
              ? <Check className="w-3 h-3 text-green-500" />
              : <Copy className="w-3 h-3 text-muted-foreground/60" />
            }
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy value"}</TooltipContent>
      </Tooltip>

      {/* Audit badge — only shown when audit data exists */}
      {hasAudit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-default">
              <Clock className="w-3 h-3 text-muted-foreground/40" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[220px] text-left space-y-0.5 leading-snug">
            {audit?.updatedBy && <div><span className="text-muted-foreground">By:</span> {audit.updatedBy}</div>}
            {audit?.updatedAt && <div><span className="text-muted-foreground">Updated:</span> {fmtDate(audit.updatedAt)}</div>}
            {audit?.createdAt && <div><span className="text-muted-foreground">Created:</span> {fmtDate(audit.createdAt)}</div>}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

// ── CSV helpers ────────────────────────────────────────────────────────────────
function buildCSV(orgs: { id: number; name: string }[], lookup: Record<number, Record<string, string>>) {
  const header = ["Section", "Detail (questionId)", ...orgs.map(o => o.name)];
  const dataRows: string[][] = [];
  MATRIX_SECTIONS.forEach(section => {
    section.rows.forEach(row => {
      dataRows.push([section.title, `${row.label} (${row.questionId})`, ...orgs.map(o => lookup[o.id]?.[row.questionId] ?? "")]);
    });
  });
  return [header, ...dataRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV(csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `connectivity-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse an imported CSV back into {orgId, questionId, response}[] rows.
 *  Expects the same format as the export: col 0 = Section, col 1 = "Label (questionId)", col 2+ = org values.
 *  Returns parsed rows + any validation errors. */
function parseImportCSV(csvText: string, orgs: { id: number; name: string }[]) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["CSV has no data rows"] };

  const parseRow = (line: string) => {
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; continue; }
      if (ch === '"' && inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"' && inQ) { inQ = false; continue; }
      if (ch === ',' && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols;
  };

  const headers = parseRow(lines[0]);
  // Map header org names to org IDs
  const orgCols: { colIdx: number; orgId: number }[] = [];
  const errors: string[] = [];

  for (let i = 2; i < headers.length; i++) {
    const name = headers[i].trim();
    const org = orgs.find(o => o.name.trim().toLowerCase() === name.toLowerCase());
    if (org) orgCols.push({ colIdx: i, orgId: org.id });
    else errors.push(`Column "${name}" does not match any accessible organization — skipped`);
  }

  // Build a flat questionId lookup from MATRIX_SECTIONS for validation
  const qidByLabel: Record<string, string> = {};
  MATRIX_SECTIONS.forEach(s => s.rows.forEach(r => {
    qidByLabel[`${r.label} (${r.questionId})`.toLowerCase()] = r.questionId;
    qidByLabel[r.questionId.toLowerCase()] = r.questionId; // also accept bare qid
  }));

  const rows: { organizationId: number; questionId: string; response: string }[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseRow(lines[li]);
    const rawDetail = (cols[1] ?? "").trim().toLowerCase();
    const questionId = qidByLabel[rawDetail];
    if (!questionId) {
      if (rawDetail) errors.push(`Row ${li + 1}: unrecognized detail "${cols[1]}" — skipped`);
      continue;
    }
    for (const { colIdx, orgId } of orgCols) {
      const response = (cols[colIdx] ?? "").trim();
      if (response) rows.push({ organizationId: orgId, questionId, response });
    }
  }

  return { rows, errors };
}

// ── ConnectivityMatrix ─────────────────────────────────────────────────────────
type ConnectivityOrg = { id: number; name: string; slug: string; partnerName?: string };
function ConnectivityMatrix({ orgs }: { orgs: ConnectivityOrg[] }) {
  const utils = trpc.useUtils();
  const { data: allResponses = [], isLoading } = trpc.admin.getAllOrgResponses.useQuery();
  const { data: allFiles = [] } = trpc.admin.getAllFiles.useQuery();
  // Build map: orgId → first ARCH.diagram fileUrl
  const archDiagramByOrg = useMemo(() => {
    const map: Record<number, string> = {};
    for (const f of allFiles) {
      if (f.questionId === "ARCH.diagram" && f.organizationId && !map[f.organizationId]) {
        map[f.organizationId] = f.fileUrl;
      }
    }
    return map;
  }, [allFiles]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Org visibility filter
  const [visibleOrgIds, setVisibleOrgIds] = useState<Set<number>>(() => new Set(orgs.map(o => o.id)));
  const toggleOrg = (id: number) => setVisibleOrgIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });
  const filteredOrgs = orgs.filter(o => visibleOrgIds.has(o.id));

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    () => new Set(MATRIX_SECTIONS.map((_, i) => i))
  );
  const toggleSection = (si: number) => setCollapsedSections(prev => {
    const next = new Set(prev);
    if (next.has(si)) { next.delete(si); } else { next.add(si); }
    return next;
  });

  // Import dialog state
  const [importOpen, setImportOpen]         = useState(false);
  const [importPreview, setImportPreview]   = useState<{ rows: { organizationId: number; questionId: string; response: string }[]; errors: string[] } | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollTable = (dir: 'left' | 'right') =>
    tableScrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });

  const bulkSave = trpc.admin.bulkSaveOrgResponses.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.saved} cell${result.saved !== 1 ? "s" : ""}`);
      setImportOpen(false);
      setImportPreview(null);
      setImportFileName("");
      utils.admin.getAllOrgResponses.invalidate();
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  // Build a lookup: orgId → questionId → { response, audit }
  type LookupEntry = { response: string; updatedBy?: string | null; updatedAt?: Date | string | null; createdAt?: Date | string | null };
  const lookup = allResponses.reduce<Record<number, Record<string, LookupEntry>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = {
      response: r.response ?? "",
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    };
    return acc;
  }, {});

  // For export, build a plain string lookup
  const strLookup = allResponses.reduce<Record<number, Record<string, string>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = r.response ?? "";
    return acc;
  }, {});

  const handleExport = () => downloadCSV(buildCSV(orgs, strLookup));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseImportCSV(text, orgs);
      setImportPreview(parsed);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importPreview || importPreview.rows.length === 0) return;
    bulkSave.mutate({ rows: importPreview.rows });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Connectivity Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live data — click any cell to edit, hover to copy or view audit history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import */}
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Connectivity Matrix</DialogTitle>
                <DialogDescription>
                  Upload a CSV exported from this matrix. Only non-empty cells will be written.
                  Column headers must match org names exactly.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div
                  onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  {importFileName
                    ? <p className="text-sm font-medium">{importFileName}</p>
                    : <p className="text-sm text-muted-foreground">Click to select a .csv file</p>
                  }
                  <input ref={importFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </div>

                {importPreview && (
                  <div className="space-y-2 text-sm">
                    {importPreview.errors.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3 space-y-1">
                        {importPreview.errors.map((e, i) => (
                          <p key={i} className="text-amber-700 dark:text-amber-400 text-xs">{e}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground">
                      Ready to write <strong className="text-foreground">{importPreview.rows.length}</strong> cell{importPreview.rows.length !== 1 ? "s" : ""} across{" "}
                      <strong className="text-foreground">{Array.from(new Set(importPreview.rows.map(r => r.organizationId))).length}</strong> org{Array.from(new Set(importPreview.rows.map(r => r.organizationId))).length !== 1 ? "s" : ""}.
                    </p>
                    <Button
                      className="w-full"
                      disabled={importPreview.rows.length === 0 || bulkSave.isPending}
                      onClick={confirmImport}
                    >
                      {bulkSave.isPending ? "Importing…" : `Import ${importPreview.rows.length} cells`}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Export */}
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Site multi-select filter */}
      {orgs.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Sites:</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm hover:bg-muted/50 transition-colors min-w-[160px] justify-between">
                <span className="text-sm">
                  {visibleOrgIds.size === 0
                    ? "None selected"
                    : visibleOrgIds.size === orgs.length
                    ? `All ${orgs.length} sites`
                    : `${visibleOrgIds.size} of ${orgs.length} sites`}
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="space-y-1">
                {/* Select all / Clear */}
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border">
                  <button
                    onClick={() => setVisibleOrgIds(new Set(orgs.map(o => o.id)))}
                    className="text-xs text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setVisibleOrgIds(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
                {orgs.map(org => (
                  <label
                    key={org.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={visibleOrgIds.has(org.id)}
                      onCheckedChange={() => toggleOrg(org.id)}
                    />
                    <span className="text-sm truncate">{org.name}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}



      {orgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations accessible.</p>
      ) : filteredOrgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations selected. Use the filters above to show orgs.</p>
      ) : (
        <div className="relative">
          {/* Left scroll arrow */}
          <button
            onClick={() => scrollTable('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 -translate-x-4 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-muted/70 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          {/* Right scroll arrow */}
          <button
            onClick={() => scrollTable('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 translate-x-4 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-muted/70 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <div ref={tableScrollRef} className="overflow-auto rounded-lg border border-border mx-8" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-card">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-44 min-w-[11rem] border-r border-border bg-card">Detail</th>
                {filteredOrgs.map(org => (
                  <th key={org.id} className="text-left py-3 px-4 min-w-[10rem] border-r border-border last:border-r-0 bg-card">
                    <span className="font-bold block leading-tight">{org.name}</span>
                    {org.partnerName && <span className="text-xs font-normal text-muted-foreground">{org.partnerName}</span>}
                    {archDiagramByOrg[org.id] && (
                      <button
                        onClick={() => setLightboxUrl(archDiagramByOrg[org.id])}
                        className="mt-1.5 block w-16 h-10 rounded overflow-hidden border border-border hover:border-primary transition-colors focus:outline-none"
                        title="View architecture diagram"
                      >
                        <img
                          src={archDiagramByOrg[org.id]}
                          alt="Architecture"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_SECTIONS.map((section, si) => {
                const isCollapsed = collapsedSections.has(si);
                return (
                  <>
                    <tr
                      key={`sh-${si}`}
                      className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
                      onClick={() => toggleSection(si)}
                    >
                      <td colSpan={filteredOrgs.length + 1} className="py-2 px-4 font-bold text-sm border-t border-border">
                        <div className="flex items-center gap-2">
                          <svg
                            className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0', isCollapsed ? '-rotate-90' : '')}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                          {section.title}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({section.rows.length})</span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && section.rows.map((row, ri) => (
                      <tr key={`r-${si}-${ri}`} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 text-foreground/70 border-r border-border/40 w-44">
                          <div className="flex items-center gap-1.5">
                            {row.label}
                            {row.fromQuestionnaire && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ClipboardList className="w-3 h-3 text-primary/50 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>From client questionnaire ({row.questionId})</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        {filteredOrgs.map(org => {
                          const entry = lookup[org.id]?.[row.questionId];
                          return (
                            <td key={org.id} className="py-2 px-3 border-r border-border/40 last:border-r-0">
                              <MatrixCell
                                orgId={org.id}
                                questionId={row.questionId}
                                initialValue={entry?.response ?? ""}
                                audit={entry}
                                isEmail={row.isEmail}
                                isPhone={row.isPhone}
                                isStatus={row.questionId === "meta.prod_status"}
                                isGotcha={section.title === "Known Gotchas / Exceptions"}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Architecture diagram lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => { if (!open) setLightboxUrl(null); }}>
        <DialogContent className="max-w-5xl w-full p-2 bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>Architecture Diagram</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Architecture diagram"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
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
