/**
 * One-shot: read every row from the existing (locked-away) Notion
 * connectivity database, create a brand-new database under a page YOU
 * have access to, and copy the rows over so you can browse them in the UI.
 *
 * Why this exists: the original connectivity DB was created by an
 * integration in a workspace/page that the human admin can't reach in the
 * Notion UI. The integration token still has full read/write, so we can
 * proxy the data into a destination of your choice.
 *
 * Reads:
 *   NOTION_API_KEY                     – required (same token the app uses)
 *   NOTION_CONNECTIVITY_DATABASE_ID    – source; falls back to
 *   NOTION_CONNECTIVITY_DATASOURCE_ID  – then to
 *   NOTION_DATABASE_ID
 *
 *   MIRROR_PARENT_PAGE_ID              – the page under which the new
 *                                        database is created. Must have
 *                                        the integration connected.
 *                                        If not set, the script searches
 *                                        for MIRROR_PARENT_PAGE_TITLE.
 *   MIRROR_PARENT_PAGE_TITLE           – fallback search target,
 *                                        default "Connectivity Mirror"
 *   MIRROR_DATABASE_TITLE              – title of the new database,
 *                                        default "Connectivity (mirror)"
 *
 *   SLUG_FILTER                        – optional, comma-separated list of
 *                                        site values. If set, only rows
 *                                        whose Site contains one of these
 *                                        (case-insensitive substring) are
 *                                        copied. Otherwise: copy everything.
 *
 * Usage:
 *   node scripts/mirror-connectivity-db.mjs              # dry-run
 *   node scripts/mirror-connectivity-db.mjs --apply      # create + copy
 *
 * Re-running with --apply creates a NEW mirror database each time. Delete
 * old ones manually if you don't want duplicates.
 */
import 'dotenv/config';

const NOTION_VERSION = '2025-09-03';
const DEFAULT_PARENT_TITLE = 'Connectivity Mirror';
const DEFAULT_DB_TITLE = 'Connectivity (mirror)';

const apply = process.argv.includes('--apply');
const apiKey = process.env.NOTION_API_KEY;
const sourceDbId =
  process.env.NOTION_CONNECTIVITY_DATABASE_ID ||
  process.env.NOTION_CONNECTIVITY_DATASOURCE_ID ||
  process.env.NOTION_DATABASE_ID;
const parentPageId = process.env.MIRROR_PARENT_PAGE_ID;
const parentTitle = process.env.MIRROR_PARENT_PAGE_TITLE || DEFAULT_PARENT_TITLE;
const newDbTitle = process.env.MIRROR_DATABASE_TITLE || DEFAULT_DB_TITLE;
const slugFilter = (process.env.SLUG_FILTER || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

if (!apiKey) {
  console.error('NOTION_API_KEY is not set');
  process.exit(1);
}
if (!sourceDbId) {
  console.error('Source DB ID (NOTION_CONNECTIVITY_DATABASE_ID / DATASOURCE_ID / DATABASE_ID) is not set');
  process.exit(1);
}

async function notion(path, init = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body && typeof body === 'object' ? body.message || JSON.stringify(body) : body;
    const err = new Error(`Notion ${res.status} ${res.statusText}: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function readPageTitle(props) {
  if (!props) return '';
  for (const v of Object.values(props)) {
    if (v && v.type === 'title') return (v.title || []).map((t) => t.plain_text).join('');
  }
  return '';
}

function readSiteValue(props) {
  const candidates = ['site', 'organization', 'org', 'client', 'site name', 'facility'];
  const lc = Object.fromEntries(Object.entries(props || {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const c of candidates) {
    const p = lc[c];
    if (!p) continue;
    switch (p.type) {
      case 'title':     return (p.title || []).map((t) => t.plain_text).join('');
      case 'rich_text': return (p.rich_text || []).map((t) => t.plain_text).join('');
      case 'select':    return p.select?.name ?? '';
      case 'status':    return p.status?.name ?? '';
      default:          return '';
    }
  }
  return '';
}

// Build a property-schema definition suitable for POST /v1/databases.
// We strip read-only and relation/rollup/formula types that can't be
// recreated standalone, and convert status → select (status is read-only).
function buildTargetSchema(sourceProps) {
  const out = {};
  for (const [name, def] of Object.entries(sourceProps)) {
    switch (def.type) {
      case 'title':       out[name] = { title: {} }; break;
      case 'rich_text':   out[name] = { rich_text: {} }; break;
      case 'number':      out[name] = { number: { format: def.number?.format || 'number' } }; break;
      case 'checkbox':    out[name] = { checkbox: {} }; break;
      case 'url':         out[name] = { url: {} }; break;
      case 'email':       out[name] = { email: {} }; break;
      case 'phone_number':out[name] = { phone_number: {} }; break;
      case 'date':        out[name] = { date: {} }; break;
      case 'select':      out[name] = { select: { options: def.select?.options?.map((o) => ({ name: o.name, color: o.color })) || [] } }; break;
      case 'multi_select':out[name] = { multi_select: { options: def.multi_select?.options?.map((o) => ({ name: o.name, color: o.color })) || [] } }; break;
      case 'status':      // status type can't be created via API; degrade to select
                          out[name] = { select: { options: def.status?.options?.map((o) => ({ name: o.name, color: o.color })) || [] } }; break;
      // skip everything we can't recreate cleanly
      case 'relation':
      case 'rollup':
      case 'formula':
      case 'created_time':
      case 'created_by':
      case 'last_edited_time':
      case 'last_edited_by':
      case 'files':
      case 'people':
      case 'unique_id':
      case 'verification':
      default:
        // intentional drop
        break;
    }
  }
  // Notion requires exactly one title property; if source had none (shouldn't happen) add one.
  if (!Object.values(out).some((v) => 'title' in v)) {
    out['Name'] = { title: {} };
  }
  return out;
}

// Convert a source page's property *values* into a payload for the new DB.
// We pass values through by type; types we dropped in the schema are skipped.
function copyRowProperties(sourceProps, targetSchema) {
  const targetByLcName = Object.fromEntries(
    Object.entries(targetSchema).map(([k, v]) => [k.toLowerCase(), { propName: k, propDef: v }])
  );
  const out = {};
  for (const [srcName, val] of Object.entries(sourceProps)) {
    const hit = targetByLcName[srcName.toLowerCase()];
    if (!hit) continue;
    const targetType = Object.keys(hit.propDef)[0];
    switch (val.type) {
      case 'title':
        out[hit.propName] = { title: (val.title || []).map((t) => ({ text: { content: t.plain_text } })) };
        break;
      case 'rich_text':
        out[hit.propName] = { rich_text: (val.rich_text || []).map((t) => ({ text: { content: t.plain_text } })) };
        break;
      case 'number':
        if (val.number != null) out[hit.propName] = { number: val.number };
        break;
      case 'checkbox':
        out[hit.propName] = { checkbox: Boolean(val.checkbox) };
        break;
      case 'url':
        if (val.url) out[hit.propName] = { url: val.url };
        break;
      case 'email':
        if (val.email) out[hit.propName] = { email: val.email };
        break;
      case 'phone_number':
        if (val.phone_number) out[hit.propName] = { phone_number: val.phone_number };
        break;
      case 'date':
        if (val.date) out[hit.propName] = { date: val.date };
        break;
      case 'select':
        if (val.select?.name) out[hit.propName] = { select: { name: val.select.name } };
        break;
      case 'multi_select':
        if (val.multi_select?.length) out[hit.propName] = { multi_select: val.multi_select.map((s) => ({ name: s.name })) };
        break;
      case 'status':
        // source status → target select
        if (val.status?.name && targetType === 'select') out[hit.propName] = { select: { name: val.status.name } };
        break;
      default:
        break;
    }
  }
  return out;
}

console.log(`[mirror] mode=${apply ? 'APPLY' : 'DRY-RUN'} version=${NOTION_VERSION}`);
console.log(`[mirror] source DB: ${sourceDbId}`);

// 1. Read source DB schema.
let sourceDb;
try {
  sourceDb = await notion(`/databases/${sourceDbId}`);
} catch (err) {
  console.error(`Could not retrieve source DB: ${err.message}`);
  process.exit(1);
}
const sourceTitle = (sourceDb.title || []).map((t) => t.plain_text).join('') || '(untitled)';
console.log(`[mirror] source title: ${sourceTitle}`);
console.log(`[mirror] source properties: ${Object.keys(sourceDb.properties).join(', ')}`);

// 2. Resolve destination parent page.
let resolvedParent = parentPageId;
if (!resolvedParent) {
  console.log(`[mirror] searching for parent page "${parentTitle}"…`);
  const search = await notion('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: parentTitle,
      filter: { property: 'object', value: 'page' },
      page_size: 25,
    }),
  });
  const matches = (search.results || []).filter((r) => {
    if (r.object !== 'page') return false;
    return readPageTitle(r.properties).trim().toLowerCase() === parentTitle.trim().toLowerCase();
  });
  if (matches.length === 0) {
    console.error('');
    console.error(`No page titled "${parentTitle}" is connected to this integration.`);
    console.error('Fix: create a page in Notion (any workspace you control),');
    console.error('open it → ••• → Connections → add your integration, then re-run.');
    console.error('Or set MIRROR_PARENT_PAGE_ID directly.');
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple pages titled "${parentTitle}" found — set MIRROR_PARENT_PAGE_ID to choose:`);
    for (const m of matches) console.error(`  · ${m.id}  ${m.url}`);
    process.exit(1);
  }
  resolvedParent = matches[0].id;
  console.log(`[mirror] destination parent: ${resolvedParent}  (${matches[0].url})`);
} else {
  console.log(`[mirror] destination parent: ${resolvedParent}  (from MIRROR_PARENT_PAGE_ID)`);
  // sanity check we can see it
  try {
    await notion(`/pages/${resolvedParent}`);
  } catch (err) {
    console.error(`Could not retrieve destination parent page: ${err.message}`);
    console.error('Hint: add your integration to that page via ••• → Connections.');
    process.exit(1);
  }
}

// 3. Build target schema (drop unsupported types).
const targetSchema = buildTargetSchema(sourceDb.properties);
const droppedProps = Object.entries(sourceDb.properties)
  .filter(([name]) => !(name in targetSchema))
  .map(([name, def]) => `${name} (${def.type})`);
if (droppedProps.length) {
  console.log(`[mirror] dropping unsupported properties: ${droppedProps.join(', ')}`);
}

// 4. Query all source rows (paginated).
const dataSourceId =
  process.env.NOTION_CONNECTIVITY_DATASOURCE_ID ||
  process.env.NOTION_CONNECTIVITY_DATABASE_ID ||
  process.env.NOTION_DATABASE_ID ||
  sourceDbId;

async function queryAllRows() {
  const rows = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    let resp;
    try {
      // v5 path
      resp = await notion(`/data_sources/${dataSourceId}/query`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.status === 404) {
        // older API: fall back to databases.query
        resp = await notion(`/databases/${sourceDbId}/query`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else {
        throw err;
      }
    }
    for (const r of resp.results || []) {
      if (r.object !== 'page' || r.archived) continue;
      rows.push(r);
    }
    cursor = resp.next_cursor;
  } while (cursor);
  return rows;
}

console.log('[mirror] querying source rows…');
const allRows = await queryAllRows();
console.log(`[mirror] total non-archived rows: ${allRows.length}`);

// 5. Apply slug filter (if any).
let rowsToCopy = allRows;
if (slugFilter.length) {
  rowsToCopy = allRows.filter((p) => {
    const site = readSiteValue(p.properties).toLowerCase();
    return slugFilter.some((s) => site.includes(s));
  });
  console.log(`[mirror] rows matching SLUG_FILTER [${slugFilter.join(', ')}]: ${rowsToCopy.length}`);
}

// Print a per-site summary (handy diagnostic — confirms the data exists).
const bySite = new Map();
for (const r of rowsToCopy) {
  const k = readSiteValue(r.properties) || '(no site)';
  bySite.set(k, (bySite.get(k) || 0) + 1);
}
console.log('[mirror] row counts by Site value:');
for (const [site, n] of [...bySite.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`           ${n.toString().padStart(4)}  ${site}`);
}

if (!apply) {
  console.log('');
  console.log('(dry-run — re-run with --apply to create the mirror DB and copy rows)');
  process.exit(0);
}

// 6. Create the new database under the destination parent.
console.log('');
console.log(`[mirror] creating new database "${newDbTitle}" under ${resolvedParent}…`);
const newDb = await notion('/databases', {
  method: 'POST',
  body: JSON.stringify({
    parent: { type: 'page_id', page_id: resolvedParent },
    title: [{ type: 'text', text: { content: newDbTitle } }],
    properties: targetSchema,
  }),
});
console.log(`[mirror] new database created: ${newDb.id}  (${newDb.url || '(no url)'})`);

// 7. Copy rows.
let copied = 0;
const errors = [];
for (const row of rowsToCopy) {
  try {
    const props = copyRowProperties(row.properties, targetSchema);
    await notion('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: newDb.id },
        properties: props,
      }),
    });
    copied++;
    if (copied % 25 === 0) console.log(`  · copied ${copied}/${rowsToCopy.length}`);
  } catch (err) {
    errors.push({ pageId: row.id, error: err.message });
    console.error(`  ! failed to copy ${row.id}: ${err.message}`);
  }
}

console.log('');
console.log(`Done.`);
console.log(`  copied : ${copied}/${rowsToCopy.length}`);
console.log(`  errors : ${errors.length}`);
console.log(`  new db : ${newDb.url || newDb.id}`);

if (errors.length) process.exit(1);
