import { useEffect, useRef, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download, Upload, Plus, Mail, Edit, RotateCcw, LogOut, UserCircle, FileUp, Headphones, AlertTriangle, AlertCircle, Info, Image, CheckSquare, BarChart3, Copy, Check, Clock } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"connectivity" | "impl-dashboard" | "dashboard" | "organizations" | "users" | "templates" | "partners" | "specs" | "support-hub">("connectivity");

  // Support Hub state
  const [hubNotes, setHubNotes] = useState<Record<number, string>>({});
  const [hubIssues, setHubIssues] = useState<Record<number, { text: string; severity: "low" | "medium" | "high"; resolved: boolean }[]>>({});
  const [hubDiagrams, setHubDiagrams] = useState<Record<number, { name: string; url: string; isImage: boolean }[]>>({});
  const [newIssueText, setNewIssueText] = useState<Record<number, string>>({});
  const [newIssueSeverity, setNewIssueSeverity] = useState<Record<number, "low" | "medium" | "high">>({});
  const [hubDiagramRefs] = useState<Record<number, React.RefObject<HTMLInputElement>>>({});

  const getHubDiagramRef = (orgId: number): React.RefObject<HTMLInputElement> => {
    if (!hubDiagramRefs[orgId]) {
      (hubDiagramRefs as any)[orgId] = { current: null };
    }
    return hubDiagramRefs[orgId];
  };

  const handleHubDiagramUpload = (orgId: number, files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      isImage: file.type.startsWith("image/"),
    }));
    setHubDiagrams(prev => ({ ...prev, [orgId]: [...(prev[orgId] || []), ...newFiles] }));
  };

  const addHubIssue = (orgId: number) => {
    const text = newIssueText[orgId]?.trim();
    if (!text) return;
    const severity = newIssueSeverity[orgId] || "medium";
    setHubIssues(prev => ({
      ...prev,
      [orgId]: [...(prev[orgId] || []), { text, severity, resolved: false }],
    }));
    setNewIssueText(prev => ({ ...prev, [orgId]: "" }));
  };

  const toggleIssueResolved = (orgId: number, idx: number) => {
    setHubIssues(prev => ({
      ...prev,
      [orgId]: (prev[orgId] || []).map((issue, i) =>
        i === idx ? { ...issue, resolved: !issue.resolved } : issue
      ),
    }));
  };

  const exportSupportHubCSV = () => {
    if (!orgs || !metrics) return;
    const rows = [
      ["Organization", "Partner", "Status", "Completion %", "Sections Complete", "Files", "Open Issues", "Notes"],
    ];
    orgs.forEach(org => {
      const m = metricsMap[org.id];
      const partner = org.clientId ? clientMap[org.clientId] || "" : "";
      const openIssues = (hubIssues[org.id] || []).filter(i => !i.resolved).length;
      rows.push([
        org.name,
        partner,
        org.status || "",
        String(m?.completionPercent || 0),
        String(m?.sectionsComplete || 0),
        String(m?.files.length || 0),
        String(openIssues),
        hubNotes[org.id] || "",
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "support-hub-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="flex gap-6 mt-6 border-b border-border overflow-x-auto">
            <button
              onClick={() => setActiveTab("connectivity")}
              className={`pb-3 px-1 font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "connectivity"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="w-4 h-4" />
              Connectivity Matrix
              {activeTab === "connectivity" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("impl-dashboard")}
              className={`pb-3 px-1 font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "impl-dashboard"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              HL7 Layout
              {activeTab === "impl-dashboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
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
            <button
              onClick={() => setActiveTab("support-hub")}
              className={`pb-3 px-1 font-medium transition-colors relative flex items-center gap-1.5 ${
                activeTab === "support-hub"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Headphones className="w-4 h-4" />
              Support Hub
              {activeTab === "support-hub" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">

        {/* ── CONNECTIVITY MATRIX TAB ── */}
        {activeTab === "connectivity" && (
          <ConnectivityMatrix orgs={orgs || []} />
        )}

        {/* ── HL7 LAYOUT TAB ── */}
        {activeTab === "impl-dashboard" && (
          <HL7Layout orgs={orgs || []} />
        )}

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

        {/* ── SUPPORT HUB TAB ── */}
        {activeTab === "support-hub" && (
          <>
            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Headphones className="w-6 h-6 text-primary" />
                  Prod Support Hub
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Quick-reference for all clients — status, issues, diagrams, and notes in one place.
                </p>
              </div>
              <Button onClick={exportSupportHubCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Orgs", value: orgs?.length || 0, icon: <ClipboardList className="w-5 h-5 text-primary" /> },
                { label: "Active", value: orgs?.filter(o => o.status === "active").length || 0, icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> },
                { label: "Open Issues", value: Object.values(hubIssues).flat().filter(i => !i.resolved).length, icon: <AlertCircle className="w-5 h-5 text-red-500" /> },
                { label: "Avg Completion", value: `${orgs?.length ? Math.round((orgs.reduce((s, o) => s + (metricsMap[o.id]?.completionPercent || 0), 0)) / orgs.length) : 0}%`, icon: <BarChart3 className="w-5 h-5 text-blue-500" /> },
              ].map((stat, i) => (
                <Card key={i} className="border border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    {stat.icon}
                    <div>
                      <div className="text-xl font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Per-org reference cards */}
            <div className="space-y-6">
              {(orgs || []).map(org => {
                const m = metricsMap[org.id];
                const partner = org.clientId ? (clientMap[org.clientId] || `Partner ${org.clientId}`) : "Platform";
                const openIssues = (hubIssues[org.id] || []).filter(i => !i.resolved);
                const resolvedIssues = (hubIssues[org.id] || []).filter(i => i.resolved);
                const diagrams = hubDiagrams[org.id] || [];

                return (
                  <Card key={org.id} className="border border-border/50">
                    <CardContent className="p-0">
                      {/* Card header */}
                      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-3">
                          <ClipboardList className="w-5 h-5 text-primary" />
                          <div>
                            <div className="font-semibold">{org.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">{partner}</Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  org.status === "active" ? "border-green-500/50 text-green-600" :
                                  org.status === "completed" ? "border-blue-500/50 text-blue-600" :
                                  "border-muted-foreground/50"
                                }`}
                              >
                                {org.status || "active"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className={`text-xl font-bold ${m?.completionPercent === 100 ? "text-green-500" : "text-primary"}`}>
                              {m?.completionPercent || 0}%
                            </div>
                            <div className="text-xs text-muted-foreground">Intake</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold">{m?.files.length || 0}</div>
                            <div className="text-xs text-muted-foreground">Files</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-xl font-bold ${openIssues.length > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                              {openIssues.length}
                            </div>
                            <div className="text-xs text-muted-foreground">Open Issues</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/org/${org.slug}`, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Portal
                          </Button>
                        </div>
                      </div>

                      {/* Card body — 3-column layout */}
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">

                        {/* Column 1: Issues */}
                        <div className="p-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Issues
                          </h4>

                          {/* Add issue */}
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              placeholder="Add an issue..."
                              value={newIssueText[org.id] || ""}
                              onChange={e => setNewIssueText(prev => ({ ...prev, [org.id]: e.target.value }))}
                              onKeyDown={e => e.key === "Enter" && addHubIssue(org.id)}
                              className="flex-1 text-xs border border-border/50 rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <select
                              value={newIssueSeverity[org.id] || "medium"}
                              onChange={e => setNewIssueSeverity(prev => ({ ...prev, [org.id]: e.target.value as any }))}
                              className="text-xs border border-border/50 rounded px-1.5 py-1.5 bg-background"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Med</option>
                              <option value="high">High</option>
                            </select>
                            <Button size="sm" variant="outline" className="px-2" onClick={() => addHubIssue(org.id)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          {openIssues.length === 0 && resolvedIssues.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No issues logged</p>
                          ) : (
                            <div className="space-y-1.5">
                              {openIssues.map((issue, idx) => {
                                const realIdx = (hubIssues[org.id] || []).indexOf(issue);
                                return (
                                  <div key={idx} className="flex items-start gap-2">
                                    <button onClick={() => toggleIssueResolved(org.id, realIdx)} className="mt-0.5 shrink-0">
                                      <Circle className="w-3.5 h-3.5 text-muted-foreground hover:text-green-500" />
                                    </button>
                                    <span className={`text-xs flex-1 ${
                                      issue.severity === "high" ? "text-red-500" :
                                      issue.severity === "medium" ? "text-amber-500" : "text-foreground"
                                    }`}>{issue.text}</span>
                                    <Badge variant="outline" className={`text-[10px] shrink-0 ${
                                      issue.severity === "high" ? "border-red-500/50 text-red-500" :
                                      issue.severity === "medium" ? "border-amber-500/50 text-amber-500" :
                                      "border-border/50"
                                    }`}>{issue.severity}</Badge>
                                  </div>
                                );
                              })}
                              {resolvedIssues.length > 0 && (
                                <div className="pt-1 border-t border-border/30 space-y-1">
                                  {resolvedIssues.map((issue, idx) => {
                                    const realIdx = (hubIssues[org.id] || []).indexOf(issue);
                                    return (
                                      <div key={idx} className="flex items-start gap-2 opacity-50">
                                        <button onClick={() => toggleIssueResolved(org.id, realIdx)} className="mt-0.5 shrink-0">
                                          <CheckSquare className="w-3.5 h-3.5 text-green-500" />
                                        </button>
                                        <span className="text-xs line-through flex-1">{issue.text}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Column 2: Notes */}
                        <div className="p-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-500" />
                            Notes
                          </h4>
                          <textarea
                            value={hubNotes[org.id] || ""}
                            onChange={e => setHubNotes(prev => ({ ...prev, [org.id]: e.target.value }))}
                            placeholder="Support notes, escalation contacts, known configs..."
                            rows={5}
                            className="w-full text-xs border border-border/50 rounded px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {/* Column 3: Diagrams */}
                        <div className="p-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Image className="w-4 h-4 text-purple-500" />
                              Diagrams
                            </span>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf,.svg"
                                multiple
                                className="hidden"
                                onChange={e => handleHubDiagramUpload(org.id, e.target.files)}
                              />
                              <span className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                Upload
                              </span>
                            </label>
                          </h4>
                          {diagrams.length === 0 ? (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf,.svg"
                                multiple
                                className="hidden"
                                onChange={e => handleHubDiagramUpload(org.id, e.target.files)}
                              />
                              <div className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center hover:border-primary/50 hover:bg-muted/20 transition-colors">
                                <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                                <p className="text-xs text-muted-foreground">Upload network or architecture diagrams</p>
                              </div>
                            </label>
                          ) : (
                            <div className="space-y-2">
                              {diagrams.map((d, i) => (
                                <div key={i} className="border border-border/50 rounded overflow-hidden">
                                  {d.isImage && (
                                    <img src={d.url} alt={d.name} className="w-full max-h-32 object-contain bg-muted/20" />
                                  )}
                                  <div className="flex items-center gap-1.5 p-2 bg-muted/20">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs flex-1 truncate">{d.name}</span>
                                    <a href={d.url} download={d.name}>
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                        <Download className="w-3 h-3" />
                                      </Button>
                                    </a>
                                  </div>
                                </div>
                              ))}
                              <label className="cursor-pointer block">
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.svg"
                                  multiple
                                  className="hidden"
                                  onChange={e => handleHubDiagramUpload(org.id, e.target.files)}
                                />
                                <div className="text-xs text-center text-primary hover:underline cursor-pointer">+ Add more</div>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HL7 Layout ───────────────────────────────────────────────────────────────

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
 *  but are stored the same way so they're fully editable and persistent. */
const MATRIX_SECTIONS: { title: string; rows: { label: string; questionId: string; isEmail?: boolean; isPhone?: boolean }[] }[] = [
  {
    title: "Organization",
    rows: [
      { label: "Go-Live Date",   questionId: "D.2" },
      { label: "Studies / Day",  questionId: "meta.studies_per_day" },
      { label: "Reading Group",  questionId: "meta.reading_group" },
      { label: "Status",         questionId: "meta.prod_status" },
    ],
  },
  {
    title: "Contacts",
    rows: [
      { label: "IT Contact",  questionId: "meta.it_contact_name" },
      { label: "Email",       questionId: "meta.it_contact_email", isEmail: true },
      { label: "Phone",       questionId: "meta.it_contact_phone", isPhone: true },
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
      { label: "Image Source",    questionId: "meta.dicom_image_source" },
      { label: "Org AE Title",    questionId: "meta.dicom_org_ae_title" },
      { label: "Org IP",          questionId: "meta.dicom_org_ip" },
      { label: "Org Port",        questionId: "meta.dicom_org_port" },
      { label: "Silverback IP",   questionId: "meta.dicom_sb_ip" },
      { label: "Silverback Port", questionId: "meta.dicom_sb_port" },
      { label: "NL IP",           questionId: "meta.dicom_nl_ip" },
      { label: "NL Port",         questionId: "meta.dicom_nl_port" },
    ],
  },
  {
    title: "HL7 Orders",
    rows: [
      { label: "Org HL7 IP",      questionId: "meta.hl7_ord_org_ip" },
      { label: "Org HL7 Port",    questionId: "meta.hl7_ord_org_port" },
      { label: "Silverback IP",   questionId: "meta.hl7_ord_sb_ip" },
      { label: "Silverback Port", questionId: "meta.hl7_ord_sb_port" },
      { label: "NL IP",           questionId: "meta.hl7_ord_nl_ip" },
      { label: "NL Port",         questionId: "meta.hl7_ord_nl_port" },
    ],
  },
  {
    title: "HL7 Results",
    rows: [
      { label: "NL IP",           questionId: "meta.hl7_res_nl_ip" },
      { label: "NL Port",         questionId: "meta.hl7_res_nl_port" },
      { label: "Silverback IP",   questionId: "meta.hl7_res_sb_ip" },
      { label: "Silverback Port", questionId: "meta.hl7_res_sb_port" },
      { label: "Org IP",          questionId: "meta.hl7_res_org_ip" },
      { label: "Org Port",        questionId: "meta.hl7_res_org_port" },
    ],
  },
  {
    title: "Known Gotchas / Exceptions",
    rows: [
      { label: "Accession Format",  questionId: "meta.accession_format" },
      { label: "Priors Available",  questionId: "meta.priors_available" },
      { label: "Downtime Behavior", questionId: "L.11" },
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
          <span className="font-mono text-sm">{saved || "—"}</span>
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
function ConnectivityMatrix({ orgs }: { orgs: { id: number; name: string; slug: string }[] }) {
  const utils = trpc.useUtils();
  const { data: allResponses = [], isLoading } = trpc.admin.getAllOrgResponses.useQuery();

  // Import dialog state
  const [importOpen, setImportOpen]         = useState(false);
  const [importPreview, setImportPreview]   = useState<{ rows: { organizationId: number; questionId: string; response: string }[]; errors: string[] } | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

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
          <h2 className="text-2xl font-bold">Production Connectivity Matrix</h2>
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
                      <strong className="text-foreground">{[...new Set(importPreview.rows.map(r => r.organizationId))].length}</strong> org{[...new Set(importPreview.rows.map(r => r.organizationId))].length !== 1 ? "s" : ""}.
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

      {orgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations accessible.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-44 min-w-[11rem] border-r border-border">Detail</th>
                {orgs.map(org => (
                  <th key={org.id} className="text-left py-3 px-4 font-bold min-w-[10rem] border-r border-border last:border-r-0">{org.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_SECTIONS.map((section, si) => (
                <>
                  <tr key={`sh-${si}`} className="bg-muted/20">
                    <td colSpan={orgs.length + 1} className="py-2 px-4 font-bold text-sm border-t border-border">
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map((row, ri) => (
                    <tr key={`r-${si}-${ri}`} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4 text-foreground/70 border-r border-border/40 w-44">{row.label}</td>
                      {orgs.map(org => {
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
              ))}
            </tbody>
          </table>
        </div>
      )}
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
