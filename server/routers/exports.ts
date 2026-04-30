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
import { protectedProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import {
  organizations,
  clients,
  intakeResponses,
  intakeFileAttachments,
  taskCompletion,
  validationResults,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { orgIdentifierMatches } from "../_core/orgLookup";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
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
    .where(orgIdentifierMatches(orgSlug))
    .limit(1);
  if (!org)
    throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

  // Partner
  let partnerName = "";
  if (org.clientId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, org.clientId))
      .limit(1);
    if (client) partnerName = client.name;
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
});
