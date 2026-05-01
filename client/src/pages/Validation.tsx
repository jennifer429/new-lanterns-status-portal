/**
 * Testing Checklist Page
 * Select rows → set status (Tested / N/A / Undo).
 * Floating bulk action toolbar appears when rows are selected.
 * Status date auto-records when Tested or N/A is set.
 * Related questionnaire answers shown beside each test for context.
 */

import { useState, useRef, useEffect, useMemo } from "react";
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
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  ExternalLink,
  FileText,
  CheckSquare,
  CalendarCheck,
  XSquare,
  Square,
  Ban,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useOrgParams } from "@/hooks/useOrgParams";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useAuth } from "@/_core/hooks/useAuth";
import { buildCSV, downloadCSV, parseCSV, readFileAsText, csvFilename } from "@/lib/csv";
import { Download, Upload } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  description: string;
  relatedQuestions?: Array<{
    questionId: string;
    label: string;
    sectionId: string;
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
      {
        name: "SSO / Active Directory Authentication",
        description: "Verify Single Sign-On via Active Directory — users can log in with AD credentials, roles map correctly, and session persists",
        relatedQuestions: [
          { questionId: "CF.2", label: "User List", sectionId: "config-files" },
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

type ValidationStatus = "pass" | "fail" | "na" | "in_progress" | "blocked" | "open";

const STATUS_CONFIG: Record<ValidationStatus, { label: string; icon: typeof CheckCircle2; colors: string }> = {
  pass: { label: "Pass", icon: CheckCircle2, colors: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" },
  fail: { label: "Fail", icon: XCircle, colors: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25" },
  na: { label: "N/A", icon: Ban, colors: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25" },
  in_progress: { label: "In Progress", icon: Clock, colors: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25" },
  blocked: { label: "Blocked", icon: AlertTriangle, colors: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25" },
  open: { label: "Open", icon: Circle, colors: "bg-muted/30 text-muted-foreground/60 border-border/40 hover:bg-muted/50 hover:text-foreground" },
};

// Cycle order when clicking the badge: Open → Pass → Fail → In Progress → Blocked → N/A → Open
const STATUS_CYCLE: ValidationStatus[] = ["open", "pass", "fail", "in_progress", "blocked", "na"];

function StatusBadge({
  status,
  onClick,
  size = "md",
}: {
  status: ValidationStatus;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-semibold transition-all border cursor-pointer",
        config.colors,
        sizeClasses
      )}
      title="Click to change status"
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </button>
  );
}

// ── Related question answer display ─────────────────────────────────────────

function RelatedAnswers({
  questions,
  responses,
  orgPath,
}: {
  questions: TestCase["relatedQuestions"];
  responses: Record<string, string>;
  orgPath: string;
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
          if (displayAnswer.length > 60) {
            displayAnswer = displayAnswer.substring(0, 57) + "…";
          }
        }

        return (
          <Link
            key={rq.questionId}
            href={`${orgPath}/intake?section=${rq.sectionId}&q=${rq.questionId}`}
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
  const { clientSlug, slug, orgPath } = useOrgParams("validation");
  const { user } = useAuth();

  const { data: organization } = trpc.organizations.getBySlug.useQuery(
    { slug },
    { enabled: !!slug, refetchOnWindowFocus: false }
  );
  const orgName = organization?.name || "";
  const partnerName = organization?.clientName || "";

  const { data: resultMap = {}, isLoading } = trpc.validation.getResults.useQuery(
    { organizationSlug: slug },
    { refetchOnWindowFocus: false }
  );

  const { data: intakeResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: slug },
    { refetchOnWindowFocus: false }
  );

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

  const csvInputRef = useRef<HTMLInputElement>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, { status?: string; signOff?: string; notes?: string; testedDate?: string }>>({});
  const [importStatus, setImportStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [expandedRelated, setExpandedRelated] = useState<Record<string, boolean>>({});
  const [resetTargetPhase, setResetTargetPhase] = useState<number | null>(null);
  const [selectedTestKeys, setSelectedTestKeys] = useState<Set<string>>(new Set());
  const [bulkStatusOpenPhase, setBulkStatusOpenPhase] = useState<number | null>(null);

  function toggleTestSelection(key: string) {
    setSelectedTestKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSelectAllInPhase(pIdx: number) {
    const keys = phases[pIdx].tests.map((_, tIdx) => testKey(pIdx, tIdx));
    const allSelected = keys.every(k => selectedTestKeys.has(k));
    setSelectedTestKeys(prev => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach(k => next.delete(k));
      } else {
        keys.forEach(k => next.add(k));
      }
      return next;
    });
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

  function getStatus(key: string): ValidationStatus {
    const m = getMerged(key);
    if (m.status === "Pass") return "pass";
    if (m.status === "Fail") return "fail";
    if (m.status === "N/A") return "na";
    if (m.status === "In Progress") return "in_progress";
    if (m.status === "Blocked") return "blocked";
    return "open";
  }

  function saveTest(key: string, patch: { status?: string; signOff?: string; notes?: string; testedDate?: string }) {
    const current = getMerged(key);
    const merged = { ...current, ...patch };

    // Record date for any active status
    if (patch.status && patch.status !== "Not Tested") {
      merged.testedDate = merged.testedDate || todayStr();
    }
    // Undo: clear date
    if (patch.status === "Not Tested") {
      merged.testedDate = "";
    }

    setLocalOverrides(prev => ({ ...prev, [key]: merged }));
    updateMutation.mutate({
      organizationSlug: slug,
      testKey: key,
      status: merged.status as any,
      signOff: merged.signOff || undefined,
      notes: merged.notes || undefined,
      testedDate: merged.testedDate || undefined,
    });
  }

  // Map internal status keys to DB enum values
  const STATUS_TO_DB: Record<ValidationStatus, string> = {
    pass: "Pass",
    fail: "Fail",
    na: "N/A",
    in_progress: "In Progress",
    blocked: "Blocked",
    open: "Not Tested",
  };

  function cycleStatus(pIdx: number, tIdx: number) {
    const key = testKey(pIdx, tIdx);
    const current = getStatus(key);
    const currentIdx = STATUS_CYCLE.indexOf(current);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    saveTest(key, { status: STATUS_TO_DB[nextStatus] });
  }

  function saveField(pIdx: number, tIdx: number, patch: { signOff?: string; notes?: string; testedDate?: string }) {
    const key = testKey(pIdx, tIdx);
    const current = getMerged(key);
    const merged = { ...current, ...patch };
    setLocalOverrides(prev => ({ ...prev, [key]: merged }));
    updateMutation.mutate({
      organizationSlug: slug,
      testKey: key,
      status: merged.status as any,
      signOff: merged.signOff || undefined,
      notes: merged.notes || undefined,
      testedDate: merged.testedDate || undefined,
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────────

  function bulkMarkPassed() {
    selectedTestKeys.forEach(key => {
      if (getMerged(key).status !== "Pass") {
        saveTest(key, { status: "Pass" });
      }
    });
    setSelectedTestKeys(new Set());
  }

  function bulkMarkNA() {
    selectedTestKeys.forEach(key => {
      if (getMerged(key).status !== "N/A") {
        saveTest(key, { status: "N/A" });
      }
    });
    setSelectedTestKeys(new Set());
  }

  function bulkMarkFail() {
    selectedTestKeys.forEach(key => {
      if (getMerged(key).status !== "Fail") {
        saveTest(key, { status: "Fail" });
      }
    });
    setSelectedTestKeys(new Set());
  }

  function bulkUndo() {
    selectedTestKeys.forEach(key => {
      saveTest(key, { status: "Not Tested" });
    });
    setSelectedTestKeys(new Set());
  }

  function bulkApplyStatus(status: ValidationStatus) {
    selectedTestKeys.forEach(key => {
      saveTest(key, { status: STATUS_TO_DB[status] });
    });
    setSelectedTestKeys(new Set());
  }

  function bulkSetDateSelected(date: string) {
    selectedTestKeys.forEach(key => {
      const current = getMerged(key);
      const merged = { ...current, testedDate: date };
      setLocalOverrides(prev => ({ ...prev, [key]: merged }));
      updateMutation.mutate({
        organizationSlug: slug,
        testKey: key,
        status: merged.status as any,
        signOff: merged.signOff || undefined,
        notes: merged.notes || undefined,
        testedDate: date,
      });
    });
  }

  // ── Phase-level bulk actions ──────────────────────────────────────────────────

  function bulkCheckPhase(pIdx: number) {
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      if (getMerged(key).status !== "Pass" && getMerged(key).status !== "N/A") {
        saveTest(key, { status: "Pass" });
      }
    });
  }

  function bulkUncheckPhase(pIdx: number) {
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      const current = getMerged(key);
      if (current.status === "Pass" || current.status === "N/A") {
        saveTest(key, { status: "Not Tested" });
      }
    });
  }

  function bulkDatePhase(pIdx: number, date: string) {
    phases[pIdx].tests.forEach((_, tIdx) => {
      const key = testKey(pIdx, tIdx);
      const current = getMerged(key);
      const merged = { ...current, testedDate: date };
      setLocalOverrides(prev => ({ ...prev, [key]: merged }));
      updateMutation.mutate({
        organizationSlug: slug,
        testKey: key,
        status: merged.status as any,
        signOff: merged.signOff || undefined,
        notes: merged.notes || undefined,
        testedDate: date,
      });
    });
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const headers = ["Phase", "Test Name", "Description", "Status", "Date Tested", "Sign-Off", "Notes"];
    const rows: string[][] = [];
    phases.forEach((phase, pIdx) => {
      phase.tests.forEach((test, tIdx) => {
        const key = testKey(pIdx, tIdx);
        const merged = getMerged(key);
        rows.push([
          `Phase ${pIdx + 1}: ${phase.title}`,
          test.name,
          test.description,
          merged.status,
          merged.testedDate || "",
          merged.signOff || "",
          merged.notes || "",
        ]);
      });
    });
    const csv = buildCSV(headers, rows);
    downloadCSV(csv, csvFilename(slug, "Testing_Checklist"));
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
        const testName = record["Test Name"]?.trim();
        if (!testName) { skipped++; continue; }

        let foundPIdx = -1;
        let foundTIdx = -1;
        phases.forEach((phase, pIdx) => {
          phase.tests.forEach((test, tIdx) => {
            if (test.name.toLowerCase() === testName.toLowerCase()) {
              foundPIdx = pIdx;
              foundTIdx = tIdx;
            }
          });
        });

        if (foundPIdx === -1) { skipped++; continue; }

        const key = testKey(foundPIdx, foundTIdx);
        const current = getMerged(key);

        const statusRaw = (record["Status"] || "").trim().toLowerCase();
        let newStatus = "Not Tested";
        if (statusRaw === "pass" || statusRaw === "tested") newStatus = "Pass";
        else if (statusRaw === "fail" || statusRaw === "failed") newStatus = "Fail";
        else if (statusRaw === "n/a" || statusRaw === "na" || statusRaw === "not applicable") newStatus = "N/A";
        else if (statusRaw === "in progress" || statusRaw === "in_progress" || statusRaw === "inprogress") newStatus = "In Progress";
        else if (statusRaw === "blocked") newStatus = "Blocked";

        const newDate = record["Date Tested"]?.trim() || current.testedDate || "";
        const newSignOff = record["Sign-Off"]?.trim() || current.signOff || "";
        const newNotes = record["Notes"]?.trim() || current.notes || "";

        const merged = { status: newStatus, testedDate: newDate, signOff: newSignOff, notes: newNotes };
        setLocalOverrides(prev => ({ ...prev, [key]: merged }));
        updateMutation.mutate({
          organizationSlug: slug,
          testKey: key,
          status: newStatus as any,
          signOff: newSignOff || undefined,
          notes: newNotes || undefined,
          testedDate: newDate || undefined,
        });
        matched++;
      }

      setImportStatus({ message: `Imported ${matched} test(s). ${skipped > 0 ? `${skipped} row(s) skipped (no match).` : ""}`, type: "success" });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err) {
      setImportStatus({ message: "Failed to parse CSV file.", type: "error" });
      setTimeout(() => setImportStatus(null), 5000);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  // Computed stats
  const allKeys = phases.flatMap((p, pIdx) => p.tests.map((_, tIdx) => testKey(pIdx, tIdx)));
  const passCount = allKeys.filter(k => getMerged(k).status === "Pass").length;
  const failCount = allKeys.filter(k => getMerged(k).status === "Fail").length;
  const naCount = allKeys.filter(k => getMerged(k).status === "N/A").length;
  const inProgressCount = allKeys.filter(k => getMerged(k).status === "In Progress").length;
  const blockedCount = allKeys.filter(k => getMerged(k).status === "Blocked").length;
  const openCount = allKeys.length - passCount - failCount - naCount - inProgressCount - blockedCount;
  const total = allKeys.length - naCount;
  const completed = passCount; // "Pass" is the fully completed state
  // Weighted: Pass=100%, InProgress=50%, Fail=25%, Blocked=25%; N/A excluded from total
  const weightedScore = passCount + inProgressCount * 0.5 + failCount * 0.25 + blockedCount * 0.25;
  const completePct = total > 0 ? Math.round((weightedScore / total) * 100) : 0;
  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:flex flex-col border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Testing Checklist</div>
              {orgName && <div className="text-xs text-muted-foreground truncate">{orgName}{partnerName ? ` · ${partnerName}` : ""}</div>}
            </div>
            {orgName && <div className="sm:hidden text-sm font-semibold truncate max-w-[100px]">{orgName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)}</div>}
          </div>

          {/* Right: nav + user */}
          <div className="flex items-center gap-2">
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            <Link href={orgPath} className="text-sm text-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
              Site Dashboard
            </Link>
            {user?.role === "admin" && (
              <Link href="/org/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium whitespace-nowrap">
                Admin
              </Link>
            )}
            <UserMenu
              extraItems={[
                {
                  label: "Export CSV",
                  icon: <Download className="w-4 h-4 mr-2" />,
                  onClick: handleExportCSV,
                },
                {
                  label: "Import CSV",
                  icon: <Upload className="w-4 h-4 mr-2" />,
                  onClick: () => csvInputRef.current?.click(),
                },
              ]}
            />
          </div>
        </div>
      </header>
      <PageBreadcrumb orgPath={orgPath} items={[{ label: "Testing Checklist" }]} />

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
                    <span className="text-sm text-foreground">{completed} of {total} tests passed</span>
                    <span className="text-sm font-bold text-primary">{completePct}%</span>
                  </div>
                </div>
                <Progress value={completePct} className="h-2" />
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  <span className="text-emerald-400 font-medium">{passCount} Pass</span>
                  {failCount > 0 && <span className="text-red-400 font-medium">{failCount} Fail</span>}
                  {inProgressCount > 0 && <span className="text-blue-400 font-medium">{inProgressCount} In Prog</span>}
                  {blockedCount > 0 && <span className="text-orange-400 font-medium">{blockedCount} Blocked</span>}
                  {naCount > 0 && <span className="text-amber-400 font-medium">{naCount} N/A</span>}
                  <span className="text-muted-foreground">{openCount} Open</span>
                </div>
              </div>

              {/* Phases — collapsible */}
              {phases.map((phase, pIdx) => {
                const phaseKeys = phase.tests.map((_, tIdx) => testKey(pIdx, tIdx));
                const phasePass = phaseKeys.filter(k => getMerged(k).status === "Pass").length;
                const phaseFail = phaseKeys.filter(k => getMerged(k).status === "Fail").length;
                const phaseNa = phaseKeys.filter(k => getMerged(k).status === "N/A").length;
                const phaseInProg = phaseKeys.filter(k => getMerged(k).status === "In Progress").length;
                const phaseBlocked = phaseKeys.filter(k => getMerged(k).status === "Blocked").length;
                const phaseCompleted = phasePass; // Pass = fully completed
                const phaseTotal = phase.tests.length - phaseNa;
                // Weighted phase completion: Pass=100%, InProgress=50%, Fail=25%, Blocked=25%
                const phaseWeightedScore = phasePass * 1.0 + phaseInProg * 0.5 + phaseFail * 0.25 + phaseBlocked * 0.25;
                const phasePct = phaseTotal > 0 ? Math.round((phaseWeightedScore / phaseTotal) * 100) : 0;
                const isCollapsed = !!collapsedPhases[pIdx];
                const allDone = phaseTotal > 0 && phaseCompleted === phaseTotal;
                const allPhaseSelected = phaseKeys.length > 0 && phaseKeys.every(k => selectedTestKeys.has(k));
                const selectedInPhase = phaseKeys.filter(k => selectedTestKeys.has(k));

                return (
                  <Card key={pIdx} className="card-elevated overflow-hidden">
                    {/* Collapsible section header */}
                    <button
                      onClick={() => setCollapsedPhases(prev => ({ ...prev, [pIdx]: !prev[pIdx] }))}
                      className="w-full px-5 py-4 bg-muted/30 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed
                          ? <ChevronRight className="w-5 h-5 text-foreground" />
                          : <ChevronDown className="w-5 h-5 text-foreground" />
                        }
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            Phase {pIdx + 1}
                          </p>
                          <h3 className="text-sm font-bold text-foreground mt-0.5">{phase.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {phaseFail > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-red-500/30 text-red-400">
                            {phaseFail} Fail
                          </Badge>
                        )}
                        {phaseInProg > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-blue-500/30 text-blue-400">
                            {phaseInProg} In Prog
                          </Badge>
                        )}
                        {phaseBlocked > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-orange-500/30 text-orange-400">
                            {phaseBlocked} Blocked
                          </Badge>
                        )}
                        {phaseNa > 0 && (
                          <Badge variant="outline" className="text-xs font-semibold border-amber-500/30 text-amber-400">
                            {phaseNa} N/A
                          </Badge>
                        )}
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
                          {phaseCompleted}/{phaseTotal} Pass
                        </Badge>
                      </div>
                    </button>

                    {/* Section action bar — visible when expanded */}
                    {!isCollapsed && (() => {
                      const bulkStatusOpen = bulkStatusOpenPhase === pIdx;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border/20 bg-muted/10">
                          {/* Left: select-all + selected count + set status */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Select all checkbox */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSelectAllInPhase(pIdx); }}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            >
                              {allPhaseSelected
                                ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                : <Square className="w-3.5 h-3.5" />
                              }
                              <span>Select all</span>
                            </button>

                            {/* Selected count chip */}
                            {selectedInPhase.length > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                                {selectedInPhase.length} selected
                              </span>
                            )}

                            {/* Set status dropdown — only when rows selected */}
                            {selectedInPhase.length > 0 && (
                              <DropdownMenu open={bulkStatusOpen} onOpenChange={(open) => setBulkStatusOpenPhase(open ? pIdx : null)}>
                                <DropdownMenuTrigger asChild>
                                  <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-border/60 bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                                    Set status
                                    {bulkStatusOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-44">
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("pass"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                    Pass
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("fail"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    Fail
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("in_progress"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                    In Progress
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("blocked"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                                    Blocked
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("na"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                    N/A
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { bulkApplyStatus("open"); setBulkStatusOpenPhase(null); }} className="gap-2 cursor-pointer">
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                    Open
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {/* Reset all (no selection needed) */}
                            {(phaseCompleted > 0 || phaseNa > 0) && selectedInPhase.length === 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setResetTargetPhase(pIdx); }}
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
                            {selectedInPhase.length > 0 ? (
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
                                  onChange={(e) => { if (e.target.value) bulkDatePhase(pIdx, e.target.value); }}
                                  className="bg-transparent border-b border-border/40 px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/60 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Collapsible content */}
                    {!isCollapsed && (
                      <CardContent className="p-0">
                        {/* Column headers */}
                        <div className="hidden md:grid grid-cols-[28px_1fr_90px_100px_140px_auto] gap-3 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                          <div />
                          <div>Test</div>
                          <div className="text-center">Status</div>
                          <div>Date</div>
                          <div>Sign-Off</div>
                          <div className="w-6" />
                        </div>

                        {phase.tests.map((test, tIdx) => {
                          const key = testKey(pIdx, tIdx);
                          const { status, signOff, notes, testedDate } = getMerged(key);
                          const isNA = status === "N/A";
                          const notesOpen = !!expandedNotes[key];
                          const relatedOpen = !!expandedRelated[key];
                          const hasRelated = test.relatedQuestions && test.relatedQuestions.length > 0;
                          const isSelected = selectedTestKeys.has(key);
                          const badgeStatus = getStatus(key);

                          return (
                            <div key={tIdx} className={cn(
                              tIdx < phase.tests.length - 1 ? "border-b border-border/20" : "",
                              isSelected && "bg-primary/5",
                              isNA && "opacity-60"
                            )}>
                              {/* Main row */}
                              <div className="grid grid-cols-1 md:grid-cols-[28px_1fr_90px_100px_140px_auto] gap-3 items-start px-5 py-3">
                                {/* Row selection checkbox */}
                                <div className="hidden md:flex items-center justify-center pt-1">
                                  <button
                                    onClick={() => toggleTestSelection(key)}
                                    className="focus:outline-none text-muted-foreground/40 hover:text-primary/70 transition-colors"
                                    title="Select row"
                                  >
                                    {isSelected
                                      ? <CheckSquare className="w-4 h-4 text-primary" />
                                      : <Square className="w-4 h-4" />
                                    }
                                  </button>
                                </div>

                                {/* Test name + description + related questions */}
                                <div className="space-y-1">
                                  <p className={cn("text-sm font-medium text-foreground", isNA && "line-through")}>{test.name}</p>
                                  <p className={cn("text-xs text-foreground/60", isNA && "line-through")}>{test.description}</p>

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

                                  {relatedOpen && hasRelated && (
                                    <RelatedAnswers
                                      questions={test.relatedQuestions}
                                      responses={responseLookup}
                                      orgPath={orgPath}
                                    />
                                  )}

                                  {/* Mobile: inline controls */}
                                  <div className="md:hidden flex flex-wrap items-center gap-3 mt-2">
                                    <StatusBadge status={badgeStatus} onClick={() => cycleStatus(pIdx, tIdx)} size="sm" />
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

                                {/* Status badge — desktop */}
                                <div className="hidden md:flex justify-center pt-0.5">
                                  <StatusBadge status={badgeStatus} onClick={() => cycleStatus(pIdx, tIdx)} />
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
                                  onClick={() => setExpandedNotes(prev => ({ ...prev, [key]: !notesOpen }))}
                                  className={cn(
                                    "hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-muted/50 transition-colors relative",
                                    notesOpen || notes ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                                  )}
                                  title={notesOpen ? "Hide comments" : "Add comment"}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {notes && !notesOpen && (
                                    <span className="absolute w-1.5 h-1.5 bg-primary rounded-full top-0.5 right-0.5" />
                                  )}
                                </button>
                              </div>

                              {/* Expandable notes row */}
                              {notesOpen && (
                                <div className="px-5 pb-3 pt-0 bg-muted/10 border-t border-border/10">
                                  <textarea
                                    className="w-full bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/40 resize-none outline-none border-none focus:ring-0 py-2 min-h-[56px]"
                                    placeholder="Add a comment or note about this test…"
                                    value={notes}
                                    onChange={(e) => setLocalOverrides(prev => ({ ...prev, [key]: { ...getMerged(key), notes: e.target.value } }))}
                                    onBlur={(e) => saveField(pIdx, tIdx, { notes: e.target.value })}
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
                  <h3 className="font-bold text-base text-foreground">Testing Summary</h3>

                  {/* Donut chart */}
                  <div className="flex justify-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="hsl(142 70% 45%)" strokeWidth="3"
                          strokeDasharray={`${completePct} ${100 - completePct}`}
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
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-foreground">Pass</span>
                      </div>
                      <span className="font-medium text-emerald-400">{passCount}</span>
                    </div>
                    {failCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-foreground">Fail</span>
                        </div>
                        <span className="font-medium text-red-400">{failCount}</span>
                      </div>
                    )}
                    {inProgressCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-foreground">In Progress</span>
                        </div>
                        <span className="font-medium text-blue-400">{inProgressCount}</span>
                      </div>
                    )}
                    {blockedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500" />
                          <span className="text-foreground">Blocked</span>
                        </div>
                        <span className="font-medium text-orange-400">{blockedCount}</span>
                      </div>
                    )}
                    {naCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-foreground">N/A</span>
                        </div>
                        <span className="font-medium text-amber-400">{naCount}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        <span className="text-foreground">Open</span>
                      </div>
                      <span className="font-medium text-muted-foreground">{openCount}</span>
                    </div>
                  </div>

                  {/* Next Up */}
                  {(() => {
                    const remaining = phases.flatMap((p, pIdx) =>
                      p.tests
                        .map((t, tIdx) => ({ ...t, key: testKey(pIdx, tIdx) }))
                        .filter(t => { const s = getMerged(t.key).status; return s !== "Pass" && s !== "N/A"; })
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

      {/* Reset All confirmation dialog */}
      <AlertDialog open={resetTargetPhase !== null} onOpenChange={(open) => { if (!open) setResetTargetPhase(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reset all tests in "{resetTargetPhase !== null ? phases[resetTargetPhase]?.title : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark all {resetTargetPhase !== null ? phases[resetTargetPhase]?.tests.length : 0} tests as not tested and clear their dates.
              Sign-off names and notes will be preserved. This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (resetTargetPhase !== null) { bulkUncheckPhase(resetTargetPhase); setResetTargetPhase(null); } }}
            >
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
