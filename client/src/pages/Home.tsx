/**
 * Site Dashboard — rich command-center view for a specific organization.
 * Shows: 3 expandable resource cards (Connectivity, Architecture, Specs),
 * overall progress hero, workflow phase cards.
 * Designed to fit in a single viewport without scrolling.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectivityTable, type ConnectivityRow } from "@/components/ConnectivityTable";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  FileText,
  CheckCircle2,
  ExternalLink,
  Download,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Wrench,
  Network,
  Image as ImageIcon,
  ChevronDown,
  Trash2,
  Activity,
  ArrowUpRight,
  Loader2,
  X,
  Maximize2,
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
        <CardContent className="p-4 pt-5">
          <div className="flex items-start justify-between mb-3">
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
          <div className="mb-2">
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
          <div className="flex items-center gap-1.5 mb-3">
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

// ── Lightbox for architecture diagrams ──────────────────────────────────────
function DiagramLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 bg-background/90 border border-border rounded-full p-1.5 hover:bg-background transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border/30"
        />
        <div className="text-center mt-2 text-sm text-muted-foreground">{alt}</div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo";

  // Expandable card states
  const [connectivityOpen, setConnectivityOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);

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

  // Validation stats from real data
  const valResults = validationData || {};
  const valEntries = Object.values(valResults) as any[];
  const valNaCount = valEntries.filter((v: any) => v.status === "N/A").length;
  const valTotal = 28 - valNaCount; // 28 tests total (4+5+4+15 across 4 phases)
  const valCompleted = valEntries.filter(
    (v: any) => v.status === "Pass"
  ).length;

  // Implementation stats from real data
  const implResults = implementationData || {};
  const implEntries = Object.values(implResults) as any[];
  const implNaCount = implEntries.filter((v: any) => v.notApplicable === true).length;
  const implTotal = TASK_SECTION_DEFS.flatMap(s => s.tasks).length - implNaCount;
  const implCompleted = TASK_SECTION_DEFS.flatMap(s => s.tasks).filter(
    t => (implResults as any)[t.id]?.completed === true && (implResults as any)[t.id]?.notApplicable !== true
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

  // Group specs by category for the expandable card
  const specsByCategory = new Map<string, any[]>();
  for (const spec of specs) {
    const cat = (spec as any).category || "General";
    if (!specsByCategory.has(cat)) specsByCategory.set(cat, []);
    specsByCategory.get(cat)!.push(spec);
  }

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Lightbox overlay */}
      {lightboxSrc && (
        <DiagramLightbox
          src={lightboxSrc.src}
          alt={lightboxSrc.alt}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/new-lantern-logo.png"
              alt="New Lantern"
              className="h-9"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">

        {/* ═══════════════════════════════════════════════════════════════════
            TOP ROW: 3 Expandable Resource Cards
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* ── 1. Connectivity Card ── */}
          <Card className="card-elevated overflow-hidden">
            <button
              onClick={() => setConnectivityOpen(!connectivityOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Network className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Connectivity</span>
              </div>
              <div className="flex items-center gap-2">
                {connectivityLoading ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading
                  </Badge>
                ) : connRows.length > 0 ? (
                  <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">
                    {connRows.length}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">0</Badge>
                )}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    connectivityOpen && "rotate-180"
                  )}
                />
              </div>
            </button>
            {connectivityOpen && (
              <div className="border-t border-border/40 max-h-[50vh] overflow-auto">
                <div className="p-3">
                  {connectivityLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : connRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <ConnectivityTable rows={connRows} onChange={handleConnChange} />
                      {connSaving && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Saving to Notion...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground mb-2">No connectivity data yet</p>
                      <Link href={`/org/${orgSlug}/intake`}>
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <ArrowRight className="w-3 h-3 mr-1" /> Add in Questionnaire
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
                {connRows.length > 0 && (
                  <div className="px-3 pb-2 flex items-center justify-end gap-2">
                    <Link href={`/org/${orgSlug}/intake`}>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">
                        <ExternalLink className="w-3 h-3 mr-1" /> Full View
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── 2. Architecture Card ── */}
          <Card className="card-elevated overflow-hidden">
            <button
              onClick={() => setArchitectureOpen(!architectureOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <ImageIcon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                {diagramFiles.length > 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                    {diagramFiles.length} file{diagramFiles.length > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">None</Badge>
                )}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    architectureOpen && "rotate-180"
                  )}
                />
              </div>
            </button>
            {architectureOpen && (
              <div className="border-t border-border/40">
                <div className="p-3">
                  {diagramFiles.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {diagramFiles.map((file: any) => {
                        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.fileName);
                        return (
                          <div key={file.id} className="flex-shrink-0 group/thumb relative">
                            {isImage ? (
                              <div
                                className="w-32 h-24 rounded-lg border border-border/50 overflow-hidden bg-muted/10 cursor-pointer relative"
                                onClick={() => setLightboxSrc({ src: file.fileUrl, alt: file.fileName })}
                              >
                                <img
                                  src={file.fileUrl}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-colors flex items-center justify-center">
                                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-32 h-24 rounded-lg border border-border/50 bg-muted/10 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{file.fileName}</span>
                              <div className="flex items-center gap-0.5">
                                <a href={file.fileUrl} download={file.fileName} onClick={(e) => e.stopPropagation()}>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                                    <Download className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleRemoveDiagram(file.id)}
                                >
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground mb-2">No diagrams uploaded</p>
                      <Link href={`/org/${orgSlug}/intake`}>
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <ArrowRight className="w-3 h-3 mr-1" /> Upload in Questionnaire
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* ── 3. Specifications Card ── */}
          <Card className="card-elevated overflow-hidden">
            <button
              onClick={() => setSpecsOpen(!specsOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Specifications</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] text-muted-foreground font-semibold">
                  {specs.length} docs
                </Badge>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    specsOpen && "rotate-180"
                  )}
                />
              </div>
            </button>
            {specsOpen && (
              <div className="border-t border-border/40 max-h-[50vh] overflow-auto">
                <div className="p-3 space-y-2">
                  {/* NL Standard Docs */}
                  {specs.length > 0 ? (
                    <>
                      {Array.from(specsByCategory.entries()).map(([category, catSpecs]) => (
                        <div key={category}>
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{category}</div>
                          {catSpecs.map((spec: any) => (
                            <div key={spec.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group/spec">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs font-medium truncate">{spec.title}</span>
                              </div>
                              {spec.fileUrl && (
                                <a href={spec.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                  <Button size="sm" variant="ghost" className="h-6 px-1.5 opacity-0 group-hover/spec:opacity-100 transition-opacity">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">No specifications available</p>
                  )}

                  {/* Site-uploaded files */}
                  {allFiles.filter((f: any) => f.questionId !== "ARCH.diagram").length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">Site Uploads</div>
                      {allFiles
                        .filter((f: any) => f.questionId !== "ARCH.diagram")
                        .slice(0, 5)
                        .map((file: any) => (
                          <div key={file.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group/file">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs font-medium truncate">{file.fileName}</span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                              <a href={file.fileUrl} download={file.fileName}>
                                <Button size="sm" variant="ghost" className="h-6 px-1.5">
                                  <Download className="w-3 h-3" />
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div className="px-3 pb-2 flex items-center justify-end">
                  <Link href={`/org/${orgSlug}/specs`}>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">
                      <ExternalLink className="w-3 h-3 mr-1" /> View All
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            IMPLEMENTATION PROGRESS HERO
            ═══════════════════════════════════════════════════════════════════ */}
        <Card className="card-elevated overflow-hidden">
          {/* Top accent gradient */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Progress Ring */}
              <ProgressRing value={overallPct} size={90} stroke={7} />

              {/* Stats */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-lg font-bold tracking-tight mb-0.5">
                  Implementation Progress
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {overallPct === 100
                    ? "All phases complete — ready for go-live."
                    : overallPct > 0
                      ? `Currently in ${activePhase === "questionnaire" ? "Questionnaire" : activePhase === "testing" ? "Testing" : "Task List"} phase.`
                      : "Get started by filling out the questionnaire."}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Questionnaire", count: `${completedSections}/${totalSections}`, pct: Math.round(qPct), done: qDone },
                    { label: "Tests Passed", count: `${valCompleted}/${valTotal}`, pct: Math.round(vPct), done: vDone },
                    { label: "Tasks Done", count: `${implCompleted}/${implTotal}`, pct: Math.round(iPct), done: implCompleted === implTotal && implTotal > 0 },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "text-center p-2 rounded-lg border transition-colors",
                        stat.done
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-muted/20 border-border/30"
                      )}
                    >
                      <div
                        className={cn(
                          "text-base font-bold tracking-tight",
                          stat.done ? "text-emerald-400" : "text-primary"
                        )}
                      >
                        {stat.pct}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                        {stat.count} {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats sidebar */}
              <div className="flex flex-col gap-2 min-w-[130px]">
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Files:</span>
                  <span className="font-semibold">{allFiles.length}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Phase:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
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
                  <div className="flex items-center gap-2 text-xs">
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Diagram:</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                      Uploaded
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            WORKFLOW PHASE CARDS
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </div>
  );
}
