import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Eye,
  Pencil,
  Navigation,
  FileSearch,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Search,
  X,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditCategory = "all" | "chat" | "read" | "write" | "navigate" | "extract";
type AuditStatus = "all" | "success" | "error" | "denied";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  chat: { label: "Chat", icon: MessageSquare, color: "text-blue-500" },
  read: { label: "Read", icon: Eye, color: "text-emerald-500" },
  write: { label: "Write", icon: Pencil, color: "text-amber-500" },
  navigate: { label: "Navigate", icon: Navigation, color: "text-purple-500" },
  extract: { label: "Extract", icon: FileSearch, color: "text-cyan-500" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { label: "Success", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
  error: { label: "Error", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/30" },
  denied: { label: "Denied", icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateText(text: string | null | undefined, max: number): string {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

// ---------------------------------------------------------------------------
// Stats Cards
// ---------------------------------------------------------------------------

function AuditStatsCards() {
  const { data: stats, isLoading } = trpc.ai.getAuditStats.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4 pb-3">
              <div className="h-4 bg-muted rounded w-16 mb-2" />
              <div className="h-8 bg-muted rounded w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const successCount = stats.byStatus.find((s) => s.status === "success")?.count ?? 0;
  const errorCount = stats.byStatus.find((s) => s.status === "error")?.count ?? 0;
  const deniedCount = stats.byStatus.find((s) => s.status === "denied")?.count ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground font-medium">Total Actions</p>
          <p className="text-2xl font-bold mt-1">{stats.totalLogs}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Successful
          </p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{successCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" /> Errors
          </p>
          <p className="text-2xl font-bold mt-1 text-red-600">{errorCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-500" /> RBAC Denied
          </p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{deniedCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Dialog
// ---------------------------------------------------------------------------

function AuditDetailDialog({
  logId,
  open,
  onOpenChange,
}: {
  logId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: log, isLoading } = trpc.ai.getAuditLogDetail.useQuery(
    { id: logId! },
    { enabled: !!logId && open }
  );

  const statusCfg = log ? STATUS_CONFIG[log.status] : null;
  const catCfg = log ? CATEGORY_CONFIG[log.category] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Audit Log Detail
            {log && statusCfg && (
              <Badge variant="outline" className={cn("text-xs", statusCfg.bg)}>
                {log.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {log ? `${log.action} — ${formatDate(log.createdAt)}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        )}

        {log && (
          <div className="space-y-4 text-sm">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Action</Label>
                <p className="font-medium flex items-center gap-1.5 mt-0.5">
                  {catCfg && <catCfg.icon className={cn("w-4 h-4", catCfg.color)} />}
                  {log.action}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p className="font-medium mt-0.5">{catCfg?.label ?? log.category}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Actor</Label>
                <p className="font-medium mt-0.5">{log.actorEmail ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Role</Label>
                <p className="font-medium mt-0.5">{log.actorRole ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <p className="font-medium mt-0.5">{formatDuration(log.durationMs)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">IP Address</Label>
                <p className="font-medium mt-0.5 font-mono text-xs">{log.ipAddress ?? "—"}</p>
              </div>
              {log.organizationSlug && (
                <div>
                  <Label className="text-xs text-muted-foreground">Organization</Label>
                  <p className="font-medium mt-0.5">{log.organizationSlug}</p>
                </div>
              )}
              {log.targetUserEmail && (
                <div>
                  <Label className="text-xs text-muted-foreground">Target User</Label>
                  <p className="font-medium mt-0.5">{log.targetUserEmail}</p>
                </div>
              )}
            </div>

            {/* User Prompt */}
            {log.userPrompt && (
              <div>
                <Label className="text-xs text-muted-foreground">User Prompt</Label>
                <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {log.userPrompt}
                </div>
              </div>
            )}

            {/* AI Response */}
            {log.aiResponse && (
              <div>
                <Label className="text-xs text-muted-foreground">AI Response</Label>
                <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {log.aiResponse}
                </div>
              </div>
            )}

            {/* Tool Arguments */}
            {log.toolArgs && (
              <div>
                <Label className="text-xs text-muted-foreground">Tool Arguments</Label>
                <pre className="mt-1 p-3 rounded-lg bg-muted/50 border border-border text-xs overflow-x-auto max-h-32 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.toolArgs), null, 2);
                    } catch {
                      return log.toolArgs;
                    }
                  })()}
                </pre>
              </div>
            )}

            {/* Tool Result */}
            {log.toolResult && (
              <div>
                <Label className="text-xs text-muted-foreground">Tool Result</Label>
                <pre className="mt-1 p-3 rounded-lg bg-muted/50 border border-border text-xs overflow-x-auto max-h-32 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.toolResult), null, 2);
                    } catch {
                      return log.toolResult;
                    }
                  })()}
                </pre>
              </div>
            )}

            {/* Error Message */}
            {log.errorMessage && (
              <div>
                <Label className="text-xs text-muted-foreground">Error</Label>
                <div className="mt-1 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-600">
                  {log.errorMessage}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AiAuditLog() {
  // Filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [category, setCategory] = useState<AuditCategory>("all");
  const [status, setStatus] = useState<AuditStatus>("all");
  const [actorEmail, setActorEmail] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Detail dialog
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Query
  const { data, isLoading, refetch } = trpc.ai.getAuditLogs.useQuery({
    page,
    pageSize,
    category,
    status,
    actorEmail: actorEmail || undefined,
    organizationSlug: orgSlug || undefined,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Filter logs by search input (client-side text filter on action/email/org)
  const filteredLogs = useMemo(() => {
    if (!searchInput.trim()) return logs;
    const q = searchInput.toLowerCase();
    return logs.filter(
      (l) =>
        l.action?.toLowerCase().includes(q) ||
        l.actorEmail?.toLowerCase().includes(q) ||
        l.organizationSlug?.toLowerCase().includes(q) ||
        l.targetUserEmail?.toLowerCase().includes(q) ||
        l.userPrompt?.toLowerCase().includes(q)
    );
  }, [logs, searchInput]);

  const clearFilters = () => {
    setCategory("all");
    setStatus("all");
    setActorEmail("");
    setOrgSlug("");
    setSearchInput("");
    setPage(1);
  };

  const hasActiveFilters = category !== "all" || status !== "all" || actorEmail || orgSlug || searchInput;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">AI Audit Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track all actions initiated by the AI assistant — chat interactions, data reads, writes, navigation, and text extraction.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <AuditStatsCards />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search actions, emails, orgs..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            {/* Category */}
            <div className="w-[140px]">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v as AuditCategory); setPage(1); }}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="write">Write</SelectItem>
                  <SelectItem value="navigate">Navigate</SelectItem>
                  <SelectItem value="extract">Extract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="w-[130px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as AuditStatus); setPage(1); }}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actor Email */}
            <div className="w-[180px]">
              <Label className="text-xs text-muted-foreground">Actor Email</Label>
              <Input
                placeholder="Filter by email"
                value={actorEmail}
                onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
                className="h-9 mt-1"
              />
            </div>

            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No audit logs found</p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Actor</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Target</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const catCfg = CATEGORY_CONFIG[log.category];
                    const statusCfg = STATUS_CONFIG[log.status];
                    const CatIcon = catCfg?.icon ?? MessageSquare;
                    const StatusIcon = statusCfg?.icon ?? CheckCircle2;

                    // Build target display
                    const target = log.organizationSlug
                      ? log.organizationSlug
                      : log.targetUserEmail
                      ? log.targetUserEmail
                      : "—";

                    return (
                      <tr
                        key={log.id}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedLogId(log.id);
                          setDetailOpen(true);
                        }}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs font-mono">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={cn("flex items-center gap-1.5", catCfg?.color)}>
                            <CatIcon className="w-3.5 h-3.5" />
                            {catCfg?.label ?? log.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[180px]">
                          {log.actorEmail ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[150px]">
                          {target}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn("text-xs gap-1 font-normal", statusCfg?.bg)}
                          >
                            <StatusIcon className={cn("w-3 h-3", statusCfg?.color)} />
                            {statusCfg?.label ?? log.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono whitespace-nowrap">
                          {formatDuration(log.durationMs)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <AuditDetailDialog
        logId={selectedLogId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
