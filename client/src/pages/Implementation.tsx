/**
 * Task List Page
 * DB-backed per organization. Matches the Validation Checklist page style:
 * two-column layout, collapsible sections, sidebar summary.
 * Columns: Done | Task | Owner | Target Date | Completed | Comment
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
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { UserMenu } from "@/components/UserMenu";
import { buildCSV, downloadCSV, parseCSV, readFileAsText, csvFilename } from "@/lib/csv";
import { Download, Upload } from "lucide-react";
import { SECTION_DEFS, type TaskDef, type SectionDef } from "@shared/taskDefs";

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

// ── Main component ─────────────────────────────────────────────────────────────

export default function Implementation() {
  const [, params] = useRoute("/org/:slug/implement");
  const slug = params?.slug || "demo";

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
    completedAt?: Date | null;
    owner?: string;
    targetDate?: string;
    notes?: string;
  }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [resetTargetSection, setResetTargetSection] = useState<typeof SECTION_DEFS[number] | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

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
        targetDate: date,
        notes: merged.notes || undefined,
      });
    });
  }

  function getMerged(taskId: string) {
    const s = taskMap[taskId];
    const l = localOverrides[taskId] ?? {};
    return {
      completed:   l.completed   !== undefined ? l.completed   : (s?.completed   ?? false),
      completedAt: l.completedAt !== undefined ? l.completedAt : (s?.completedAt ?? null),
      owner:       l.owner       !== undefined ? l.owner       : (s?.owner       ?? ""),
      targetDate:  l.targetDate  !== undefined ? l.targetDate  : (s?.targetDate  ?? ""),
      notes:       l.notes       !== undefined ? l.notes       : (s?.notes       ?? ""),
    };
  }

  function save(taskId: string, sectionName: string, patch: { completed?: boolean; owner?: string; targetDate?: string; notes?: string }) {
    const current = getMerged(taskId);
    const merged = { ...current, ...patch };
    if (patch.completed !== undefined) {
      merged.completedAt = patch.completed ? new Date() : null;
    }
    setLocalOverrides(prev => ({ ...prev, [taskId]: merged }));
    updateTask.mutate({
      organizationSlug: slug,
      taskId,
      sectionName,
      completed: merged.completed,
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
    const today = todayStr();
    section.tasks.forEach(task => {
      const current = getMerged(task.id);
      if (!current.completed) {
        const merged = { ...current, completed: true, completedAt: new Date(), targetDate: current.targetDate || today };
        setLocalOverrides(prev => ({ ...prev, [task.id]: merged }));
        updateTask.mutate({
          organizationSlug: slug,
          taskId: task.id,
          sectionName: section.title,
          completed: true,
          owner: merged.owner || undefined,
          targetDate: merged.targetDate || undefined,
          notes: merged.notes || undefined,
        });
      }
    });
  }

  function bulkResetSection(section: SectionDef) {
    section.tasks.forEach(task => {
      const current = getMerged(task.id);
      if (current.completed) {
        const merged = { ...current, completed: false, completedAt: null };
        setLocalOverrides(prev => ({ ...prev, [task.id]: merged }));
        updateTask.mutate({
          organizationSlug: slug,
          taskId: task.id,
          sectionName: section.title,
          completed: false,
          owner: merged.owner || undefined,
          targetDate: merged.targetDate || undefined,
          notes: merged.notes || undefined,
        });
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

  // ── CSV Export ──────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const headers = ["Phase", "Task ID", "Task Name", "Description", "Status", "Owner", "Target Date", "Completed Date", "Notes"];
    const rows: string[][] = [];
    SECTION_DEFS.forEach((section, sIdx) => {
      section.tasks.forEach((task) => {
        const merged = getMerged(task.id);
        rows.push([
          `Phase ${sIdx + 1}: ${section.title}`,
          task.id,
          task.title,
          task.description || "",
          merged.completed ? "Complete" : "Not Started",
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
        // Match by Task ID first, then by Task Name
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
        const newOwner = record["Owner"]?.trim() || current.owner || "";
        const newTargetDate = record["Target Date"]?.trim() || current.targetDate || "";
        const newNotes = record["Notes"]?.trim() || current.notes || "";

        const merged = {
          ...current,
          completed: newCompleted,
          completedAt: newCompleted ? (current.completedAt || new Date()) : null,
          owner: newOwner,
          targetDate: newTargetDate,
          notes: newNotes,
        };

        setLocalOverrides(prev => ({ ...prev, [foundTask!.id]: merged }));
        updateTask.mutate({
          organizationSlug: slug,
          taskId: foundTask.id,
          sectionName: foundSection.title,
          completed: newCompleted,
          owner: newOwner || undefined,
          targetDate: newTargetDate || undefined,
          notes: newNotes || undefined,
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
  const total = allTaskIds.length;
  const completed = allTaskIds.filter(id => getMerged(id).completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Task List</h1>
              <p className="text-sm text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border border-border/40 rounded-md hover:bg-muted/60 hover:border-primary/30 transition-all"
              title="Export task list as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border border-border/40 rounded-md hover:bg-muted/60 hover:border-primary/30 transition-all"
              title="Import task data from CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Link href={`/org/${slug}`} className="text-sm text-foreground hover:text-primary transition-colors font-medium">
              Back to Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
            {/* Left column — sections */}
            <div className="space-y-6">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">{completed} of {total} tasks complete</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {/* Sections */}
              {SECTION_DEFS.map((section, sIdx) => {
                const sectionCompleted = section.tasks.filter(t => getMerged(t.id).completed).length;
                const sectionTotal = section.tasks.length;
                const allDone = sectionCompleted === sectionTotal;
                const isCollapsed = !!collapsedSections[section.id];

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
                    </button>

                    {/* Bulk action toolbar — visible when expanded */}
                    {!isCollapsed && (() => {
                      const sectionTaskIds = section.tasks.map(t => t.id);
                      const selectedInSection = sectionTaskIds.filter(id => selectedTaskIds.has(id));
                      const allSectionSelected = sectionTaskIds.length > 0 && sectionTaskIds.every(id => selectedTaskIds.has(id));
                      return (
                        <div className="flex flex-wrap items-center gap-3 px-5 py-2.5 border-b border-border/20 bg-muted/10">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Actions</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); bulkCompleteSection(section); }}
                            disabled={allDone}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs transition-colors",
                              allDone
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-primary hover:text-primary/80 cursor-pointer"
                            )}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Mark All Done
                          </button>
                          <span className="text-border">|</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setResetTargetSection(section); }}
                            disabled={sectionCompleted === 0}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs transition-colors",
                              sectionCompleted === 0
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-destructive/70 hover:text-destructive cursor-pointer"
                            )}
                          >
                            <XSquare className="w-3.5 h-3.5" />
                            Reset All
                          </button>
                          <span className="text-border">|</span>
                          {/* Select-all toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelectAllInSection(section); }}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Square className="w-3.5 h-3.5" />
                            {allSectionSelected ? "Deselect All" : "Select All"}
                          </button>
                          <span className="text-border">|</span>
                          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {selectedInSection.length > 0 ? (
                              <>
                                <span className="text-primary font-medium">Backdate {selectedInSection.length} selected:</span>
                                <input
                                  type="date"
                                  defaultValue={todayStr()}
                                  onChange={(e) => { if (e.target.value) bulkSetDateSelected(e.target.value); }}
                                  className="bg-transparent border-b border-primary/60 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                                />
                              </>
                            ) : (
                              <>
                                <span>Set all dates:</span>
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
                        <div className="hidden md:grid grid-cols-[24px_40px_1fr_120px_110px_110px_auto] gap-3 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                          <div />
                          <div className="text-center">Done</div>
                          <div>Task</div>
                          <div>Owner</div>
                          <div>Target Date</div>
                          <div>Completed</div>
                          <div className="w-6" />
                        </div>

                        {section.tasks.map((task, tIdx) => {
                          const { completed: done, completedAt, owner, targetDate, notes } = getMerged(task.id);
                          const notesOpen = !!expandedNotes[task.id];
                          const intakeHref = task.intakeLink ? `/org/${slug}${task.intakeLink}` : null;
                          const isSelected = selectedTaskIds.has(task.id);

                          return (
                            <div key={task.id} className={cn(tIdx < section.tasks.length - 1 ? "border-b border-border/20" : "", isSelected && "bg-primary/5")}>
                              {/* Main row */}
                              <div className="grid grid-cols-1 md:grid-cols-[24px_40px_1fr_120px_110px_110px_auto] gap-3 items-start px-5 py-3">
                                {/* Row selection checkbox */}
                                <div className="hidden md:flex items-center justify-center pt-1">
                                  <button
                                    onClick={() => toggleTaskSelection(task.id)}
                                    className="focus:outline-none text-muted-foreground/40 hover:text-primary/70 transition-colors"
                                    title="Select row"
                                  >
                                    {isSelected
                                      ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                      : <Square className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                </div>
                                {/* Done Checkbox */}
                                <div className="flex justify-center pt-0.5">
                                  <button
                                    onClick={() => save(task.id, section.title, { completed: !done })}
                                    className="focus:outline-none"
                                    title={done ? "Mark incomplete" : "Mark complete"}
                                  >
                                    {done
                                      ? <CheckCircle2 className="w-6 h-6 text-green-500 hover:text-green-400 transition-colors" />
                                      : <Circle className="w-6 h-6 text-muted-foreground/40 hover:text-primary/60 transition-colors cursor-pointer" />
                                    }
                                  </button>
                                </div>

                                {/* Task name + description + intake link */}
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground">{task.description}</p>
                                  )}
                                  {intakeHref && (
                                    <a
                                      href={intakeHref}
                                      className="inline-flex items-center gap-1 text-xs text-primary/60 hover:text-primary transition-colors mt-0.5"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {task.intakeLinkLabel}
                                    </a>
                                  )}
                                  {/* Mobile: owner + dates + comment toggle */}
                                  <div className="md:hidden flex flex-wrap items-center gap-3 mt-2">
                                    <InlineEdit
                                      value={owner}
                                      placeholder="Owner…"
                                      onCommit={v => save(task.id, section.title, { owner: v })}
                                    />
                                    <input
                                      type="date"
                                      value={targetDate}
                                      onChange={(e) => save(task.id, section.title, { targetDate: e.target.value })}
                                      className="bg-transparent border border-border/40 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                    {done && completedAt && (
                                      <span className="text-xs text-muted-foreground">{formatDate(completedAt)}</span>
                                    )}
                                    <button
                                      onClick={() => setExpandedNotes(prev => ({ ...prev, [task.id]: !notesOpen }))}
                                      className={cn(
                                        "flex items-center justify-center w-6 h-6 rounded hover:bg-muted/50 transition-colors relative",
                                        notesOpen || notes ? "text-primary" : "text-muted-foreground/40"
                                      )}
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {notes && !notesOpen && (
                                        <span className="absolute w-1.5 h-1.5 bg-primary rounded-full top-0.5 right-0.5" />
                                      )}
                                    </button>
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

                                {/* Completed date — desktop */}
                                <div className="hidden md:flex items-center text-xs text-foreground">
                                  {done && completedAt
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
                          strokeDasharray={`${(completed / total) * 100} ${100 - (completed / total) * 100}`}
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
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-foreground">Complete</span>
                      </div>
                      <span className="font-medium text-foreground">{completed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        <span className="text-foreground">Remaining</span>
                      </div>
                      <span className="font-medium text-foreground">{total - completed}</span>
                    </div>
                  </div>

                  {/* Next Up */}
                  {(() => {
                    const remaining = SECTION_DEFS.flatMap(s =>
                      s.tasks.filter(t => !getMerged(t.id).completed)
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
        )}
      </div>

      {/* Reset All confirmation dialog */}
      <AlertDialog open={!!resetTargetSection} onOpenChange={(open) => { if (!open) setResetTargetSection(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all tasks in "{resetTargetSection?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark all {resetTargetSection?.tasks.length} tasks as incomplete and clear their completion dates.
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
