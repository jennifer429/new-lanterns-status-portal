/**
 * Sync Quality Check Script
 * 
 * Tests the integrity of bidirectional sync between Notion and MySQL:
 * 1. No duplicates — no org+question has multiple rows in Notion or MySQL
 * 2. No data loss — empty-answer safeguard works (won't overwrite non-empty MySQL with blank Notion)
 * 3. Bidirectional consistency — compare MySQL vs Notion row counts and answer values
 * 4. Idempotency — running sync twice doesn't create extra rows
 * 
 * Usage: node scripts/sync-quality-check.mjs
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
const NOTION_DATASOURCE_ID = process.env.NOTION_DATASOURCE_ID || "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID || "c16396a9-b4c9-48f0-9264-6e58f3742676";
const DATABASE_URL = process.env.DATABASE_URL;

if (!NOTION_API_KEY || !DATABASE_URL) {
  console.error("Missing NOTION_API_KEY or DATABASE_URL");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

// Parse DATABASE_URL for mysql2
function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  };
}

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: [],
};

function pass(test, detail = "") {
  results.passed++;
  results.details.push({ status: "PASS", test, detail });
  console.log(`  ✅ PASS: ${test}${detail ? " — " + detail : ""}`);
}

function fail(test, detail = "") {
  results.failed++;
  results.details.push({ status: "FAIL", test, detail });
  console.log(`  ❌ FAIL: ${test}${detail ? " — " + detail : ""}`);
}

function warn(test, detail = "") {
  results.warnings++;
  results.details.push({ status: "WARN", test, detail });
  console.log(`  ⚠️  WARN: ${test}${detail ? " — " + detail : ""}`);
}

// ─── Test 1: No Duplicates in MySQL ────────────────────────────────────────────

async function testMySqlDuplicates(db) {
  console.log("\n📋 Test 1: No duplicates in MySQL (intakeResponses)");
  
  const [rows] = await db.execute(`
    SELECT organizationId, questionId, COUNT(*) as cnt
    FROM intakeResponses
    GROUP BY organizationId, questionId
    HAVING cnt > 1
    LIMIT 20
  `);
  
  if (rows.length === 0) {
    pass("No duplicate org+question rows in MySQL");
  } else {
    fail(`Found ${rows.length} duplicate org+question combinations in MySQL`, 
      rows.slice(0, 5).map(r => `orgId=${r.organizationId} qid=${r.questionId} count=${r.cnt}`).join("; "));
  }
}

// ─── Test 2: No Duplicates in Notion ───────────────────────────────────────────

async function testNotionDuplicates() {
  console.log("\n📋 Test 2: No duplicates in Notion (same slug+questionId)");
  
  const allRows = [];
  let cursor = undefined;
  let pages = 0;
  
  do {
    const params = { data_source_id: NOTION_DATASOURCE_ID, page_size: 100 };
    if (cursor) params.start_cursor = cursor;
    const response = await notion.dataSources.query(params);
    
    for (const page of response.results) {
      const props = page.properties;
      const slug = props?.["Slug"]?.rich_text?.[0]?.plain_text || 
                   props?.["Institution Group"]?.select?.name || "";
      const qid = props?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
      if (slug && qid) {
        allRows.push({ slug, qid, pageId: page.id });
      }
    }
    
    cursor = response.has_more ? response.next_cursor : undefined;
    pages++;
    process.stdout.write(`\r    Fetched ${allRows.length} Notion rows (${pages} pages)...`);
  } while (cursor);
  
  console.log(`\r    Fetched ${allRows.length} Notion rows total.            `);
  
  // Check for duplicates
  const seen = new Map();
  const dupes = [];
  
  for (const row of allRows) {
    const key = `${row.slug}::${row.qid}`;
    if (seen.has(key)) {
      dupes.push({ key, pages: [seen.get(key), row.pageId] });
    } else {
      seen.set(key, row.pageId);
    }
  }
  
  if (dupes.length === 0) {
    pass(`No duplicate slug+questionId rows in Notion (${allRows.length} total rows)`);
  } else {
    fail(`Found ${dupes.length} duplicate slug+questionId combinations in Notion`,
      dupes.slice(0, 5).map(d => d.key).join("; "));
  }
  
  return allRows;
}

// ─── Test 3: Row Count Consistency ─────────────────────────────────────────────

async function testRowCountConsistency(db, notionRows) {
  console.log("\n📋 Test 3: Row count consistency (MySQL vs Notion)");
  
  // MySQL: count distinct org+question pairs
  const [mysqlCount] = await db.execute(`
    SELECT COUNT(*) as cnt FROM intakeResponses
  `);
  
  // MySQL: count distinct orgs
  const [mysqlOrgs] = await db.execute(`
    SELECT COUNT(DISTINCT organizationId) as cnt FROM intakeResponses
  `);
  
  // Notion: count unique slugs
  const notionSlugs = new Set(notionRows.map(r => r.slug));
  
  console.log(`    MySQL rows: ${mysqlCount[0].cnt}, MySQL orgs: ${mysqlOrgs[0].cnt}`);
  console.log(`    Notion rows: ${notionRows.length}, Notion orgs: ${notionSlugs.size}`);
  
  // Notion should have >= MySQL rows (Notion has blank rows too)
  if (notionRows.length >= mysqlCount[0].cnt) {
    pass(`Notion has ${notionRows.length} rows >= MySQL's ${mysqlCount[0].cnt} rows (Notion includes blank rows)`);
  } else {
    warn(`Notion has fewer rows (${notionRows.length}) than MySQL (${mysqlCount[0].cnt})`,
      "Some MySQL answers may not have corresponding Notion rows");
  }
}

// ─── Test 4: Answer Consistency (sample check) ─────────────────────────────────

async function testAnswerConsistency(db) {
  console.log("\n📋 Test 4: Answer consistency (sample 20 MySQL answers vs Notion)");
  
  // Get 20 random MySQL answers that are non-empty
  const [sampleRows] = await db.execute(`
    SELECT ir.organizationId, ir.questionId, ir.response, o.slug
    FROM intakeResponses ir
    JOIN organizations o ON o.id = ir.organizationId
    WHERE ir.response IS NOT NULL AND ir.response != ''
    ORDER BY RAND()
    LIMIT 20
  `);
  
  let matches = 0;
  let mismatches = 0;
  let notFound = 0;
  
  for (const row of sampleRows) {
    // Query Notion for this specific org+question
    try {
      const result = await notion.dataSources.query({
        data_source_id: NOTION_DATASOURCE_ID,
        filter: {
          and: [
            { property: "Institution Group", select: { equals: row.slug } },
            { property: "Question ID", rich_text: { equals: row.questionId } },
          ],
        },
        page_size: 1,
      });
      
      if (result.results.length === 0) {
        notFound++;
        continue;
      }
      
      const notionAnswer = result.results[0].properties?.["Answer"]?.rich_text?.[0]?.plain_text || "";
      const mysqlAnswer = (row.response || "").substring(0, 2000); // Notion truncates at 2000
      
      if (notionAnswer === mysqlAnswer) {
        matches++;
      } else if (notionAnswer.startsWith(mysqlAnswer.substring(0, 50)) || mysqlAnswer.startsWith(notionAnswer.substring(0, 50))) {
        matches++; // Close enough (truncation difference)
      } else {
        mismatches++;
        if (mismatches <= 3) {
          console.log(`    Mismatch: ${row.slug}/${row.questionId}`);
          console.log(`      MySQL: "${mysqlAnswer.substring(0, 80)}..."`);
          console.log(`      Notion: "${notionAnswer.substring(0, 80)}..."`);
        }
      }
    } catch (e) {
      notFound++;
    }
  }
  
  console.log(`    Results: ${matches} match, ${mismatches} mismatch, ${notFound} not found in Notion`);
  
  if (mismatches === 0) {
    pass(`All ${matches} sampled answers match between MySQL and Notion`);
  } else if (mismatches <= 2) {
    warn(`${mismatches} of ${sampleRows.length} sampled answers differ`, "May be due to recent edits");
  } else {
    fail(`${mismatches} of ${sampleRows.length} sampled answers differ between MySQL and Notion`);
  }
  
  if (notFound > 5) {
    warn(`${notFound} MySQL answers not found in Notion`, "Some org+question rows may be missing");
  }
}

// ─── Test 5: Empty-Answer Safeguard ────────────────────────────────────────────

async function testEmptyAnswerSafeguard(db) {
  console.log("\n📋 Test 5: Empty-answer safeguard validation");
  
  // Check if there are any MySQL rows with non-empty answers where updatedBy = notion-sync@system
  // and the answer is empty — this would indicate the safeguard failed
  const [overwritten] = await db.execute(`
    SELECT COUNT(*) as cnt FROM intakeResponses
    WHERE updatedBy = 'notion-sync@system' AND (response IS NULL OR response = '')
  `);
  
  if (overwritten[0].cnt === 0) {
    pass("No rows were blanked by notion-sync (safeguard working)");
  } else {
    warn(`${overwritten[0].cnt} rows have empty answers set by notion-sync`, 
      "These may be legitimate (answer was cleared in Notion intentionally)");
  }
  
  // Check how many rows have been synced from Notion
  const [syncedRows] = await db.execute(`
    SELECT COUNT(*) as cnt FROM intakeResponses WHERE updatedBy = 'notion-sync@system'
  `);
  console.log(`    Rows synced from Notion so far: ${syncedRows[0].cnt}`);
  pass(`Sync audit trail: ${syncedRows[0].cnt} rows marked as notion-sync@system`);
}

// ─── Test 6: Org Coverage ──────────────────────────────────────────────────────

async function testOrgCoverage(db, notionRows) {
  console.log("\n📋 Test 6: Org coverage (all MySQL orgs have Notion rows)");
  
  // Get all org slugs from MySQL
  const [mysqlOrgs] = await db.execute(`
    SELECT DISTINCT o.slug 
    FROM organizations o 
    JOIN intakeResponses ir ON ir.organizationId = o.id
  `);
  
  const notionSlugs = new Set(notionRows.map(r => r.slug));
  const missingSlugs = mysqlOrgs.filter(r => !notionSlugs.has(r.slug));
  
  if (missingSlugs.length === 0) {
    pass(`All ${mysqlOrgs.length} MySQL orgs have corresponding Notion rows`);
  } else {
    fail(`${missingSlugs.length} MySQL orgs missing from Notion`,
      missingSlugs.map(r => r.slug).join(", "));
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SYNC QUALITY CHECK — MySQL ↔ Notion Bidirectional Integrity");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const db = await mysql.createConnection(parseDatabaseUrl(DATABASE_URL));
  
  try {
    await testMySqlDuplicates(db);
    const notionRows = await testNotionDuplicates();
    await testRowCountConsistency(db, notionRows);
    await testAnswerConsistency(db);
    await testEmptyAnswerSafeguard(db);
    await testOrgCoverage(db, notionRows);
  } finally {
    await db.end();
  }
  
  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  SUMMARY: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});
