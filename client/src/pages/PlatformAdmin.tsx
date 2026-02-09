import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download, Plus } from "lucide-react";
import { toast } from "sonner";

/**
 * Platform Admin Dashboard - New Lantern staff only (@newlantern.ai)
 * Shows ALL organizations as portal summary cards
 */
export default function PlatformAdmin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Access control: Only New Lantern staff (clientId = NULL)
  useEffect(() => {
    if (!authLoading && (!user || user.clientId !== null)) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const { data: orgs, isLoading } = trpc.admin.getAllOrganizations.useQuery();
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();

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

  const activeOrgs = orgs?.filter(o => o.status === "active") || [];

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
              <Button
                variant="outline"
                onClick={() => setLocation("/org/admin/users")}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
              <Button onClick={() => setLocation("/org/admin/create")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
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

                      {/* Last Login */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <Activity className="w-3 h-3" />
                        <span>Last login: about 5 hours ago</span>
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
      </div>
    </div>
  );
}
