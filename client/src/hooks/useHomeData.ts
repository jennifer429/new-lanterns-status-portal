import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { type ConnectivityRow } from "@/components/ConnectivityTable";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "@shared/taskDefs";

const VAL_PHASES = [
  { title: "Connectivity Validation", count: 4 },
  { title: "HL7 Message Validation", count: 5 },
  { title: "Image Routing Validation", count: 4 },
  { title: "User Acceptance Testing", count: 15 },
];

export const VAL_TEST_NAMES = [
  "VPN Tunnel Connectivity", "DICOM Echo Test (C-ECHO)", "HL7 Port Connectivity", "SSO / Active Directory Authentication",
  "ORM New Order (NW)", "ORM Cancel Order (CA)", "ORU Report Delivery", "ADT Patient Update", "Priority Routing (STAT)",
  "DICOM Store from Modality", "Prior Image Query/Retrieve", "Worklist (MWL) Query", "AI Routing (if applicable)",
  "End-to-End Order Workflow", "Radiologist Reading Workflow", "Tech QC Workflow", "Report Distribution", "STAT Escalation Path",
  "Downtime Recovery", "Reschedule a Study", "Cancel a Study", "End-to-End Study Completion", "Addendum Workflow",
  "CT Dose & Tech Sheet Integration", "BI-RADS Custom Report Insertion", "Lung-RADS / Lung CA Mapping", "Study Merge", "Study Split",
];

export function useHomeData(orgSlug: string) {
  // ── tRPC queries ────────────────────────────────────────────────────────────
  const { data: organization, isLoading: orgLoading } =
    trpc.organizations.getBySlug.useQuery(
      { slug: orgSlug },
      { enabled: !!orgSlug }
    );

  const { data: existingResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  const { data: allFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  const { data: validationData } = trpc.validation.getResults.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  const { data: implementationData } =
    trpc.implementation.getTasks.useQuery(
      { organizationSlug: orgSlug },
      { enabled: !!orgSlug }
    );

  const { data: specs = [] } = trpc.admin.getSpecifications.useQuery();

  // ── Connectivity ─────────────────────────────────────────────────────────
  const { data: connectivityData, isLoading: connectivityLoading } =
    trpc.connectivity.getForOrg.useQuery(
      { organizationSlug: orgSlug, organizationName: organization?.name },
      { enabled: !!orgSlug }
    );

  const [connRows, setConnRows] = useState<ConnectivityRow[]>([]);
  const notionPageIds = useRef<Set<string>>(new Set());
  const [connSaving, setConnSaving] = useState(false);

  useEffect(() => {
    if (connectivityData?.rows) {
      setConnRows(connectivityData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(connectivityData.rows.map((r: any) => r.id));
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
          createRowMutation.mutate(
            { organizationName: organization.name, row },
            {
              onSuccess: ({ pageId }) => {
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

  // ── Notes / Documents ────────────────────────────────────────────────────
  const { data: adhocFilesList = [], refetch: refetchAdhoc } = trpc.notes.listByOrg.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  const uploadAdhocMutation = trpc.notes.uploadForOrg.useMutation({
    onSuccess: () => { refetchAdhoc(); },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => { refetchAdhoc(); },
  });

  // ── File mutations ───────────────────────────────────────────────────────
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

  // ── Adhoc upload state & handlers ───────────────────────────────────────
  const [adhocFiles, setAdhocFiles] = useState<File[]>([]);
  const [adhocUploading, setAdhocUploading] = useState(false);
  const [notesLabel, setNotesLabel] = useState("Call Notes");
  const [notesCustomLabel, setNotesCustomLabel] = useState("");

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

  // ── Computed data ────────────────────────────────────────────────────────
  const responsesMap: Record<string, string> = {};
  existingResponses.forEach((r: any) => {
    if (r.questionId && r.response) {
      responsesMap[r.questionId] = r.response;
    }
  });

  const diagramFiles = allFiles.filter((f: any) => f.questionId === "ARCH.diagram");

  const allQuestions = questionnaireSections.flatMap((section) => {
    if (section.type === "workflow") {
      return [{ id: section.id + "_config", sectionTitle: section.title, isWorkflow: true, conditionalOn: null }];
    }
    return (section.questions || []).map((q) => ({
      id: q.id,
      sectionTitle: section.title,
      conditionalOn: q.conditionalOn || null,
    }));
  });

  const progress = calculateProgress(allQuestions, existingResponses, allFiles);
  const totalSections = Object.keys(progress.sectionProgress).length;
  const completedSections = Object.values(progress.sectionProgress).filter(
    (section: any) => section.completed === section.total
  ).length;

  // ── Validation stats ─────────────────────────────────────────────────────
  const valResults = validationData || {};
  const valEntries = Object.values(valResults) as any[];
  const valNaCount = valEntries.filter((v: any) => v.status === "N/A").length;
  const valTotal = 28;
  const valCompleted = valEntries.filter((v: any) => v.status === "Pass").length;
  const valFailedCount = Object.values(valResults as Record<string, any>).filter((v: any) => v.status === "Fail").length;
  const valInProgressCount = valEntries.filter((v: any) => v.status === "In Progress").length;
  const valBlockedCount = valEntries.filter((v: any) => v.status === "Blocked").length;
  const valNotTestedCount = valTotal - valCompleted - valFailedCount - valNaCount - valInProgressCount - valBlockedCount;

  // ── Implementation stats ─────────────────────────────────────────────────
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

  // ── Questionnaire section stats ──────────────────────────────────────────
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

  // ── Validation "next up" tests ───────────────────────────────────────────
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

  // ── Weighted progress ────────────────────────────────────────────────────
  const implApplicable = implTotal - implNaCount;
  const implWeightedScore = implApplicable > 0
    ? ((implCompleted + implInProgressCount * 0.5 + implBlockedCount * 0.25) / implApplicable) * 100
    : 0;

  const valApplicable = 28 - valNaCount;
  const valWeightedScore = valApplicable > 0
    ? ((valCompleted + valFailedCount * 0.25 + valInProgressCount * 0.5 + valBlockedCount * 0.25) / valApplicable) * 100
    : 0;

  const qPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  const vPct = valWeightedScore;
  const iPct = implWeightedScore;
  const overallPct = Math.round(qPct * 0.4 + vPct * 0.3 + iPct * 0.3);

  const qDone = completedSections === totalSections && totalSections > 0;
  const vDone = valCompleted === valTotal && valTotal > 0;
  const activePhase = !qDone ? "questionnaire" : !vDone ? "testing" : "implementation";

  // ── Specs by category ────────────────────────────────────────────────────
  const specsByCategory = new Map<string, any[]>();
  for (const spec of specs) {
    const cat = (spec as any).category || "General";
    if (!specsByCategory.has(cat)) specsByCategory.set(cat, []);
    specsByCategory.get(cat)!.push(spec);
  }

  return {
    // Org
    organization,
    orgLoading,
    orgName: organization?.name || "",
    partnerName: organization?.clientName || "",

    // Files
    allFiles,
    diagramFiles,
    specs,
    specsByCategory,

    // Connectivity
    connRows,
    connSaving,
    connectivityLoading,
    connectivityData,
    handleConnChange,

    // Notes/Documents
    adhocFilesList,
    adhocFiles,
    setAdhocFiles,
    adhocUploading,
    notesLabel,
    setNotesLabel,
    notesCustomLabel,
    setNotesCustomLabel,
    handleAdhocFileSelect,
    handleAdhocUpload,
    deleteNoteMutation,

    // Architecture
    handleRemoveDiagram,

    // Progress
    progress,
    totalSections,
    completedSections,
    overallPct,
    qPct,
    vPct,
    iPct,
    qDone,
    vDone,
    activePhase,

    // Questionnaire stats
    qInProgressSections,
    qNotStartedSections,
    nextUpSections,

    // Validation stats
    valResults,
    valTotal,
    valCompleted,
    valNaCount,
    valFailedCount,
    valInProgressCount,
    valBlockedCount,
    valNotTestedCount,
    valApplicable,
    nextUpTests,
    VAL_PHASES,

    // Implementation stats
    implCompleted,
    implNaCount,
    implTotal,
    implApplicable,
    implInProgressCount,
    implBlockedCount,
    implOpenCount,
    nextUpTasks,
    iPctRounded: Math.round(iPct),
  };
}
