import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardList, Users, FileText, Download, LogOut, Settings, ChevronDown, ListChecks, History, FolderOpen, Eye } from "lucide-react";
import { toast } from "sonner";
import { AdminChatWidget } from "@/components/AdminChatWidget";
import { AiAuditLog } from "@/components/AiAuditLog";
import { ConnectivityMatrix } from "./admin/ConnectivityMatrix";
import { AdminDashboardTab } from "./admin/AdminDashboardTab";
import { OrgsTab } from "./admin/OrgsTab";
import { UsersTab } from "./admin/UsersTab";
import { TaskTemplatesTab } from "./admin/TaskTemplatesTab";
import { TemplatesTab } from "./admin/TemplatesTab";
import { PartnersTab } from "./admin/PartnersTab";
import { SpecsTab } from "./admin/SpecsTab";
import { VendorPicklistsTab } from "./admin/VendorPicklistsTab";
import ProceduralLibrary from "./ProceduralLibrary";

/** Thin wrapper that renders ProceduralLibrary inline within the admin layout */
function ProceduralLibraryEmbed() {
  return <ProceduralLibrary />;
}

type Tab = "prod-dashboard" | "impl-dashboard" | "orgs" | "users" | "templates" | "task-templates" | "partners" | "specs" | "vendor-picklists" | "audit-log" | "library";

function getPartnerDisplayName(user: any, clients?: any[]): string {
  if (!user?.clientId) return "Platform";
  if (clients) {
    const client = clients.find((c: any) => c.id === user.clientId);
    if (client) return client.name;
  }
  return `Partner ${user.clientId}`;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function csvEscape(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function PlatformAdmin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("impl-dashboard");
  // Platform admins can preview the console scoped to a single partner.
  // Survives reload via sessionStorage; partner admins ignore this.
  const [viewAsClientId, setViewAsClientIdRaw] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("admin.viewAsClientId");
    return stored ? Number(stored) : null;
  });
  const setViewAsClientId = (id: number | null) => {
    setViewAsClientIdRaw(id);
    if (typeof window !== "undefined") {
      if (id === null) sessionStorage.removeItem("admin.viewAsClientId");
      else sessionStorage.setItem("admin.viewAsClientId", String(id));
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/");
  }, [user, authLoading, setLocation]);

  const isTruePlatformAdmin = user?.clientId === null || user?.clientId === undefined;

  const { data: orgs, isLoading, refetch: refetchOrgs } = trpc.admin.getAllOrganizations.useQuery();
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  // Effective scope: partner admins always see their own clientId; platform admins
  // either see everything or, while previewing, only the selected partner.
  const effectiveClientId = isTruePlatformAdmin ? viewAsClientId : (user?.clientId ?? null);
  const isPlatformAdmin = effectiveClientId === null;
  const viewedPartnerName = effectiveClientId
    ? (clients?.find(c => c.id === effectiveClientId)?.name ?? "")
    : "";

  const scopedOrgs = effectiveClientId
    ? (orgs ?? []).filter(o => o.clientId === effectiveClientId)
    : (orgs ?? []);
  const scopedClients = effectiveClientId
    ? (clients ?? []).filter(c => c.id === effectiveClientId)
    : (clients ?? []);
  const scopedOrgIds = new Set(scopedOrgs.map(o => o.id));
  const scopedUsers = effectiveClientId
    ? (allUsers ?? []).filter(u =>
        (u.organizationId != null && scopedOrgIds.has(u.organizationId)) ||
        (u.role === "admin" && u.clientId === effectiveClientId)
      )
    : (allUsers ?? []);
  const scopedMetrics = effectiveClientId
    ? metrics?.filter(m => scopedOrgIds.has(m.organizationId))
    : metrics;

  // If the active tab becomes unavailable (e.g. Partners/Specs while previewing), fall back.
  useEffect(() => {
    if (!isPlatformAdmin && (activeTab === "partners" || activeTab === "specs")) {
      setActiveTab("impl-dashboard");
    }
  }, [isPlatformAdmin, activeTab]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; },
  });

  const handleExportAll = () => {
    const lines = ["Type,Name,Email,Organization,Partner,Role,Status,Completion %,Last Login"];
    scopedOrgs.forEach(org => {
      const orgMetrics = scopedMetrics?.find(m => m.organizationId === org.id);
      const partnerName = org.clientId ? clients?.find(c => c.id === org.clientId)?.name || "N/A" : "N/A";
      lines.push([csvEscape("Organization"), csvEscape(org.name), "", "", csvEscape(partnerName), "", csvEscape(org.status), `${orgMetrics?.completionPercent || 0}%`, ""].join(","));
    });
    scopedUsers.forEach(u => {
      const org = scopedOrgs.find(o => o.id === u.organizationId);
      const partnerName = org?.clientId ? clients?.find(c => c.id === org.clientId)?.name || "N/A" : "N/A";
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never";
      lines.push([csvEscape("User"), csvEscape(u.name), csvEscape(u.email), csvEscape(org?.name), csvEscape(partnerName), csvEscape(u.role), u.organizationId ? "Active" : "Inactive", "", csvEscape(lastLogin)].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded successfully");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const headerTitle = isPlatformAdmin
    ? "Platform Admin"
    : isTruePlatformAdmin
      ? `${viewedPartnerName} Admin`
      : `${getPartnerDisplayName(user, clients)} Admin`;
  const headerSubtitle = isPlatformAdmin
    ? "New Lantern - All Partners"
    : isTruePlatformAdmin
      ? "Previewing partner view"
      : "Manage your organizations";

  const sharedProps = {
    isPlatformAdmin,
    orgs: scopedOrgs,
    refetchOrgs,
    clients: scopedClients,
    allUsers: scopedUsers,
    refetchUsers,
  };

  const adminTabs: Tab[] = ["users", "orgs", "templates", "task-templates", "partners", "specs", "vendor-picklists", "library", "audit-log"];

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="container py-3 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 sm:h-12 shrink-0" />
            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-base sm:text-3xl font-bold text-foreground truncate">{headerTitle}</h1>
              <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 truncate">
                {headerSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {isTruePlatformAdmin && (clients?.length ?? 0) > 0 && (
                <Select
                  value={viewAsClientId === null ? "platform" : String(viewAsClientId)}
                  onValueChange={(v) => setViewAsClientId(v === "platform" ? null : Number(v))}
                >
                  <SelectTrigger className="h-8 sm:h-9 w-32 sm:w-44 text-xs sm:text-sm gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="View as…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Platform (All)</SelectItem>
                    {clients?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={handleExportAll} className="gap-2 h-8 sm:h-9 px-2 sm:px-3" title="Export a CSV summary of all organizations and users">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export Orgs &amp; Users</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary border-primary/40 hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm">
                    {user?.name ? getInitials(user.name) : "AD"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name || "Admin"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={handleExportAll}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Orgs &amp; Users (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => logoutMutation.mutate()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 sm:gap-4 mt-3 sm:mt-6 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab("prod-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === "prod-dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Connectivity Matrix
              {activeTab === "prod-dashboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab("impl-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap shrink-0 ${activeTab === "impl-dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Admin Dashboard
              {activeTab === "impl-dashboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1 shrink-0 ${adminTabs.includes(activeTab) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <Settings className="w-4 h-4" />
                  Admin
                  <ChevronDown className="w-3 h-3" />
                  {adminTabs.includes(activeTab) && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setActiveTab("users")} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />Users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("orgs")} className="cursor-pointer">
                  <ClipboardList className="mr-2 h-4 w-4" />Organizations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("templates")} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("task-templates")} className="cursor-pointer">
                  <ClipboardList className="mr-2 h-4 w-4" />Task Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("vendor-picklists")} className="cursor-pointer">
                  <ListChecks className="mr-2 h-4 w-4" />Vendor Picklists
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("library")} className="cursor-pointer">
                  <FolderOpen className="mr-2 h-4 w-4" />Document Library
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("audit-log")} className="cursor-pointer">
                  <History className="mr-2 h-4 w-4" />AI Audit Log
                </DropdownMenuItem>
                {isPlatformAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveTab("partners")} className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />Partners
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("specs")} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />Specifications
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Preview banner — only shown when a true Platform admin is scoping the view to one partner */}
      {isTruePlatformAdmin && viewAsClientId !== null && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs sm:text-sm">
          <div className="container py-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Previewing as <strong className="text-amber-200">{viewedPartnerName}</strong> partner admin — data is scoped to this partner.
              </span>
            </span>
            <button
              onClick={() => setViewAsClientId(null)}
              className="underline hover:no-underline shrink-0 text-amber-200"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container py-5">
        {activeTab === "prod-dashboard" && (
          <ConnectivityMatrix orgs={scopedOrgs
            .filter(o => o.status === "active")
            .map(o => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              partnerName: o.clientId && clients ? (clients.find(c => c.id === o.clientId)?.name ?? "") : "",
            }))}
          />
        )}
        {activeTab === "impl-dashboard" && <AdminDashboardTab {...sharedProps} metrics={scopedMetrics} />}
        {activeTab === "orgs" && <OrgsTab {...sharedProps} metrics={scopedMetrics} />}
        {activeTab === "users" && <UsersTab {...sharedProps} />}
        {activeTab === "task-templates" && <TaskTemplatesTab isPlatformAdmin={isPlatformAdmin} clients={scopedClients} />}
        {activeTab === "templates" && <TemplatesTab isPlatformAdmin={isPlatformAdmin} clients={scopedClients} />}
        {activeTab === "partners" && isPlatformAdmin && <PartnersTab clients={clients || []} orgs={orgs || []} refetchOrgs={refetchOrgs} />}
        {activeTab === "specs" && isPlatformAdmin && <SpecsTab />}
        {activeTab === "vendor-picklists" && <VendorPicklistsTab />}
        {activeTab === "audit-log" && <AiAuditLog />}
        {activeTab === "library" && <ProceduralLibraryEmbed />}
      </div>

      <AdminChatWidget isPlatformAdmin={isPlatformAdmin} />
    </div>
  );
}
