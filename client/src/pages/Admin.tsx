/**
 * Admin Dashboard - View and access all client portals with metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { questionnaireSections } from "@shared/questionnaireData";
import { Link } from "wouter";
import { ExternalLink, Building2, CheckCircle2, Clock, Users, TrendingUp, Activity, FileText, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserManagement } from "@/components/UserManagement";
import { FilesManagement } from "@/components/FilesManagement";
import { OrganizationManagement } from "@/components/OrganizationManagement";
import { useState, useMemo } from "react";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const { data: metrics, isLoading } = trpc.organizations.getMetrics.useQuery();
  const { data: allClients = [] } = trpc.admin.getAllClients.useQuery();

  const filteredMetrics = useMemo(() => {
    if (!metrics) return [];
    return metrics.filter((org) => {
      const matchesPartner = selectedClientId === null || org.clientId === selectedClientId;
      const matchesSearch = orgSearch.trim() === "" ||
        org.name.toLowerCase().includes(orgSearch.trim().toLowerCase());
      return matchesPartner && matchesSearch;
    });
  }, [metrics, selectedClientId, orgSearch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Admin Dashboard</div>
              <div className="text-xs text-muted-foreground truncate">PACS Implementation Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
          </div>
        </div>
      </header>

      <PhiDisclaimer />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="dashboard">
              <Activity className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Files</span>
            </TabsTrigger>
            <TabsTrigger value="update-organizations">
              <Building2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Update Organizations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Card className="card-elevated overflow-hidden">
              {/* Top accent gradient — matches Home ProgressHero */}
              <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Client Portals</CardTitle>
                    <CardDescription>
                      Access implementation portals for all active clients
                    </CardDescription>
                  </div>

                  {/* Filter controls */}
                  <div className="flex flex-col gap-2 min-w-0 sm:min-w-[320px]">
                    {/* Partner filter dropdown */}
                    {allClients.length > 0 && (
                      <Select
                        value={selectedClientId === null ? "all" : String(selectedClientId)}
                        onValueChange={(v) => setSelectedClientId(v === "all" ? null : Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All Partners" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Partners</SelectItem>
                          {allClients.map((client) => (
                            <SelectItem key={client.id} value={String(client.id)} className="text-xs">
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Org search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search hospitals…"
                        value={orgSearch}
                        onChange={(e) => setOrgSearch(e.target.value)}
                        className="pl-8 pr-8 h-8 text-xs"
                      />
                      {orgSearch && (
                        <button
                          onClick={() => setOrgSearch("")}
                          className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Active filter summary */}
                    {(selectedClientId !== null || orgSearch) && (
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredMetrics.length} of {metrics?.length ?? 0} portals
                        {selectedClientId !== null && (
                          <> · Partner: <span className="font-semibold text-foreground">{allClients.find(c => c.id === selectedClientId)?.name}</span></>
                        )}
                        <button
                          onClick={() => { setSelectedClientId(null); setOrgSearch(""); }}
                          className="ml-2 underline hover:no-underline"
                        >
                          Clear
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMetrics.map((org) => (
                    <Card
                      key={org.id}
                      className="card-elevated card-clickable overflow-hidden"
                    >
                      <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                            <CardTitle className="text-base truncate">{org.name}</CardTitle>
                          </div>
                          {org.status === "active" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Completion Percentage */}
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <div className="font-semibold">{org.completionPercentage}%</div>
                              <div className="text-xs text-muted-foreground">Complete</div>
                            </div>
                          </div>

                          {/* User Count */}
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <div className="font-semibold">{org.userCount}</div>
                              <div className="text-xs text-muted-foreground">Users</div>
                            </div>
                          </div>

                          {/* File Count */}
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <div className="font-semibold">{org.fileCount || 0}</div>
                              <div className="text-xs text-muted-foreground">Files</div>
                            </div>
                          </div>
                        </div>

                        {/* Overall Progress Panel */}
                        <div className="border-t border-border/60 pt-3 mt-3">
                          <h3 className="font-semibold text-sm mb-1">Questionnaire Progress</h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            {Object.values(org.sectionProgress || {}).filter((s: any) => s.completed === s.total && s.total > 0).length} of {questionnaireSections.length} sections complete
                          </p>

                          {/* Big Percentage Display */}
                          <div
                            className={cn(
                              "rounded-lg border p-4 mb-3 text-center transition-colors",
                              org.completionPercentage === 100
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-primary/5 border-primary/20"
                            )}
                          >
                            <div
                              className={cn(
                                "text-5xl font-bold tracking-tight",
                                org.completionPercentage === 100 ? "text-emerald-500" : "text-primary"
                              )}
                            >
                              {org.completionPercentage}%
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Complete</div>
                          </div>

                          {/* Section Checklist */}
                          <div className="space-y-2">
                            {questionnaireSections.map((section) => {
                              const stats = org.sectionProgress?.[section.title];
                              const percentage = stats && stats.total > 0
                                ? Math.round((stats.completed / stats.total) * 100)
                                : 0;
                              const isComplete = stats && stats.completed === stats.total && stats.total > 0;

                              return (
                                <div key={section.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div
                                      className={cn(
                                        "progress-dot",
                                        isComplete ? "progress-dot-complete" : "progress-dot-empty"
                                      )}
                                    />
                                    <span className="text-muted-foreground">{section.title}</span>
                                  </div>
                                  <span className="font-semibold">{percentage}%</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Ready Status */}
                          <div className="mt-3 text-xs text-muted-foreground">
                            {org.completionPercentage === 100 ? 'Ready' : 'In Progress'}
                          </div>
                        </div>

                        {/* Task Summary */}
                        {org.taskStats && (
                          <div className="border-t border-border/60 pt-3 mt-1">
                            <h3 className="font-semibold text-sm mb-2">Task Summary</h3>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-3xl font-bold text-primary tracking-tight">
                                {(() => {
                                  const applicable = org.taskStats.total - (org.taskStats.notApplicable ?? 0);
                                  const weighted = org.taskStats.completed + (org.taskStats.inProgress ?? 0) * 0.5 + (org.taskStats.blocked ?? 0) * 0.25;
                                  return applicable > 0 ? Math.round((weighted / applicable) * 100) : 0;
                                })()}%
                              </span>
                              <span className="text-xs text-muted-foreground">Complete</span>
                            </div>
                            <div className="space-y-1.5">
                              {([
                                { label: "Done",        count: org.taskStats.completed,    dotCls: "bg-emerald-500", numCls: "text-emerald-500" },
                                { label: "In Progress", count: org.taskStats.inProgress,   dotCls: "bg-amber-400",   numCls: "text-amber-500" },
                                { label: "Blocked",     count: org.taskStats.blocked,      dotCls: "bg-red-500",     numCls: "text-red-500" },
                                { label: "Open",        count: org.taskStats.total - org.taskStats.completed - org.taskStats.inProgress - org.taskStats.blocked - org.taskStats.notApplicable, dotCls: "bg-muted-foreground/50", numCls: "text-muted-foreground" },
                                { label: "N/A",         count: org.taskStats.notApplicable, dotCls: "bg-muted-foreground/30", numCls: "text-muted-foreground/70" },
                              ] as const).map(({ label, count, dotCls, numCls }) => (
                                <div key={label} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
                                    <span className="text-muted-foreground">{label}</span>
                                  </div>
                                  <span className={`font-semibold ${numCls}`}>{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Uploaded Files */}
                        {org.files && org.files.length > 0 && (
                          <div className="border-t border-border/60 pt-2">
                            <div className="text-xs text-muted-foreground mb-2">Uploaded Files:</div>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {org.files.map((file: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-primary hover:underline transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{file.fileName}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Last Login */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/60 pt-2">
                          <Activity className="w-3 h-3 text-primary" />
                          <span>
                            Last login: {org.lastLoginAt
                              ? formatDistanceToNow(new Date(org.lastLoginAt), { addSuffix: true })
                              : "Never"}
                          </span>
                        </div>


                        {/* Phase Navigation Buttons */}
                        {(() => {
                          const orgClientSlug = allClients.find(c => c.id === org.clientId)?.slug;
                          const prefix = orgClientSlug ? `/org/${orgClientSlug}/${org.slug}` : `/org/${org.slug}`;
                          return (
                            <div className="grid grid-cols-3 gap-1.5">
                              <Link href={`${prefix}/intake`}>
                                <Button variant="outline" size="sm" className="w-full text-xs">
                                  Questionnaire
                                </Button>
                              </Link>
                              <Link href={`${prefix}/validation`}>
                                <Button variant="outline" size="sm" className="w-full text-xs">
                                  Testing
                                </Button>
                              </Link>
                              <Link href={`${prefix}/implement`}>
                                <Button variant="outline" size="sm" className="w-full text-xs">
                                  Task List
                                </Button>
                              </Link>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredMetrics.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    {metrics?.length === 0 ? "No client portals found" : "No portals match the current filter"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="files">
            <FilesManagement />
          </TabsContent>

          <TabsContent value="update-organizations">
            <OrganizationManagement />
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
}
