/**
 * One-shot: rewrite the "Site" column on every Notion connectivity row that
 * still says "RRMC" so it matches the renamed org slug "RRAL". After PR #71
 * aligned the local org slug RRMC → RRAL and PR #76 made the slug immutable,
 * Notion-side rows kept their original "RRMC" Site label, so the connectivity
 * matcher (server/routers/connectivity.ts → siteMatchesOrg) filters them out
 * and the page renders blank.
 *
 * Reads:
 *   NOTION_API_KEY                         – required
 *   NOTION_CONNECTIVITY_DATASOURCE_ID      – preferred; falls back to
 *   NOTION_CONNECTIVITY_DATABASE_ID        – then to
 *   NOTION_DATABASE_ID
 *
 * Safe to re-run: skips rows whose Site value is already non-RRMC.
 *
 * Usage:
 *   node scripts/fix-rral-notion-site.mjs               # dry-run, prints planned updates
 *   node scripts/fix-rral-notion-site.mjs --apply       # actually write to Notion
 */
import 'dotenv/config';
import { Client } from '@notionhq/client';

const OLD_SITE = 'RRMC';
const NEW_SITE = 'RRAL';

const apply = process.argv.includes('--apply');
const apiKey = process.env.NOTION_API_KEY;
const dsId =
  process.env.NOTION_CONNECTIVITY_DATASOURCE_ID ||
  process.env.NOTION_CONNECTIVITY_DATABASE_ID ||
  process.env.NOTION_DATABASE_ID;

if (!apiKey) {
  console.error('NOTION_API_KEY is not set');
  process.exit(1);
}
if (!dsId) {
  console.error('NOTION_CONNECTIVITY_DATASOURCE_ID (or DATABASE_ID) is not set');
  process.exit(1);
}

const client = new Client({ auth: apiKey });

// Matches connectivity.ts → FIELD_CANDIDATES.site, in priority order.
const SITE_FIELD_CANDIDATES = ['Site', 'Organization', 'Org', 'Client', 'Site Name', 'Facility'];

function pickSiteEntry(properties) {
  const lc = Object.fromEntries(
    Object.entries(properties).map(([k, v]) => [k.toLowerCase(), [k, v]]),
  );
  for (const candidate of SITE_FIELD_CANDIDATES) {
    const hit = lc[candidate.toLowerCase()];
    if (hit) return { name: hit[0], prop: hit[1] };
  }
  return null;
}

function readPropString(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':     return prop.title.map((t) => t.plain_text).join('');
    case 'rich_text': return prop.rich_text.map((t) => t.plain_text).join('');
    case 'select':    return prop.select?.name ?? '';
    case 'status':    return prop.status?.name ?? '';
    default:          return '';
  }
}

function buildSiteUpdate(propType, value) {
  switch (propType) {
    case 'title':     return { title: [{ text: { content: value } }] };
    case 'rich_text': return { rich_text: [{ text: { content: value } }] };
    case 'select':    return { select: { name: value } };
    case 'status':    return null; // status is read-only in Notion
    default:          return { rich_text: [{ text: { content: value } }] };
  }
}

console.log(`[fix-rral-notion-site] mode=${apply ? 'APPLY' : 'DRY-RUN'} data_source_id=${dsId}`);

let cursor = undefined;
let scanned = 0;
let toUpdate = 0;
let updated = 0;
let skippedReadonly = 0;
const failures = [];

do {
  const response = await client.dataSources.query({
    data_source_id: dsId,
    page_size: 100,
    start_cursor: cursor,
  });

  for (const page of response.results) {
    if (page.object !== 'page' || page.archived) continue;
    scanned++;

    const entry = pickSiteEntry(page.properties);
    if (!entry) continue;

    const currentValue = readPropString(entry.prop);
    if (currentValue.trim().toUpperCase() !== OLD_SITE.toUpperCase()) continue;

    toUpdate++;
    const replacement = buildSiteUpdate(entry.prop.type, NEW_SITE);
    if (!replacement) {
      skippedReadonly++;
      console.warn(
        `  · ${page.id}  Site="${currentValue}"  → SKIP (Site field is type "${entry.prop.type}", read-only)`,
      );
      continue;
    }

    console.log(`  · ${page.id}  "${entry.name}": "${currentValue}" → "${NEW_SITE}"`);

    if (apply) {
      try {
        await client.pages.update({
          page_id: page.id,
          properties: { [entry.name]: replacement },
        });
        updated++;
      } catch (err) {
        failures.push({ pageId: page.id, error: err?.message ?? String(err) });
        console.error(`    ! update failed: ${err?.message ?? err}`);
      }
    }
  }

  cursor = response.next_cursor;
} while (cursor);

console.log('');
console.log(`Scanned    : ${scanned}`);
console.log(`Eligible   : ${toUpdate}  (Site === "${OLD_SITE}")`);
if (apply) {
  console.log(`Updated    : ${updated}`);
  console.log(`Failed     : ${failures.length}`);
} else {
  console.log(`(dry-run — re-run with --apply to commit these updates)`);
}
if (skippedReadonly > 0) {
  console.log(`Skipped (read-only Site field): ${skippedReadonly}`);
}

if (failures.length > 0) {
  process.exit(1);
}
