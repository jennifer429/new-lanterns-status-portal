/**
 * Connectivity page — dedicated view for the Notion-backed connectivity matrix.
 * Accessed from the org dashboard quick-link card.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ConnectivityTable, type ConnectivityRow } from "@/components/ConnectivityTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserMenu } from "@/components/UserMenu";
import {
  ArrowLeft,
  Network,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function Connectivity() {
  const { user } = useAuth();
  const { slug: orgSlug } = useParams<{ slug: string }>();

  // Fetch organization
  const { data: organization } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch existing questionnaire responses for systems list
  const { data: existingResponses } = trpc.intake.getResponses.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Connectivity data from Notion
  const { data: connectivityData, isLoading: connectivityLoading } =
    trpc.connectivity.getForOrg.useQuery(
      { organizationSlug: orgSlug, organizationName: organization?.name },
      { enabled: !!orgSlug && !!organization?.name }
    );

  const [connRows, setConnRows] = useState<ConnectivityRow[]>([]);
  const notionPageIds = useRef<Set<string>>(new Set());
  const [connSaving, setConnSaving] = useState(false);

  useEffect(() => {
    if (connectivityData?.rows) {
      setConnRows(connectivityData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(connectivityData.rows.map((r: any) => r.id));
    }
  }, [connectivityData]);

  const createRowMutation = trpc.connectivity.createRow.useMutation();
  const updateRowMutation = trpc.connectivity.updateRow.useMutation();
  const archiveRowMutation = trpc.connectivity.archiveRow.useMutation();

  const handleConnChange = async (newRows: ConnectivityRow[]) => {
    const oldIds = new Set(connRows.map((r) => r.id));
    const newIds = new Set(newRows.map((r) => r.id));
    setConnRows(newRows);
    if (!connectivityData?.configured || !organization?.name) return;
    setConnSaving(true);
    try {
      for (const row of connRows) {
        if (!newIds.has(row.id) && notionPageIds.current.has(row.id)) {
          archiveRowMutation.mutate({ pageId: row.id });
          notionPageIds.current.delete(row.id);
        }
      }
      for (const row of newRows) {
        if (!oldIds.has(row.id)) {
          createRowMutation.mutate(
            { organizationName: organization.name, row },
            {
              onSuccess: ({ pageId }) => {
                notionPageIds.current.add(pageId);
                setConnRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, id: pageId } : r))
                );
              },
            }
          );
        } else if (notionPageIds.current.has(row.id)) {
          const old = connRows.find((r) => r.id === row.id);
          if (old && JSON.stringify(old) !== JSON.stringify(row)) {
            updateRowMutation.mutate({ pageId: row.id, organizationName: organization.name, row });
          }
        }
      }
    } finally {
      setConnSaving(false);
    }
  };

  const systems = (() => {
    try {
      const r = existingResponses?.find(
        (r: any) => r.questionId === "ARCH.systems"
      );
      return r?.response ? JSON.parse(r.response) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Connectivity Matrix</div>
              {organization?.name && <div className="text-xs text-muted-foreground truncate">{organization.name}{organization.clientName ? ` · ${organization.clientName}` : ""}</div>}
            </div>
          </div>
          {/* Right: back + user menu */}
          <div className="flex items-center gap-2">
            <Link href={`/org/${orgSlug}`}>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>
      <PageBreadcrumb orgSlug={orgSlug} items={[{ label: "Connectivity Matrix" }]} />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Card className="card-elevated overflow-hidden">
          <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Network className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Connectivity Matrix</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {organization?.name ? `${organization.name} — ` : ""}Manage network connections and routing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectivityLoading ? (
                <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </Badge>
              ) : connRows.length ? (
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 ${
                    connSaving
                      ? "text-muted-foreground"
                      : "border-green-500/40 text-green-400"
                  }`}
                >
                  {connSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {connRows.length}{" "}
                  {connRows.length === 1 ? "connection" : "connections"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Notion
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="p-0">
            {connectivityLoading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading connectivity data…</span>
              </div>
            ) : connectivityData?.error ? (
              <div className="flex items-center gap-3 py-6 px-5 rounded-b-xl bg-destructive/10 border-t border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  Notion error: {connectivityData.error}
                </p>
              </div>
            ) : !connectivityData?.configured ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 mx-5 my-5 border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
                <Network className="w-7 h-7 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Notion API key not configured
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set NOTION_API_KEY to enable live connectivity editing
                  </p>
                </div>
              </div>
            ) : (
              <ConnectivityTable
                rows={connRows}
                systems={systems}
                onChange={handleConnChange}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
