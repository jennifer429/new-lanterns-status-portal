/**
 * Site Dashboard — rich command-center view for a specific organization.
 * Shows: overall progress hero, workflow phase cards, architecture diagram,
 * connectivity info, questionnaire breakdown, validation stats, implementation stats, specs.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectivityTable, type ConnectivityRow } from "@/components/ConnectivityTable";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ClipboardList,
  FileText,
  CheckCircle2,
  Circle,
  ExternalLink,
  Download,
  ArrowRight,
  Pencil,
  BookOpen,
  ShieldCheck,
  Wrench,
  Network,
  Image as ImageIcon,
  Clock,
  ChevronDown,
  Trash2,
  Activity,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "@shared/taskDefs";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";

// ── Collapsible Section (with smooth Radix animation) ──────────────────────
function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="card-elevated overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-3">
              {icon}
              <span className="text-base font-semibold tracking-tight">{title}</span>
            </div>
            <div className="flex items-center gap-3">
              {badge}
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/40">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Progress Ring (SVG) ─────────────────────────────────────────────────────
function ProgressRing({
  value,
  size = 80,
  stroke = 6,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value === 100
      ? "oklch(0.72 0.19 142)"
      : value >= 50
        ? "oklch(0.75 0.18 85)"
        : "oklch(0.7 0.15 300)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.3 0.01 260)"
          strokeWidth={stroke}
          opacity={0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tracking-tight">{value}%</span>
        {label && (
          <span className="text-[10px] text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  );
}

// ── Workflow Phase Card ─────────────────────────────────────────────────────
function WorkflowPhaseCard({
  title,
  icon,
  completed,
  total,
  href,
  isActive,
  isLocked,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  completed: number;
  total: number;
  href: string;
  isActive: boolean;
  isLocked: boolean;
  subtitle?: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDone = completed === total && total > 0;
  const label = isDone ? "View" : completed > 0 ? "Continue" : "Start";

  return (
    <Link href={href}>
      <Card
        className={cn(
          "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
          isActive && "border-primary/50",
          isLocked && "opacity-40 pointer-events-none",
        )}
      >
        {/* Subtle gradient accent at top */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
            isDone
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : isActive
                ? "bg-gradient-to-r from-primary to-primary/60"
                : "bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/10"
          )}
        />
        <CardContent className="p-5 pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  isDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {icon}
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {completed}/{total} complete
              </span>
              <span
                className={cn(
                  "font-semibold",
                  isDone ? "text-emerald-400" : "text-foreground"
                )}
              >
                {pct}%
              </span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isDone
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : pct > 0
                      ? "bg-gradient-to-r from-primary to-primary/70"
                      : "bg-transparent"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "progress-dot",
                  i < completed
                    ? isDone
                      ? "progress-dot-complete"
                      : "progress-dot-filled"
                    : "progress-dot-empty"
                )}
              />
            ))}
          </div>

          {/* Action button */}
          <Button
            size="sm"
            variant={isDone ? "outline" : "default"}
            className={cn(
              "w-full text-xs font-semibold",
              isDone
                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                : "badge-status-start"
            )}
          >
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo";

  // Fetch organization data
  const { data: organization, isLoading: orgLoading } =
    trpc.organizations.getBySlug.useQuery(
      { slug: orgSlug },
      { enabled: !!orgSlug }
    );

  // Fetch existing responses to calculate real progress
  const { data: existingResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch all uploaded files
  const { data: allFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch validation results
  const { data: validationData } = trpc.validation.getResults.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch implementation results
  const { data: implementationData } =
    trpc.implementation.getTasks.useQuery(
      { organizationSlug: orgSlug },
      { enabled: !!orgSlug }
    );

  // Fetch New Lantern specifications
  const { data: specs = [] } = trpc.admin.getSpecifications.useQuery();

  // Connectivity — live Notion-backed state
  const { data: connectivityData, isLoading: connectivityLoading } =
    trpc.connectivity.getForOrg.useQuery(
      { organizationSlug: orgSlug, organizationName: organization?.name },
      { enabled: !!orgSlug }
    );

  const [connRows, setConnRows] = useState<ConnectivityRow[]>([]);
  // IDs that exist as Notion pages (vs newly-added local rows)
  const notionPageIds = useRef<Set<string>>(new Set());
  const [connSaving, setConnSaving] = useState(false);

  useEffect(() => {
    if (connectivityData?.rows) {
      setConnRows(connectivityData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(connectivityData.rows.map(r => r.id));
    }
  }, [connectivityData]);

  const createRowMutation = trpc.connectivity.createRow.useMutation();
  const updateRowMutation = trpc.connectivity.updateRow.useMutation();
  const archiveRowMutation = trpc.connectivity.archiveRow.useMutation();

  const handleConnChange = async (newRows: ConnectivityRow[]) => {
    const oldIds = new Set(connRows.map(r => r.id));
    const newIds = new Set(newRows.map(r => r.id));
    setConnRows(newRows); // optimistic
    if (!connectivityData?.configured || !organization?.name) return;
    setConnSaving(true);
    try {
      // Deletions
      for (const row of connRows) {
        if (!newIds.has(row.id) && notionPageIds.current.has(row.id)) {
          archiveRowMutation.mutate({ pageId: row.id });
          notionPageIds.current.delete(row.id);
        }
      }
      // Additions & updates
      for (const row of newRows) {
        if (!oldIds.has(row.id)) {
          // New row — create in Notion, swap in real page ID
          createRowMutation.mutate(
            { organizationName: organization.name, row },
            { onSuccess: ({ pageId }) => {
                notionPageIds.current.add(pageId);
                setConnRows(prev => prev.map(r => r.id === row.id ? { ...r, id: pageId } : r));
              }
            }
          );
        } else if (notionPageIds.current.has(row.id)) {
          const old = connRows.find(r => r.id === row.id);
          if (JSON.stringify(old) !== JSON.stringify(row)) {
            updateRowMutation.mutate({ pageId: row.id, organizationName: organization.name, row });
          }
        }
      }
    } finally {
      setConnSaving(false);
    }
  };

  // Delete file mutation
  const utils = trpc.useUtils();
  const deleteFileMutation = trpc.intake.deleteFile.useMutation({
    onSuccess: () => {
      utils.intake.getAllUploadedFiles.invalidate({ organizationSlug: orgSlug });
    },
  });

  const handleRemoveDiagram = (fileId: number) => {
    if (window.confirm("Remove this architecture diagram?")) {
      deleteFileMutation.mutate({ fileId, organizationSlug: orgSlug });
    }
  };

  // Build responses map
  const responsesMap: Record<string, string> = {};
  existingResponses.forEach((r: any) => {
    if (r.questionId && r.response) {
      responsesMap[r.questionId] = r.response;
    }
  });

  // Architecture diagram files
  const diagramFiles = allFiles.filter(
    (f: any) => f.questionId === "ARCH.diagram"
  );

  // Flatten all questions from sections
  const allQuestions = questionnaireSections.flatMap((section) => {
    if (section.type === "workflow") {
      return [
        {
          id: section.id + "_config",
          sectionTitle: section.title,
          isWorkflow: true,
          conditionalOn: null,
        },
      ];
    }
    return (section.questions || []).map((q) => ({
      id: q.id,
      sectionTitle: section.title,
      conditionalOn: q.conditionalOn || null,
    }));
  });

  // Use shared progress calculation
  const progress = calculateProgress(allQuestions, existingResponses, allFiles);

  const totalSections = Object.keys(progress.sectionProgress).length;
  const completedSections = Object.values(progress.sectionProgress).filter(
    (section: any) => section.completed === section.total
  ).length;

  // Section progress for display
  const sectionProgress = Object.entries(progress.sectionProgress).map(
    ([name, stats]: [string, any]) => ({
      name,
      isComplete: stats.total > 0 && stats.completed === stats.total,
      completed: stats.completed,
      total: stats.total,
    })
  );

  // Validation stats from real data
  const valResults = validationData || {};
  const valEntries = Object.values(valResults) as any[];
  const valTotal = 18;
  const valCompleted = valEntries.filter(
    (v: any) => v.status === "Pass"
  ).length;

  // Implementation stats from real data
  const implResults = implementationData || {};
  const implTotal = TASK_SECTION_DEFS.flatMap(s => s.tasks).length;
  const implCompleted = TASK_SECTION_DEFS.flatMap(s => s.tasks).filter(
    t => (implResults as any)[t.id]?.completed === true
  ).length;

  // Overall progress (weighted: questionnaire 40%, testing 30%, implementation 30%)
  const qPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  const vPct = valTotal > 0 ? (valCompleted / valTotal) * 100 : 0;
  const iPct = implTotal > 0 ? (implCompleted / implTotal) * 100 : 0;
  const overallPct = Math.round(qPct * 0.4 + vPct * 0.3 + iPct * 0.3);

  // Determine active phase
  const qDone = completedSections === totalSections && totalSections > 0;
  const vDone = valCompleted === valTotal && valTotal > 0;
  const activePhase = !qDone ? "questionnaire" : !vDone ? "testing" : "implementation";

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const orgName = organization?.name || "Your Organization";
  const partnerName = organization?.clientName || "";

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/new-lantern-logo.png"
              alt="New Lantern"
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold tracking-tight">{orgName}</div>
              {partnerName && (
                <div className="text-xs text-muted-foreground">{partnerName}</div>
              )}
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <PhiDisclaimer />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* ── Hero: Overall Progress ── */}
        <Card className="card-elevated overflow-hidden">
          {/* Top accent gradient */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Progress Ring */}
              <ProgressRing value={overallPct} size={110} stroke={8} />

              {/* Stats */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold tracking-tight mb-1">
                  Implementation Progress
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  {overallPct === 100
                    ? "All phases complete — ready for go-live."
                    : overallPct > 0
                      ? `Currently in ${activePhase === "questionnaire" ? "Questionnaire" : activePhase === "testing" ? "Testing" : "Task List"} phase.`
                      : "Get started by filling out the questionnaire."}
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Questionnaire", value: `${completedSections}/${totalSections}`, done: qDone },
                    { label: "Tests Passed", value: `${valCompleted}/${valTotal}`, done: vDone },
                    { label: "Tasks Done", value: `${implCompleted}/${implTotal}`, done: implCompleted === implTotal && implTotal > 0 },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "text-center p-3 rounded-xl border transition-colors",
                        stat.done
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-muted/20 border-border/30"
                      )}
                    >
                      <div
                        className={cn(
                          "text-lg font-bold tracking-tight",
                          stat.done ? "text-emerald-400" : "text-primary"
                        )}
                      >
                        {stat.value}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats sidebar */}
              <div className="flex flex-col gap-3 min-w-[140px]">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Files:</span>
                  <span className="font-semibold">{allFiles.length}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phase:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      activePhase === "questionnaire"
                        ? "border-primary/40 text-primary"
                        : activePhase === "testing"
                          ? "border-amber-500/40 text-amber-400"
                          : "border-emerald-500/40 text-emerald-400"
                    )}
                  >
                    {activePhase === "questionnaire"
                      ? "Questionnaire"
                      : activePhase === "testing"
                        ? "Testing"
                        : "Task List"}
                  </Badge>
                </div>
                {diagramFiles.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Diagram:</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                      Uploaded
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Workflow Phase Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkflowPhaseCard
            title="Questionnaire"
            subtitle="Start here"
            icon={<ClipboardList className="w-5 h-5" />}
            completed={completedSections}
            total={totalSections}
            href={`/org/${orgSlug}/intake`}
            isActive={activePhase === "questionnaire"}
            isLocked={false}
          />
          <WorkflowPhaseCard
            title="Testing"
            subtitle="Validate connectivity"
            icon={<ShieldCheck className="w-5 h-5" />}
            completed={valCompleted}
            total={valTotal}
            href={`/org/${orgSlug}/validation`}
            isActive={activePhase === "testing"}
            isLocked={false}
          />
          <WorkflowPhaseCard
            title="Task List"
            subtitle="Build & deploy"
            icon={<Wrench className="w-5 h-5" />}
            completed={implCompleted}
            total={implTotal}
            href={`/org/${orgSlug}/implement`}
            isActive={activePhase === "implementation"}
            isLocked={false}
          />
        </div>

        <div className="section-divider" />

        {/* ── Architecture Diagram ── */}
        <CollapsibleSection
          title="Architecture Diagram"
          icon={<ImageIcon className="w-5 h-5 text-primary" />}
          badge={
            diagramFiles.length > 0 ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                Uploaded
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground"
              >
                Not Uploaded
              </Badge>
            )
          }
          defaultOpen={diagramFiles.length > 0}
        >
          <CardContent className="p-5">
            {diagramFiles.length > 0 ? (
              <div className="space-y-4">
                {diagramFiles.map((file: any) => {
                  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(
                    file.fileName
                  );
                  return (
                    <div key={file.id}>
                      {isImage ? (
                        <div className="border border-border/50 rounded-xl overflow-hidden bg-muted/10">
                          <img
                            src={file.fileUrl}
                            alt={file.fileName}
                            className="w-full max-h-[600px] object-contain"
                          />
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-t border-border/30">
                            <span className="text-sm text-muted-foreground">
                              {file.fileName}
                            </span>
                            <div className="flex items-center gap-2">
                              <a href={file.fileUrl} download={file.fileName}>
                                <Button size="sm" variant="ghost" className="text-xs">
                                  <Download className="w-4 h-4 mr-1" /> Download
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveDiagram(file.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-muted/10">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {file.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={file.fileUrl} download={file.fileName}>
                              <Button size="sm" variant="ghost" className="text-xs">
                                <Download className="w-4 h-4 mr-1" /> Download
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveDiagram(file.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-14 border-2 border-dashed border-border/40 rounded-xl">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No architecture diagram uploaded yet
                </p>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  Upload your network diagram in the Questionnaire
                </p>
                <Link href={`/org/${orgSlug}/intake`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Go to Questionnaire
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </CollapsibleSection>

        {/* ── Connectivity (live Notion) ── */}
        <CollapsibleSection
          title="Connectivity"
          icon={<Network className="w-5 h-5 text-primary" />}
          badge={
            connectivityLoading ? (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </Badge>
            ) : connRows.length ? (
              <Badge variant="outline" className={cn("text-xs gap-1", connSaving ? "text-muted-foreground" : "border-green-500/40 text-green-400")}>
                {connSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                {connRows.length} {connRows.length === 1 ? "connection" : "connections"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">Notion</Badge>
            )
          }
          defaultOpen={false}
        >
          <CardContent className="p-0">
            {connectivityData?.error ? (
              <div className="flex items-center gap-3 py-6 px-5 rounded-b-xl bg-destructive/10 border-t border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">Notion error: {connectivityData.error}</p>
              </div>
            ) : !connectivityData?.configured ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 mx-5 my-5 border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
                <Network className="w-7 h-7 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium">Notion API key not configured</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Set NOTION_API_KEY to enable live connectivity editing</p>
                </div>
              </div>
            ) : (
              <ConnectivityTable
                rows={connRows}
                systems={(() => { try { const r = existingResponses?.find((r: any) => r.questionId === 'ARCH.systems'); return r?.response ? JSON.parse(r.response) : []; } catch { return []; } })()}
                onChange={handleConnChange}
              />
            )}
          </CardContent>
        </CollapsibleSection>



        {/* ── Specifications ── */}
        {specs.length > 0 && (
          <>
            <div className="section-divider" />
            <CollapsibleSection
              title="New Lantern Specifications"
              icon={<BookOpen className="w-5 h-5 text-primary" />}
              badge={
                <Badge
                  variant="outline"
                  className="text-xs text-muted-foreground font-semibold"
                >
                  {specs.length} docs
                </Badge>
              }
              defaultOpen={false}
            >
              <CardContent className="p-5">
                <div className="space-y-2">
                  {specs.map((spec: any) => (
                    <a
                      key={spec.id}
                      href={spec.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 hover:bg-accent/50 hover:border-border transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                          <Download className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{spec.title}</div>
                          {spec.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {spec.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {spec.category && (
                        <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-medium">
                          {spec.category}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </CardContent>
            </CollapsibleSection>
          </>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
