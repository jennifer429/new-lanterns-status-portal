import { useMemo, useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ClipboardList, TestTube2, ListChecks, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { questionnaireSections } from "@shared/questionnaireData";
import { transformSectionProgress } from "@/lib/adminUtils";
import type { SharedAdminProps, Metric } from "./types";

type AdminDashboardTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "orgs" | "clients"> & {
  metrics: Metric[] | undefined;
};

export function AdminDashboardTab({ isPlatformAdmin, orgs, clients, metrics }: AdminDashboardTabProps) {
  const [, setLocation] = useLocation();
  const metricsMap = useMemo(() =>
    metrics?.reduce((acc, m) => { acc[m.organizationId] = m; return acc; }, {} as Record<number, Metric>) || {},
    [metrics]
  );

  const clientMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );

  const activeOrgs = useMemo(() =>
    [...(orgs?.filter(o => o.status === "active") || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [orgs]
  );

  const [dashboardPartnerFilter, setDashboardPartnerFilter] = useState<number | null>(null);
  const [dashboardSiteFilter, setDashboardSiteFilter] = useState<number | null>(null);
  const [expandedSiteIds, setExpandedSiteIds] = useState<Set<number>>(new Set());
  const firstExpandDoneRef = useRef(false);

  const dashboardAvailableSites = activeOrgs.filter(org =>
    dashboardPartnerFilter === null || org.clientId === dashboardPartnerFilter
  );

  const filteredActiveOrgs = activeOrgs.filter(org => {
    const matchesPartner = dashboardPartnerFilter === null || org.clientId === dashboardPartnerFilter;
    const matchesSite = dashboardSiteFilter === null || org.id === dashboardSiteFilter;
    return matchesPartner && matchesSite;
  });

  const firstOrgId = filteredActiveOrgs[0]?.id;

  useEffect(() => {
    if (!firstExpandDoneRef.current && firstOrgId != null) {
      setExpandedSiteIds(new Set([firstOrgId]));
      firstExpandDoneRef.current = true;
    }
  });

  return (
    <>
          <>
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Admin Dashboard</h2>
                <div className="text-sm text-muted-foreground">
                  {(dashboardPartnerFilter !== null || dashboardSiteFilter !== null)
                    ? `${filteredActiveOrgs.length} of ${activeOrgs.length} organizations`
                    : `${activeOrgs.length} active organizations`}
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Partner filter dropdown — only shown to platform admins with multiple partners */}
                {isPlatformAdmin && clients && clients.length > 1 && (
                  <Select
                    value={dashboardPartnerFilter === null ? "all" : String(dashboardPartnerFilter)}
                    onValueChange={(v) => {
                      setDashboardPartnerFilter(v === "all" ? null : Number(v));
                      setDashboardSiteFilter(null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue placeholder="All Partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Site dropdown — filtered by selected partner */}
                <Select
                  value={dashboardSiteFilter === null ? "all" : String(dashboardSiteFilter)}
                  onValueChange={(v) => setDashboardSiteFilter(v === "all" ? null : Number(v))}
                >
                  <SelectTrigger className="h-8 text-xs w-48">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {dashboardAvailableSites.map(org => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear all */}
                {(dashboardPartnerFilter !== null || dashboardSiteFilter !== null) && (
                  <button
                    onClick={() => { setDashboardPartnerFilter(null); setDashboardSiteFilter(null); }}
                    className="text-xs text-muted-foreground underline hover:no-underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible site cards with mini dashboards (all admins) */}
            <div className="space-y-3">
              {filteredActiveOrgs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm italic">
                  {activeOrgs.length === 0 ? "No active organizations" : "No organizations match the current filter"}
                </div>
              ) : (
                filteredActiveOrgs.map(org => {
                  const orgMetrics = metricsMap[org.id];
                  const partnerName = org.clientId ? clientMap[org.clientId] : "—";
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
                  const filesCount = orgMetrics?.files.length ?? 0;
                  const userCount = orgMetrics?.userCount ?? 0;
                  const naQCount = (orgMetrics as any)?.naQuestionCount ?? 0;
                  const isExpanded = expandedSiteIds.has(org.id);

                  return (
                    <Card key={org.id} className="overflow-hidden border-2 border-primary/50 bg-card shadow-md shadow-primary/5">
                      {/* Collapsible header */}
                      <button
                        onClick={() => setExpandedSiteIds(prev => {
                          const next = new Set(prev);
                          next.has(org.id) ? next.delete(org.id) : next.add(org.id);
                          return next;
                        })}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors bg-muted/25"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="font-bold text-lg truncate">{org.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className={cn(
                              "text-sm font-bold border-2 px-2.5 py-0.5",
                              overallPct === 100 ? "border-emerald-500/60 text-emerald-400" : "border-primary/60 text-primary"
                            )}>
                              {overallPct}% overall
                            </Badge>
                            <span className="text-sm text-muted-foreground hidden sm:inline">
                              Q: {sectionsComplete}/{totalSections} · Tests: {vsPass}/{vs?.total ?? 28} · Tasks: {tsDone}/{ts?.total ?? 0}
                            </span>
                            {isPlatformAdmin && (
                              <span className="text-sm text-muted-foreground hidden md:inline">· {partnerName}</span>
                            )}
                            {filesCount > 0 && (
                              <Badge variant="secondary" className="text-xs">{filesCount} files</Badge>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </button>

                      {/* Expanded mini dashboard */}
                      {isExpanded && (
                        <div className="border-t-2 border-primary/60 px-5 py-4 space-y-4 bg-background/80">
                          {/* Overall progress bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Implementation Progress</span>
                              <span className="text-lg font-bold text-primary">{overallPct}%</span>
                            </div>
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/60">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${overallPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Three mini stat columns */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Questionnaire */}
                            <div className="rounded-lg border-2 border-border/90 bg-muted/50 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <ClipboardList className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-bold">Questionnaire</span>
                                </div>
                                <span className="text-lg font-bold text-primary">{qPct}%</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">{sectionsComplete}/{totalSections} sections complete</p>
                              {naQCount > 0 && (
                                <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                                  {naQCount} question{naQCount !== 1 ? 's' : ''} marked N/A
                                </p>
                              )}
                              <div className="w-full h-1.5 bg-muted rounded-full mb-3 border border-border/40">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${qPct}%` }} />
                              </div>
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/intake`)}
                                className="w-full text-xs py-1.5 px-3 rounded border-2 border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                              >
                                {qPct === 100 ? "View" : qPct === 0 ? "Start" : "Continue"}
                              </button>
                            </div>

                            {/* Testing */}
                            <div className="rounded-lg border-2 border-border/90 bg-muted/50 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <TestTube2 className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-bold">Testing</span>
                                </div>
                                <span className="text-lg font-bold text-primary">{vsPct}%</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{vsPass}/{vs?.total ?? 28} tests passed</p>
                              <div className="w-full h-1.5 bg-muted rounded-full mb-2 border border-border/40">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${vsPct}%` }} />
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
                                <span className="text-emerald-400 font-semibold">{vsPass} Pass</span>
                                {(vs?.fail ?? 0) > 0 && <span className="text-red-400 font-semibold">{vs.fail} Fail</span>}
                                {(vs?.inProgress ?? 0) > 0 && <span className="text-blue-400 font-semibold">{vs?.inProgress ?? 0} In Prog</span>}
                                {(vs?.blocked ?? 0) > 0 && <span className="text-orange-400 font-semibold">{vs.blocked} Blocked</span>}
                                <span className="text-muted-foreground">{vs?.notTested ?? (vs?.total ?? 28)} Open</span>
                              </div>
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/validation`)}
                                className="w-full text-xs py-1.5 px-3 rounded border-2 border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                              >
                                {vsPct === 100 ? "View" : vsPass === 0 ? "Start" : "Continue"}
                              </button>
                            </div>

                            {/* Task List */}
                            <div className="rounded-lg border-2 border-border/90 bg-muted/50 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <ListChecks className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-bold">Task List</span>
                                </div>
                                <span className="text-lg font-bold text-primary">{tsPct}%</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{tsDone}/{ts?.total ?? 0} tasks done</p>
                              <div className="w-full h-1.5 bg-muted rounded-full mb-2 border border-border/40">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${tsPct}%` }} />
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs mb-3">
                                <span className="text-emerald-400 font-semibold">{ts?.completed ?? 0} Done</span>
                                <span className="text-blue-400 font-semibold">{ts?.inProgress ?? 0} In Prog</span>
                                <span className="text-red-400 font-semibold">{ts?.blocked ?? 0} Blocked</span>
                                <span className="text-muted-foreground">{ts ? (ts.total - tsDone - (ts.inProgress ?? 0) - (ts.blocked ?? 0) - (ts.notApplicable ?? 0)) : 0} Open</span>
                              </div>
                              <button
                                onClick={() => setLocation(`/org/${org.slug}/implement`)}
                                className="w-full text-xs py-1.5 px-3 rounded border-2 border-primary/40 text-primary hover:bg-primary/10 transition-colors text-center font-medium"
                              >
                                {tsPct === 100 ? "View" : tsDone === 0 ? "Start" : "Continue"}
                              </button>
                            </div>
                          </div>

                          {/* Files */}
                          {orgMetrics?.files && orgMetrics.files.length > 0 && (
                            <div>
                              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">Files</p>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {orgMetrics.files.map((f: any) => (
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
                    </Card>
                  );
                })
              )}
            </div>
          </>
    </>
  );
}
