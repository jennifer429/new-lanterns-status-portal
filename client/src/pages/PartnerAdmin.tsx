import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, ExternalLink, Users, FileText, Download } from "lucide-react";

interface PartnerAdminProps {
  partnerName: string; // "SRV" or "RadOne"
  allowedDomain: string; // "@srv.com" or "@radone.com"
}

/**
 * Partner Admin Dashboard - Shows only organizations for the specific partner
 * Access controlled by email domain
 */
export default function PartnerAdmin({ partnerName, allowedDomain }: PartnerAdminProps) {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Access control: Partner admins must have a clientId
  useEffect(() => {
    if (!authLoading && (!user || !user.clientId)) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  // Get organizations and metrics filtered by user's clientId
  const { data: orgs, isLoading } = trpc.admin.getAllOrganizations.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();

  // Create metrics map for quick lookup
  const metricsMap = metrics?.reduce((acc, m) => {
    acc[m.organizationId] = m;
    return acc;
  }, {} as Record<number, typeof metrics[number]>) || {};

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{partnerName} Admin</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your organizations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation(`/org/${partnerName}/admin/users`)}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
              <Button onClick={() => setLocation(`/org/${partnerName}/admin/create`)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Stats Card */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgs?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgs?.filter(o => o.status === "active").length || 0} active
            </p>
          </CardContent>
        </Card>

        {/* Organizations List */}
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              All organizations managed by {partnerName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!orgs || orgs.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No organizations yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setLocation(`/org/${partnerName}/admin/create`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Organization
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {orgs.map(org => {
                  const orgMetrics = metricsMap[org.id];
                  return (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg">{org.name}</h3>
                        <Badge variant={org.status === "active" ? "default" : "secondary"}>
                          {org.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {org.contactName && `${org.contactName} • `}
                        {org.contactEmail}
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
                      {org.startDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Started: {org.startDate}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
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
      </div>
    </div>
  );
}
