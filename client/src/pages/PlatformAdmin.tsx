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
import { ClipboardList, Users, FileText, Download, LogOut, Settings, ChevronDown, ListChecks, History } from "lucide-react";
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

type Tab = "prod-dashboard" | "impl-dashboard" | "orgs" | "users" | "templates" | "task-templates" | "partners" | "specs" | "vendor-picklists" | "audit-log";

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

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/");
  }, [user, authLoading, setLocation]);

  const isPlatformAdmin = user?.clientId === null || user?.clientId === undefined;

  const { data: orgs, isLoading, refetch: refetchOrgs } = trpc.admin.getAllOrganizations.useQuery();
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; },
  });

  const handleExportAll = () => {
    const lines = ["Type,Name,Email,Organization,Partner,Role,Status,Completion %,Last Login"];
    orgs?.forEach(org => {
      const orgMetrics = metrics?.find(m => m.organizationId === org.id);
      const partnerName = org.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || "N/A" : "N/A";
      lines.push([csvEscape("Organization"), csvEscape(org.name), "", "", csvEscape(partnerName), "", csvEscape(org.status), `${orgMetrics?.completionPercent || 0}%`, ""].join(","));
    });
    allUsers?.forEach(u => {
      const org = orgs?.find(o => o.id === u.organizationId);
      const partnerName = org?.clientId && clients ? clients.find(c => c.id === org.clientId)?.name || "N/A" : "N/A";
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

  const headerTitle = isPlatformAdmin ? "Platform Admin" : `${getPartnerDisplayName(user, clients)} Admin`;
  const headerSubtitle = isPlatformAdmin ? "New Lantern - All Partners" : "Manage your organizations";

  const sharedProps = {
    isPlatformAdmin,
    orgs: orgs || [],
    refetchOrgs,
    clients: clients || [],
    allUsers: allUsers || [],
    refetchUsers,
  };

  const adminTabs: Tab[] = ["users", "orgs", "templates", "task-templates", "partners", "specs", "vendor-picklists", "audit-log"];

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
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-none">
                {headerSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={handleExportAll} className="gap-2 px-2 sm:px-3">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export All</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-10 rounded-full bg-purple-600 border-purple-400 hover:bg-purple-500 text-white font-semibold">
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
                    Export All Data
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
          <div className="flex items-center gap-4 mt-4 sm:mt-6 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab("prod-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === "prod-dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Connectivity Matrix
              {activeTab === "prod-dashboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab("impl-dashboard")}
              className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap shrink-0 ${activeTab === "impl-dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Admin Dashboard
              {activeTab === "impl-dashboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`pb-2 sm:pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1 shrink-0 ${adminTabs.includes(activeTab) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
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

      {/* Main Content */}
      <div className="container py-5">
        {activeTab === "prod-dashboard" && (
          <ConnectivityMatrix orgs={(orgs || [])
            .filter(o => o.status === "active")
            .map(o => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              partnerName: o.clientId && clients ? (clients.find(c => c.id === o.clientId)?.name ?? "") : "",
            }))}
          />
        )}
        {activeTab === "impl-dashboard" && <AdminDashboardTab {...sharedProps} metrics={metrics} />}
        {activeTab === "orgs" && <OrgsTab {...sharedProps} metrics={metrics} />}
        {activeTab === "users" && <UsersTab {...sharedProps} />}
        {activeTab === "task-templates" && <TaskTemplatesTab isPlatformAdmin={isPlatformAdmin} clients={clients || []} />}
        {activeTab === "templates" && <TemplatesTab isPlatformAdmin={isPlatformAdmin} clients={clients || []} />}
        {activeTab === "partners" && isPlatformAdmin && <PartnersTab clients={clients || []} orgs={orgs || []} refetchOrgs={refetchOrgs} />}
        {activeTab === "specs" && isPlatformAdmin && <SpecsTab />}
        {activeTab === "vendor-picklists" && <VendorPicklistsTab />}
        {activeTab === "audit-log" && <AiAuditLog />}
      </div>

      <AdminChatWidget isPlatformAdmin={!user?.clientId} />
    </div>
  );
}
