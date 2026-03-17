/**
 * Admin Dashboard - View and access all client portals with metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { questionnaireSections } from "@shared/questionnaireData";
import { transformSectionProgress } from "@/lib/adminUtils";
import { Link } from "wouter";
import { ExternalLink, Building2, Calendar, CheckCircle2, Clock, Users, TrendingUp, Activity, FileText, Download, Trash2, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { FilesManagement } from "@/components/FilesManagement";
import { OrganizationManagement } from "@/components/OrganizationManagement";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";
import { UserMenu } from "@/components/UserMenu";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const { user } = useAuth();
  const { data: metrics, isLoading } = trpc.organizations.getMetrics.useQuery();
  const { data: allClients = [] } = trpc.admin.getAllClients.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

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
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 animate-page-in">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-purple-300 mt-1">PACS Implementation Portal</p>
              </div>
            </div>
            
            <UserMenu />
          </div>
        </div>
      </header>

      {/* PHI Disclaimer - Below header */}
      <PhiDisclaimer />

      {/* Main Content */}
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-black/40 border border-purple-500/20 mb-6">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">
              <FileText className="w-4 h-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="update-organizations" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">
              <Building2 className="w-4 h-4 mr-2" />
              Update Organizations
            </TabsTrigger>

          </TabsList>

          <TabsContent value="dashboard">
        <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white text-xl">Client Portals</CardTitle>
                <CardDescription className="text-gray-300">
                  Access implementation portals for all active clients
                </CardDescription>
              </div>

              {/* Filter controls */}
              <div className="flex flex-col gap-2 min-w-0 sm:min-w-[320px]">
                {/* Partner filter chips */}
                {allClients.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedClientId(null)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedClientId === null
                          ? "bg-purple-600 text-white"
                          : "bg-purple-900/40 text-purple-300 hover:bg-purple-800/50"
                      }`}
                    >
                      All Partners
                    </button>
                    {allClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => setSelectedClientId(
                          selectedClientId === client.id ? null : client.id
                        )}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedClientId === client.id
                            ? "bg-purple-600 text-white"
                            : "bg-purple-900/40 text-purple-300 hover:bg-purple-800/50"
                        }`}
                      >
                        {client.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Org search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-purple-400 pointer-events-none" />
                  <Input
                    placeholder="Search hospitals…"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-8 pr-8 h-8 text-xs bg-purple-900/20 border-purple-500/30 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
                  />
                  {orgSearch && (
                    <button
                      onClick={() => setOrgSearch("")}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Active filter summary */}
                {(selectedClientId !== null || orgSearch) && (
                  <p className="text-xs text-purple-300">
                    Showing {filteredMetrics.length} of {metrics?.length ?? 0} portals
                    {selectedClientId !== null && (
                      <> · Partner: <span className="font-semibold">{allClients.find(c => c.id === selectedClientId)?.name}</span></>
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
                  className="border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-purple-400" />
                        <CardTitle className="text-white text-base">{org.name}</CardTitle>
                      </div>
                      {org.status === "active" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Completion Percentage */}
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-white font-semibold">{org.completionPercentage}%</div>
                          <div className="text-xs text-gray-400">Complete</div>
                        </div>
                      </div>

                      {/* User Count */}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-white font-semibold">{org.userCount}</div>
                          <div className="text-xs text-gray-400">Users</div>
                        </div>
                      </div>

                      {/* File Count */}
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <div className="text-white font-semibold">{org.fileCount || 0}</div>
                          <div className="text-xs text-gray-400">Files</div>
                        </div>
                      </div>
                    </div>

                    {/* Overall Progress Panel */}
                    <div className="border-t border-purple-500/20 pt-3 mt-3">
                      <h3 className="text-white font-semibold text-sm mb-1">Questionnaire Progress</h3>
                      <p className="text-xs text-gray-400 mb-3">
                        {Object.values(org.sectionProgress || {}).filter((s: any) => s.completed === s.total && s.total > 0).length} of {questionnaireSections.length} sections complete
                      </p>
                      
                      {/* Big Percentage Display */}
                      <div className="bg-purple-900/30 border-2 border-purple-500/40 rounded-lg p-4 mb-3 text-center">
                        <div className="text-5xl font-bold text-purple-400">{org.completionPercentage}%</div>
                        <div className="text-sm text-gray-300 mt-1">Complete</div>
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
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  isComplete 
                                    ? 'border-green-400 bg-green-400' 
                                    : 'border-gray-500'
                                }`}>
                                  {isComplete && (
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <span className="text-gray-300">{section.title}</span>
                              </div>
                              <span className="text-white font-semibold">{percentage}%</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Ready Status */}
                      <div className="mt-3 text-xs text-gray-400">
                        {org.completionPercentage === 100 ? 'Ready' : 'In Progress'}
                      </div>
                    </div>

                    {/* Uploaded Files */}
                    {org.files && org.files.length > 0 && (
                      <div className="border-t border-purple-500/20 pt-2">
                        <div className="text-xs text-gray-400 mb-2">Uploaded Files:</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {org.files.map((file: any, idx: number) => (
                            <a
                              key={idx}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{file.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last Login */}
                    <div className="flex items-center gap-2 text-xs text-gray-300 border-t border-purple-500/20 pt-2">
                      <Activity className="w-3 h-3 text-purple-400" />
                      <span>
                        Last login: {org.lastLoginAt 
                          ? formatDistanceToNow(new Date(org.lastLoginAt), { addSuffix: true })
                          : "Never"}
                      </span>
                    </div>


                    {/* Phase Navigation Buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Link href={`/org/${org.slug}/intake`}>
                        <Button
                          variant="outline"
                          className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200"
                          size="sm"
                        >
                          Questionnaire
                        </Button>
                      </Link>
                      <Link href={`/org/${org.slug}/validation`}>
                        <Button
                          variant="outline"
                          className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200"
                          size="sm"
                        >
                          Testing
                        </Button>
                      </Link>
                      <Link href={`/org/${org.slug}/implement`}>
                        <Button
                          variant="outline"
                          className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200"
                          size="sm"
                        >
                          Task List
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredMetrics.length === 0 && (
              <div className="text-center py-12 text-gray-400">
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
