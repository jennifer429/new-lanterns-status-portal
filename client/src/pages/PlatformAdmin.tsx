import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Plus, ExternalLink, FileText, Download, RotateCcw } from "lucide-react";

/**
 * Platform Admin Dashboard - New Lantern staff only (@newlantern.ai)
 * Shows ALL organizations across all partners (RadOne, SRV, etc.)
 */
export default function PlatformAdmin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Access control: Only New Lantern staff (clientId = 1 or NULL)
  useEffect(() => {
    if (!authLoading && (!user || (user.clientId !== null && user.clientId !== 1))) {
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

  // Group organizations by client
  const orgsByClient = orgs?.reduce((acc, org) => {
    const clientId = org.clientId || 0;
    if (!acc[clientId]) acc[clientId] = [];
    acc[clientId].push(org);
    return acc;
  }, {} as Record<number, typeof orgs>);

  // Create a map of organizationId -> metrics for quick lookup
  const metricsMap = metrics?.reduce((acc, m) => {
    acc[m.organizationId] = m;
    return acc;
  }, {} as Record<number, typeof metrics[number]>) || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Platform Admin</h1>
              <p className="text-sm text-muted-foreground mt-1">
                New Lantern - All Partners
              </p>
            </div>
            <Button onClick={() => setLocation("/org/admin/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orgs?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orgs?.filter(o => o.status === "active").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations by Partner */}
        {clients?.map((client: { id: number; name: string; slug: string; status: string }) => {
          const clientOrgs = orgsByClient?.[client.id] || [];
          return (
            <Card key={client.id} className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{client.name}</CardTitle>
                    <CardDescription>
                      {clientOrgs.length} organization{clientOrgs.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{client.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {clientOrgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No organizations yet</p>
                ) : (
                  <div className="space-y-2">
                    {clientOrgs.map(org => {
                      const orgMetrics = metricsMap[org.id];
                      return (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium">{org.name}</h3>
                            <Badge variant={org.status === "active" ? "default" : org.status === "inactive" ? "destructive" : "secondary"}>
                              {org.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {org.contactName} • {org.contactEmail}
                          </p>
                          {orgMetrics && (
                            <div className="flex items-center gap-6 text-sm">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span><strong>{orgMetrics.userCount}</strong> users</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Progress:</span>
                                <span className="font-semibold text-primary">{orgMetrics.completionPercent}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span><strong>{orgMetrics.files.length}</strong> files</span>
                                {orgMetrics.files.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => {
                                      // Download all files
                                      orgMetrics.files.forEach(f => {
                                        window.open(f.fileUrl, '_blank');
                                      });
                                    }}
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {org.status === "inactive" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // TODO: Implement reactivation
                                alert('Reactivation feature coming soon');
                              }}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reactivate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/org/${org.slug}/intake`)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
