/**
 * Validation Checklist Page
 * Checkbox-based completion: check = tested, date auto-populates.
 * Related questionnaire answers shown beside each test for context.
 * Sections are collapsible. Font is consistent — no grayed-out text.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  FileText,
  CheckSquare,
  CalendarCheck,
  XSquare,
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  description: string; // What to verify
  /** Related questionnaire question IDs — shown as context beside the test */
  relatedQuestions?: Array<{
    questionId: string;
    label: string; // Short label like "VPN Details" or "PACS Vendor"
    sectionId: string; // Questionnaire section to link to
  }>;
}

interface Phase {
  title: string;
  tests: TestCase[];
}

// ── Static test definitions with questionnaire mappings ─────────────────────

const phases: Phase[] = [
  {
    title: "Connectivity Validation",
    tests: [
      {
        name: "VPN Tunnel Connectivity",
        description: "Verify bidirectional connectivity through VPN tunnel",
        relatedQuestions: [
          { questionId: "E.1", label: "VPN Form", sectionId: "connectivity" },
          { questionId: "H.1", label: "Number of Sites", sectionId: "org-info" },
        ],
      },
      {
        name: "DICOM Echo Test (C-ECHO)",
        description: "Confirm C-ECHO success from all AE titles",
        relatedQuestions: [
          { questionId: "ARCH.systems", label: "Systems Inventory", sectionId: "architecture" },
          { questionId: "CONN.endpoints", label: "Endpoints", sectionId: "connectivity" },
        ],
      },
      {
        name: "HL7 Port Connectivity",
        description: "Verify ACK received on all configured HL7 ports",
        relatedQuestions: [
          { questionId: "CONN.endpoints", label: "Endpoints", sectionId: "connectivity" },
        ],
      },
    ],
  },
  {
    title: "HL7 Message Validation",
    tests: [
      {
        name: "ORM New Order (NW)",
        description: "Send a new order and verify it appears in worklist",
        relatedQuestions: [
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
          { questionId: "G.3", label: "ORC-1 Values", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "ORM Cancel Order (CA)",
        description: "Cancel an order and verify removal from worklist",
        relatedQuestions: [
          { questionId: "G.3", label: "ORC-1 Values", sectionId: "hl7-dicom" },
          { questionId: "G.4", label: "ORC-5 Values", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "ORU Report Delivery",
        description: "Verify finalized report delivered back to EHR",
        relatedQuestions: [
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
          { questionId: "G.5", label: "OBR:27.1 Values", sectionId: "hl7-dicom" },
          { questionId: "CF.3", label: "Sample ORU", sectionId: "config-files" },
        ],
      },
      {
        name: "ADT Patient Update",
        description: "Verify patient demographics update in PACS",
        relatedQuestions: [
          { questionId: "D.11", label: "Patient Identifier", sectionId: "hl7-dicom" },
          { questionId: "D.12", label: "ID Matching", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "Priority Routing (STAT)",
        description: "Verify STAT orders are flagged correctly in worklist",
        relatedQuestions: [
          { questionId: "D.10", label: "Priority Values", sectionId: "hl7-dicom" },
          { questionId: "G.6", label: "Patient Class", sectionId: "hl7-dicom" },
        ],
      },
    ],
  },
  {
    title: "Image Routing Validation",
    tests: [
      {
        name: "DICOM Store from Modality",
        description: "Verify images arrive from modality to PACS",
        relatedQuestions: [
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
          { questionId: "D.3", label: "Modalities", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "Prior Image Query/Retrieve",
        description: "Verify prior studies are retrievable",
        relatedQuestions: [
          { questionId: "IW.priors_description", label: "Priors Workflow", sectionId: "integration-workflows" },
          { questionId: "D.12", label: "ID Matching", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "Worklist (MWL) Query",
        description: "Verify scheduled exams returned via modality worklist",
        relatedQuestions: [
          { questionId: "ARCH.systems", label: "Systems Inventory", sectionId: "architecture" },
        ],
      },
      {
        name: "AI Routing (if applicable)",
        description: "Verify images routed to AI engine if configured",
        relatedQuestions: [
          { questionId: "ARCH.systems", label: "Systems Inventory", sectionId: "architecture" },
          { questionId: "D.9", label: "DICOM SR / Clinical Data", sectionId: "hl7-dicom" },
        ],
      },
    ],
  },
  {
    title: "User Acceptance Testing",
    tests: [
      {
        name: "End-to-End Order Workflow",
        description: "Complete cycle: Order → Image → Report",
        relatedQuestions: [
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
        ],
      },
      {
        name: "Radiologist Reading Workflow",
        description: "Study opens, report dictated and signed",
        relatedQuestions: [
          { questionId: "CF.1", label: "Procedure Codes", sectionId: "config-files" },
          { questionId: "CF.2", label: "User List", sectionId: "config-files" },
        ],
      },
      {
        name: "Tech QC Workflow",
        description: "Tech can reject/accept images",
        relatedQuestions: [
          { questionId: "CF.2", label: "User List", sectionId: "config-files" },
        ],
      },
      {
        name: "Report Distribution",
        description: "Final report reaches referring provider",
        relatedQuestions: [
          { questionId: "CF.6", label: "Provider Directory", sectionId: "config-files" },
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
        ],
      },
      {
        name: "STAT Escalation Path",
        description: "Critical results alert fires correctly",
        relatedQuestions: [
          { questionId: "D.10", label: "Priority Values", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "Downtime Recovery",
        description: "Queued studies process after reconnect",
        relatedQuestions: [
          { questionId: "L.11", label: "Downtime Plans", sectionId: "org-info" },
          { questionId: "L.8", label: "Go-Live Support", sectionId: "org-info" },
        ],
      },
      {
        name: "Reschedule a Study",
        description: "Reschedule an existing order — verify worklist updates, prior linkage follows new appointment, and original order is closed",
        relatedQuestions: [
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
          { questionId: "G.3", label: "ORC-1 Values", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "Cancel a Study",
        description: "Cancel a scheduled study — verify removal from worklist, cancellation message delivered to EHR, and no orphaned images",
        relatedQuestions: [
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
          { questionId: "G.3", label: "ORC-1 Values", sectionId: "hl7-dicom" },
          { questionId: "G.4", label: "ORC-5 Values", sectionId: "hl7-dicom" },
        ],
      },
      {
        name: "End-to-End Study Completion",
        description: "Perform a full study: order placed → patient checked in → images acquired → tech QC → radiologist reads → report signed → report delivered to EHR",
        relatedQuestions: [
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
          { questionId: "CF.1", label: "Procedure Codes", sectionId: "connectivity" },
        ],
      },
      {
        name: "Addendum Workflow",
        description: "Add an addendum to a signed report — verify addendum appended (not overwritten), versioned ORU sent to EHR, and referring provider notified",
        relatedQuestions: [
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
          { questionId: "CF.3", label: "Sample ORU", sectionId: "connectivity" },
        ],
      },
      {
        name: "CT Dose & Tech Sheet Integration",
        description: "Verify CT dose data (RDSR/DICOM SR) populates tech sheet fields and flows into report templates correctly; confirm dose values match modality output",
        relatedQuestions: [
          { questionId: "D.9", label: "DICOM SR / Clinical Data", sectionId: "hl7-dicom" },
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
          { questionId: "ARCH.systems", label: "Systems Inventory", sectionId: "architecture" },
        ],
      },
      {
        name: "BI-RADS Custom Report Insertion",
        description: "Verify BI-RADS structured reporting inserts correctly into mammography reports — category, recommendation, and laterality fields map to template",
        relatedQuestions: [
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
          { questionId: "CF.3", label: "Sample ORU", sectionId: "connectivity" },
        ],
      },
      {
        name: "Lung-RADS / Lung CA Mapping",
        description: "Verify Lung-RADS structured reporting populates correctly — nodule size, category, and follow-up recommendation insert into lung screening report templates",
        relatedQuestions: [
          { questionId: "IW.reports_description", label: "Reports Workflow", sectionId: "integration-workflows" },
          { questionId: "CF.3", label: "Sample ORU", sectionId: "connectivity" },
        ],
      },
      {
        name: "Study Merge",
        description: "Merge two separate studies into one — verify combined images, updated worklist entry, and correct report association",
        relatedQuestions: [
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
        ],
      },
      {
        name: "Study Split",
        description: "Break apart a merged or incorrectly combined study — verify images route to correct separate orders and reports follow",
        relatedQuestions: [
          { questionId: "IW.images_description", label: "Images Workflow", sectionId: "integration-workflows" },
          { questionId: "IW.orders_description", label: "Orders Workflow", sectionId: "integration-workflows" },
        ],
      },
    ],
  },
];

function testKey(pIdx: number, tIdx: number) {
  return `${pIdx}:${tIdx}`;
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

// ── Related question answer display ─────────────────────────────────────────

function RelatedAnswers({
  questions,
  responses,
  slug,
}: {
  questions: TestCase["relatedQuestions"];
  responses: Record<string, string>;
  slug: string;
}) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {questions.map((rq) => {
        const answer = responses[rq.questionId];
        const hasAnswer = answer && answer.trim() !== "" && answer !== "null" && answer !== "undefined";
        let displayAnswer = "";
        if (hasAnswer) {
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed)) {
              displayAnswer = parsed.join(", ");
            } else if (typeof parsed === "object") {
              displayAnswer = "Configured";
            } else {
              displayAnswer = String(parsed);
            }
          } catch {
            displayAnswer = answer;
          }
          // Truncate long answers
          if (displayAnswer.length > 60) {
            displayAnswer = displayAnswer.substring(0, 57) + "…";
          }
        }

        return (
          <Link
            key={rq.questionId}
            href={`/org/${slug}/intake?section=${rq.sectionId}&q=${rq.questionId}`}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors",
              hasAnswer
                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
            )}
            title={hasAnswer ? `${rq.label}: ${displayAnswer} — Click to edit in questionnaire` : `${rq.label}: Not answered — Click to fill in questionnaire`}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium">{rq.label}</span>
            {hasAnswer && (
              <>
                <span className="text-muted-foreground mx-0.5">:</span>
                <span className="truncate max-w-[150px]">{displayAnswer}</span>
              </>
            )}
            {!hasAnswer && (
              <span className="text-muted-foreground/60 italic ml-0.5">empty</span>
            )}
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
          </Link>
        );
      })}
    </div>
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

  // Fetch questionnaire responses for this org to show related answers
  const { data: intakeResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: slug },
    { refetchOnWindowFocus: false }
  );

  // Build a lookup map of questionId → response value
  const responseLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of intakeResponses) {
      if (r.questionId && r.response) {
        map[r.questionId] = r.response;
      }
    }
    return map;
  }, [intakeResponses]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.validation.updateResult.useMutation({
    onSuccess: () => utils.validation.getResults.invalidate({ organizationSlug: slug }),
  });

  // Local optimistic state
  const [localOverrides, setLocalOverrides] = useState<Record<string, { status?: string; signOff?: string; notes?: string; testedDate?: string }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  // Track which tests have their related questions expanded
  const [expandedRelated, setExpandedRelated] = useState<Record<string, boolean>>({});

  function togglePhase(pIdx: number) {
    setCollapsedPhases(prev => ({ ...prev, [pIdx]: !prev[pIdx] }));
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getMerged(key: string) {
    const server = resultMap[key];
    const local = localOverrides[key] ?? {};
    return {
      status: (local.status ?? server?.status ?? "Not Tested") as string,
      signOff: local.signOff !== undefined ? local.signOff : (server?.signOff ?? ""),
      notes: local.notes !== undefined ? local.notes : (server?.notes ?? ""),
      testedDate: local.testedDate !== undefined ? local.testedDate : (server?.testedDate ?? ""),
    };
  }

  function toggleTested(pIdx: number, tIdx: number) {
    const key = testKey(pIdx, tIdx);
    const current = getMerged(key);
    const isTested = current.status === "Pass";

    // Toggle: if already tested, uncheck; if not, check and auto-date
    const newStatus = isTested ? "Not Tested" : "Pass";
    const newDate = isTested ? "" : (current.testedDate || todayStr());

    const merged = {
      ...current,
      status: newStatus,
      testedDate: newDate,
    };

    setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
    updateMutation.mutate({
      organizationSlug: slug,
      testKey: key,
      status: newStatus as any,
      signOff: merged.signOff || undefined,
      notes: merged.notes || undefined,
      testedDate: merged.testedDate || undefined,
    });
  }

  function saveField(pIdx: number, tIdx: number, patch: { signOff?: string; notes?: string; testedDate?: string }) {
    const key = testKey(pIdx, tIdx);
    const current = getMerged(key);
    const merged = { ...current, ...patch };
    setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
    updateMutation.mutate({
      organizationSlug: slug,
      testKey: key,
      status: merged.status as any,
      signOff: merged.signOff || undefined,
      notes: merged.notes || undefined,
      testedDate: merged.testedDate || undefined,
    });
  }

  // ── Bulk actions per phase ──────────────────────────────────────────────────

  function bulkCheckPhase(pIdx: number) {
    const today = todayStr();
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      const current = getMerged(key);
      if (current.status !== "Pass") {
        const merged = {
          ...current,
          status: "Pass",
          testedDate: current.testedDate || today,
        };
        setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
        updateMutation.mutate({
          organizationSlug: slug,
          testKey: key,
          status: "Pass" as any,
          signOff: merged.signOff || undefined,
          notes: merged.notes || undefined,
          testedDate: merged.testedDate || undefined,
        });
      }
    });
  }

  function bulkDatePhase(pIdx: number, date: string) {
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      const current = getMerged(key);
      const merged = { ...current, testedDate: date };
      setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
      updateMutation.mutate({
        organizationSlug: slug,
        testKey: key,
        status: merged.status as any,
        signOff: merged.signOff || undefined,
        notes: merged.notes || undefined,
        testedDate: date || undefined,
      });
    });
  }

  function bulkUncheckPhase(pIdx: number) {
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      const current = getMerged(key);
      if (current.status === "Pass") {
        const merged = {
          ...current,
          status: "Not Tested",
          testedDate: "",
        };
        setLocalOverrides((prev) => ({ ...prev, [key]: merged }));
        updateMutation.mutate({
          organizationSlug: slug,
          testKey: key,
          status: "Not Tested" as any,
          signOff: merged.signOff || undefined,
          notes: merged.notes || undefined,
          testedDate: undefined,
        });
      }
    });
  }

  // Computed stats
  const allKeys = phases.flatMap((p, pIdx) => p.tests.map((_, tIdx) => testKey(pIdx, tIdx)));
  const total = allKeys.length;
  const completed = allKeys.filter((k) => getMerged(k).status === "Pass").length;
  const completePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Testing Checklist</h1>
              <p className="text-sm text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/org/${slug}`} className="text-sm text-foreground hover:text-primary transition-colors font-medium">
              Back to Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-foreground text-sm">
            Loading testing data…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
            {/* Left column — Test phases */}
            <div className="space-y-6">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">{completed} of {total} tests completed</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{completePct}%</span>
                </div>
                <Progress value={completePct} className="h-2" />
              </div>

              {/* Phases — collapsible */}
              {phases.map((phase, pIdx) => {
                const phaseKeys = phase.tests.map((_, tIdx) => testKey(pIdx, tIdx));
                const phaseCompleted = phaseKeys.filter((k) => getMerged(k).status === "Pass").length;
                const phaseTotal = phase.tests.length;
                const isCollapsed = !!collapsedPhases[pIdx];
                const allDone = phaseCompleted === phaseTotal;

                return (
                  <Card key={pIdx} className="card-elevated overflow-hidden">
                    {/* Collapsible section header */}
                    <button
                      onClick={() => togglePhase(pIdx)}
                      className="w-full px-5 py-4 bg-muted/30 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5 text-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-foreground" />
                        )}
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            Phase {pIdx + 1}
                          </p>
                          <h3 className="text-sm font-bold text-foreground mt-0.5">{phase.title}</h3>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold",
                          allDone
                            ? "border-emerald-500/40 text-emerald-400"
                            : phaseCompleted > 0
                              ? "border-primary/40 text-primary"
                              : "border-border text-foreground"
                        )}
                      >
                        {phaseCompleted}/{phaseTotal} Complete
                      </Badge>
                    </button>

                    {/* Bulk action toolbar — visible when expanded */}
                    {!isCollapsed && (<>
                      <div className="flex flex-wrap items-center gap-3 px-5 py-2.5 border-b border-border/20 bg-muted/10">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Actions</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); bulkCheckPhase(pIdx); }}
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
                          onClick={(e) => { e.stopPropagation(); bulkUncheckPhase(pIdx); }}
                          disabled={phaseCompleted === 0}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs transition-colors",
                            phaseCompleted === 0
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
                            onChange={(e) => { if (e.target.value) bulkDatePhase(pIdx, e.target.value); }}
                            className="bg-transparent border-b border-border/40 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                          />
                        </div>
                      </div>

                    <CardContent className="p-0">
                        {/* Column headers */}
                        <div className="hidden md:grid grid-cols-[40px_1fr_100px_140px_auto] gap-3 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                          <div className="text-center">Done</div>
                          <div>Test</div>
                          <div>Date</div>
                          <div>Sign-Off</div>
                          <div className="w-6" />
                        </div>

                        {phase.tests.map((test, tIdx) => {
                          const key = testKey(pIdx, tIdx);
                          const { status, signOff, notes, testedDate } = getMerged(key);
                          const isTested = status === "Pass";
                          const notesOpen = !!expandedNotes[key];
                          const relatedOpen = !!expandedRelated[key];
                          const hasRelated = test.relatedQuestions && test.relatedQuestions.length > 0;

                          return (
                            <div key={tIdx} className={tIdx < phase.tests.length - 1 ? "border-b border-border/20" : ""}>
                              {/* Main row */}
                              <div className="grid grid-cols-1 md:grid-cols-[40px_1fr_100px_140px_auto] gap-3 items-start px-5 py-3">
                                {/* Checkbox */}
                                <div className="flex justify-center pt-0.5">
                                  <button
                                    onClick={() => toggleTested(pIdx, tIdx)}
                                    className="focus:outline-none"
                                    title={isTested ? "Mark as not tested" : "Mark as tested"}
                                  >
                                    {isTested ? (
                                      <CheckCircle2 className="w-6 h-6 text-green-500 hover:text-green-400 transition-colors" />
                                    ) : (
                                      <Circle className="w-6 h-6 text-muted-foreground/40 hover:text-primary/60 transition-colors cursor-pointer" />
                                    )}
                                  </button>
                                </div>

                                {/* Test name + description + related questions toggle */}
                                <div className="space-y-1">
                                  <p className={cn(
                                    "text-sm font-medium",
                                    isTested ? "text-foreground" : "text-foreground"
                                  )}>
                                    {test.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{test.description}</p>

                                  {/* Related questions toggle */}
                                  {hasRelated && (
                                    <button
                                      onClick={() => setExpandedRelated(prev => ({ ...prev, [key]: !relatedOpen }))}
                                      className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors mt-0.5"
                                    >
                                      <FileText className="w-3 h-3" />
                                      {relatedOpen ? "Hide" : "Show"} related answers ({test.relatedQuestions!.length})
                                    </button>
                                  )}

                                  {/* Related questionnaire answers — expandable */}
                                  {relatedOpen && hasRelated && (
                                    <RelatedAnswers
                                      questions={test.relatedQuestions}
                                      responses={responseLookup}
                                      slug={slug}
                                    />
                                  )}

                                  {/* Mobile: date + sign-off inline */}
                                  <div className="md:hidden flex items-center gap-3 mt-2">
                                    <input
                                      type="date"
                                      value={testedDate}
                                      onChange={(e) => saveField(pIdx, tIdx, { testedDate: e.target.value })}
                                      className="bg-transparent border border-border/40 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                    <InlineEdit
                                      value={signOff}
                                      placeholder="Sign-off…"
                                      onCommit={(v) => saveField(pIdx, tIdx, { signOff: v })}
                                    />
                                  </div>
                                </div>

                                {/* Date — desktop */}
                                <div className="hidden md:block">
                                  <input
                                    type="date"
                                    value={testedDate}
                                    onChange={(e) => saveField(pIdx, tIdx, { testedDate: e.target.value })}
                                    className="bg-transparent border border-border/40 rounded px-1.5 py-1 text-xs text-foreground w-full focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert"
                                  />
                                </div>

                                {/* Sign-off — desktop */}
                                <div className="hidden md:block">
                                  <InlineEdit
                                    value={signOff}
                                    placeholder="Name…"
                                    onCommit={(v) => saveField(pIdx, tIdx, { signOff: v })}
                                  />
                                </div>

                                {/* Comment toggle */}
                                <button
                                  onClick={() => setExpandedNotes((prev) => ({ ...prev, [key]: !notesOpen }))}
                                  className={cn(
                                    "hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-muted/50 transition-colors",
                                    notesOpen || notes ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                                  )}
                                  title={notesOpen ? "Hide comments" : "Add comment"}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Expandable notes row */}
                              {notesOpen && (
                                <div className="px-5 pb-3 pt-0 bg-muted/10 border-t border-border/10">
                                  <textarea
                                    className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/40 resize-none outline-none border-none focus:ring-0 py-2 min-h-[56px]"
                                    placeholder="Add a comment or note about this test…"
                                    value={notes}
                                    onChange={(e) => setLocalOverrides((prev) => ({ ...prev, [key]: { ...getMerged(key), notes: e.target.value } }))}
                                    onBlur={(e) => saveField(pIdx, tIdx, { notes: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </>)}
                  </Card>
                );
              })}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              <Card className="card-elevated sticky top-20">
                <CardContent className="p-5 space-y-6">
                  <h3 className="font-bold text-base text-foreground">Testing Summary</h3>

                  {/* Donut chart */}
                  <div className="flex justify-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(142 70% 45%)" strokeWidth="3"
                          strokeDasharray={`${(completed / total) * 100} ${100 - (completed / total) * 100}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{completePct}%</span>
                        <span className="text-sm text-muted-foreground">Complete</span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-foreground">Tested</span>
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
                    const remaining = phases.flatMap((p, pIdx) =>
                      p.tests
                        .map((t, tIdx) => ({ ...t, key: testKey(pIdx, tIdx) }))
                        .filter((t) => getMerged(t.key).status !== "Pass")
                    ).slice(0, 3);

                    if (remaining.length === 0) return (
                      <div className="border-t border-border/40 pt-4">
                        <p className="text-sm text-green-400 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> All tests completed!
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
