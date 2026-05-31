import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ClipboardList, TestTube2, ListChecks, Download, Search, Folder,
  CalendarClock, Rocket, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { transformSectionProgress } from "@/lib/adminUtils";
import type { SharedAdminProps, Metric, Org } from "./types";

type AdminDashboardTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients" | "refetchOrgs"> & {
  metrics: Metric[] | undefined;
};

type StageFilter = "all" | "active" | "live";

/** Today as YYYY-MM-DD (local), used to default the go-live date picker. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format a YYYY-MM-DD string as e.g. "May 31, 2026". Returns "" for empty. */
function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Order sites within a partner: active first, then everything else. */
const STATUS_RANK: Record<string, number> = { active: 0, paused: 1, completed: 2, inactive: 3 };

/** Map an org status to a lifecycle stage pill (uses the existing status enum). */
function stageOf(status: string): { label: string; pill: string; dot: string } {
  switch (status) {
    case "completed":
      return { label: "Live", pill: "border-emerald-500/50 text-emerald-400", dot: "bg-emerald-400" };
    case "paused":
      return { label: "Paused", pill: "border-amber-500/40 text-amber-400", dot: "bg-amber-400" };
    default:
      return { label: "Implementing", pill: "border-blue-500/40 text-blue-400", dot: "bg-blue-400" };
  }
}

/** Derive all the progress numbers for a site from its metrics row. */
function computeOrgStats(orgMetrics: Metric | undefined) {
  const sectionProg = transformSectionProgress(orgMetrics?.sectionProgress);
  const sectionsComplete = sectionProg.filter(s => s.progress === 100).length;
  const totalSections = sectionProg.length || 6;
  const qPct = totalSections > 0 ? Math.round((sectionsComplete / totalSections) * 100) : 0;

  const ts = (orgMetrics as any)?.taskStats;
  const tsDone = ts?.completed ?? 0;
  const tsTotal = ts ? (ts.total - (ts.notApplicable ?? 0)) : 0;
  const tsPct = tsTotal > 0 ? Math.round((tsDone / tsTotal) * 100) : 0;

  const vs = (orgMetrics as any)?.validationStats;
  const vsPass = vs?.pass ?? 0;
  const vsInProg = vs?.inProgress ?? 0;
  const vsFail = vs?.fail ?? 0;
  const vsBlocked = vs?.blocked ?? 0;
  const vsTotal = vs ? (vs.total - (vs.na ?? 0)) : 0;
  const vsPct = vsTotal > 0 ? Math.round(((vsPass + vsInProg * 0.5 + vsFail * 0.25 + vsBlocked * 0.25) / vsTotal) * 100) : 0;

  const overallPct = Math.round(qPct * 0.4 + vsPct * 0.3 + tsPct * 0.3);

  return {
    sectionsComplete, totalSections, qPct,
    ts, tsDone, tsPct,
    vs, vsPass, vsInProg, vsFail, vsBlocked, vsPct,
    overallPct,
    filesCount: orgMetrics?.files.length ?? 0,
    userCount: orgMetrics?.userCount ?? 0,
    naQCount: (orgMetrics as any)?.naQuestionCount ?? 0,
  };
}

export function AdminDashboardTab({ isPlatformAdmin, orgs, clients, metrics, refetchOrgs }: AdminDashboardTabProps) {
  const [, setLocation] = useLocation();

  // Go-live editing: which site's date picker is open, and its draft value.
  const [goLiveDraft, setGoLiveDraft] = useState<{ id: number; date: string } | null>(null);

  const markCompleteMutation = trpc.admin.markOrganizationComplete.useMutation({
    onSuccess: () => { toast.success("Site marked live 🎉"); setGoLiveDraft(null); refetchOrgs(); },
    onError: (e: any) => toast.error(e.message || "Failed to mark site live"),
  });
  const reopenMutation = trpc.admin.reopenOrganization.useMutation({
    onSuccess: () => { toast.success("Site reopened"); refetchOrgs(); },
    onError: (e: any) => toast.error(e.message || "Failed to reopen site"),
  });
  const updateOrgMutation = trpc.admin.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Target go-live date saved"); refetchOrgs(); },
    onError: (e: any) => toast.error(e.message || "Failed to save target date"),
  });

  const metricsMap = useMemo(() =>
    metrics?.reduce((acc, m) => { acc[m.organizationId] = m; return acc; }, {} as Record<number, Metric>) || {},
    [metrics]
  );
  const clientMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );
  const clientSlugMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.slug; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );

  // Stats for every org, computed once.
  const statsByOrg = useMemo(() => {
    const m: Record<number, ReturnType<typeof computeOrgStats>> = {};
    (orgs || []).forEach(o => { m[o.id] = computeOrgStats(metricsMap[o.id]); });
    return m;
  }, [orgs, metricsMap]);

  // Everything except deactivated sites is in scope for the dashboard.
  const visibleOrgs = useMemo(() => (orgs || []).filter(o => o.status !== "inactive"), [orgs]);

  // Roster summary (matches the "N orgs · N active · N live · N partners" header).
  const summary = useMemo(() => ({
    total: visibleOrgs.length,
    active: visibleOrgs.filter(o => o.status === "active").length,
    live: visibleOrgs.filter(o => o.status === "completed").length,
    partners: new Set(visibleOrgs.map(o => o.clientId)).size,
  }), [visibleOrgs]);

  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [expandedSiteIds, setExpandedSiteIds] = useState<Set<number>>(new Set());

  // Apply search + partner + stage filters.
  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleOrgs.filter(o => {
      if (partnerFilter !== null && o.clientId !== partnerFilter) return false;
      if (stageFilter === "active" && o.status !== "active") return false;
      if (stageFilter === "live" && o.status !== "completed") return false;
      if (q && !o.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visibleOrgs, partnerFilter, stageFilter, search]);

  // Group by partner → alphabetical partners; within a partner active-first then alphabetical.
  const partnerGroups = useMemo(() => {
    const groups = new Map<number | null, Org[]>();
    filteredOrgs.forEach(o => {
      const key = o.clientId ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    });
    return Array.from(groups.entries())
      .map(([clientId, sites]) => ({
        clientId,
        name: clientId != null ? (clientMap[clientId] || "Unknown partner") : "Unassigned",
        sites: sites.sort((a, b) =>
          (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name)
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredOrgs, clientMap]);

  const toggleSite = (id: number) => setExpandedSiteIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allFilteredIds = filteredOrgs.map(o => o.id);
  const allExpanded = allFilteredIds.length > 0 && allFilteredIds.every(id => expandedSiteIds.has(id));
  const toggleExpandAll = () =>
    setExpandedSiteIds(allExpanded ? new Set() : new Set(allFilteredIds));

  return (
    <div>
      {/* Header */}
      <div className="mb-1">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-primary/80 mb-1">Platform Admin</p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {summary.total} organization{summary.total !== 1 ? "s" : ""} · {summary.active} active · {summary.live} live
          {isPlatformAdmin && ` · ${summary.partners} partner${summary.partners !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4 mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search organizations…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {isPlatformAdmin && clients && clients.length > 1 && (
          <Select
            value={partnerFilter === null ? "all" : String(partnerFilter)}
            onValueChange={v => setPartnerFilter(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-9 text-sm w-full sm:w-44 shrink-0">
              <SelectValue placeholder="All Partners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Stage segmented control */}
        <div className="flex items-center rounded-lg border border-border/50 bg-card p-0.5 shrink-0">
          {(["all", "active", "live"] as StageFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors",
                stageFilter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={toggleExpandAll}
          className="h-9 px-3 rounded-lg border border-border/50 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", allExpanded && "rotate-180")} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Partner groups */}
      {partnerGroups.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm italic">
          {visibleOrgs.length === 0 ? "No organizations yet." : "No organizations match the current filters."}
        </div>
      ) : (
        <div className="space-y-6">
          {partnerGroups.map(group => {
            const activeCount = group.sites.filter(s => s.status === "active").length;
            const avg = group.sites.length
              ? Math.round(group.sites.reduce((sum, s) => sum + (statsByOrg[s.id]?.overallPct ?? 0), 0) / group.sites.length)
              : 0;

            return (
              <div key={String(group.clientId)}>
                {/* Partner header */}
                <div className="flex items-center gap-2 px-1 mb-2">
                  <Folder className="w-4 h-4 text-primary/70 shrink-0" />
                  <span className="font-semibold text-sm truncate">{group.name}</span>
                  <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
                    {group.sites.length} site{group.sites.length !== 1 ? "s" : ""} · {activeCount} active · {avg}% avg
                  </span>
                </div>

                {/* Site rows */}
                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40 bg-card/30">
                  {group.sites.map(org => {
                    const st = statsByOrg[org.id] ?? computeOrgStats(undefined);
                    const stage = stageOf(org.status);
                    const isExpanded = expandedSiteIds.has(org.id);
                    const intakeBase = org.clientId && clientSlugMap[org.clientId]
                      ? `/org/${clientSlugMap[org.clientId]}/${org.slug}`
                      : `/org/${org.slug}`;

                    return (
                      <div key={org.id}>
                        {/* Compact scannable row */}
                        <button
                          onClick={() => toggleSite(org.id)}
                          className="w-full text-left px-3 py-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4 hover:bg-muted/20 transition-colors"
                        >
                          {/* Name + status dot */}
                          <div className="flex items-center gap-2.5 min-w-0 sm:w-52 shrink-0">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", stage.dot)} />
                            <span className="font-semibold text-foreground truncate">{org.name}</span>
                          </div>

                          {/* One big overall progress bar */}
                          <div className="flex-1 flex items-center gap-3 min-w-0">
                            <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden border border-border/50 min-w-0">
                              <div
                                className={cn("h-full rounded-full transition-all", org.status === "completed" ? "bg-emerald-500" : "bg-primary")}
                                style={{ width: `${st.overallPct}%` }}
                              />
                            </div>
                            <span className={cn("text-sm font-bold tabular-nums shrink-0 w-10 text-right", org.status === "completed" ? "text-emerald-400" : "text-primary")}>
                              {st.overallPct}%
                            </span>
                          </div>

                          {/* Go-live dates */}
                          <div className="flex flex-col gap-0.5 text-[11px] sm:w-36 shrink-0">
                            {org.status === "completed" && org.liveDate ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                <Rocket className="w-3 h-3 shrink-0" /> Live {formatDate(org.liveDate)}
                              </span>
                            ) : org.targetGoLiveDate ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <CalendarClock className="w-3 h-3 shrink-0" /> Target {formatDate(org.targetGoLiveDate)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 italic">No go-live date</span>
                            )}
                          </div>

                          {/* Stage + files + chevron */}
                          <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                            <span className={cn("px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap", stage.pill)}>
                              {stage.label}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums w-9 justify-end">
                              <Download className="w-3 h-3" />{st.filesCount}
                            </span>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </button>

                        {/* Expanded mini dashboard */}
                        {isExpanded && (
                          <div className="border-t border-border/40 px-3 sm:px-5 py-4 space-y-4 bg-background/40">
                            {/* Overall progress bar */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Implementation Progress</span>
                                <span className="text-base font-bold text-primary">{st.overallPct}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/60">
                                <div className={cn("h-full rounded-full transition-all", org.status === "completed" ? "bg-emerald-500" : "bg-primary")} style={{ width: `${st.overallPct}%` }} />
                              </div>
                            </div>

                            {/* Go-live management */}
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-end gap-4">
                              {/* Target go-live date (editable) */}
                              <div className="flex-1 min-w-0">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  <CalendarClock className="w-3.5 h-3.5" /> Target Go-Live
                                </label>
                                <input
                                  type="date"
                                  defaultValue={org.targetGoLiveDate ?? ""}
                                  onBlur={(e) => {
                                    const v = e.target.value || null;
                                    if (v !== (org.targetGoLiveDate ?? null)) {
                                      updateOrgMutation.mutate({ id: org.id, targetGoLiveDate: v });
                                    }
                                  }}
                                  className="h-9 w-full sm:w-44 px-2.5 rounded-lg bg-card border border-border/60 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                />
                              </div>

                              {/* Live status / flip-to-done control */}
                              <div className="flex-1 min-w-0">
                                {org.status === "completed" ? (
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                                        <Rocket className="w-4 h-4" /> Live
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Went live {org.liveDate ? formatDate(org.liveDate) : "—"}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => reopenMutation.mutate({ organizationId: org.id })}
                                      disabled={reopenMutation.isPending}
                                      className="h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" /> Reopen
                                    </button>
                                  </div>
                                ) : goLiveDraft?.id === org.id ? (
                                  <div className="flex items-end gap-2 flex-wrap">
                                    <div>
                                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Go-Live Date</label>
                                      <input
                                        type="date"
                                        value={goLiveDraft.date}
                                        onChange={(e) => setGoLiveDraft({ id: org.id, date: e.target.value })}
                                        className="h-9 w-44 px-2.5 rounded-lg bg-card border border-border/60 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                      />
                                    </div>
                                    <button
                                      onClick={() => markCompleteMutation.mutate({ organizationId: org.id, liveDate: goLiveDraft.date })}
                                      disabled={markCompleteMutation.isPending || !goLiveDraft.date}
                                      className="h-9 px-3 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      <Rocket className="w-3.5 h-3.5" /> Confirm Live
                                    </button>
                                    <button
                                      onClick={() => setGoLiveDraft(null)}
                                      className="h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setGoLiveDraft({ id: org.id, date: org.targetGoLiveDate || todayStr() })}
                                    className="h-9 px-4 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
                                  >
                                    <Rocket className="w-4 h-4" /> Mark Live
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Three mini stat columns */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Questionnaire */}
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-bold">Questionnaire</span>
                                  </div>
                                  <span className="text-lg font-bold text-primary">{st.qPct}%</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">{st.sectionsComplete}/{st.totalSections} sections complete</p>
                                {st.naQCount > 0 && (
                                  <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                                    {st.naQCount} question{st.naQCount !== 1 ? "s" : ""} marked N/A
                                  </p>
                                )}
                                <div className="w-full h-1.5 bg-muted rounded-full mb-3 border border-border/40">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${st.qPct}%` }} />
                                </div>
                                <button
                                  onClick={() => setLocation(`${intakeBase}/intake`)}
                                  className="w-full text-xs py-1.5 px-3 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                                >
                                  {st.qPct === 100 ? "View" : st.qPct === 0 ? "Start" : "Continue"}
                                </button>
                              </div>

                              {/* Testing */}
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <TestTube2 className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-bold">Testing</span>
                                  </div>
                                  <span className="text-lg font-bold text-primary">{st.vsPct}%</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">{st.vsPass}/{st.vs?.total ?? 28} tests passed</p>
                                <div className="w-full h-1.5 bg-muted rounded-full mb-2 border border-border/40">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${st.vsPct}%` }} />
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
                                  <span className="text-emerald-400 font-semibold">{st.vsPass} Pass</span>
                                  {st.vsFail > 0 && <span className="text-red-400 font-semibold">{st.vsFail} Fail</span>}
                                  {st.vsInProg > 0 && <span className="text-blue-400 font-semibold">{st.vsInProg} In Prog</span>}
                                  {st.vsBlocked > 0 && <span className="text-orange-400 font-semibold">{st.vsBlocked} Blocked</span>}
                                  <span className="text-muted-foreground">{st.vs?.notTested ?? (st.vs?.total ?? 28)} Open</span>
                                </div>
                                <button
                                  onClick={() => setLocation(`${intakeBase}/validation`)}
                                  className="w-full text-xs py-1.5 px-3 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                                >
                                  {st.vsPct === 100 ? "View" : st.vsPass === 0 ? "Start" : "Continue"}
                                </button>
                              </div>

                              {/* Task List */}
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-bold whitespace-nowrap">Task List</span>
                                  </div>
                                  <span className="text-lg font-bold text-primary">{st.tsPct}%</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">{st.tsDone}/{st.ts?.total ?? 0} tasks done</p>
                                <div className="w-full h-1.5 bg-muted rounded-full mb-2 border border-border/40">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${st.tsPct}%` }} />
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs mb-3">
                                  <span className="text-emerald-400 font-semibold">{st.ts?.completed ?? 0} Done</span>
                                  <span className="text-blue-400 font-semibold">{st.ts?.inProgress ?? 0} In Prog</span>
                                  <span className="text-red-400 font-semibold">{st.ts?.blocked ?? 0} Blocked</span>
                                  <span className="text-muted-foreground">{st.ts ? (st.ts.total - st.tsDone - (st.ts.inProgress ?? 0) - (st.ts.blocked ?? 0) - (st.ts.notApplicable ?? 0)) : 0} Open</span>
                                </div>
                                <button
                                  onClick={() => setLocation(`${intakeBase}/implement`)}
                                  className="w-full text-xs py-1.5 px-3 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                                >
                                  {st.tsPct === 100 ? "View" : st.tsDone === 0 ? "Start" : "Continue"}
                                </button>
                              </div>
                            </div>

                            {/* Files */}
                            {orgMetricsFiles(metricsMap[org.id]).length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Files</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {orgMetricsFiles(metricsMap[org.id]).map((f: any) => (
                                    <a
                                      key={f.id}
                                      href={f.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 rounded border border-border/60 hover:bg-muted/30 transition-colors group"
                                    >
                                      <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                                      <span className="text-sm truncate flex-1">{f.fileName}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Files list for a metrics row (kept tolerant of undefined). */
function orgMetricsFiles(m: Metric | undefined): any[] {
  return (m?.files as any[]) ?? [];
}
