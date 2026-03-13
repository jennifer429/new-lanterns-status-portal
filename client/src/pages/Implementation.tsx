/**
 * Implementation Checklist Page
 * DB-backed per organization. Checkboxes auto-populate completion date.
 * Owner is a free-form text field. Each task has a comment and links to
 * the relevant intake question / validation page.
 */

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, Wrench, Calendar, Clock, ExternalLink, MessageSquare } from "lucide-react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Static task definitions ────────────────────────────────────────────────────

interface TaskDef {
  id: string;        // stable key, used as DB taskId
  title: string;
  intakeLink?: string;  // relative path for deep-link (filled in at render time with slug)
  intakeLinkLabel?: string;
}

interface SectionDef {
  id: string;
  title: string;
  duration: string;  // shown at top of card e.g. "5–10 days"
  tasks: TaskDef[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    id: "network",
    title: "Network & Connectivity",
    duration: "5–10 days",
    tasks: [
      { id: "network:vpn",      title: "VPN Tunnel Configuration",            intakeLink: "/intake?section=connectivity", intakeLinkLabel: "VPN Form (E.1)" },
      { id: "network:firewall", title: "Firewall Rules & Port Openings",       intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-t",  title: "DICOM Endpoint Testing (Test Env)",   intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:dicom-p",  title: "DICOM Endpoint Testing (Production)", intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
      { id: "network:hl7-port", title: "HL7 Port Configuration",              intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Connectivity Card" },
    ],
  },
  {
    id: "hl7",
    title: "HL7 Interface Build",
    duration: "7–14 days",
    tasks: [
      { id: "hl7:orm",       title: "ORM Interface Configuration",   intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru",       title: "ORU Interface Configuration",   intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:adt",       title: "ADT Interface Configuration",   intakeLink: "/intake?section=integration-workflows", intakeLinkLabel: "Integration Workflows" },
      { id: "hl7:oru-spec",  title: "ORU Specification Review",      intakeLink: "/intake?section=connectivity",          intakeLinkLabel: "Sample ORU / Specs (CF.3, CF.4)" },
      { id: "hl7:orm-spec",  title: "ORM Specification Review",      intakeLink: "/intake?section=connectivity",          intakeLinkLabel: "Sample ORM / Specs (CF.4, CF.5)" },
      { id: "hl7:validate",  title: "HL7 Message Validation",        intakeLink: "/validation",                           intakeLinkLabel: "Validation Checklist" },
    ],
  },
  {
    id: "config",
    title: "System Configuration",
    duration: "3–7 days",
    tasks: [
      { id: "config:proc",     title: "Procedure Code Mapping",      intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Procedure Code List (CF.1)" },
      { id: "config:users",    title: "User Account Provisioning",   intakeLink: "/intake?section=connectivity", intakeLinkLabel: "User List (CF.2)" },
      { id: "config:provider", title: "Provider Directory Upload",   intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Provider Directory (CF.6)" },
      { id: "config:worklist", title: "Worklist Configuration",      intakeLink: "/intake?section=hl7-dicom",    intakeLinkLabel: "HL7 & DICOM Settings" },
    ],
  },
  {
    id: "templates",
    title: "Worklist & Templates",
    duration: "3–5 days",
    tasks: [
      { id: "tmpl:worklist",  title: "Worklist Filter Setup" },
      { id: "tmpl:reports",   title: "Report Template Configuration",  intakeLink: "/intake?section=connectivity", intakeLinkLabel: "Sample ORU (CF.3)" },
      { id: "tmpl:macros",    title: "Macro & Auto-text Setup" },
    ],
  },
  {
    id: "testing",
    title: "End-to-End Testing",
    duration: "5–7 days",
    tasks: [
      { id: "test:e2e",       title: "Full Order-to-Report Workflow Test",       intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:edge",      title: "Edge Case Testing (STAT, Addendum, etc.)", intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:perf",      title: "Performance & Load Testing",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
      { id: "test:signoff",   title: "Go-Live Readiness Sign-Off",               intakeLink: "/validation", intakeLinkLabel: "Validation Checklist" },
    ],
  },
];

// ── Inline editable owner field ───────────────────────────────────────────────

function OwnerInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="bg-transparent border-b border-primary outline-none text-xs w-28 text-foreground"
        placeholder="Owner…"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-text text-xs group relative"
      title="Click to set owner"
    >
      {value
        ? <span className="px-2 py-0.5 rounded border border-border/50 bg-muted/30 text-foreground">{value}</span>
        : <span className="px-2 py-0.5 rounded border border-dashed border-border/50 text-muted-foreground/50">Owner…</span>
      }
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

  const [localOverrides, setLocalOverrides] = useState<Record<string, { completed?: boolean; completedAt?: Date | null; owner?: string; notes?: string }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  function getMerged(taskId: string) {
    const s = taskMap[taskId];
    const l = localOverrides[taskId] ?? {};
    return {
      completed:   l.completed   !== undefined ? l.completed   : (s?.completed   ?? false),
      completedAt: l.completedAt !== undefined ? l.completedAt : (s?.completedAt ?? null),
      owner:       l.owner       !== undefined ? l.owner       : (s?.owner       ?? ""),
      notes:       l.notes       !== undefined ? l.notes       : (s?.notes       ?? ""),
    };
  }

  function save(taskId: string, sectionName: string, patch: { completed?: boolean; owner?: string; notes?: string }) {
    const current = getMerged(taskId);
    const merged = { ...current, ...patch };
    // Auto-set completedAt when toggling on, clear when toggling off
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
      notes: merged.notes || undefined,
    });
  }

  // Stats
  const allTaskIds = SECTION_DEFS.flatMap(s => s.tasks.map(t => t.id));
  const total = allTaskIds.length;
  const completed = allTaskIds.filter(id => getMerged(id).completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  function formatDate(d: Date | null) {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Implementation Checklist</h1>
              <p className="text-xs text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <Link href={`/org/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading checklist…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
            {/* Left — Sections */}
            <div className="space-y-6">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">{completed} of {total} tasks complete</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {SECTION_DEFS.map(section => {
                const sectionCompleted = section.tasks.filter(t => getMerged(t.id).completed).length;
                const sectionTotal = section.tasks.length;
                const allDone = sectionCompleted === sectionTotal;

                return (
                  <Card key={section.id} className="border-border/50 overflow-hidden">
                    {/* Section header */}
                    <div className="px-5 py-3 bg-muted/30 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold">{section.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Typical duration: {section.duration}</span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${allDone ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}
                        >
                          {sectionCompleted}/{sectionTotal}
                        </Badge>
                      </div>
                    </div>

                    {/* Column headers */}
                    <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                      <div className="w-4" />
                      <div>Task</div>
                      <div>Owner <span className="normal-case font-normal opacity-60">(click to set)</span></div>
                      <div>Completed</div>
                      <div>Link</div>
                      <div className="w-6" />
                    </div>

                    <CardContent className="p-0">
                      {section.tasks.map(task => {
                        const { completed: done, completedAt, owner, notes } = getMerged(task.id);
                        const notesOpen = !!expandedNotes[task.id];
                        const intakeHref = task.intakeLink ? `/org/${slug}${task.intakeLink}` : null;

                        return (
                          <div key={task.id} className={`border-b border-border/20 last:border-0`}>
                            {/* Main row */}
                            <div className={`grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 items-center px-5 py-3 ${done ? "opacity-60" : ""}`}>

                              {/* Checkbox */}
                              <button
                                onClick={() => save(task.id, section.title, { completed: !done })}
                                className="flex-shrink-0 w-4 h-4 rounded border border-border/60 flex items-center justify-center hover:border-primary transition-colors"
                                style={{ background: done ? "hsl(var(--primary))" : "transparent" }}
                                title={done ? "Mark incomplete" : "Mark complete"}
                              >
                                {done && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </button>

                              {/* Mobile stacked */}
                              <div className="md:hidden space-y-1.5 ml-6">
                                <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <OwnerInput value={owner} onCommit={v => save(task.id, section.title, { owner: v })} />
                                  {completedAt && <span className="text-xs text-muted-foreground">{formatDate(completedAt)}</span>}
                                </div>
                                {intakeHref && (
                                  <a href={intakeHref} className="text-xs text-primary/70 hover:text-primary flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />{task.intakeLinkLabel}
                                  </a>
                                )}
                              </div>

                              {/* Desktop columns */}
                              <span className={`hidden md:block text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </span>

                              <div className="hidden md:block">
                                <OwnerInput value={owner} onCommit={v => save(task.id, section.title, { owner: v })} />
                              </div>

                              <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground w-20">
                                {done && completedAt
                                  ? <><Calendar className="w-3 h-3 flex-shrink-0" />{formatDate(completedAt)}</>
                                  : <span className="text-muted-foreground/30">—</span>
                                }
                              </span>

                              <div className="hidden md:block">
                                {intakeHref ? (
                                  <a
                                    href={intakeHref}
                                    className="text-xs text-primary/60 hover:text-primary flex items-center gap-1 whitespace-nowrap transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    {task.intakeLinkLabel}
                                  </a>
                                ) : <span />}
                              </div>

                              {/* Comment toggle */}
                              <button
                                onClick={() => setExpandedNotes(prev => ({ ...prev, [task.id]: !notesOpen }))}
                                className={`hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-muted/50 transition-colors relative ${notesOpen || notes ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
                                title={notesOpen ? "Hide comment" : "Add comment"}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {notes && !notesOpen && (
                                  <span className="absolute w-1.5 h-1.5 bg-primary rounded-full top-0.5 right-0.5" />
                                )}
                              </button>
                            </div>

                            {/* Expandable comment */}
                            {notesOpen && (
                              <div className="px-5 pb-3 pt-0 bg-muted/10 border-t border-border/10">
                                <textarea
                                  className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 resize-none outline-none border-none focus:ring-0 py-2 min-h-[52px]"
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
                  </Card>
                );
              })}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              <Card className="border-border/50 sticky top-8">
                <CardContent className="p-5 space-y-5">
                  {/* Summary donut */}
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    Summary
                  </h3>

                  <div className="flex justify-center">
                    <div className="relative w-28 h-28">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(142 70% 45%)" strokeWidth="3"
                          strokeDasharray={`${(completed / total) * 100} ${100 - (completed / total) * 100}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground">Done</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {SECTION_DEFS.map(s => {
                      const done = s.tasks.filter(t => getMerged(t.id).completed).length;
                      const tot = s.tasks.length;
                      const allDone = done === tot;
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {allDone
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              : done > 0
                                ? <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                : <Circle className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                            }
                            <span className={`text-xs ${allDone ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{done}/{tot}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Blockers — uncompleted tasks in started sections */}
                  {(() => {
                    const blocked = SECTION_DEFS.flatMap(s => {
                      const sectionHasProgress = s.tasks.some(t => getMerged(t.id).completed);
                      if (!sectionHasProgress) return [];
                      return s.tasks.filter(t => !getMerged(t.id).completed).map(t => t.title);
                    }).slice(0, 4);

                    if (!blocked.length) return null;
                    return (
                      <div className="border-t border-border/40 pt-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> In Progress
                        </h4>
                        {blocked.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span>{t}
                          </p>
                        ))}
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
