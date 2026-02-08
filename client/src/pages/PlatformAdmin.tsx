import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Plus, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

/**
 * Platform Admin Dashboard - New Lantern staff only (@newlantern.ai)
 * Shows ALL organizations across all partners (RadOne, SRV, etc.)
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

  const { data: orgs, isLoading, refetch } = trpc.admin.getAllOrganizations.useQuery();
  const { data: clients } = trpc.admin.getAllClients.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();
  
  const deactivateMutation = trpc.admin.deactivateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization deactivated");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to deactivate: ${error.message}`);
    },
  });

  const reactivateMutation = trpc.admin.reactivateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization reactivated");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to reactivate: ${error.message}`);
    },
  });

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
  const inactiveOrgs = orgs?.filter(o => o.status === "inactive") || [];

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
              <div className="text-2xl font-bold">{activeOrgs.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Organizations List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Active Organizations</CardTitle>
            <CardDescription>{activeOrgs.length} active projects</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead className="text-right">Files</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No active organizations
                    </TableCell>
                  </TableRow>
                ) : (
                  activeOrgs.map(org => {
                    const orgMetrics = metricsMap[org.id];
                    const partnerName = org.clientId ? clientMap[org.clientId] : "Unknown";
                    return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{partnerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {org.contactName}<br />
                          {org.contactEmail}
                        </TableCell>
                        <TableCell className="text-right">{orgMetrics?.userCount || 0}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-primary">
                            {orgMetrics?.completionPercent || 0}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{orgMetrics?.files.length || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Deactivate ${org.name}?`)) {
                                deactivateMutation.mutate({ organizationId: org.id });
                              }
                            }}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Deactivate
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Inactive Organizations List */}
        {inactiveOrgs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Inactive Organizations</CardTitle>
              <CardDescription>{inactiveOrgs.length} inactive projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveOrgs.map(org => {
                    const orgMetrics = metricsMap[org.id];
                    const partnerName = org.clientId ? clientMap[org.clientId] : "Unknown";
                    return (
                      <TableRow key={org.id} className="opacity-60">
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{partnerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {org.contactName}<br />
                          {org.contactEmail}
                        </TableCell>
                        <TableCell className="text-right">{orgMetrics?.userCount || 0}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-muted-foreground">
                            {orgMetrics?.completionPercent || 0}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{orgMetrics?.files.length || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Reactivate ${org.name}?`)) {
                                reactivateMutation.mutate({ organizationId: org.id });
                              }
                            }}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
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
      </div>
    </div>
  );
}
