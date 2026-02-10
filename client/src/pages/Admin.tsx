/**
 * Admin Dashboard - View and access all client portals with metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { questionnaireSections } from "@shared/questionnaireData";
import { Link } from "wouter";
import { ExternalLink, Building2, Calendar, CheckCircle2, Clock, Users, TrendingUp, Activity, FileText, Download, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { FilesManagement } from "@/components/FilesManagement";
import { OrganizationManagement } from "@/components/OrganizationManagement";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user } = useAuth();
  const { data: metrics, isLoading } = trpc.organizations.getMetrics.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/20 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-purple-300 mt-1">PACS Implementation Portal</p>
              </div>
            </div>
            
            {/* Profile Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-full bg-purple-600 border-purple-400 hover:bg-purple-500 text-white font-semibold"
                >
                  {user?.name ? getInitials(user.name) : "AD"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-black border-purple-500/30">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">{user?.name || "Admin"}</p>
                  <p className="text-xs text-gray-400">{user?.email || ""}</p>
                </div>
                <DropdownMenuSeparator className="bg-purple-500/20" />
                <DropdownMenuItem
                  className="text-gray-300 hover:text-white hover:bg-purple-600 cursor-pointer"
                  onClick={() => alert("Edit profile coming soon")}
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-300 hover:text-white hover:bg-purple-600 cursor-pointer"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <CardTitle className="text-white text-xl">Client Portals</CardTitle>
            <CardDescription className="text-gray-300">
              Access implementation portals for all active clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics?.map((org) => (
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
                      <h3 className="text-white font-semibold text-sm mb-1">Overall Progress</h3>
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


                    {/* Open Portal Button */}
                    <Link href={`/org/${org.slug}/intake`}>
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Portal
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(!metrics || metrics.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                No client portals found
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
