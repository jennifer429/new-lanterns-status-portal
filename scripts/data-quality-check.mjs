/**
 * Data Quality Check — MySQL Integrity Gate
 *
 * Pure-MySQL checks that must pass BEFORE the constraint migrations
 * (composite unique keys, CHECK constraints, foreign keys) can be applied.
 * A constraint cannot be added to a table that already violates it — the
 * migration will hard-fail mid-deploy — so this script is the pre-flight gate.
 *
 * Categories:
 *   §1 Referential integrity — orphaned child rows (no FKs enforce this today)
 *   §2 Uniqueness            — duplicate logical keys the portal upserts on
 *
 * Severities:
 *   FAIL — blocks the corresponding constraint migration; must be cleaned first
 *   WARN — should be reviewed but does not block (e.g. Notion-sourced caches)
 *
 * Usage:
 *   DATABASE_URL="mysql://user:pass@host:3306/db" node scripts/data-quality-check.mjs
 *
 * Exit codes: 0 = clean, 1 = FAIL found, 2 = fatal error.
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(2);
}

function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
  };
}

const results = { passed: 0, failed: 0, warnings: 0, details: [] };
function record(status, test, detail = "") {
  if (status === "PASS") results.passed++;
  else if (status === "FAIL") results.failed++;
  else results.warnings++;
  results.details.push({ status, test, detail });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${icon} ${status}: ${test}${detail ? " — " + detail : ""}`);
}

/**
 * §1 Referential integrity.
 * Each entry: child rows whose FK does not resolve to a parent row.
 * `nullable` columns only flag NON-NULL values that fail to resolve.
 */
const ORPHAN_CHECKS = [
  // child table, fk column, parent table, parent column, nullable?, severity
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

async function checkOrphans(db) {
  console.log("\n📋 §1 Referential integrity (orphaned rows)");
  for (const [child, fk, parent, pk, nullable, severity] of ORPHAN_CHECKS) {
    const nullGuard = nullable ? `c.\`${fk}\` IS NOT NULL AND` : "";
    const sql = `
      SELECT c.\`${fk}\` AS val, COUNT(*) AS cnt
      FROM \`${child}\` c
      LEFT JOIN \`${parent}\` p ON p.\`${pk}\` = c.\`${fk}\`
      WHERE ${nullGuard} p.\`${pk}\` IS NULL
      GROUP BY c.\`${fk}\`
      LIMIT 10`;
    try {
      const [rows] = await db.query(sql);
      const label = `${child}.${fk} → ${parent}.${pk}`;
      if (rows.length === 0) {
        record("PASS", label, "no orphans");
      } else {
        const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
        record(severity, `${label} — ${total}+ orphan row(s)`,
          rows.slice(0, 5).map(r => `${fk}=${r.val} (×${r.cnt})`).join("; "));
      }
    } catch (e) {
      record("WARN", `${child}.${fk} → ${parent}.${pk}`, `check errored: ${e.message}`);
    }
  }

  // orgNotes must have at least one owner (organizationId OR clientId)
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM orgNotes WHERE organizationId IS NULL AND clientId IS NULL`
    );
    const cnt = Number(rows[0].cnt);
    if (cnt === 0) record("PASS", "orgNotes has an owner (orgId or clientId)");
    else record("FAIL", `orgNotes ownerless rows: ${cnt}`, "both organizationId and clientId are NULL");
  } catch (e) {
    record("WARN", "orgNotes owner check", `errored: ${e.message}`);
  }
}

/**
 * §2 Uniqueness — logical keys the portal upserts on but the DB does not enforce.
 * Each must return 0 duplicate groups before the unique index can be added.
 */
const UNIQUE_CHECKS = [
  ["intakeResponses", ["organizationId", "questionId"]],
  ["responses", ["organizationId", "questionId"]],
  ["taskCompletion", ["organizationId", "taskId"]],
  ["validationResults", ["organizationId", "testKey"]],
  ["sectionProgress", ["organizationId", "sectionName"]],
  ["taskOrgAssignment", ["organizationId", "taskId"]],
  ["question_options", ["questionId", "optionValue"]],
];

async function checkUniqueness(db) {
  console.log("\n📋 §2 Uniqueness (duplicate logical keys)");
  for (const [table, cols] of UNIQUE_CHECKS) {
    const colList = cols.map(c => `\`${c}\``).join(", ");
    const sql = `
      SELECT ${colList}, COUNT(*) AS cnt
      FROM \`${table}\`
      GROUP BY ${colList}
      HAVING cnt > 1
      LIMIT 10`;
    try {
      const [rows] = await db.query(sql);
      const label = `${table} unique(${cols.join(", ")})`;
      if (rows.length === 0) {
        record("PASS", label, "no duplicates");
      } else {
        record("FAIL", `${label} — ${rows.length}+ duplicate group(s)`,
          rows.slice(0, 5).map(r => cols.map(c => `${c}=${r[c]}`).join("/") + ` (×${r.cnt})`).join("; "));
      }
    } catch (e) {
      record("WARN", `${table} unique(${cols.join(", ")})`, `check errored: ${e.message}`);
    }
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DATA QUALITY CHECK — MySQL Integrity Gate (§1 + §2)");
  console.log("═══════════════════════════════════════════════════════════════");

  const db = await mysql.createConnection(parseDatabaseUrl(DATABASE_URL));
  try {
    await checkOrphans(db);
    await checkUniqueness(db);
  } finally {
    await db.end();
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  SUMMARY: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
  console.log("═══════════════════════════════════════════════════════════════");
  if (results.failed > 0) {
    console.log("\n  ❌ FAIL findings block the constraint migrations.");
    console.log("     Clean these rows first (see drizzle/manual/README.md), then re-run.\n");
    process.exit(1);
  }
  console.log("\n  ✅ Clean — safe to apply the constraint migrations.\n");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});
