import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronDown, ClipboardList, Download, Search, Folder,
  CalendarClock, Rocket, RotateCcw, Check, Users, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { transformSectionProgress } from "@/lib/adminUtils";
import { VAL_PHASES } from "@/hooks/useHomeData";
import { QuestionnairePhaseCard } from "@/pages/home/QuestionnairePhaseCard";
import { TestingPhaseCard } from "@/pages/home/TestingPhaseCard";
import { TaskListPhaseCard } from "@/pages/home/TaskListPhaseCard";
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
  // No applicable items left (e.g. all marked N/A at go-live) ⇒ nothing to do ⇒ 100%.
  const tsPct = tsTotal > 0 ? Math.round((tsDone / tsTotal) * 100) : (ts?.total > 0 ? 100 : 0);

  const vs = (orgMetrics as any)?.validationStats;
  const vsPass = vs?.pass ?? 0;
  const vsInProg = vs?.inProgress ?? 0;
  const vsFail = vs?.fail ?? 0;
  const vsBlocked = vs?.blocked ?? 0;
  const vsTotal = vs ? (vs.total - (vs.na ?? 0)) : 0;
  const vsPct = vsTotal > 0 ? Math.round(((vsPass + vsInProg * 0.5 + vsFail * 0.25 + vsBlocked * 0.25) / vsTotal) * 100) : (vs?.total > 0 ? 100 : 0);

  const overallPct = Math.round(qPct * 0.4 + vsPct * 0.3 + tsPct * 0.3);

  // Per-section in-progress / not-started counts (same basis as the site card).
  const spVals = Object.values((orgMetrics as any)?.sectionProgress ?? {}) as Array<{ completed: number; total: number }>;
  const qInProgressSections = spVals.filter(s => s.completed > 0 && s.completed < s.total).length;
  const qNotStartedSections = spVals.filter(s => s.completed === 0).length;

  // Task list — weighted % to match the site's TaskListPhaseCard headline.
  const tsInProg = ts?.inProgress ?? 0;
  const tsBlocked = ts?.blocked ?? 0;
  const tsNa = ts?.notApplicable ?? 0;
  const tsTotalAll = ts?.total ?? 0;
  const implApplicable = Math.max(0, tsTotalAll - tsNa);
  const tsWeighted = implApplicable > 0
    ? Math.round(((tsDone + tsInProg * 0.5 + tsBlocked * 0.25) / implApplicable) * 100)
    : (tsTotalAll > 0 ? 100 : 0);
  const implOpenCount = Math.max(0, tsTotalAll - tsDone - tsInProg - tsBlocked - tsNa);

  const valTotal = vs?.total ?? 28;
  const qDone = totalSections > 0 && sectionsComplete === totalSections;
  const vDone = valTotal > 0 && vsPass === valTotal;
  const activePhase: "questionnaire" | "testing" | "implementation" =
    !qDone ? "questionnaire" : !vDone ? "testing" : "implementation";

  return {
    sectionsComplete, totalSections, qPct,
    ts, tsDone, tsPct,
    vs, vsPass, vsInProg, vsFail, vsBlocked, vsPct, valTotal,
    overallPct,
    filesCount: orgMetrics?.files.length ?? 0,
    qFiles: (orgMetrics as any)?.questionnaireFileCount ?? orgMetrics?.files.length ?? 0,
    siteFiles: (orgMetrics as any)?.siteFileCount ?? 0,
    userCount: orgMetrics?.userCount ?? 0,
    naQCount: (orgMetrics as any)?.naQuestionCount ?? 0,
    // Phase-card inputs (shared with the site dashboard).
    qInProgressSections, qNotStartedSections,
    implApplicable, tsWeighted, tsInProg, tsBlocked, tsNa, implOpenCount,
    valNotTested: vs?.notTested ?? 0, valNa: vs?.na ?? 0,
    activePhase,
    nextUpSections: ((orgMetrics as any)?.nextUpSections ?? []) as string[],
    nextUpTests: ((orgMetrics as any)?.nextUpTests ?? []) as string[],
    nextUpTasks: ((orgMetrics as any)?.nextUpTasks ?? []) as Array<{ id: string; title: string }>,
  };
}

/**
 * Completion donut shown beside each site name (from the Platform Admin mockup).
 * 42px ring: purple accent while implementing, green with a check once live/100%.
 */
function CompletionDonut({ value, live }: { value: number; live: boolean }) {
  const size = 42, stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = live || value >= 100;
  const shown = live ? 100 : value;
  const off = c * (1 - shown / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={done ? "rgb(52 211 153)" : "var(--primary)"}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {live ? (
          <Check className="w-[15px] h-[15px] text-emerald-400" />
        ) : (
          <span className="font-bold tabular-nums leading-none" style={{ fontSize: 11, letterSpacing: "-0.03em" }}>
            {value}<span style={{ fontSize: 8 }}>%</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact icon + number stat used for the per-site users / file counts. */
function CountStat({ icon: I, value, title }: { icon: typeof Users; value: number; title: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums" title={title}>
      <I className="w-3.5 h-3.5 shrink-0" />{value}
    </span>
  );
}

/**
 * Always-visible go-live control that lives in the site row. Shows the
 * target/live date as a chip; clicking opens a popover to edit the target
 * date, mark the site live (with a date), or reopen a live site.
 */
function GoLiveControl({
  org, markComplete, reopen, updateTarget, busy,
}: {
  org: Org;
  markComplete: (liveDate: string) => void;
  reopen: () => void;
  updateTarget: (date: string | null) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isLive = org.status === "completed";
  const [liveDateDraft, setLiveDateDraft] = useState(org.targetGoLiveDate || todayStr());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 text-[11px] sm:w-36 shrink-0 rounded-md px-2 py-1 border transition-colors text-left",
            isLive
              ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              : org.targetGoLiveDate
                ? "border-border/50 text-muted-foreground hover:bg-muted/30"
                : "border-dashed border-border/50 text-muted-foreground/50 hover:bg-muted/30"
          )}
        >
          {isLive ? (
            <><Rocket className="w-3 h-3 shrink-0" /> Live {org.liveDate ? formatDate(org.liveDate) : ""}</>
          ) : org.targetGoLiveDate ? (
            <><CalendarClock className="w-3 h-3 shrink-0" /> Target {formatDate(org.targetGoLiveDate)}</>
          ) : (
            <><CalendarClock className="w-3 h-3 shrink-0" /> Set go-live</>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 space-y-3">
        {/* Target go-live date */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Target Go-Live
          </label>
          <input
            type="date"
            defaultValue={org.targetGoLiveDate ?? ""}
            onBlur={(e) => {
              const v = e.target.value || null;
              if (v !== (org.targetGoLiveDate ?? null)) updateTarget(v);
            }}
            className="h-9 w-full px-2.5 rounded-lg bg-card border border-border/60 text-sm focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="border-t border-border/40" />

        {isLive ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <Rocket className="w-4 h-4" /> Live since {org.liveDate ? formatDate(org.liveDate) : "—"}
            </p>
            <button
              onClick={() => { reopen(); setOpen(false); }}
              disabled={busy}
              className="w-full h-9 px-3 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reopen
            </button>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">Restores the tasks, tests &amp; questions that were auto-marked N/A at go-live.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Go-Live Date</label>
            <input
              type="date"
              value={liveDateDraft}
              onChange={(e) => setLiveDateDraft(e.target.value)}
              className="h-9 w-full px-2.5 rounded-lg bg-card border border-border/60 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              onClick={() => { markComplete(liveDateDraft); setOpen(false); }}
              disabled={busy || !liveDateDraft}
              className="w-full h-9 px-3 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" /> Mark Live
            </button>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">Marks every still-open task, test &amp; question N/A (dated today) so the site reads 100%.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AdminDashboardTab({ isPlatformAdmin, orgs, clients, metrics, refetchOrgs }: AdminDashboardTabProps) {
  const markCompleteMutation = trpc.admin.markOrganizationComplete.useMutation({
    onSuccess: () => { toast.success("Site marked live 🎉 — open items set to N/A"); refetchOrgs(); },
    onError: (e: any) => toast.error(e.message || "Failed to mark site live"),
  });
  const reopenMutation = trpc.admin.reopenOrganization.useMutation({
    onSuccess: () => { toast.success("Site reopened — auto-N/A items restored"); refetchOrgs(); },
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

                    return (
                      <div key={org.id}>
                        {/* Compact scannable row */}
                        <div className="px-3 py-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4 hover:bg-muted/20 transition-colors">
                          {/* Scannable toggle area (donut + name + counts) */}
                          <button
                            onClick={() => toggleSite(org.id)}
                            className="flex-1 min-w-0 text-left flex items-center gap-3 sm:gap-4"
                          >
                            {/* Completion donut + name */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <CompletionDonut value={st.overallPct} live={org.status === "completed"} />
                              <span className="font-semibold text-foreground truncate">{org.name}</span>
                            </div>

                            {/* Per-site counts — hidden on phone, shown in the expanded footer instead */}
                            <span className="hidden md:flex items-center gap-4 shrink-0 pr-1">
                              <CountStat icon={Users} value={st.userCount} title={`${st.userCount} users`} />
                              <CountStat icon={ClipboardList} value={st.qFiles} title={`${st.qFiles} questionnaire files`} />
                              <CountStat icon={FolderOpen} value={st.siteFiles} title={`${st.siteFiles} site files`} />
                            </span>
                          </button>

                          {/* Go-live control — always visible, no need to expand */}
                          <GoLiveControl
                            org={org}
                            busy={markCompleteMutation.isPending || reopenMutation.isPending}
                            markComplete={(liveDate) => markCompleteMutation.mutate({ organizationId: org.id, liveDate })}
                            reopen={() => reopenMutation.mutate({ organizationId: org.id })}
                            updateTarget={(date) => updateOrgMutation.mutate({ id: org.id, targetGoLiveDate: date })}
                          />

                          {/* Stage + chevron toggle */}
                          <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                            <span className={cn("px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap", stage.pill)}>
                              {stage.label}
                            </span>
                            <button onClick={() => toggleSite(org.id)} className="p-0.5 rounded hover:bg-muted/40 transition-colors" aria-label="Toggle details">
                              <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 transition-transform", isExpanded && "rotate-180")} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded mini dashboard */}
                        {isExpanded && (
                          <div className="border-t border-border/40 px-3 sm:px-5 py-4 space-y-4 bg-background/40">
                            {/* Three phase cards — the SAME components the site dashboard uses */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <QuestionnairePhaseCard
                                clientSlug={org.clientId ? (clientSlugMap[org.clientId] ?? "") : ""}
                                orgSlug={org.slug}
                                completedSections={st.sectionsComplete}
                                totalSections={st.totalSections}
                                qInProgressSections={st.qInProgressSections}
                                qNotStartedSections={st.qNotStartedSections}
                                naQuestions={st.naQCount}
                                nextUpSections={st.nextUpSections}
                                activePhase={st.activePhase}
                              />
                              <TestingPhaseCard
                                clientSlug={org.clientId ? (clientSlugMap[org.clientId] ?? "") : ""}
                                orgSlug={org.slug}
                                valTotal={st.valTotal}
                                valCompleted={st.vsPass}
                                valNaCount={st.valNa}
                                valFailedCount={st.vsFail}
                                valInProgressCount={st.vsInProg}
                                valBlockedCount={st.vsBlocked}
                                valNotTestedCount={st.valNotTested}
                                nextUpTests={st.nextUpTests}
                                activePhase={st.activePhase}
                                VAL_PHASES={VAL_PHASES}
                              />
                              <TaskListPhaseCard
                                clientSlug={org.clientId ? (clientSlugMap[org.clientId] ?? "") : ""}
                                orgSlug={org.slug}
                                iPct={st.tsWeighted}
                                implCompleted={st.tsDone}
                                implApplicable={st.implApplicable}
                                implInProgressCount={st.tsInProg}
                                implBlockedCount={st.tsBlocked}
                                implNaCount={st.tsNa}
                                implOpenCount={st.implOpenCount}
                                nextUpTasks={st.nextUpTasks}
                                activePhase={st.activePhase}
                              />
                            </div>

                            {/* Per-site counts — always visible here (incl. phone) */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {st.userCount} user{st.userCount !== 1 ? "s" : ""}</span>
                              <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> {st.qFiles} questionnaire file{st.qFiles !== 1 ? "s" : ""}</span>
                              <span className="flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> {st.siteFiles} site file{st.siteFiles !== 1 ? "s" : ""}</span>
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
