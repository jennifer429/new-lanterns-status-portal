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
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// ── Static task definitions ────────────────────────────────────────────────────

interface TaskDef {
  id: string;
  title: string;
  description?: string;
  intakeLink?: string;
  intakeLinkLabel?: string;
}

interface SectionDef {
  id: string;
  title: string;
  duration: string;
  tasks: TaskDef[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    id: "network",
    title: "Network & Connectivity",
    duration: "5–10 days",
    tasks: [
      { id: "network:vpn",      title: "VPN Tunnel Configuration",            description: "Site-to-site VPN established and verified",                       intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)" },
      { id: "network:firewall", title: "Firewall Rules & Port Openings",       description: "All required ports open in both directions",                      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-t",  title: "DICOM Endpoint Testing (Test Env)",   description: "C-ECHO success from all AE titles in test environment",           intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-p",  title: "DICOM Endpoint Testing (Production)", description: "C-ECHO success from all AE titles in production environment",      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:hl7-port", title: "HL7 Port Configuration",              description: "HL7 listener ports configured and ACK responses confirmed",        intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
    ],
  },
  {
    id: "hl7",
    title: "HL7 Interface Build",
    duration: "7–14 days",
    tasks: [
      { id: "hl7:orm",       title: "ORM Interface Configuration",   description: "Order messages flowing from EHR to New Lantern",          intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru",       title: "ORU Interface Configuration",   description: "Result/report messages returning from New Lantern to EHR", intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:adt",       title: "ADT Interface Configuration",   description: "Patient demographics updates flowing correctly",           intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru-spec",  title: "ORU Specification Review",      description: "ORU spec reviewed and field mappings confirmed",           intakeLink: "/intake?section=config-files",          intakeLinkLabel: "Sample ORU / Specs (CF.3, CF.4)" },
      { id: "hl7:orm-spec",  title: "ORM Specification Review",      description: "ORM spec reviewed and order fields mapped",               intakeLink: "/intake?section=config-files",          intakeLinkLabel: "Sample ORM / Specs (CF.4, CF.5)" },
      { id: "hl7:validate",  title: "HL7 Message Validation",        description: "All message types validated end-to-end",                  intakeLink: "/validation",                           intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "config",
    title: "System Configuration",
    duration: "3–7 days",
    tasks: [
      { id: "config:proc",     title: "Procedure Code Mapping",      description: "All procedure codes loaded and mapped to modalities",      intakeLink: "/intake?section=config-files", intakeLinkLabel: "Procedure Code List (CF.1)" },
      { id: "config:users",    title: "User Account Provisioning",   description: "All user accounts created with correct roles",             intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "config:provider", title: "Provider Directory Upload",   description: "Referring and reading physician directory loaded",         intakeLink: "/intake?section=config-files", intakeLinkLabel: "Provider Directory (CF.6)" },
      { id: "config:worklist", title: "Worklist Configuration",      description: "Worklist filters, sorting, and display configured",        intakeLink: "/intake?section=hl7-dicom",    intakeLinkLabel: "HL7 & DICOM Settings" },
    ],
  },
  {
    id: "templates",
    title: "Worklist & Templates",
    duration: "3–5 days",
    tasks: [
      { id: "tmpl:worklist", title: "Worklist Filter Setup",          description: "Filters by modality, body part, priority, and location" },
      { id: "tmpl:reports",  title: "Report Template Configuration",  description: "Report templates loaded and formatted correctly",  intakeLink: "/intake?section=config-files", intakeLinkLabel: "Sample ORU (CF.3)" },
      { id: "tmpl:macros",   title: "Macro & Auto-text Setup",        description: "Radiologist macros and auto-text configured" },
    ],
  },
  {
    id: "training",
    title: "Training & Go-Live Preparation",
    duration: "3–5 days",
    tasks: [
      { id: "train:admin",         title: "Admin Training",          description: "System administration, user management, configuration changes" },
      { id: "train:tech",          title: "Tech Training",           description: "Modality workflow, image QC, worklist operations" },
      { id: "train:users",         title: "User Setup",              description: "All accounts provisioned, roles assigned, logins verified",    intakeLink: "/intake?section=config-files", intakeLinkLabel: "User List (CF.2)" },
      { id: "train:downtime",      title: "Downtime Workflow",       description: "Team trained on paper backup, rerouting, and recovery",        intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "train:troubleshoot",  title: "Troubleshooting Workflows", description: "Escalation paths, common issues, support contacts documented", intakeLink: "/intake?section=org-info",    intakeLinkLabel: "Issue Escalation (L.10)" },
    ],
  },
  {
    id: "testing",
    title: "End-to-End Testing",
    duration: "5–7 days",
    tasks: [
      { id: "test:e2e",     title: "Full Order-to-Report Workflow Test",       description: "Complete cycle validated end-to-end",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:edge",    title: "Edge Case Testing (STAT, Addendum, etc.)", description: "STAT priority, addendum, cancel, reschedule flows", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:perf",    title: "Performance & Load Testing",               description: "Performance confirmed at expected study volume",     intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:signoff", title: "Go-Live Readiness Sign-Off",               description: "All parties signed off on readiness",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "prod-validation",
    title: "Production Data Validation (2 Weeks)",
    duration: "14 days minimum",
    tasks: [
      { id: "prod:start",        title: "Begin Live Production Data Flow",    description: "Production data flowing into New Lantern" },
      { id: "prod:data-quality", title: "Data Quality Review",                description: "Study and report completeness and accuracy verified" },
      { id: "prod:timeliness",   title: "Timeliness Audit",                   description: "Studies and reports flowing within agreed SLAs" },
      { id: "prod:normal-wf",    title: "Normal Workflow Sign-Off",           description: "Standard order → image → report cycle validated" },
      { id: "prod:stat",         title: "STAT & Priority Routing",            description: "STAT and priority routing verified end-to-end" },
      { id: "prod:addendum",     title: "Addendum & Correction Workflow",     description: "Addendum and correction workflow validated" },
      { id: "prod:cancel",       title: "Order Cancellation",                 description: "Cancellation and worklist removal confirmed" },
      { id: "prod:downtime",     title: "Downtime / Reconnect",               description: "Queued studies process correctly after reconnect", intakeLink: "/intake?section=org-info", intakeLinkLabel: "Downtime Plans (L.11)" },
      { id: "prod:volume",       title: "Volume & Load Confirmation",         description: "Performance confirmed at full production volume" },
      { id: "prod:adjustments",  title: "Issue Documentation & Remediation",  description: "All issues found during validation documented and resolved" },
      { id: "prod:golive",       title: "2-Week Validation Complete",         description: "Approved for full go-live" },
    ],
  },
];

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

  const [localOverrides, setLocalOverrides] = useState<Record<string, {
    completed?: boolean;
    completedAt?: Date | null;
    owner?: string;
    targetDate?: string;
    notes?: string;
  }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
          <Link href={`/org/${slug}`} className="text-sm text-foreground hover:text-primary transition-colors font-medium">
            Back to Dashboard
          </Link>
        </div>
      </header>

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
                    {!isCollapsed && (
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
                          Complete All
                        </button>
                        <span className="text-border">|</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); bulkResetSection(section); }}
                          disabled={sectionCompleted === 0}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs transition-colors",
                            sectionCompleted === 0
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground cursor-pointer"
                          )}
                        >
                          <XSquare className="w-3.5 h-3.5" />
                          Reset All
                        </button>
                        <span className="text-border">|</span>
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>Set dates:</span>
                          <input
                            type="date"
                            defaultValue={todayStr()}
                            onChange={(e) => { if (e.target.value) bulkSetDateSection(section, e.target.value); }}
                            className="bg-transparent border-b border-border/40 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Collapsible content */}
                    {!isCollapsed && (
                      <CardContent className="p-0">
                        {/* Column headers */}
                        <div className="hidden md:grid grid-cols-[40px_1fr_120px_110px_110px_auto] gap-3 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
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

                          return (
                            <div key={task.id} className={tIdx < section.tasks.length - 1 ? "border-b border-border/20" : ""}>
                              {/* Main row */}
                              <div className="grid grid-cols-1 md:grid-cols-[40px_1fr_120px_110px_110px_auto] gap-3 items-start px-5 py-3">
                                {/* Checkbox */}
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
                    )}
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
    </div>
  );
}
