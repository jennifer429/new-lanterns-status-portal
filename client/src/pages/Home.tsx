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
  Upload,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "@shared/taskDefs";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { UploadedFilesList } from "@/components/UploadedFileRow";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user: currentUser } = useAuth();

  // Expandable card states
  const [connectivityOpen, setConnectivityOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocFiles, setAdhocFiles] = useState<File[]>([]);
  const [adhocUploading, setAdhocUploading] = useState(false);
  const [notesLabel, setNotesLabel] = useState("Call Notes");
  const [notesCustomLabel, setNotesCustomLabel] = useState("");

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

  // Labeled notes (Documents & Notes section)
  const { data: adhocFilesList = [], refetch: refetchAdhoc } = trpc.notes.listByOrg.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  const uploadAdhocMutation = trpc.notes.uploadForOrg.useMutation({
    onSuccess: () => {
      refetchAdhoc();
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      refetchAdhoc();
    },
  });

  // Delete file mutation (for architecture diagrams and intake files)
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

  const handleAdhocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 25MB limit`);
        return false;
      }
      return true;
    });
    setAdhocFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleAdhocUpload = async () => {
    if (adhocFiles.length === 0) return;
    const effectiveLabel = notesLabel === "Other" ? (notesCustomLabel.trim() || "Other") : notesLabel;
    setAdhocUploading(true);
    let ok = 0;
    for (const file of adhocFiles) {
      try {
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = (e) => res((e.target!.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await uploadAdhocMutation.mutateAsync({
          organizationSlug: orgSlug,
          label: effectiveLabel,
          fileName: file.name,
          fileData: base64,
          mimeType: file.type || "application/octet-stream",
        });
        ok++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setAdhocUploading(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "File uploaded!" : `${ok} files uploaded!`);
      setAdhocFiles([]);
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
  const valTotal = 28; // 28 tests total (4+5+4+15 across 4 phases) — N/A counts as 100% complete
  const valCompleted = valEntries.filter(
    (v: any) => v.status === "Pass"
  ).length;

  // Implementation stats from real data
  const implResults = implementationData || {};
  const implEntries = Object.values(implResults) as any[];
  const implNaCount = implEntries.filter((v: any) => v.notApplicable === true).length;
  const allTaskDefs = TASK_SECTION_DEFS.flatMap(s => s.tasks);
  const implTotal = allTaskDefs.length;
  const implCompleted = allTaskDefs.filter(
    t => (implResults as any)[t.id]?.completed === true && (implResults as any)[t.id]?.notApplicable !== true
  ).length;
  const implInProgressCount = allTaskDefs.filter(
    t => (implResults as any)[t.id]?.inProgress === true && !(implResults as any)[t.id]?.notApplicable
  ).length;
  const implBlockedCount = allTaskDefs.filter(
    t => (implResults as any)[t.id]?.blocked === true && !(implResults as any)[t.id]?.notApplicable
  ).length;
  const implOpenCount = allTaskDefs.filter(t => {
    const r = (implResults as any)[t.id];
    return !r?.completed && !r?.notApplicable && !r?.blocked && !r?.inProgress;
  }).length;
  const nextUpTasks = allTaskDefs.filter(t => {
    const r = (implResults as any)[t.id];
    return !r?.completed && !r?.notApplicable && !r?.blocked && !r?.inProgress;
  }).slice(0, 3);

  // Questionnaire per-section stats for dashboard card
  const qSectionEntries = Object.entries(progress.sectionProgress);
  const qInProgressSections = qSectionEntries.filter(
    ([, s]: [string, any]) => s.completed > 0 && s.completed < s.total
  ).length;
  const qNotStartedSections = qSectionEntries.filter(
    ([, s]: [string, any]) => s.completed === 0
  ).length;
  const nextUpSections = qSectionEntries
    .filter(([, s]: [string, any]) => s.completed < s.total)
    .slice(0, 3)
    .map(([title]) => title);

  // Validation per-test stats for dashboard card
  // Build a flat list of all test names across phases for "next up"
  const VAL_PHASES = [
    { title: "Connectivity Validation", count: 4 },
    { title: "HL7 Message Validation", count: 5 },
    { title: "Image Routing Validation", count: 4 },
    { title: "User Acceptance Testing", count: 15 },
  ];
  // Flat test names for "Next Up" display (matches pIdx:tIdx keys)
  const VAL_TEST_NAMES = [
    "VPN Tunnel Connectivity", "DICOM Echo Test (C-ECHO)", "HL7 Port Connectivity", "SSO / Active Directory Authentication",
    "ORM New Order (NW)", "ORM Cancel Order (CA)", "ORU Report Delivery", "ADT Patient Update", "Priority Routing (STAT)",
    "DICOM Store from Modality", "Prior Image Query/Retrieve", "Worklist (MWL) Query", "AI Routing (if applicable)",
    "End-to-End Order Workflow", "Radiologist Reading Workflow", "Tech QC Workflow", "Report Distribution", "STAT Escalation Path",
    "Downtime Recovery", "Reschedule a Study", "Cancel a Study", "End-to-End Study Completion", "Addendum Workflow",
    "CT Dose & Tech Sheet Integration", "BI-RADS Custom Report Insertion", "Lung-RADS / Lung CA Mapping", "Study Merge", "Study Split",
  ];
  const valFailedCount = Object.values(valResults as Record<string, any>).filter(
    (v: any) => v.status === "Fail"
  ).length;
  const valInProgressCount = valEntries.filter((v: any) => v.status === "In Progress").length;
  const valBlockedCount = valEntries.filter((v: any) => v.status === "Blocked").length;
  const valNotTestedCount = valTotal - valCompleted - valFailedCount - valNaCount - valInProgressCount - valBlockedCount;
  // Next up: first 3 tests that are not Pass and not N/A
  const allValKeys: string[] = [];
  let offset = 0;
  for (const phase of VAL_PHASES) {
    for (let t = 0; t < phase.count; t++) {
      allValKeys.push(`${offset}:${t}`);
    }
    offset++;
  }
  const nextUpTests = allValKeys
    .filter(k => {
      const v = (valResults as any)[k];
      return !v || (v.status !== "Pass" && v.status !== "N/A");
    })
    .slice(0, 3);

  // Weighted progress: Done=100%, N/A=100%, InProgress=50%, Blocked=25%, Open=0%
  // Implementation weighted progress
  const implWeightedScore = implTotal > 0
    ? ((implCompleted * 1.0 + implNaCount * 1.0 + implInProgressCount * 0.5 + implBlockedCount * 0.25) / implTotal) * 100
    : 0;
  // Validation weighted progress (Pass=100%, Fail=25%, N/A=100%, InProgress=50%, Blocked=25%, NotTested=0%)
  const valWeightedScore = 28 > 0
    ? ((valCompleted * 1.0 + valNaCount * 1.0 + valFailedCount * 0.25 + valInProgressCount * 0.5 + valBlockedCount * 0.25) / 28) * 100
    : 0;
  // Overall progress (weighted: questionnaire 40%, testing 30%, implementation 30%)
  const qPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  const vPct = valWeightedScore;
  const iPct = implWeightedScore;
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + org name */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Site Dashboard</div>
              {orgName && <div className="text-xs text-muted-foreground truncate">{orgName}{partnerName ? ` · ${partnerName}` : ""}</div>}
            </div>
          </div>
          {/* Right: user menu */}
          <div className="flex items-center gap-2">
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
            {/* Architecture thumbnail preview when collapsed */}
            {!architectureOpen && diagramFiles.length > 0 && (() => {
              const imgFiles = diagramFiles.filter((f: any) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.fileName));
              if (imgFiles.length === 0) return null;
              const firstImg = imgFiles[0];
              return (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setLightboxSrc({ src: firstImg.fileUrl, alt: firstImg.fileName })}
                    className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border/40 bg-muted/20 hover:border-primary/40 hover:opacity-90 transition-all group"
                  >
                    <img
                      src={firstImg.fileUrl}
                      alt={firstImg.fileName}
                      className="w-full h-full object-contain bg-black/5"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                    {imgFiles.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        +{imgFiles.length - 1} more
                      </div>
                    )}
                  </button>
                </div>
              );
            })()}
            {architectureOpen && (
              <div className="border-t border-border/40">
                <div className="p-3 space-y-3">
                  {diagramFiles.length > 0 ? (
                    <>
                      {/* Image thumbnails grid */}
                      {(() => {
                        const imgFiles = diagramFiles.filter((f: any) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.fileName));
                        if (imgFiles.length === 0) return null;
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            {imgFiles.map((f: any) => (
                              <button
                                key={f.id}
                                onClick={() => setLightboxSrc({ src: f.fileUrl, alt: f.fileName })}
                                className="relative aspect-video rounded-lg overflow-hidden border border-border/40 bg-muted/20 hover:border-primary/40 hover:opacity-90 transition-all group"
                              >
                                <img
                                  src={f.fileUrl}
                                  alt={f.fileName}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                  <Maximize2 className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                                  <p className="text-[10px] text-white truncate">{f.fileName}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Non-image files list */}
                      <UploadedFilesList
                        files={diagramFiles
                          .filter((f: any) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.fileName))
                          .map((file: any) => ({
                            id: file.id,
                            fileName: file.fileName,
                            fileUrl: file.fileUrl,
                            fileSize: file.fileSize,
                            createdAt: file.createdAt,
                            uploadedBy: file.uploadedBy,
                          }))}
                        onRemove={(fileId) => handleRemoveDiagram(fileId)}
                        compact
                        emptyMessage=""
                      />
                    </>
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
            SECOND ROW: Progress Hero (full width)
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
                    { label: "Tests Passed", count: `${valCompleted + valNaCount}/${valTotal}`, pct: Math.round(vPct), done: vPct >= 100 },
                    { label: "Tasks Done", count: `${implCompleted + implNaCount}/${implTotal}`, pct: Math.round(iPct), done: iPct >= 100 },
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
          {/* Questionnaire card — merged with section summary */}
          {(() => {
            const qPctCard = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
            const qIsDone = completedSections === totalSections && totalSections > 0;
            const qLabel = qIsDone ? "View" : completedSections > 0 ? "Continue" : "Start";
            return (
              <Link href={`/org/${orgSlug}/intake`}>
                <Card
                  className={cn(
                    "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
                    activePhase === "questionnaire" && "border-primary/50",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
                      qIsDone
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : activePhase === "questionnaire"
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
                            qIsDone
                              ? "bg-emerald-500/15 text-emerald-400"
                              : activePhase === "questionnaire"
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold tracking-tight">Questionnaire</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Start here</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{completedSections}/{totalSections} complete</span>
                        <span className={cn("font-semibold", qIsDone ? "text-emerald-400" : "text-foreground")}>{qPctCard}%</span>
                      </div>
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            qIsDone
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                              : qPctCard > 0
                                ? "bg-gradient-to-r from-primary to-primary/70"
                                : "bg-transparent"
                          )}
                          style={{ width: `${qPctCard}%` }}
                        />
                      </div>
                    </div>

                    {/* Status breakdown */}
                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {([
                        { label: "Done",    count: completedSections,    dotCls: "bg-green-500",           numCls: "text-green-500" },
                        { label: "In Prog", count: qInProgressSections,  dotCls: "bg-blue-400",           numCls: "text-blue-400" },
                        { label: "N/A",     count: progress.naQuestions,  dotCls: "bg-amber-400",           numCls: "text-amber-400" },
                        { label: "Open",    count: qNotStartedSections,  dotCls: "bg-muted-foreground/40", numCls: "text-foreground" },
                      ] as const).map(({ label: statusLabel, count, dotCls, numCls }) => (
                        <div key={statusLabel} className="text-center">
                          <div className={`text-sm font-bold ${numCls}`}>{count}</div>
                          <div className="flex items-center justify-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                            <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Next Up */}
                    {nextUpSections.length > 0 && (
                      <div className="border-t border-border/30 pt-2 mb-3">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
                        <ul className="space-y-1">
                          {nextUpSections.map(title => (
                            <li key={title} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                              <span className="text-xs text-foreground">{title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action button */}
                    <Button
                      size="sm"
                      variant={qIsDone ? "outline" : "default"}
                      className={cn(
                        "w-full text-xs font-semibold",
                        qIsDone
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "badge-status-start"
                      )}
                    >
                      {qIsDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {qLabel}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })()}
          {/* Testing card — merged with test summary */}
          {(() => {
            // Weighted: Pass=100%, N/A=100%, Fail=25%, InProgress=50%, Blocked=25%, Open=0%
            const vPctCard = valTotal > 0 ? Math.round(((valCompleted * 1.0 + valNaCount * 1.0 + valFailedCount * 0.25 + valInProgressCount * 0.5 + valBlockedCount * 0.25) / valTotal) * 100) : 0;
            const vIsDone = vPctCard >= 100;
            const vLabel = vIsDone ? "View" : valCompleted > 0 ? "Continue" : "Start";
            // Map nextUpTests keys to test names
            const nextUpTestNames = nextUpTests.map(key => {
              const [pIdx, tIdx] = key.split(":").map(Number);
              let flatIdx = 0;
              for (let i = 0; i < pIdx; i++) flatIdx += VAL_PHASES[i].count;
              flatIdx += tIdx;
              return VAL_TEST_NAMES[flatIdx] || `Test ${key}`;
            });
            return (
              <Link href={`/org/${orgSlug}/validation`}>
                <Card
                  className={cn(
                    "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
                    activePhase === "testing" && "border-primary/50",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
                      vIsDone
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : activePhase === "testing"
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
                            vIsDone
                              ? "bg-emerald-500/15 text-emerald-400"
                              : activePhase === "testing"
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold tracking-tight">Testing</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Validate connectivity</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{valCompleted + valNaCount}/{valTotal} complete</span>
                        <span className={cn("font-semibold", vIsDone ? "text-emerald-400" : "text-foreground")}>{vPctCard}%</span>
                      </div>
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            vIsDone
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                              : vPctCard > 0
                                ? "bg-gradient-to-r from-primary to-primary/70"
                                : "bg-transparent"
                          )}
                          style={{ width: `${vPctCard}%` }}
                        />
                      </div>
                    </div>

                    {/* Status breakdown */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-3">
                      {([
                        { label: "Pass",       count: valCompleted,        dotCls: "bg-emerald-500",         numCls: "text-emerald-500" },
                        { label: "Fail",       count: valFailedCount,      dotCls: "bg-red-500",             numCls: "text-red-500" },
                        { label: "In Prog",    count: valInProgressCount,  dotCls: "bg-blue-500",            numCls: "text-blue-500" },
                        { label: "Blocked",    count: valBlockedCount,     dotCls: "bg-orange-500",          numCls: "text-orange-500" },
                        { label: "N/A",        count: valNaCount,          dotCls: "bg-amber-500",           numCls: "text-amber-500" },
                        { label: "Open",       count: valNotTestedCount,   dotCls: "bg-muted-foreground/40", numCls: "text-foreground" },
                      ] as const).map(({ label: statusLabel, count, dotCls, numCls }) => (
                        <div key={statusLabel} className="text-center">
                          <div className={`text-sm font-bold ${numCls}`}>{count}</div>
                          <div className="flex items-center justify-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                            <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Next Up */}
                    {nextUpTestNames.length > 0 && (
                      <div className="border-t border-border/30 pt-2 mb-3">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
                        <ul className="space-y-1">
                          {nextUpTestNames.map(name => (
                            <li key={name} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                              <span className="text-xs text-foreground">{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action button */}
                    <Button
                      size="sm"
                      variant={vIsDone ? "outline" : "default"}
                      className={cn(
                        "w-full text-xs font-semibold",
                        vIsDone
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "badge-status-start"
                      )}
                    >
                      {vIsDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {vLabel}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })()}
          {/* Task List card — merged with task summary */}
          {(() => {
            // Weighted: Done=100%, N/A=100%, InProgress=50%, Blocked=25%, Open=0%
            const pct = implTotal > 0 ? Math.round(((implCompleted * 1.0 + implNaCount * 1.0 + implInProgressCount * 0.5 + implBlockedCount * 0.25) / implTotal) * 100) : 0;
            const isDone = pct >= 100;
            const label = isDone ? "View" : implCompleted > 0 ? "Continue" : "Start";
            return (
              <Link href={`/org/${orgSlug}/implement`}>
                <Card
                  className={cn(
                    "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
                    activePhase === "implementation" && "border-primary/50",
                  )}
                >
                  {/* Top accent */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
                      isDone
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : activePhase === "implementation"
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
                              : activePhase === "implementation"
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold tracking-tight">Task List</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Build & deploy</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{implCompleted + implNaCount}/{implTotal} complete</span>
                        <span className={cn("font-semibold", isDone ? "text-emerald-400" : "text-foreground")}>{pct}%</span>
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

                    {/* Status breakdown */}
                    <div className="grid grid-cols-5 gap-1 mb-3">
                      {([
                        { label: "Done",    count: implCompleted,         dotCls: "bg-emerald-500",         numCls: "text-emerald-500" },
                        { label: "In Prog", count: implInProgressCount,   dotCls: "bg-blue-500",            numCls: "text-blue-500" },
                        { label: "Blocked", count: implBlockedCount,      dotCls: "bg-orange-500",          numCls: "text-orange-500" },
                        { label: "N/A",     count: implNaCount,           dotCls: "bg-amber-500",           numCls: "text-amber-500" },
                        { label: "Open",    count: implOpenCount,         dotCls: "bg-muted-foreground/40", numCls: "text-foreground" },
                      ] as const).map(({ label: statusLabel, count, dotCls, numCls }) => (
                        <div key={statusLabel} className="text-center">
                          <div className={`text-sm font-bold ${numCls}`}>{count}</div>
                          <div className="flex items-center justify-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                            <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Next Up */}
                    {nextUpTasks.length > 0 && (
                      <div className="border-t border-border/30 pt-2 mb-3">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
                        <ul className="space-y-1">
                          {nextUpTasks.map(t => (
                            <li key={t.id} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                              <span className="text-xs text-foreground">{t.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
          })()}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DOCUMENTS & NOTES — Adhoc file uploads
            ═══════════════════════════════════════════════════════════════════ */}
        <Card className="card-elevated overflow-hidden">
          <button
            onClick={() => setAdhocOpen(!adhocOpen)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold">Documents & Notes</span>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Meeting transcripts, notes, and other files</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {adhocFilesList.length > 0 ? (
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-semibold">
                  {adhocFilesList.length} file{adhocFilesList.length !== 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Upload</Badge>
              )}
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  adhocOpen && "rotate-180"
                )}
              />
            </div>
          </button>
          {adhocOpen && (
            <div className="border-t border-border/40 p-3 space-y-3">
              {/* Label selector */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label this upload</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Call Notes", "Meeting Notes", "Template", "Action Items", "Reference Doc", "Other"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setNotesLabel(opt)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                        notesLabel === opt
                          ? "bg-primary/15 border-primary/50 text-primary"
                          : "bg-muted/30 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {notesLabel === "Other" && (
                  <input
                    type="text"
                    value={notesCustomLabel}
                    onChange={(e) => setNotesCustomLabel(e.target.value)}
                    placeholder="Enter a custom label…"
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                )}
              </div>

              {/* Drop zone */}
              <label className="block cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.xls,.mp3,.mp4,.wav,.m4a,.vtt,.srt"
                  onChange={handleAdhocFileSelect}
                  disabled={adhocUploading}
                />
                <div className="border-2 border-dashed border-border rounded-lg p-4 flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Click to add files</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDFs, docs, images, audio, transcripts (max 25MB each)</p>
                  </div>
                </div>
              </label>

              {/* Staged files */}
              {adhocFiles.length > 0 && (
                <div className="space-y-1.5">
                  {adhocFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      <button
                        onClick={() => setAdhocFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        disabled={adhocUploading}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleAdhocUpload}
                    disabled={adhocUploading}
                  >
                    {adhocUploading ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload {adhocFiles.length} File{adhocFiles.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                </div>
              )}

              {/* Uploaded files list */}
              {adhocFilesList.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Files</p>
                  <UploadedFilesList
                    files={adhocFilesList.map((f: any) => ({
                      id: f.id,
                      fileName: f.fileName,
                      fileUrl: f.fileUrl,
                      fileSize: f.fileSize,
                      createdAt: f.createdAt,
                      uploadedBy: f.uploadedBy,
                      label: f.label,
                    }))}
                    onRemove={(noteId) => {
                      if (window.confirm("Remove this file?")) {
                        deleteNoteMutation.mutate({ noteId });
                      }
                    }}
                    compact
                  />
                </div>
              ) : adhocFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No files uploaded yet. Add meeting notes, transcripts, or any supporting documents.</p>
              ) : null}
            </div>
          )}
        </Card>

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </div>
  );
}
