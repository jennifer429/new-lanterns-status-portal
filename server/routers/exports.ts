/**
 * Export Router
 *
 * Provides two export endpoints for the site dashboard:
 * 1. statusReportHtml — generates a self-contained HTML document styled for PDF printing
 *    (users print-to-PDF from the browser, or we can use window.print())
 * 2. taskEmailHtml — generates a formatted HTML email body with remaining tasks in a table
 *
 * Both endpoints gather all org data server-side to ensure consistency with the dashboard.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { sendEmail } from "../email/send";
import { ENV } from "../_core/env";
import { storagePut } from "../storage";
import { renderDashboardSnapshotPng } from "../_core/dashboardSnapshot";
import {
  organizations,
  clients,
  users,
  intakeResponses,
  intakeFileAttachments,
  taskCompletion,
  validationResults,
} from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  syncTaskCompletionToNotion,
  syncValidationResultToNotion,
} from "../notionTaskValidation";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress, getIncompleteVisibleQuestionIds } from "@shared/progressCalculation";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "@shared/taskDefs";

// ---------------------------------------------------------------------------
// Validation phase definitions (mirrors client-side)
// ---------------------------------------------------------------------------
const VAL_PHASES = [
  {
    title: "Connectivity Validation",
    count: 4,
    tests: [
      "VPN Tunnel Connectivity",
      "DICOM Echo Test (C-ECHO)",
      "HL7 Port Connectivity",
      "SSO / Active Directory Authentication",
    ],
  },
  {
    title: "HL7 Message Validation",
    count: 5,
    tests: [
      "ORM New Order (NW)",
      "ORM Cancel Order (CA)",
      "ORU Report Delivery",
      "ADT Patient Update",
      "Priority Routing (STAT)",
    ],
  },
  {
    title: "Image Routing Validation",
    count: 4,
    tests: [
      "DICOM Store from Modality",
      "Prior Image Query/Retrieve",
      "Worklist (MWL) Query",
      "AI Routing (if applicable)",
    ],
  },
  {
    title: "User Acceptance Testing",
    count: 15,
    tests: [
      "End-to-End Order Workflow",
      "Radiologist Reading Workflow",
      "Tech QC Workflow",
      "Report Distribution",
      "STAT Escalation Path",
      "Downtime Recovery",
      "Reschedule a Study",
      "Cancel a Study",
      "End-to-End Study Completion",
      "Addendum Workflow",
      "CT Dose & Tech Sheet Integration",
      "BI-RADS Custom Report Insertion",
      "Lung-RADS / Lung CA Mapping",
      "Study Merge",
      "Study Split",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper: gather all org data for export
// ---------------------------------------------------------------------------
interface OrgExportData {
  org: {
    name: string;
    slug: string;
    clientSlug: string;
    contactName: string | null;
    contactEmail: string | null;
    startDate: string | null;
    goalDate: string | null;
    status: string;
  };
  partnerName: string;
  questionnaire: {
    completedSections: number;
    totalSections: number;
    pct: number;
    sectionProgress: Record<string, { completed: number; total: number }>;
    openQuestions: Array<{
      id: string;
      section: string;
      sectionCode: string;
      text: string;
    }>;
  };
  implementation: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    notApplicable: number;
    open: number;
    pct: number;
    tasks: Array<{
      id: string;
      title: string;
      section: string;
      description: string;
      status: "Completed" | "In Progress" | "Blocked" | "N/A" | "Open";
      owner: string | null;
      targetDate: string | null;
      notes: string | null;
    }>;
  };
  validation: {
    total: number;
    passed: number;
    failed: number;
    inProgress: number;
    blocked: number;
    notApplicable: number;
    notTested: number;
    pct: number;
    tests: Array<{
      key: string;
      name: string;
      phase: string;
      status: string;
      owner: string | null;
      notes: string | null;
    }>;
  };
  overallPct: number;
  generatedAt: string;
}

async function gatherOrgData(orgSlug: string): Promise<OrgExportData> {
  const db = await requireDb();

  // Org
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  if (!org)
    throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

  // Partner
  let partnerName = "";
  let clientSlug = "";
  if (org.clientId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, org.clientId))
      .limit(1);
    if (client) {
      partnerName = client.name;
      clientSlug = client.slug;
    }
  }

  // Questionnaire progress
  const responses = await db
    .select()
    .from(intakeResponses)
    .where(eq(intakeResponses.organizationId, org.id));
  const files = await db
    .select()
    .from(intakeFileAttachments)
    .where(eq(intakeFileAttachments.organizationId, org.id));

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

  const progress = calculateProgress(allQuestions, responses as any, files as any);

  // Open (incomplete, visible) questionnaire items, with section code + label
  // so the status email can deep-link straight to the question in intake.
  const qMeta = new Map<string, { section: string; sectionCode: string; text: string }>();
  for (const section of questionnaireSections) {
    if (section.type === "workflow") {
      qMeta.set(section.id + "_config", {
        section: section.title,
        sectionCode: section.id,
        text: `${section.title} workflow`,
      });
    }
    for (const q of section.questions || []) {
      if (q.inactive) continue;
      qMeta.set(q.id, { section: section.title, sectionCode: section.id, text: q.text });
    }
  }
  const openQuestions = getIncompleteVisibleQuestionIds(allQuestions, responses as any, files as any)
    .map((id) => {
      const m = qMeta.get(String(id));
      return m ? { id: String(id), ...m } : null;
    })
    .filter((x): x is { id: string; section: string; sectionCode: string; text: string } => x !== null);
  const totalSections = Object.keys(progress.sectionProgress).length;
  const completedSections = Object.values(progress.sectionProgress).filter(
    (s) => s.completed === s.total
  ).length;
  const qPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  // Implementation tasks
  const implRows = await db
    .select()
    .from(taskCompletion)
    .where(eq(taskCompletion.organizationId, org.id));
  const implMap: Record<string, any> = {};
  for (const row of implRows) {
    implMap[row.taskId] = {
      completed: row.completed === 1,
      notApplicable: row.notApplicable === 1,
      inProgress: row.inProgress === 1,
      blocked: row.blocked === 1,
      owner: row.completedBy ?? null,
      targetDate: row.targetDate ?? null,
      notes: row.notes ?? null,
    };
  }

  const allTaskDefs = TASK_SECTION_DEFS.flatMap((s) =>
    s.tasks.map((t) => ({ ...t, section: s.title }))
  );
  const implTotal = allTaskDefs.length;
  const implCompleted = allTaskDefs.filter(
    (t) => implMap[t.id]?.completed && !implMap[t.id]?.notApplicable
  ).length;
  const implNa = allTaskDefs.filter((t) => implMap[t.id]?.notApplicable).length;
  const implInProgress = allTaskDefs.filter(
    (t) => implMap[t.id]?.inProgress && !implMap[t.id]?.notApplicable
  ).length;
  const implBlocked = allTaskDefs.filter(
    (t) => implMap[t.id]?.blocked && !implMap[t.id]?.notApplicable
  ).length;
  const implOpen = implTotal - implCompleted - implNa - implInProgress - implBlocked;
  const implWeighted =
    implTotal > 0
      ? Math.round(
          ((implCompleted + implNa + implInProgress * 0.5 + implBlocked * 0.25) /
            implTotal) *
            100
        )
      : 0;

  const implTasks = allTaskDefs.map((t) => {
    const r = implMap[t.id];
    let status: "Completed" | "In Progress" | "Blocked" | "N/A" | "Open" = "Open";
    if (r?.notApplicable) status = "N/A";
    else if (r?.completed) status = "Completed";
    else if (r?.blocked) status = "Blocked";
    else if (r?.inProgress) status = "In Progress";
    return {
      id: t.id,
      title: t.title,
      section: t.section,
      description: t.description || "",
      status,
      owner: r?.owner ?? null,
      targetDate: r?.targetDate ?? null,
      notes: r?.notes ?? null,
    };
  });

  // Validation
  const valRows = await db
    .select()
    .from(validationResults)
    .where(eq(validationResults.organizationId, org.id));
  const valMap: Record<string, any> = {};
  for (const row of valRows) {
    valMap[row.testKey] = {
      status: row.status,
      owner: row.signOff,
      notes: row.notes,
    };
  }

  const valTotal = 28;
  let valPassed = 0,
    valFailed = 0,
    valInProg = 0,
    valBlocked = 0,
    valNa = 0;
  const valTests: OrgExportData["validation"]["tests"] = [];
  let phaseOffset = 0;
  for (const phase of VAL_PHASES) {
    for (let t = 0; t < phase.count; t++) {
      const key = `${phaseOffset}:${t}`;
      const v = valMap[key];
      const status = v?.status || "Not Tested";
      if (status === "Pass") valPassed++;
      else if (status === "Fail") valFailed++;
      else if (status === "In Progress") valInProg++;
      else if (status === "Blocked") valBlocked++;
      else if (status === "N/A") valNa++;
      valTests.push({
        key,
        name: phase.tests[t],
        phase: phase.title,
        status,
        owner: v?.owner ?? null,
        notes: v?.notes ?? null,
      });
    }
    phaseOffset++;
  }
  const valNotTested = valTotal - valPassed - valFailed - valInProg - valBlocked - valNa;
  const valWeighted =
    valTotal > 0
      ? Math.round(
          ((valPassed + valNa + valFailed * 0.25 + valInProg * 0.5 + valBlocked * 0.25) /
            valTotal) *
            100
        )
      : 0;

  // Overall
  const overallPct = Math.round(qPct * 0.4 + valWeighted * 0.3 + implWeighted * 0.3);

  return {
    org: {
      name: org.name,
      slug: org.slug,
      clientSlug,
      contactName: org.contactName,
      contactEmail: org.contactEmail,
      startDate: org.startDate,
      goalDate: org.goalDate,
      status: org.status,
    },
    partnerName,
    questionnaire: {
      completedSections,
      totalSections,
      pct: qPct,
      sectionProgress: progress.sectionProgress,
      openQuestions,
    },
    implementation: {
      total: implTotal,
      completed: implCompleted,
      inProgress: implInProgress,
      blocked: implBlocked,
      notApplicable: implNa,
      open: implOpen,
      pct: implWeighted,
      tasks: implTasks,
    },
    validation: {
      total: valTotal,
      passed: valPassed,
      failed: valFailed,
      inProgress: valInProg,
      blocked: valBlocked,
      notApplicable: valNa,
      notTested: valNotTested,
      pct: valWeighted,
      tests: valTests,
    },
    overallPct,
    generatedAt: new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    }),
  };
}

// ---------------------------------------------------------------------------
// HTML builders
// ---------------------------------------------------------------------------

function buildStatusReportHtml(data: OrgExportData): string {
  const statusColor = (pct: number) =>
    pct >= 100 ? "#10b981" : pct >= 50 ? "#8b5cf6" : "#f59e0b";

  const sectionRows = Object.entries(data.questionnaire.sectionProgress)
    .map(
      ([name, s]) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.completed}/${s.total}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.completed === s.total ? "✓ Complete" : "In Progress"}</td>
        </tr>`
    )
    .join("");

  // Implementation summary by section
  const implSectionSummary = TASK_SECTION_DEFS.map((sec) => {
    const secTasks = data.implementation.tasks.filter((t) => t.section === sec.title);
    const done = secTasks.filter((t) => t.status === "Completed" || t.status === "N/A").length;
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${sec.title}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${done}/${secTasks.length}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${done === secTasks.length ? "✓ Complete" : "In Progress"}</td>
    </tr>`;
  }).join("");

  // Validation summary by phase
  const valPhaseSummary = VAL_PHASES.map((phase) => {
    const phaseTests = data.validation.tests.filter((t) => t.phase === phase.title);
    const passed = phaseTests.filter((t) => t.status === "Pass" || t.status === "N/A").length;
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${phase.title}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${passed}/${phaseTests.length}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${passed === phaseTests.length ? "✓ Complete" : "In Progress"}</td>
    </tr>`;
  }).join("");

  // Blocked / attention items
  const blockedTasks = data.implementation.tasks.filter((t) => t.status === "Blocked");
  const failedTests = data.validation.tests.filter((t) => t.status === "Fail");
  const attentionItems = [
    ...blockedTasks.map((t) => `<li><strong>Task Blocked:</strong> ${t.title} (${t.section})${t.notes ? ` — ${t.notes}` : ""}</li>`),
    ...failedTests.map((t) => `<li><strong>Test Failed:</strong> ${t.name} (${t.phase})${t.notes ? ` — ${t.notes}` : ""}</li>`),
  ].join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Status Report — ${data.org.name}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }
    h2 { font-size: 18px; color: #374151; margin: 28px 0 12px; border-bottom: 2px solid #8b5cf6; padding-bottom: 4px; }
    h3 { font-size: 14px; color: #6b7280; margin: 16px 0 8px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .header-left { }
    .header-right { text-align: right; font-size: 12px; color: #6b7280; }
    .subtitle { font-size: 14px; color: #6b7280; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .stat-detail { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .overall-card { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 2px solid #8b5cf6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; }
    .overall-value { font-size: 48px; font-weight: 800; color: #7c3aed; }
    .overall-label { font-size: 14px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
    th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    .attention { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
    .attention ul { margin: 8px 0 0 20px; font-size: 13px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-complete { background: #d1fae5; color: #065f46; }
    .badge-progress { background: #ede9fe; color: #5b21b6; }
    .badge-blocked { background: #fee2e2; color: #991b1b; }
    .badge-open { background: #f3f4f6; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${data.org.name}</h1>
      <div class="subtitle">PACS Implementation Status Report${data.partnerName ? ` · ${data.partnerName}` : ""}</div>
    </div>
    <div class="header-right">
      <div>Generated: ${data.generatedAt}</div>
      ${data.org.contactName ? `<div>Contact: ${data.org.contactName}</div>` : ""}
      ${data.org.startDate ? `<div>Start: ${data.org.startDate}</div>` : ""}
      ${data.org.goalDate ? `<div>Goal: ${data.org.goalDate}</div>` : ""}
    </div>
  </div>

  <div class="overall-card">
    <div class="overall-value">${data.overallPct}%</div>
    <div class="overall-label">Overall Implementation Progress</div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" style="color:${statusColor(data.questionnaire.pct)}">${data.questionnaire.pct}%</div>
      <div class="stat-label">Questionnaire</div>
      <div class="stat-detail">${data.questionnaire.completedSections}/${data.questionnaire.totalSections} sections</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${statusColor(data.validation.pct)}">${data.validation.pct}%</div>
      <div class="stat-label">Validation Testing</div>
      <div class="stat-detail">${data.validation.passed + data.validation.notApplicable}/${data.validation.total} passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${statusColor(data.implementation.pct)}">${data.implementation.pct}%</div>
      <div class="stat-label">Implementation Tasks</div>
      <div class="stat-detail">${data.implementation.completed + data.implementation.notApplicable}/${data.implementation.total} done</div>
    </div>
  </div>

  ${attentionItems ? `
  <div class="attention">
    <strong>⚠ Items Needing Attention</strong>
    <ul>${attentionItems}</ul>
  </div>` : ""}

  <h2>Questionnaire Progress</h2>
  <table>
    <thead><tr><th>Section</th><th style="text-align:center;">Progress</th><th style="text-align:center;">Status</th></tr></thead>
    <tbody>${sectionRows}</tbody>
  </table>

  <h2>Implementation Tasks</h2>
  <table>
    <thead><tr><th>Section</th><th style="text-align:center;">Progress</th><th style="text-align:center;">Status</th></tr></thead>
    <tbody>${implSectionSummary}</tbody>
  </table>

  <h2>Validation Testing</h2>
  <table>
    <thead><tr><th>Phase</th><th style="text-align:center;">Progress</th><th style="text-align:center;">Status</th></tr></thead>
    <tbody>${valPhaseSummary}</tbody>
  </table>

  <div class="footer">
    New Lantern · PACS Implementation Status Report · ${data.generatedAt}
  </div>
</body>
</html>`;
}

function statusBadge(status: string): string {
  const map: Record<string, { cls: string; label: string }> = {
    Completed: { cls: "badge-complete", label: "Completed" },
    "In Progress": { cls: "badge-progress", label: "In Progress" },
    Blocked: { cls: "badge-blocked", label: "Blocked" },
    "N/A": { cls: "badge-open", label: "N/A" },
    Open: { cls: "badge-open", label: "Open" },
    Pass: { cls: "badge-complete", label: "Pass" },
    Fail: { cls: "badge-blocked", label: "Fail" },
    "Not Tested": { cls: "badge-open", label: "Not Tested" },
  };
  const m = map[status] || { cls: "badge-open", label: status };
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

function buildTaskEmailHtml(data: OrgExportData): string {
  // Only include remaining tasks (not completed, not N/A)
  const remainingTasks = data.implementation.tasks.filter(
    (t) => t.status !== "Completed" && t.status !== "N/A"
  );

  // Remaining validation tests
  const remainingTests = data.validation.tests.filter(
    (t) => t.status !== "Pass" && t.status !== "N/A"
  );

  const taskRows = remainingTasks
    .map(
      (t) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.section}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${statusBadge(t.status)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.owner || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.targetDate || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${t.notes || ""}</td>
        </tr>`
    )
    .join("");

  const testRows = remainingTests
    .map(
      (t) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.phase}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${statusBadge(t.status)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${t.notes || ""}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Remaining Tasks — ${data.org.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; color: #111827; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #374151; margin: 24px 0 10px; }
    .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
    .summary { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .summary-grid { display: flex; gap: 24px; flex-wrap: wrap; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 24px; font-weight: 700; color: #7c3aed; }
    .summary-label { font-size: 11px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
    th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; font-size: 12px; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-complete { background: #d1fae5; color: #065f46; }
    .badge-progress { background: #ede9fe; color: #5b21b6; }
    .badge-blocked { background: #fee2e2; color: #991b1b; }
    .badge-open { background: #f3f4f6; color: #6b7280; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
    .empty { padding: 20px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${data.org.name} — Remaining Items</h1>
    <div class="subtitle">PACS Implementation · ${data.generatedAt}${data.partnerName ? ` · ${data.partnerName}` : ""}</div>

    <div class="summary">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${data.overallPct}%</div>
          <div class="summary-label">Overall Progress</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${remainingTasks.length}</div>
          <div class="summary-label">Tasks Remaining</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${remainingTests.length}</div>
          <div class="summary-label">Tests Remaining</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.implementation.blocked + data.validation.tests.filter((t) => t.status === "Blocked").length}</div>
          <div class="summary-label">Blocked Items</div>
        </div>
      </div>
    </div>

    <h2>Remaining Implementation Tasks (${remainingTasks.length})</h2>
    ${remainingTasks.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th>Task</th>
          <th style="text-align:center;">Status</th>
          <th>Owner</th>
          <th>Target Date</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>` : `<div class="empty">All implementation tasks are complete! 🎉</div>`}

    <h2>Remaining Validation Tests (${remainingTests.length})</h2>
    ${remainingTests.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Phase</th>
          <th>Test</th>
          <th style="text-align:center;">Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${testRows}</tbody>
    </table>` : `<div class="empty">All validation tests have passed! 🎉</div>`}

    <div class="footer">
      New Lantern · Generated ${data.generatedAt} · This email was generated from the Implementation Status Portal
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Status-update email (Claude Design "Implementation Update" mockup)
// ---------------------------------------------------------------------------

export interface StatusUpdatePayload {
  orgName: string;
  partnerName?: string;
  subject: string;
  note: string;
  senderName?: string;
  recipientNames?: string[];
  dashboardUrl?: string;
  include: {
    progress: boolean;
    blockers: boolean;
    tasks: boolean;
    promptReply: boolean;
  };
  progress: {
    overall: number;
    stage: string; // "live" renders "Live" instead of a percentage
    q: number;
    qTotal: number;
    vPass: number;
    vTotal: number;
    tDone: number;
    tTotal: number;
  };
  blockers: Array<{ text: string; owner: string; link?: string; group?: string }>;
  tasks: Array<{ text: string; owner: string; due?: string; link?: string; group?: string }>;
  completed?: Array<{ text: string }>;
  /** Absolute URL of the rendered dashboard snapshot PNG (embedded + clickable). */
  dashboardImageUrl?: string;
}

/**
 * buildStatusUpdateEmailHtml — renders the admin-composed "Implementation
 * Update" email. Mirrors the dark New Lantern mail card from the Claude Design
 * mockup (note → progress snapshot → blockers → tasks/assignments → CTA →
 * reply prompt), email-client-safe with table layout + inline styles.
 */
export function buildStatusUpdateEmailHtml(p: StatusUpdatePayload): string {
  // Plain-email palette: it should read like a typed message, not a newsletter.
  const INK = "#18181B";
  const INK3 = "#8A8A93";
  const LINE = "#E5E5E5";
  const PURPLE = "#7C1EBD";
  // Figtree is requested via <link>, but email clients ignore web fonts — the
  // system stack below is the real fallback every client will render.
  const FONT =
    "'Figtree',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const esc = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const site = esc(p.orgName) || "your site";
  const link = (text: string, href?: string) =>
    href
      ? `<a href="${esc(href)}" style="color:${PURPLE};text-decoration:underline;">${text}</a>`
      : text;

  // Recipients greeted by first name, the way a person would type it.
  const joinNames = (ns: string[]) => {
    const u = Array.from(new Set(ns.map((n) => n.trim()).filter(Boolean)));
    if (u.length === 0) return "";
    if (u.length === 1) return u[0];
    if (u.length === 2) return `${u[0]} and ${u[1]}`;
    if (u.length <= 4) return `${u.slice(0, -1).join(", ")}, and ${u[u.length - 1]}`;
    return `${u.slice(0, 3).join(", ")}, and team`;
  };
  const names = joinNames(p.recipientNames || []);
  const greetLine = names ? `Hey ${esc(names)},` : p.orgName ? `Hi ${esc(p.orgName)} team,` : "Hi there,";

  // Plain prose paragraph / bold lead-in / bullet list helpers — no cards, no
  // pills, no progress bars in the body. It should read like an email.
  const para = (inner: string, mt = 16) =>
    `<p style="font:400 14.5px/1.62 ${FONT};color:${INK};margin:${mt}px 0 0;">${inner}</p>`;
  const lead = (inner: string, mt = 22) =>
    `<p style="font:700 14.5px/1.5 ${FONT};color:${INK};margin:${mt}px 0 0;">${inner}</p>`;
  const bullets = (items: string[]) =>
    `<ul style="margin:7px 0 0;padding:0 0 0 22px;">${items
      .map(
        (li) =>
          `<li style="font:400 14.5px/1.55 ${FONT};color:${INK};margin:0 0 7px;">${li}</li>`
      )
      .join("")}</ul>`;

  // "This week we completed:"
  const completedHtml =
    p.completed && p.completed.length
      ? lead("This week we completed:") + bullets(p.completed.map((c) => esc(c.text)))
      : "";

  // Follow-up items, grouped by the person who owns them ("@Nikki — ...").
  let followupsHtml = "";
  if (p.include.tasks && p.tasks.length) {
    const groups = new Map<string, typeof p.tasks>();
    for (const t of p.tasks) {
      const key = t.owner?.trim() || "Your team";
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
    }
    for (const [owner, items] of groups) {
      followupsHtml +=
        lead(`@${esc(owner)} — follow-up items for ${site}:`) +
        bullets(
          items.map((t) => {
            const title = link(esc(t.text) || "—", t.link);
            const meta = t.due ? ` <span style="color:${INK3};">(due ${esc(t.due)})</span>` : "";
            return `${title}${meta}`;
          })
        );
    }
  }

  // "The following items are blocked:"
  const blockedHtml =
    p.include.blockers && p.blockers.length
      ? lead("The following items are blocked:") +
        bullets(
          p.blockers.map((b) => {
            const title = link(esc(b.text) || "—", b.link);
            const why = b.group ? ` — ${esc(b.group)}` : "";
            const who = b.owner ? ` <span style="color:${INK3};">(${esc(b.owner)})</span>` : "";
            return `${title}${why}${who}`;
          })
        )
      : "";

  // Closing line + reply-all nudge, then the clickable dashboard screenshot.
  const replyBit = p.include.promptReply
    ? " — or just reply all and send them back to me"
    : "";
  const closing = p.dashboardUrl
    ? para(
        `You can make updates right on the implementation site (screenshot below — ${link(
          "click to log in",
          p.dashboardUrl
        )})${replyBit}.`
      )
    : p.include.promptReply
      ? para("Just reply all with any updates and I'll get them in.")
      : "";

  const signHtml = p.senderName
    ? para(`Thanks,<br><span style="font-weight:600;">${esc(p.senderName)}</span>`, 20)
    : "";

  // The dashboard "screenshot": a real PNG (generated server-side) embedded and
  // linked to login. Falls back to a plain link if the image isn't available.
  const snapshotHtml = p.dashboardImageUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td>
        <a href="${esc(p.dashboardUrl || p.dashboardImageUrl)}" style="text-decoration:none;display:block;">
          <img src="${esc(p.dashboardImageUrl)}" width="100%" alt="${site} implementation dashboard — click to log in" style="display:block;width:100%;max-width:540px;border:1px solid ${LINE};border-radius:10px;" />
        </a>
        <div style="font:400 12px/1.4 ${FONT};color:${INK3};margin-top:8px;">${link(
          "Open the implementation site &rarr;",
          p.dashboardUrl
        )}</div>
      </td></tr></table>`
    : p.dashboardUrl
      ? para(link("Open the implementation site &rarr;", p.dashboardUrl), 24)
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <title>${esc(p.subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width:600px) {
      .nl-wrap { padding:20px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;">
        <tr><td class="nl-wrap" style="padding:30px 28px 26px;">
          <p style="font:400 14.5px/1.6 ${FONT};color:${INK};margin:0;">${greetLine}</p>
          ${para(esc(p.note))}
          ${completedHtml}
          ${followupsHtml}
          ${blockedHtml}
          ${closing}
          ${signHtml}
          ${snapshotHtml}
          <p style="font:400 11px/1.5 ${FONT};color:${INK3};margin:26px 0 0;border-top:1px solid ${LINE};padding-top:14px;">Please don't reply with protected health information (PHI) — share files through the secure site portal. You're receiving this as a named contact on the ${site} implementation${p.partnerName ? " · " + esc(p.partnerName) : ""}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const exportsRouter = router({
  /**
   * Generate a full status report as self-contained HTML (for print-to-PDF)
   */
  statusReport: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const data = await gatherOrgData(input.organizationSlug);
      return {
        html: buildStatusReportHtml(data),
        filename: `${data.org.slug}-status-report-${new Date().toISOString().slice(0, 10)}.html`,
        orgName: data.org.name,
        overallPct: data.overallPct,
      };
    }),

  /**
   * Generate a formatted email HTML with remaining tasks table
   */
  taskEmail: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const data = await gatherOrgData(input.organizationSlug);
      const remainingTasks = data.implementation.tasks.filter(
        (t) => t.status !== "Completed" && t.status !== "N/A"
      ).length;
      const remainingTests = data.validation.tests.filter(
        (t) => t.status !== "Pass" && t.status !== "N/A"
      ).length;
      return {
        html: buildTaskEmailHtml(data),
        filename: `${data.org.slug}-remaining-tasks-${new Date().toISOString().slice(0, 10)}.html`,
        orgName: data.org.name,
        remainingTasks,
        remainingTests,
        overallPct: data.overallPct,
      };
    }),

  /**
   * Pre-fill the admin "Send status update" composer (Claude Design mockup).
   *
   * Returns everything the composer needs from LIVE data:
   *  - `recipients`  — prepopulated To list: this site's users + the partner's
   *                    admins (the admin can paste more, split on , or ;).
   *  - `assignees`   — real people on the site (+ contact roles) for owner pickers.
   *  - `catalog`     — every implementation task + validation test, browseable
   *                    so the admin selects real items instead of retyping.
   *  - `blockers` / `tasks` — a sensible pre-selection, each linked back to its
   *                    source task/test (kind + sourceId) so edits feed back.
   */
  statusUpdateDraft: protectedProcedure
    .input(z.object({ organizationSlug: z.string() }))
    .query(async ({ input }) => {
      const data = await gatherOrgData(input.organizationSlug);
      const db = await requireDb();
      const [orgRow] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);

      const stage = data.org.status === "completed" ? "live" : "implementing";

      // ── People on the site: named contacts (shown by first name) first, then
      // site users + this partner's admins. ──────────────────────────────────
      const recipients: Array<{ label: string; email: string }> = [];
      const assigneeSet = new Map<string, string>(); // value → label
      const seenEmail = new Set<string>();
      if (orgRow) {
        // Named contacts from the intake A.contacts table → the "To" row shows
        // each person by first name (e.g. "Pranay · IT Connectivity").
        const CONTACT_ROLE_LABELS: Record<string, string> = {
          admin: "Administrative",
          it: "IT Connectivity",
          it_post_prod: "IT Post-Production Support",
          clinical: "Clinical",
          radiologist: "Radiologist Champion",
          pm: "Project Manager",
        };
        const [contactsRow] = await db
          .select({ response: intakeResponses.response })
          .from(intakeResponses)
          .where(
            and(
              eq(intakeResponses.organizationId, orgRow.id),
              eq(intakeResponses.questionId, "A.contacts")
            )
          )
          .limit(1);
        if (contactsRow?.response) {
          try {
            const contacts = JSON.parse(contactsRow.response) as Record<
              string,
              { name?: string; email?: string; phone?: string }
            >;
            for (const [roleKey, c] of Object.entries(contacts)) {
              const email = (c?.email || "").trim();
              const name = (c?.name || "").trim();
              const role = CONTACT_ROLE_LABELS[roleKey] || roleKey;
              const firstName = name ? name.split(/\s+/)[0] : "";
              if (name) assigneeSet.set(name, firstName || name);
              if (email && !seenEmail.has(email.toLowerCase())) {
                seenEmail.add(email.toLowerCase());
                recipients.push({
                  label: firstName ? `${firstName} · ${role}` : role,
                  email,
                });
              }
            }
          } catch {
            /* malformed contacts JSON — fall back to portal users below */
          }
        }

        const peopleRows = await db
          .select({
            name: users.name,
            email: users.email,
            role: users.role,
            organizationId: users.organizationId,
            clientId: users.clientId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.isActive, 1));
        for (const u of peopleRows) {
          const isSiteUser = u.organizationId === orgRow.id;
          const isPartnerAdmin =
            u.role === "admin" && !!orgRow.clientId && u.clientId === orgRow.clientId;
          if (!isSiteUser && !isPartnerAdmin) continue;
          const display = (u.name || u.email || "").trim();
          const email = (u.email || "").trim();
          if (email && !seenEmail.has(email.toLowerCase())) {
            seenEmail.add(email.toLowerCase());
            const firstName = display ? display.split(/\s+/)[0] : "";
            recipients.push({
              label: `${firstName || display || email}${isPartnerAdmin ? " · Partner" : " · Site"}`,
              email,
            });
          }
          if (display) assigneeSet.set(display, display.split(/\s+/)[0] || display);
        }
      }
      // Owner pickers: real people first, then the standard contact roles.
      const CONTACT_ROLES = [
        "Administrative",
        "IT Connectivity",
        "IT Post-Production Support",
        "Clinical",
        "Radiologist Champion",
        "Project Manager",
      ];
      const assignees = [...assigneeSet.keys(), ...CONTACT_ROLES.filter((r) => !assigneeSet.has(r))];

      // ── Deep links: each item points at its exact spot in the portal. A
      // logged-out click is bounced through login and returned here (the
      // intake/validation/implement pages scroll + highlight the item). ──────
      const base = ENV.siteBaseUrl
        ? `${ENV.siteBaseUrl.replace(/\/$/, "")}/org/${data.org.clientSlug}/${data.org.slug}`
        : "";
      const enc = encodeURIComponent;
      const taskLink = (id: string) => (base ? `${base}/implement?task=${enc(id)}` : "");
      const testLink = (key: string) => (base ? `${base}/validation?t=${enc(key)}` : "");
      const questionLink = (sectionCode: string, id: string) =>
        base ? `${base}/intake?section=${enc(sectionCode)}&q=${enc(id)}` : "";

      // ── Browseable catalog: every open question + task + test, linked to its source ─
      const mkQuestion = (q: OrgExportData["questionnaire"]["openQuestions"][number]) => ({
        id: `question:${q.id}`,
        kind: "question" as const,
        sourceId: q.id,
        group: q.section,
        text: q.text,
        owner: "",
        due: "",
        status: "Open",
        link: questionLink(q.sectionCode, q.id),
      });
      const mkTask = (t: OrgExportData["implementation"]["tasks"][number]) => ({
        id: `task:${t.id}`,
        kind: "task" as const,
        sourceId: t.id,
        group: t.section,
        text: t.title,
        owner: t.owner || "",
        due: t.targetDate || "",
        status: t.status,
        link: taskLink(t.id),
      });
      const mkTest = (t: OrgExportData["validation"]["tests"][number]) => ({
        id: `test:${t.key}`,
        kind: "test" as const,
        sourceId: t.key,
        group: t.phase,
        text: t.name,
        owner: t.owner || "",
        due: "",
        status: t.status,
        link: testLink(t.key),
      });
      const catalog = [
        ...data.questionnaire.openQuestions.map(mkQuestion),
        ...data.implementation.tasks.map(mkTask),
        ...data.validation.tests.map(mkTest),
      ];

      // Pre-selected blockers (blocked tasks + failed/blocked tests).
      const blockers = catalog
        .filter(
          (it) =>
            (it.kind === "task" && it.status === "Blocked") ||
            (it.kind === "test" && (it.status === "Fail" || it.status === "Blocked"))
        )
        .map((it) => ({ ...it, owner: it.owner || "IT Connectivity" }));

      // Pre-selected "next ups" — every open / in-progress task + every
      // outstanding test (not just a sample). Admin trims what they don't want.
      const blockerIds = new Set(blockers.map((b) => b.id));
      const tasks = catalog
        .filter(
          (it) =>
            !blockerIds.has(it.id) &&
            ((it.kind === "task" && (it.status === "In Progress" || it.status === "Open")) ||
              (it.kind === "test" && (it.status === "Not Tested" || it.status === "In Progress")))
        )
        .map((it) => ({
          ...it,
          owner: it.owner || (it.kind === "task" ? "Project Manager" : "Radiologist Champion"),
        }));

      const overall = stage === "live" ? 100 : data.overallPct;

      // Browseable catalog excludes resolved work — passed/N/A tests and
      // completed/N/A tasks — so admins can only add still-open items.
      const DONE_STATUSES = new Set(["Pass", "N/A", "Completed"]);
      const browseCatalog = catalog.filter((it) => !DONE_STATUSES.has(it.status));

      const note =
        stage === "live"
          ? `Quick wrap-up below — your site is live. I've left the final status from the implementation portal so you have it on record, plus anything still open.`
          : `Below is our latest update from the implementation portal. There are a few next steps for your team further down — take a look when you get a chance and let me know if anything's unclear.`;

      return {
        orgName: data.org.name,
        partnerName: data.partnerName,
        subject: `${data.org.name} — New Lantern onboarding update (${stage === "live" ? "Live" : overall + "% complete"})`,
        note,
        stage,
        progress: {
          overall,
          stage,
          q: data.questionnaire.completedSections,
          qTotal: data.questionnaire.totalSections,
          vPass: data.validation.passed + data.validation.notApplicable,
          vTotal: data.validation.total,
          tDone: data.implementation.completed + data.implementation.notApplicable,
          tTotal: data.implementation.total,
        },
        recipients,
        assignees,
        catalog: browseCatalog,
        blockers,
        tasks,
      };
    }),

  /**
   * Send the admin-composed status update. Admin-only; partner admins are
   * scoped to their own client's organizations. The final email HTML is built
   * server-side from the composed payload (recipients never see raw HTML).
   *
   * Side effects:
   *  - CCs the sending admin and signs the email with their name.
   *  - Writes the chosen owner + status back to the linked task / test records
   *    (blockers → Blocked, tasks → In Progress) and mirrors to Notion.
   */
  sendStatusUpdate: adminProcedure
    .input(
      z.object({
        organizationSlug: z.string(),
        to: z.array(z.string().email()).min(1, "At least one recipient is required"),
        toNames: z.array(z.string()).optional(),
        cc: z.array(z.string().email()).optional(),
        subject: z.string().min(1, "Subject is required"),
        note: z.string().default(""),
        include: z.object({
          progress: z.boolean(),
          blockers: z.boolean(),
          tasks: z.boolean(),
          promptReply: z.boolean(),
        }),
        progress: z.object({
          overall: z.number(),
          stage: z.string(),
          q: z.number(),
          qTotal: z.number(),
          vPass: z.number(),
          vTotal: z.number(),
          tDone: z.number(),
          tTotal: z.number(),
        }),
        blockers: z.array(
          z.object({
            text: z.string(),
            owner: z.string(),
            kind: z.enum(["task", "test", "question"]).optional(),
            sourceId: z.string().optional(),
            group: z.string().optional(),
            link: z.string().optional(),
          })
        ),
        tasks: z.array(
          z.object({
            text: z.string(),
            owner: z.string(),
            due: z.string().optional(),
            kind: z.enum(["task", "test", "question"]).optional(),
            sourceId: z.string().optional(),
            group: z.string().optional(),
            link: z.string().optional(),
          })
        ),
        writeBack: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.organizationSlug))
        .limit(1);
      if (!org)
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      // Partner admins may only send for their own client's organizations.
      if (ctx.user.clientId && org.clientId !== ctx.user.clientId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only send updates for your own organizations",
        });
      }

      let partnerName = "";
      let dashboardUrl: string | undefined;
      if (org.clientId) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, org.clientId))
          .limit(1);
        if (client) {
          partnerName = client.name;
          if (ENV.siteBaseUrl) {
            dashboardUrl = `${ENV.siteBaseUrl.replace(/\/$/, "")}/org/${client.slug}/${org.slug}`;
          }
        }
      }

      // Sender identity → signature + auto-CC.
      const senderEmail = ctx.user.email ?? undefined;
      const senderName =
        ctx.user.name?.trim() || (senderEmail ? senderEmail.split("@")[0] : "New Lantern");
      const cc = Array.from(
        new Set([...(input.cc ?? []), ...(senderEmail ? [senderEmail] : [])])
      ).filter((e) => !input.to.includes(e));

      // Safety net: never email or write back already-resolved work, even if
      // the client submitted it — drop completed/N/A tasks and passed/N/A
      // tests by re-checking their live status here. (Free-text and
      // questionnaire items, which have no completion record, always pass.)
      const resolvedSourceIds = new Set<string>();
      {
        const linked = [...input.blockers, ...input.tasks];
        const taskIds = linked.filter((i) => i.kind === "task" && i.sourceId).map((i) => i.sourceId!);
        const testKeys = linked.filter((i) => i.kind === "test" && i.sourceId).map((i) => i.sourceId!);
        if (taskIds.length) {
          const rows = await db
            .select()
            .from(taskCompletion)
            .where(and(eq(taskCompletion.organizationId, org.id), inArray(taskCompletion.taskId, taskIds)));
          for (const r of rows) if (r.notApplicable === 1 || r.completed === 1) resolvedSourceIds.add(r.taskId);
        }
        if (testKeys.length) {
          const rows = await db
            .select()
            .from(validationResults)
            .where(and(eq(validationResults.organizationId, org.id), inArray(validationResults.testKey, testKeys)));
          for (const r of rows) if (r.status === "Pass" || r.status === "N/A") resolvedSourceIds.add(r.testKey);
        }
      }
      const keepItem = (i: { kind?: string; sourceId?: string }) =>
        !(i.kind && i.sourceId && resolvedSourceIds.has(i.sourceId));
      const sendBlockers = input.blockers.filter(keepItem);
      const sendTasks = input.tasks.filter(keepItem);

      // Render the dashboard "screenshot" (a real PNG) and upload it so the
      // email can embed it and link it to login. Best-effort: if rendering or
      // upload fails, the email falls back to a plain link.
      let dashboardImageUrl: string | undefined;
      try {
        const png = await renderDashboardSnapshotPng({
          orgName: org.name,
          partnerName,
          live: input.progress.stage === "live",
          pct: input.progress.overall,
          q: input.progress.q,
          qTotal: input.progress.qTotal,
          vPass: input.progress.vPass,
          vTotal: input.progress.vTotal,
          tDone: input.progress.tDone,
          tTotal: input.progress.tTotal,
        });
        if (png) {
          const { url } = await storagePut(
            `status-snapshots/${org.slug}-${Date.now()}.png`,
            png,
            "image/png"
          );
          dashboardImageUrl = url;
        }
      } catch (err) {
        console.warn("[sendStatusUpdate] dashboard snapshot failed:", err);
      }

      const html = buildStatusUpdateEmailHtml({
        orgName: org.name,
        partnerName,
        subject: input.subject,
        note: input.note,
        senderName,
        recipientNames: input.toNames,
        dashboardUrl,
        dashboardImageUrl,
        include: input.include,
        progress: input.progress,
        blockers: input.include.blockers ? sendBlockers : [],
        tasks: input.include.tasks ? sendTasks : [],
      });

      const sent = await sendEmail({
        to: input.to,
        cc: cc.length ? cc : undefined,
        subject: input.subject,
        html,
        type: "task_status",
        organizationId: org.id,
        triggeredBy: senderEmail,
      });

      if (!sent)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Email could not be sent — check email configuration",
        });

      // ── Write owner + status back to the linked task / test records ─────────
      let writtenBack = 0;
      if (input.writeBack) {
        const items = [
          ...(input.include.blockers ? sendBlockers.map((b) => ({ ...b, bucket: "blocker" as const })) : []),
          ...(input.include.tasks ? sendTasks.map((t) => ({ ...t, bucket: "task" as const })) : []),
        ];
        for (const it of items) {
          if (!it.kind || !it.sourceId) continue; // custom free-text item, nothing to link
          try {
            if (it.kind === "task") {
              const [existing] = await db
                .select()
                .from(taskCompletion)
                .where(
                  and(
                    eq(taskCompletion.organizationId, org.id),
                    eq(taskCompletion.taskId, it.sourceId)
                  )
                )
                .limit(1);
              const blocked = it.bucket === "blocker";
              const dueVal = "due" in it ? it.due : undefined;
              const payload = {
                completedBy: it.owner || null,
                blocked: blocked ? 1 : existing?.blocked ?? 0,
                inProgress: blocked ? 0 : 1,
                completed: existing?.completed ?? 0,
                notApplicable: existing?.notApplicable ?? 0,
                targetDate: dueVal || existing?.targetDate || null,
                sectionName: it.group || existing?.sectionName || "",
              };
              if (existing) {
                await db
                  .update(taskCompletion)
                  .set({ ...payload, notionLastEdited: null })
                  .where(eq(taskCompletion.id, existing.id));
              } else {
                await db
                  .insert(taskCompletion)
                  .values({ organizationId: org.id, taskId: it.sourceId, ...payload, notionLastEdited: null });
              }
              syncTaskCompletionToNotion({
                organizationId: org.id,
                orgSlug: org.slug,
                orgName: org.name,
                taskId: it.sourceId,
                sectionName: payload.sectionName,
                completed: payload.completed,
                inProgress: payload.inProgress,
                blocked: payload.blocked,
                notApplicable: payload.notApplicable,
                completedAt: null,
                completedBy: payload.completedBy,
                targetDate: payload.targetDate,
                notes: null,
              }).catch((err) => console.error("[notion-task] write-back error:", err));
              writtenBack++;
            } else if (it.kind === "test") {
              const status: "Blocked" | "In Progress" =
                it.bucket === "blocker" ? "Blocked" : "In Progress";
              const [existing] = await db
                .select()
                .from(validationResults)
                .where(
                  and(
                    eq(validationResults.organizationId, org.id),
                    eq(validationResults.testKey, it.sourceId)
                  )
                )
                .limit(1);
              // Don't clobber a passed/N/A test by re-opening it.
              if (existing && (existing.status === "Pass" || existing.status === "N/A")) continue;
              const payload = { status, signOff: it.owner || null, updatedBy: senderEmail ?? null };
              if (existing) {
                await db
                  .update(validationResults)
                  .set({ ...payload, notionLastEdited: null })
                  .where(eq(validationResults.id, existing.id));
              } else {
                await db
                  .insert(validationResults)
                  .values({ organizationId: org.id, testKey: it.sourceId, ...payload, notionLastEdited: null });
              }
              syncValidationResultToNotion({
                organizationId: org.id,
                orgSlug: org.slug,
                orgName: org.name,
                testKey: it.sourceId,
                actual: existing?.actual ?? null,
                status,
                signOff: payload.signOff,
                notes: existing?.notes ?? null,
                testedDate: existing?.testedDate ?? null,
                updatedBy: payload.updatedBy,
              }).catch((err) => console.error("[notion-validation] write-back error:", err));
              writtenBack++;
            }
          } catch (err) {
            console.error("[status-update] write-back failed for", it.kind, it.sourceId, err);
          }
        }
      }

      return { sent: true, count: input.to.length, cc, writtenBack };
    }),
});
