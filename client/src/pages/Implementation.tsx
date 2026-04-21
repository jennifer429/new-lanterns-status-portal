/**
 * Task List Page
 * DB-backed per organization. Select rows → set status (Done / N/A / Undo).
 * Bulk action toolbar appears when rows are selected.
 * Status date auto-records when Done or N/A is set.
 */

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Circle,
  ListChecks,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  CheckSquare,
  XSquare,
  CalendarCheck,
  Square,
  Ban,
  BookOpen,
  Clock,
  AlertCircle,
  ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { useOrgParams } from "@/hooks/useOrgParams";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { UserMenu } from "@/components/UserMenu";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useAuth } from "@/_core/hooks/useAuth";
import { buildCSV, downloadCSV, parseCSV, readFileAsText, csvFilename } from "@/lib/csv";
import { Download, Upload } from "lucide-react";
import { SECTION_DEFS, type TaskDef, type SectionDef } from "@shared/taskDefs";
import { SwimlaneView } from "@/components/SwimlaneView";
import { LayoutGrid, List } from "lucide-react";

// ── Inline editable text ───────────────────────────────────────────────────────

function InlineEdit({
  value,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-primary outline-none text-sm w-full ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text text-sm group relative inline-block w-full ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground/50 italic">{placeholder}</span>}
      <span className="absolute right-0 top-0 text-muted-foreground/30 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
    </span>
  );
}

// ── Status badge component ────────────────────────────────────────────────────

function StatusBadge({
  status,
  onClick,
  size = "md",
}: {
  status: "done" | "na" | "open";
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (status === "done") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-semibold transition-all border cursor-pointer",
          "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
          sizeClasses
        )}
        title="Click to change status"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Done
      </button>
    );
  }

  if (status === "na") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-semibold transition-all border cursor-pointer",
          "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
          sizeClasses
        )}
        title="Click to change status"
      >
        <Ban className="w-3.5 h-3.5" />
        N/A
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-semibold transition-all border cursor-pointer",
        "bg-muted/30 text-muted-foreground/60 border-border/40 hover:bg-muted/50 hover:text-foreground",
        sizeClasses
      )}
      title="Click to set status"
    >
      <Circle className="w-3.5 h-3.5" />
      Open
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Implementation() {
  const { clientSlug, slug, orgPath } = useOrgParams("implement");
  const { user } = useAuth();

  const { data: organization } = trpc.organizations.getBySlug.useQuery(
    { slug },
    { enabled: !!slug, refetchOnWindowFocus: false }
  );
  const orgName = organization?.name || "";
  const partnerName = organization?.clientName || "";

  const { data: taskMap = {}, isLoading } = trpc.implementation.getTasks.useQuery(
    { organizationSlug: slug },
    { refetchOnWindowFocus: false }
  );

  const utils = trpc.useUtils();
  const updateTask = trpc.implementation.updateTask.useMutation({
    onSuccess: () => utils.implementation.getTasks.invalidate({ organizationSlug: slug }),
  });

  // CSV import file ref
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [localOverrides, setLocalOverrides] = useState<Record<string, {
    completed?: boolean;
    notApplicable?: boolean;
    inProgress?: boolean;
    blocked?: boolean;
    completedAt?: Date | null;
    owner?: string;
    targetDate?: string;
    notes?: string;
  }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [resetTargetSection, setResetTargetSection] = useState<typeof SECTION_DEFS[number] | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpenSection, setBulkStatusOpenSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "swimlane">("list");

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  function toggleSelectAllInSection(section: typeof SECTION_DEFS[number]) {
    const ids = section.tasks.map(t => t.id);
    const allSelected = ids.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function getMerged(taskId: string) {
    const s = taskMap[taskId];
    const l = localOverrides[taskId] ?? {};
    return {
      completed:      l.completed      !== undefined ? l.completed      : (s?.completed      ?? false),
      notApplicable:  l.notApplicable  !== undefined ? l.notApplicable  : (s?.notApplicable  ?? false),
      inProgress:     l.inProgress     !== undefined ? l.inProgress     : (s?.inProgress     ?? false),
      blocked:        l.blocked        !== undefined ? l.blocked        : (s?.blocked        ?? false),
      completedAt:    l.completedAt    !== undefined ? l.completedAt    : (s?.completedAt    ?? null),
      owner:          l.owner          !== undefined ? l.owner          : (s?.owner          ?? ""),
      targetDate:     l.targetDate     !== undefined ? l.targetDate     : (s?.targetDate     ?? ""),
      notes:          l.notes          !== undefined ? l.notes          : (s?.notes          ?? ""),
    };
  }

  type TaskStatus = "open" | "in_progress" | "complete" | "n_a" | "blocked";

  function getTaskStatus(taskId: string): TaskStatus {
    const m = getMerged(taskId);
    if (m.completed) return "complete";
    if (m.notApplicable) return "n_a";
    if (m.blocked) return "blocked";
    if (m.inProgress) return "in_progress";
    return "open";
  }

  function applyStatus(taskId: string, sectionName: string, status: TaskStatus) {
    const current = getMerged(taskId);
    const patch = {
      completed:    status === "complete",
      notApplicable: status === "n_a",
      inProgress:   status === "in_progress",
      blocked:      status === "blocked",
    };
    const merged = { ...current, ...patch };
    if (status === "complete") {
      merged.completedAt = new Date();
    } else {
      merged.completedAt = null;
    }
    setLocalOverrides(prev => ({ ...prev, [taskId]: merged }));
    updateTask.mutate({
      organizationSlug: slug,
      taskId,
      sectionName,
      completed: merged.completed,
      notApplicable: merged.notApplicable,
      inProgress: merged.inProgress,
      blocked: merged.blocked,
      owner: merged.owner || undefined,
      targetDate: merged.targetDate || undefined,
      notes: merged.notes || undefined,
    });
  }

  function bulkApplyStatus(status: TaskStatus) {
    selectedTaskIds.forEach(taskId => {
      const section = SECTION_DEFS.find(s => s.tasks.some(t => t.id === taskId));
      if (!section) return;
      applyStatus(taskId, section.title, status);
    });
  }

  function save(taskId: string, sectionName: string, patch: { completed?: boolean; notApplicable?: boolean; owner?: string; targetDate?: string; notes?: string }) {
    const current = getMerged(taskId);
    const merged = { ...current, ...patch };
    if (patch.completed !== undefined) {
      merged.completedAt = patch.completed ? new Date() : null;
    }
    // When marking N/A, also uncheck completed
    if (patch.notApplicable) {
      merged.completed = false;
      merged.completedAt = null;
    }
    setLocalOverrides(prev => ({ ...prev, [taskId]: merged }));
    updateTask.mutate({
      organizationSlug: slug,
      taskId,
      sectionName,
      completed: merged.completed,
      notApplicable: merged.notApplicable,
      inProgress: merged.inProgress,
      blocked: merged.blocked,
      owner: merged.owner || undefined,
      targetDate: merged.targetDate || undefined,
      notes: merged.notes || undefined,
    });
  }

  function formatDate(d: Date | null | undefined) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── Bulk actions per section ──────────────────────────────────────────────────

  function bulkCompleteSection(section: SectionDef) {
    section.tasks.forEach(task => {
      const current = getMerged(task.id);
      if (!current.completed && !current.notApplicable) {
        save(task.id, section.title, { completed: true, notApplicable: false });
      }
    });
  }

  function bulkResetSection(section: SectionDef) {
    section.tasks.forEach(task => {
      const current = getMerged(task.id);
      if (current.completed || current.notApplicable) {
        save(task.id, section.title, { completed: false, notApplicable: false });
      }
    });
  }

  function bulkSetDateSection(section: SectionDef, date: string) {
    section.tasks.forEach(task => {
      const current = getMerged(task.id);
      const merged = { ...current, targetDate: date };
      setLocalOverrides(prev => ({ ...prev, [task.id]: merged }));
      updateTask.mutate({
        organizationSlug: slug,
        taskId: task.id,
        sectionName: section.title,
        completed: merged.completed,
        owner: merged.owner || undefined,
        targetDate: date || undefined,
        notes: merged.notes || undefined,
      });
    });
  }

  function bulkSetDateSelected(date: string) {
    selectedTaskIds.forEach(taskId => {
      const section = SECTION_DEFS.find(s => s.tasks.some(t => t.id === taskId));
      if (!section) return;
      const current = getMerged(taskId);
      const merged = { ...current, targetDate: date };
      setLocalOverrides(prev => ({ ...prev, [taskId]: merged }));
      updateTask.mutate({
        organizationSlug: slug,
        taskId,
        sectionName: section.title,
        completed: merged.completed,
        owner: merged.owner || undefined,
        targetDate: date || undefined,
        notes: merged.notes || undefined,
      });
    });
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const headers = ["Phase", "Task ID", "Task Name", "Description", "Status", "Owner", "Target Date", "Status Date", "Notes"];
    const rows: string[][] = [];
    SECTION_DEFS.forEach((section, sIdx) => {
      section.tasks.forEach((task) => {
        const merged = getMerged(task.id);
        rows.push([
          `Phase ${sIdx + 1}: ${section.title}`,
          task.id,
          task.title,
          task.description || "",
          merged.notApplicable ? "N/A" : merged.completed ? "Done" : "Open",
          merged.owner || "",
          merged.targetDate || "",
          merged.completedAt ? new Date(merged.completedAt).toISOString().slice(0, 10) : "",
          merged.notes || "",
        ]);
      });
    });
    const csv = buildCSV(headers, rows);
    downloadCSV(csv, csvFilename(slug, "Task_List"));
  }

  // ── CSV Import ──────────────────────────────────────────────────────────────

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const records = parseCSV(text);
      if (records.length === 0) {
        setImportStatus({ message: "CSV file is empty or invalid.", type: "error" });
        return;
      }

      let matched = 0;
      let skipped = 0;

      for (const record of records) {
        const taskId = record["Task ID"]?.trim();
        const taskName = record["Task Name"]?.trim();

        let foundTask: TaskDef | null = null;
        let foundSection: SectionDef | null = null;

        if (taskId) {
          for (const section of SECTION_DEFS) {
            const t = section.tasks.find(t => t.id === taskId);
            if (t) { foundTask = t; foundSection = section; break; }
          }
        }
        if (!foundTask && taskName) {
          for (const section of SECTION_DEFS) {
            const t = section.tasks.find(t => t.title.toLowerCase() === taskName.toLowerCase());
            if (t) { foundTask = t; foundSection = section; break; }
          }
        }

        if (!foundTask || !foundSection) { skipped++; continue; }

        const current = getMerged(foundTask.id);
        const statusRaw = (record["Status"] || "").trim().toLowerCase();
        const newCompleted = (statusRaw === "complete" || statusRaw === "completed" || statusRaw === "done");
        const newNA = (statusRaw === "n/a" || statusRaw === "na" || statusRaw === "not applicable");
        const newOwner = record["Owner"]?.trim() || current.owner || "";
        const newTargetDate = record["Target Date"]?.trim() || current.targetDate || "";
        const newNotes = record["Notes"]?.trim() || current.notes || "";

        save(foundTask.id, foundSection.title, {
          completed: newCompleted,
          notApplicable: newNA,
          owner: newOwner,
          targetDate: newTargetDate,
          notes: newNotes,
        });
        matched++;
      }

      setImportStatus({ message: `Imported ${matched} task(s). ${skipped > 0 ? `${skipped} row(s) skipped (no match).` : ""}`, type: "success" });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err) {
      setImportStatus({ message: "Failed to parse CSV file.", type: "error" });
      setTimeout(() => setImportStatus(null), 5000);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  const allTaskIds = SECTION_DEFS.flatMap(s => s.tasks.map(t => t.id));
  const naCount = allTaskIds.filter(id => getMerged(id).notApplicable).length;
  const total = allTaskIds.length - naCount;
  const completed = allTaskIds.filter(id => getMerged(id).completed && !getMerged(id).notApplicable).length;
  const inProgressCount = allTaskIds.filter(id => getMerged(id).inProgress && !getMerged(id).notApplicable).length;
  const blockedCount = allTaskIds.filter(id => getMerged(id).blocked && !getMerged(id).notApplicable).length;
  const weightedScore = completed + inProgressCount * 0.5 + blockedCount * 0.25;
  const pct = total > 0 ? Math.round((weightedScore / total) * 100) : 0;
  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:flex flex-col border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Task List</div>
              {orgName && <div className="text-xs text-muted-foreground truncate">{orgName}{partnerName ? ` · ${partnerName}` : ""}</div>}
            </div>
            {orgName && <div className="sm:hidden text-sm font-semibold truncate max-w-[100px]">{orgName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)}</div>}
          </div>

          {/* Right: actions + nav + user */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border border-border/40 rounded-md hover:bg-muted/60 hover:border-primary/30 transition-all"
              title="Export task list as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border border-border/40 rounded-md hover:bg-muted/60 hover:border-primary/30 transition-all"
              title="Import task data from CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            {/* View toggle */}
            <div className="flex items-center bg-muted/30 border border-border/40 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all",
                  viewMode === "list"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <div className="w-px h-4 bg-border/40" />
              <button
                onClick={() => setViewMode("swimlane")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all",
                  viewMode === "swimlane"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Swimlane view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Swimlane</span>
              </button>
            </div>
            <div className="w-px h-5 bg-border/40 mx-1" />
            <Link href={orgPath} className="text-sm text-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
              Site Dashboard
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
                Admin
              </Link>
            )}
            <UserMenu />
          </div>
        </div>
      </header>
      <PageBreadcrumb orgPath={orgPath} items={[{ label: "Task List" }]} />

      {/* Import status banner */}
      {importStatus && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className={cn(
            "px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 border",
            importStatus.type === "success"
              ? "bg-green-500/10 text-green-400 border-green-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          )}>
            {importStatus.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {importStatus.message}
            <button onClick={() => setImportStatus(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-foreground text-sm">
            Loading task list…
          </div>
        ) : (
          viewMode === "swimlane" ? (
            <SwimlaneView
              organizationSlug={slug}
              taskMap={Object.fromEntries(
                SECTION_DEFS.flatMap(s => s.tasks).map(t => {
                  const m = getMerged(t.id);
                  return [t.id, {
                    completed: m.completed,
                    notApplicable: m.notApplicable,
                    inProgress: m.inProgress,
                    blocked: m.blocked,
                    completedAt: m.completedAt,
                    owner: m.owner || null,
                    targetDate: m.targetDate || null,
                    notes: m.notes || null,
                  }];
                })
              )}
            />
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
            {/* Left column — sections */}
            <div className="space-y-6">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">{completed} of {total} tasks complete</span>
                    {naCount > 0 && (
                      <span className="text-xs text-amber-400">({naCount} N/A)</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {/* Sections */}
              {SECTION_DEFS.map((section, sIdx) => {
                const sectionNa = section.tasks.filter(t => getMerged(t.id).notApplicable).length;
                const sectionCompleted = section.tasks.filter(t => getMerged(t.id).completed && !getMerged(t.id).notApplicable).length;
                const sectionInProgress = section.tasks.filter(t => getMerged(t.id).inProgress && !getMerged(t.id).notApplicable).length;
                const sectionBlocked = section.tasks.filter(t => getMerged(t.id).blocked && !getMerged(t.id).notApplicable).length;
                const sectionTotal = section.tasks.length - sectionNa;
                const allDone = sectionTotal > 0 && sectionCompleted === sectionTotal;
                const isCollapsed = !!collapsedSections[section.id];
                const sectionTaskIds = section.tasks.map(t => t.id);
                const allSectionSelected = sectionTaskIds.length > 0 && sectionTaskIds.every(id => selectedTaskIds.has(id));
                const selectedInSection = sectionTaskIds.filter(id => selectedTaskIds.has(id));

                return (
                  <Card key={section.id} className="card-elevated overflow-hidden">
                    {/* Collapsible header */}
                    <button
                      onClick={() => setCollapsedSections(prev => ({ ...prev, [section.id]: !isCollapsed }))}
                      className="w-full px-5 py-4 bg-muted/30 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed
                          ? <ChevronRight className="w-5 h-5 text-foreground" />
                          : <ChevronDown className="w-5 h-5 text-foreground" />
                        }
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            Phase {sIdx + 1} · {section.duration}
                          </p>
                          <h3 className="text-sm font-bold text-foreground mt-0.5">{section.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sectionBlocked > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-red-500/30 text-red-500">
                            {sectionBlocked} Blocked
                          </Badge>
                        )}
                        {sectionInProgress > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-blue-400/30 text-blue-400">
                            {sectionInProgress} In Progress
                          </Badge>
                        )}
                        {sectionNa > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-purple-400/30 text-purple-400">
                            {sectionNa} N/A
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold",
                            allDone
                              ? "border-emerald-500/40 text-emerald-400"
                              : sectionCompleted > 0
                                ? "border-primary/40 text-primary"
                                : "border-border text-foreground"
                          )}
                        >
                          {sectionCompleted}/{sectionTotal} Complete
                        </Badge>
                      </div>
                    </button>

                    {/* Bulk action toolbar — visible when expanded */}
                    {!isCollapsed && (() => {
                      const sectionTaskIds = section.tasks.map(t => t.id);
                      const selectedInSection = sectionTaskIds.filter(id => selectedTaskIds.has(id));
                      const allSectionSelected = sectionTaskIds.length > 0 && sectionTaskIds.every(id => selectedTaskIds.has(id));
                      const bulkStatusOpen = bulkStatusOpenSection === section.title;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border/20 bg-muted/10">
                          {/* Left: select-all + selected count + set status */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Select all checkbox */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSelectAllInSection(section); }}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            >
                              {allSectionSelected
                                ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                : <Square className="w-3.5 h-3.5" />
                              }
                              <span>Select all</span>
                            </button>

                            {/* Selected count chip */}
                            {selectedInSection.length > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                                {selectedInSection.length} selected
                              </span>
                            )}

                            {/* Set status dropdown — only when rows selected */}
                            {selectedInSection.length > 0 && (
                              <DropdownMenu open={bulkStatusOpen} onOpenChange={(open) => setBulkStatusOpenSection(open ? section.title : null)}>
                                <DropdownMenuTrigger asChild>
                                  <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-border/60 bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                                    Set status
                                    {bulkStatusOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-44">
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("complete"); setBulkStatusOpenSection(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                    Mark complete
                                  </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => { bulkApplyStatus("in_progress"); setBulkStatusOpenSection(null); }} className="gap-2 cursor-pointer">
                                     <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                     In progress
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("n_a"); setBulkStatusOpenSection(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                                    Mark N/A
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("blocked"); setBulkStatusOpenSection(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    Blocked
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("open"); setBulkStatusOpenSection(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                    Open
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {/* Reset all (no selection needed) */}
                            {(sectionCompleted > 0 || sectionNa > 0) && selectedInSection.length === 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setResetTargetSection(section); }}
                                className="inline-flex items-center gap-1.5 text-xs text-destructive/60 hover:text-destructive cursor-pointer transition-colors"
                              >
                                <XSquare className="w-3.5 h-3.5" />
                                Reset all
                              </button>
                            )}
                          </div>

                          {/* Right: date picker */}
                          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {selectedInSection.length > 0 ? (
                              <>
                                <span className="text-primary font-medium">Date:</span>
                                <input
                                  type="date"
                                  defaultValue={todayStr()}
                                  onChange={(e) => { if (e.target.value) bulkSetDateSelected(e.target.value); }}
                                  className="bg-transparent border-b border-primary/60 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                                />
                              </>
                            ) : (
                              <>
                                <span>Date:</span>
                                <input
                                  type="date"
                                  defaultValue={todayStr()}
                                  onChange={(e) => { if (e.target.value) bulkSetDateSection(section, e.target.value); }}
                                  className="bg-transparent border-b border-border/40 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Collapsible content */}
                    <div className={`collapsible-body ${!isCollapsed ? "open" : ""}`}><div>
                      <CardContent className="p-0">
                        {/* Column headers */}
                        <div className="hidden md:grid grid-cols-[24px_100px_1fr_120px_110px_110px_auto] gap-3 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                          <div />
                          <div>Status</div>
                          <div>Task</div>
                          <div>Owner</div>
                          <div>Target Date</div>
                          <div>Status Date</div>
                          <div className="w-6" />
                        </div>

                        {section.tasks.map((task, tIdx) => {
                          const { completed: done, notApplicable: isNA, completedAt, owner, targetDate, notes } = getMerged(task.id);
                          const taskStatus = getTaskStatus(task.id);
                          const notesOpen = !!expandedNotes[task.id];
                          const intakeHref = task.intakeLink ? `${orgPath}${task.intakeLink}` : null;
                          const specHref = task.specLink ? `${orgPath}${task.specLink}` : null;
                          const isSelected = selectedTaskIds.has(task.id);

                          const STATUS_CONFIG = {
                            open:        { label: "Open",        dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
                            in_progress: { label: "In progress", dot: "bg-blue-400",            text: "text-blue-400" },
                            complete:    { label: "Complete",    dot: "bg-green-500",             text: "text-green-500" },
                            n_a:         { label: "N/A",         dot: "bg-purple-400",            text: "text-purple-400" },
                            blocked:     { label: "Blocked",     dot: "bg-red-500",               text: "text-red-500" },
                          } as const;

                          const sc = STATUS_CONFIG[taskStatus];

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                tIdx < section.tasks.length - 1 ? "border-b border-border/20" : "",
                                isSelected && "bg-primary/5",
                                isNA && "opacity-60"
                              )}
                            >
                              {/* Main row */}
                              <div className="grid grid-cols-1 md:grid-cols-[24px_100px_1fr_120px_110px_110px_auto] gap-3 items-start px-5 py-3">
                                {/* Row selection checkbox */}
                                <div className="hidden md:flex items-center justify-center pt-1">
                                  <button
                                    onClick={() => toggleTaskSelection(task.id)}
                                    className="focus:outline-none text-muted-foreground/40 hover:text-primary/70 transition-colors"
                                    title="Select row"
                                  >
                                    {isSelected
                                      ? <CheckSquare className="w-4 h-4 text-primary" />
                                      : <Square className="w-4 h-4" />
                                    }
                                  </button>
                                </div>

                                {/* Status dropdown */}
                                <div className="flex items-start pt-0.5">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/40 bg-background/60 text-xs font-medium hover:bg-muted/50 transition-colors",
                                        sc.text
                                      )}>
                                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sc.dot)} />
                                        {sc.label}
                                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40">
                                      <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "complete")} className="gap-2 cursor-pointer">
                                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                        Mark complete
                                      </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "in_progress")} className="gap-2 cursor-pointer">
                                         <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                         In progress
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "n_a")} className="gap-2 cursor-pointer">
                                        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                                        Mark N/A
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "blocked")} className="gap-2 cursor-pointer">
                                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                        Blocked
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "open")} className="gap-2 cursor-pointer">
                                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                        Open
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {/* Task name + description + links */}
                                <div className="space-y-0.5">
                                  <p className={cn("text-sm font-medium text-foreground", isNA && "line-through")}>{task.title}</p>
                                  {task.description && (
                                    <p className={cn("text-xs text-muted-foreground", isNA && "line-through")}>{task.description}</p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {intakeHref && (
                                      <a
                                        href={intakeHref}
                                        className="inline-flex items-center gap-1 text-xs text-primary/60 hover:text-primary transition-colors"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {task.intakeLinkLabel}
                                      </a>
                                    )}
                                    {specHref && (
                                      <a
                                        href={specHref}
                                        className="inline-flex items-center gap-1 text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
                                      >
                                        <BookOpen className="w-3 h-3" />
                                        {task.specLinkLabel}
                                      </a>
                                    )}
                                  </div>
                                  {/* Mobile: inline controls */}
                                  <div className="md:hidden flex flex-wrap items-center gap-3 mt-2">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-border/40 bg-background/60 text-xs font-medium hover:bg-muted/50 transition-colors", sc.text)}>
                                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sc.dot)} />
                                          {sc.label}
                                          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-40">
                                        <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "complete")} className="gap-2 cursor-pointer"><span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />Mark complete</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "in_progress")} className="gap-2 cursor-pointer"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />In progress</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "n_a")} className="gap-2 cursor-pointer"><span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />Mark N/A</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "blocked")} className="gap-2 cursor-pointer"><span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />Blocked</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => applyStatus(task.id, section.title, "open")} className="gap-2 cursor-pointer"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />Open</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <InlineEdit value={owner} placeholder="Owner…" onCommit={v => save(task.id, section.title, { owner: v })} />
                                    <input
                                      type="date"
                                      value={targetDate}
                                      onChange={(e) => save(task.id, section.title, { targetDate: e.target.value })}
                                      className="bg-transparent border border-border/40 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                    {completedAt && (
                                      <span className="text-xs text-muted-foreground">{formatDate(completedAt)}</span>
                                    )}
                                  </div>
                                </div>


                                {/* Owner — desktop */}
                                <div className="hidden md:block">
                                  <InlineEdit
                                    value={owner}
                                    placeholder="Owner…"
                                    onCommit={v => save(task.id, section.title, { owner: v })}
                                  />
                                </div>

                                {/* Target Date — desktop */}
                                <div className="hidden md:block">
                                  <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => save(task.id, section.title, { targetDate: e.target.value })}
                                    className="bg-transparent border border-border/40 rounded px-1.5 py-1 text-xs text-foreground w-full focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert"
                                  />
                                </div>

                                {/* Status date — desktop */}
                                <div className="hidden md:flex items-center text-xs text-foreground">
                                  {completedAt
                                    ? formatDate(completedAt)
                                    : <span className="text-muted-foreground/30">—</span>
                                  }
                                </div>

                                {/* Comment toggle */}
                                <button
                                  onClick={() => setExpandedNotes(prev => ({ ...prev, [task.id]: !notesOpen }))}
                                  className={cn(
                                    "hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-muted/50 transition-colors relative",
                                    notesOpen || notes ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                                  )}
                                  title={notesOpen ? "Hide comment" : "Add comment"}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {notes && !notesOpen && (
                                    <span className="absolute w-1.5 h-1.5 bg-primary rounded-full top-0.5 right-0.5" />
                                  )}
                                </button>
                              </div>

                              {/* Expandable notes */}
                              {notesOpen && (
                                <div className="px-5 pb-3 pt-0 bg-muted/10 border-t border-border/10">
                                  <textarea
                                    className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/40 resize-none outline-none border-none focus:ring-0 py-2 min-h-[52px]"
                                    placeholder="Add a comment or note…"
                                    value={notes}
                                    onChange={e => setLocalOverrides(prev => ({ ...prev, [task.id]: { ...getMerged(task.id), notes: e.target.value } }))}
                                    onBlur={e => save(task.id, section.title, { notes: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </div></div>
                  </Card>
                );
              })}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              <Card className="card-elevated sticky top-20">
                <CardContent className="p-5 space-y-6">
                  <h3 className="font-bold text-base text-foreground">Task Summary</h3>

                  {/* Donut chart */}
                  <div className="flex justify-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(var(--primary))" strokeWidth="3"
                          strokeDasharray={`${pct} ${100 - pct}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{pct}%</span>
                        <span className="text-sm text-muted-foreground">Complete</span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-foreground">Done</span>
                      </div>
                      <span className="font-medium text-foreground">{completed}</span>
                    </div>
                    {inProgressCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-400" />
                          <span className="text-foreground">In Progress</span>
                        </div>
                        <span className="font-medium text-blue-400">{inProgressCount}</span>
                      </div>
                    )}
                    {blockedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-foreground">Blocked</span>
                        </div>
                        <span className="font-medium text-red-500">{blockedCount}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        <span className="text-foreground">Open</span>
                      </div>
                      <span className="font-medium text-foreground">{total - completed - inProgressCount - blockedCount}</span>
                    </div>
                    {naCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500/40" />
                          <span className="text-foreground">Not Applicable</span>
                        </div>
                        <span className="font-medium text-amber-400">{naCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Next Up */}
                  {(() => {
                    const remaining = SECTION_DEFS.flatMap(s =>
                      s.tasks.filter(t => !getMerged(t.id).completed && !getMerged(t.id).notApplicable)
                    ).slice(0, 3);

                    if (remaining.length === 0) return (
                      <div className="border-t border-border/40 pt-4">
                        <p className="text-sm text-green-400 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> All tasks complete!
                        </p>
                      </div>
                    );

                    return (
                      <div className="border-t border-border/40 pt-4 space-y-3">
                        <h4 className="font-bold text-sm text-foreground">Next Up</h4>
                        <ul className="text-sm text-foreground space-y-1.5">
                          {remaining.map((t, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
          )
        )}
      </div>

      {/* Reset All confirmation dialog */}
      <AlertDialog open={!!resetTargetSection} onOpenChange={(open) => { if (!open) setResetTargetSection(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all tasks in "{resetTargetSection?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark all {resetTargetSection?.tasks.length} tasks as open and clear their status dates.
              Target dates and notes will be preserved. This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (resetTargetSection) { bulkResetSection(resetTargetSection); setResetTargetSection(null); } }}
            >
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
