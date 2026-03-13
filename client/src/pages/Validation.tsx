/**
 * Validation Checklist Page
 * Loads/saves test results from the database per organization.
 * Phases and test definitions are static; actual/status/signOff are editable.
 */

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, ShieldCheck, ChevronDown } from "lucide-react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────────────────

type TestStatus = "Pass" | "Fail" | "Not Tested" | "Pending";

interface TestCase {
  name: string;
  expected: string;
}

interface Phase {
  title: string;
  tests: TestCase[];
}

// ── Static test definitions (template — no mutable state here) ─────────────────

const phases: Phase[] = [
  {
    title: "Connectivity Validation",
    tests: [
      { name: "VPN Tunnel Connectivity", expected: "Bidirectional ping < 50ms" },
      { name: "DICOM Echo Test (C-ECHO)", expected: "Success response from all AE titles" },
      { name: "HL7 Port Connectivity", expected: "ACK received on all ports" },
    ],
  },
  {
    title: "HL7 Message Validation",
    tests: [
      { name: "ORM New Order (NW)", expected: "Order appears in worklist within 5s" },
      { name: "ORM Cancel Order (CA)", expected: "Order removed from worklist" },
      { name: "ORU Report Delivery", expected: "Report delivered to EHR within 10s" },
      { name: "ADT Patient Update", expected: "Demographics updated in PACS" },
      { name: "Priority Routing (STAT)", expected: "STAT orders flagged in worklist" },
    ],
  },
  {
    title: "Image Routing Validation",
    tests: [
      { name: "DICOM Store from Modality", expected: "Images arrive in < 30s" },
      { name: "Prior Image Query/Retrieve", expected: "Priors available within 60s" },
      { name: "Worklist (MWL) Query", expected: "Scheduled exams returned" },
      { name: "AI Routing (if applicable)", expected: "Images routed to AI engine" },
    ],
  },
  {
    title: "User Acceptance Testing",
    tests: [
      { name: "End-to-End Order Workflow", expected: "Order → Image → Report complete" },
      { name: "Radiologist Reading Workflow", expected: "Study opens, report dictated, signed" },
      { name: "Tech QC Workflow", expected: "Tech can reject/accept images" },
      { name: "Report Distribution", expected: "Final report reaches referring provider" },
      { name: "STAT Escalation Path", expected: "Critical results alert fires" },
      { name: "Downtime Recovery", expected: "Queued studies process after reconnect" },
    ],
  },
];

function testKey(pIdx: number, tIdx: number) {
  return `${pIdx}:${tIdx}`;
}

// ── Status badge ───────────────────────────────────────────────────────────────

function TestStatusBadge({ status }: { status: TestStatus }) {
  const styles: Record<TestStatus, string> = {
    Pass: "bg-green-500/20 text-green-400 border-green-500/30",
    Fail: "bg-red-500/20 text-red-400 border-red-500/30",
    "Not Tested": "bg-muted text-muted-foreground border-border",
    Pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[status]}`}>
      {status}
    </Badge>
  );
}

// ── Status picker dropdown ─────────────────────────────────────────────────────

const STATUS_OPTIONS: TestStatus[] = ["Pass", "Fail", "Pending", "Not Tested"];

function StatusPicker({ value, onChange }: { value: TestStatus; onChange: (s: TestStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 group"
        title="Change status"
      >
        <TestStatusBadge status={value} />
        <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-md shadow-xl py-1 min-w-[130px]">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2 ${s === value ? "opacity-100" : "opacity-70"}`}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              <TestStatusBadge status={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Sync external value when not editing
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

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
        className={`bg-transparent border-b border-primary outline-none text-xs w-full ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text text-xs group relative inline-block w-full ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground/40">{placeholder}</span>}
      <span className="absolute right-0 top-0 text-muted-foreground/30 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Validation() {
  const [, params] = useRoute("/org/:slug/validation");
  const slug = params?.slug || "demo";

  const { data: resultMap = {}, isLoading } = trpc.validation.getResults.useQuery(
    { organizationSlug: slug },
    { refetchOnWindowFocus: false }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.validation.updateResult.useMutation({
    onSuccess: () => utils.validation.getResults.invalidate({ organizationSlug: slug }),
  });

  // Local optimistic state on top of server data
  const [localOverrides, setLocalOverrides] = useState<Record<string, { actual?: string; status?: TestStatus; signOff?: string }>>({});

  function getMerged(key: string) {
    const server = resultMap[key];
    const local = localOverrides[key] ?? {};
    return {
      actual: local.actual !== undefined ? local.actual : (server?.actual ?? ""),
      status: (local.status ?? server?.status ?? "Not Tested") as TestStatus,
      signOff: local.signOff !== undefined ? local.signOff : (server?.signOff ?? ""),
    };
  }

  function save(pIdx: number, tIdx: number, patch: { actual?: string; status?: TestStatus; signOff?: string }) {
    const key = testKey(pIdx, tIdx);
    const current = getMerged(key);
    const merged = { ...current, ...patch };
    setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
    updateMutation.mutate({
      organizationSlug: slug,
      testKey: key,
      actual: merged.actual || undefined,
      status: merged.status,
      signOff: merged.signOff || undefined,
    });
  }

  // Computed stats
  const allKeys = phases.flatMap((p, pIdx) => p.tests.map((_, tIdx) => testKey(pIdx, tIdx)));
  const total = allKeys.length;
  const passed = allKeys.filter((k) => getMerged(k).status === "Pass").length;
  const failed = allKeys.filter((k) => getMerged(k).status === "Fail").length;
  const pending = allKeys.filter((k) => ["Not Tested", "Pending"].includes(getMerged(k).status)).length;
  const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const blockers = phases.flatMap((p, pIdx) =>
    p.tests
      .map((t, tIdx) => ({ ...t, ...getMerged(testKey(pIdx, tIdx)) }))
      .filter((t) => t.status === "Fail")
  );

  const getStatusIcon = (status: TestStatus) => {
    if (status === "Pass") return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />;
    if (status === "Fail") return <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />;
    if (status === "Pending") return <Circle className="w-5 h-5 text-amber-400/60 flex-shrink-0" />;
    return <Circle className="w-5 h-5 text-muted-foreground/30 flex-shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Validation Checklist</h1>
              <p className="text-xs text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <Link href={`/org/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading validation data…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            {/* Left column — Test phases */}
            <div className="space-y-6">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">{passed} of {total} tests passed</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{passPct}%</span>
                </div>
                <Progress value={passPct} className="h-2" />
              </div>

              {/* Phases */}
              {phases.map((phase, pIdx) => {
                const phaseKeys = phase.tests.map((_, tIdx) => testKey(pIdx, tIdx));
                const phasePassed = phaseKeys.filter((k) => getMerged(k).status === "Pass").length;
                const phaseFailed = phaseKeys.filter((k) => getMerged(k).status === "Fail").length;
                const phaseTotal = phase.tests.length;
                const allNotStarted = phaseKeys.every((k) => getMerged(k).status === "Not Tested");

                let phaseLabel = `${phasePassed}/${phaseTotal} Passed`;
                let phaseLabelStyle = "border-green-500/40 text-green-400";
                if (allNotStarted) {
                  phaseLabel = `0/${phaseTotal} Not Started`;
                  phaseLabelStyle = "border-border text-muted-foreground";
                } else if (phaseFailed > 0) {
                  phaseLabelStyle = "border-amber-500/40 text-amber-400";
                }

                return (
                  <Card key={pIdx} className="border-border/50 overflow-hidden">
                    <div className="px-5 py-3 bg-muted/30 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider">
                          Phase {pIdx + 1}: {phase.title}
                        </h3>
                        <Badge variant="outline" className={`text-xs ${phaseLabelStyle}`}>
                          {phaseLabel}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-0">
                      {/* Column headers */}
                      <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_110px_1fr] gap-2 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                        <div className="w-5" />
                        <div>Test</div>
                        <div>Expected</div>
                        <div>Actual <span className="normal-case font-normal opacity-60">(click to edit)</span></div>
                        <div className="text-center">Result</div>
                        <div>Sign-Off <span className="normal-case font-normal opacity-60">(click to edit)</span></div>
                      </div>

                      {phase.tests.map((test, tIdx) => {
                        const key = testKey(pIdx, tIdx);
                        const { actual, status, signOff } = getMerged(key);

                        return (
                          <div
                            key={tIdx}
                            className={`grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr_110px_1fr] gap-2 items-center px-5 py-3 ${
                              tIdx < phase.tests.length - 1 ? "border-b border-border/20" : ""
                            } ${status === "Pass" ? "opacity-60" : ""}`}
                          >
                            {getStatusIcon(status)}

                            {/* Mobile: stacked */}
                            <div className="md:hidden space-y-2 ml-8">
                              <p className="text-sm font-medium">{test.name}</p>
                              <p className="text-xs text-muted-foreground">Expected: {test.expected}</p>
                              <InlineEdit
                                value={actual}
                                placeholder="Enter actual result…"
                                onCommit={(v) => save(pIdx, tIdx, { actual: v })}
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                <StatusPicker value={status} onChange={(s) => save(pIdx, tIdx, { status: s })} />
                                <InlineEdit
                                  value={signOff}
                                  placeholder="Sign-off…"
                                  onCommit={(v) => save(pIdx, tIdx, { signOff: v })}
                                />
                              </div>
                            </div>

                            {/* Desktop: grid columns */}
                            <span className="hidden md:block text-sm font-medium">{test.name}</span>
                            <span className="hidden md:block text-xs text-muted-foreground">{test.expected}</span>
                            <span className="hidden md:block">
                              <InlineEdit
                                value={actual}
                                placeholder="Enter actual result…"
                                onCommit={(v) => save(pIdx, tIdx, { actual: v })}
                              />
                            </span>
                            <div className="hidden md:flex justify-center">
                              <StatusPicker value={status} onChange={(s) => save(pIdx, tIdx, { status: s })} />
                            </div>
                            <span className="hidden md:block">
                              <InlineEdit
                                value={signOff}
                                placeholder="Name, date…"
                                onCommit={(v) => save(pIdx, tIdx, { signOff: v })}
                              />
                            </span>
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
                <CardContent className="p-5 space-y-6">
                  <h3 className="font-bold text-base">Validation Summary</h3>

                  {/* Donut chart */}
                  <div className="flex justify-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(0 70% 50%)" strokeWidth="3"
                          strokeDasharray={`${(failed / total) * 100} ${100 - (failed / total) * 100}`}
                          strokeDashoffset={`${-(passed / total) * 100}`}
                        />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(142 70% 45%)" strokeWidth="3"
                          strokeDasharray={`${(passed / total) * 100} ${100 - (passed / total) * 100}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{passPct}%</span>
                        <span className="text-xs text-muted-foreground">Passed</span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>Passed ({passPct}%)</span>
                      </div>
                      <span className="font-medium">{passed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span>Failed ({Math.round((failed / total) * 100)}%)</span>
                      </div>
                      <span className="font-medium">{failed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        <span>Pending ({Math.round((pending / total) * 100)}%)</span>
                      </div>
                      <span className="font-medium">{pending}</span>
                    </div>
                  </div>

                  {/* Blockers */}
                  {blockers.length > 0 && (
                    <div className="border-t border-border/40 pt-4 space-y-2">
                      <h4 className="font-bold text-sm flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        Blockers ({blockers.length})
                      </h4>
                      {blockers.map((b, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {b.name}{b.actual ? ` — ${b.actual}` : ""}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Next Steps: auto-generated from first few not-tested items */}
                  {(() => {
                    const notTested = phases.flatMap((p, pIdx) =>
                      p.tests
                        .map((t, tIdx) => ({ ...t, ...getMerged(testKey(pIdx, tIdx)) }))
                        .filter((t) => t.status === "Not Tested" || t.status === "Pending")
                    ).slice(0, 3);

                    if (notTested.length === 0) return (
                      <div className="border-t border-border/40 pt-4">
                        <p className="text-xs text-green-400 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> All tests completed!
                        </p>
                      </div>
                    );

                    return (
                      <div className="border-t border-border/40 pt-4 space-y-3">
                        <h4 className="font-bold text-sm">Next Up</h4>
                        <ul className="text-xs text-muted-foreground space-y-1.5">
                          {notTested.map((t, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              {t.name}
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
