/**
 * Data Quality Check — in-process MySQL integrity monitor
 *
 * Post-deployment companion to `scripts/data-quality-check.mjs`. The script is
 * the one-shot pre-flight gate run by hand before the constraint migrations;
 * this module runs the same checks *continuously* (daily, from cron.ts) to catch
 * residual gaps that slip past the now-deployed constraints — most importantly
 * orphaned/duplicate rows in the Notion-sourced caches (contacts, systems),
 * which sync in without FK enforcement.
 *
 * Severities:
 *   FAIL — a constraint-backed invariant is violated (should be impossible now;
 *          if seen, something bypassed the DB or a constraint was dropped)
 *   WARN — a Notion-sourced cache row points at a missing parent; transient
 *          during sync, worth surfacing but not an emergency
 */

import { sql } from "drizzle-orm";
import { requireDb } from "./db";

export type Severity = "PASS" | "FAIL" | "WARN";

export interface DataQualityFinding {
  status: Severity;
  test: string;
  detail: string;
}

export interface DataQualityResult {
  passed: number;
  failed: number;
  warnings: number;
  findings: DataQualityFinding[];
  ranAt: string;
  durationMs: number;
}

/**
 * §1 Referential integrity — child rows whose FK does not resolve to a parent.
 * [child, fkColumn, parent, parentKey, nullable, severity]
 * `nullable` columns only flag NON-NULL values that fail to resolve.
 */
const ORPHAN_CHECKS: Array<[string, string, string, string, boolean, "FAIL" | "WARN"]> = [
  ["organizations", "clientId", "clients", "id", true, "FAIL"],
  ["users", "organizationId", "organizations", "id", true, "FAIL"],
  ["users", "clientId", "clients", "id", true, "FAIL"],
  ["responses", "organizationId", "organizations", "id", false, "FAIL"],
  ["responses", "questionId", "questions", "id", false, "FAIL"],
  ["question_options", "questionId", "questions", "id", false, "FAIL"],
  ["sectionProgress", "organizationId", "organizations", "id", false, "FAIL"],
  ["taskCompletion", "organizationId", "organizations", "id", false, "FAIL"],
  ["fileAttachments", "organizationId", "organizations", "id", false, "FAIL"],
  ["validationResults", "organizationId", "organizations", "id", false, "FAIL"],
  ["intakeResponses", "organizationId", "organizations", "id", false, "FAIL"],
  ["intakeFileAttachments", "organizationId", "organizations", "id", false, "FAIL"],
  ["activityFeed", "organizationId", "organizations", "id", false, "FAIL"],
  ["onboardingFeedback", "organizationId", "organizations", "id", false, "FAIL"],
  ["orgCustomTasks", "organizationId", "organizations", "id", false, "FAIL"],
  ["taskOrgAssignment", "organizationId", "organizations", "id", false, "FAIL"],
  ["taskOrgAssignment", "implOrgId", "implementationOrgs", "id", false, "FAIL"],
  ["implementationOrgs", "organizationId", "organizations", "id", false, "FAIL"],
  ["partnerTemplates", "clientId", "clients", "id", false, "FAIL"],
  ["partnerTaskTemplates", "clientId", "clients", "id", false, "FAIL"],
  ["partnerDocuments", "clientId", "clients", "id", false, "FAIL"],
  ["partnerDocAudit", "documentId", "partnerDocuments", "id", false, "FAIL"],
  ["passwordResetTokens", "userId", "users", "id", false, "FAIL"],
  ["orgNotes", "organizationId", "organizations", "id", true, "FAIL"],
  ["orgNotes", "clientId", "clients", "id", true, "FAIL"],
  // Notion is the source of truth for these — orphans mean a stale cache row,
  // worth reviewing but not a blocker for MySQL-owned constraints.
  ["contacts", "organizationId", "organizations", "id", false, "WARN"],
  ["systems", "organizationId", "organizations", "id", false, "WARN"],
];

/**
 * §2 Uniqueness — logical keys the portal upserts on.
 * Post-constraint these should always be clean; a duplicate means a write path
 * bypassed the unique index (or the index was dropped).
 */
const UNIQUE_CHECKS: Array<[string, string[]]> = [
  ["intakeResponses", ["organizationId", "questionId"]],
  ["responses", ["organizationId", "questionId"]],
  ["taskCompletion", ["organizationId", "taskId"]],
  ["validationResults", ["organizationId", "testKey"]],
  ["sectionProgress", ["organizationId", "sectionName"]],
  ["taskOrgAssignment", ["organizationId", "taskId"]],
  ["question_options", ["questionId", "optionValue"]],
];

// Table/column names below come exclusively from the hardcoded constants above,
// never from user input, so sql.raw() interpolation carries no injection risk.
type Db = Awaited<ReturnType<typeof requireDb>>;

async function rawRows(db: Db, query: string): Promise<any[]> {
  const result: any = await db.execute(sql.raw(query));
  // mysql2 driver returns [rows, fields]; be defensive in case of shape drift.
  return Array.isArray(result) ? (result[0] as any[]) : (result as any[]);
}

async function checkOrphans(db: Db, record: (s: Severity, t: string, d?: string) => void): Promise<void> {
  for (const [child, fk, parent, pk, nullable, severity] of ORPHAN_CHECKS) {
    const nullGuard = nullable ? `c.\`${fk}\` IS NOT NULL AND` : "";
    const query = `
      SELECT c.\`${fk}\` AS val, COUNT(*) AS cnt
      FROM \`${child}\` c
      LEFT JOIN \`${parent}\` p ON p.\`${pk}\` = c.\`${fk}\`
      WHERE ${nullGuard} p.\`${pk}\` IS NULL
      GROUP BY c.\`${fk}\`
      LIMIT 10`;
    const label = `${child}.${fk} → ${parent}.${pk}`;
    try {
      const rows = await rawRows(db, query);
      if (rows.length === 0) {
        record("PASS", label, "no orphans");
      } else {
        const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
        record(
          severity,
          `${label} — ${total}+ orphan row(s)`,
          rows.slice(0, 5).map((r) => `${fk}=${r.val} (×${r.cnt})`).join("; ")
        );
      }
    } catch (e: any) {
      record("WARN", label, `check errored: ${e.message}`);
    }
  }

  // orgNotes must have at least one owner (organizationId OR clientId)
  try {
    const rows = await rawRows(
      db,
      `SELECT COUNT(*) AS cnt FROM orgNotes WHERE organizationId IS NULL AND clientId IS NULL`
    );
    const cnt = Number(rows[0]?.cnt ?? 0);
    if (cnt === 0) record("PASS", "orgNotes has an owner (orgId or clientId)");
    else record("FAIL", `orgNotes ownerless rows: ${cnt}`, "both organizationId and clientId are NULL");
  } catch (e: any) {
    record("WARN", "orgNotes owner check", `errored: ${e.message}`);
  }
}

async function checkUniqueness(db: Db, record: (s: Severity, t: string, d?: string) => void): Promise<void> {
  for (const [table, cols] of UNIQUE_CHECKS) {
    const colList = cols.map((c) => `\`${c}\``).join(", ");
    const query = `
      SELECT ${colList}, COUNT(*) AS cnt
      FROM \`${table}\`
      GROUP BY ${colList}
      HAVING cnt > 1
      LIMIT 10`;
    const label = `${table} unique(${cols.join(", ")})`;
    try {
      const rows = await rawRows(db, query);
      if (rows.length === 0) {
        record("PASS", label, "no duplicates");
      } else {
        record(
          "FAIL",
          `${label} — ${rows.length}+ duplicate group(s)`,
          rows
            .slice(0, 5)
            .map((r) => cols.map((c) => `${c}=${r[c]}`).join("/") + ` (×${r.cnt})`)
            .join("; ")
        );
      }
    } catch (e: any) {
      record("WARN", label, `check errored: ${e.message}`);
    }
  }
}

// Keep the most recent result in memory so the sync dashboard / health endpoint
// can surface it without re-running the (read-heavy) scan on every request.
let lastResult: DataQualityResult | null = null;

/** Last data-quality result, or null if the check has not run since startup. */
export function getLastDataQualityResult(): DataQualityResult | null {
  return lastResult ? { ...lastResult, findings: [...lastResult.findings] } : null;
}

/**
 * Run all data-quality checks against the live DB and cache the result.
 * Never throws — a DB-level failure is captured as a single WARN finding so the
 * cron job stays alive.
 */
export async function runDataQualityCheck(): Promise<DataQualityResult> {
  const start = Date.now();
  const findings: DataQualityFinding[] = [];
  const record = (status: Severity, test: string, detail = "") => findings.push({ status, test, detail });

  try {
    const db = await requireDb();
    await checkOrphans(db, record);
    await checkUniqueness(db, record);
  } catch (e: any) {
    record("WARN", "data-quality-check", `fatal: ${e?.message ?? String(e)}`);
  }

  const result: DataQualityResult = {
    passed: findings.filter((f) => f.status === "PASS").length,
    failed: findings.filter((f) => f.status === "FAIL").length,
    warnings: findings.filter((f) => f.status === "WARN").length,
    findings,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
  lastResult = result;
  return result;
}
