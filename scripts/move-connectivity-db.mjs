/**
 * One-shot: move the Notion connectivity database under the
 * "Integration Connection Registry" page.
 *
 * Prerequisites (in Notion):
 *   1. Integration must be connected to the CURRENT parent of the
 *      connectivity database.
 *   2. Integration must be connected to the "Integration Connection
 *      Registry" page (open the page → ••• → Connections → add).
 *
 * Reads:
 *   NOTION_API_KEY                         – required
 *   NOTION_CONNECTIVITY_DATABASE_ID        – preferred; falls back to
 *   NOTION_CONNECTIVITY_DATASOURCE_ID      – then to
 *   NOTION_DATABASE_ID
 *
 *   DESTINATION_PAGE_TITLE                 – optional override
 *                                            (default: "Integration Connection Registry")
 *   DESTINATION_PAGE_ID                    – optional, skip the title search
 *
 * Usage:
 *   node scripts/move-connectivity-db.mjs              # dry-run
 *   node scripts/move-connectivity-db.mjs --apply      # commit the move
 */
import 'dotenv/config';

const NOTION_VERSION = '2025-09-03';
const DEFAULT_DEST_TITLE = 'Integration Connection Registry';

const apply = process.argv.includes('--apply');
const apiKey = process.env.NOTION_API_KEY;
const dbId =
  process.env.NOTION_CONNECTIVITY_DATABASE_ID ||
  process.env.NOTION_CONNECTIVITY_DATASOURCE_ID ||
  process.env.NOTION_DATABASE_ID;
const destTitle = process.env.DESTINATION_PAGE_TITLE || DEFAULT_DEST_TITLE;
const explicitDestId = process.env.DESTINATION_PAGE_ID;

if (!apiKey) {
  console.error('NOTION_API_KEY is not set');
  process.exit(1);
}
if (!dbId) {
  console.error('NOTION_CONNECTIVITY_DATABASE_ID (or DATASOURCE_ID / DATABASE_ID) is not set');
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

function readTitle(props) {
  if (!props || typeof props !== 'object') return '';
  for (const v of Object.values(props)) {
    if (v && v.type === 'title') {
      return (v.title || []).map((t) => t.plain_text).join('');
    }
  }
  return '';
}

console.log(`[move-connectivity-db] mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(`[move-connectivity-db] source db id : ${dbId}`);

// 1. Look up the source database so we can show its current parent.
let sourceDb;
try {
  sourceDb = await notion(`/databases/${dbId}`);
} catch (err) {
  console.error(`Could not retrieve source database: ${err.message}`);
  console.error('Hint: the integration may not be connected to this database.');
  process.exit(1);
}

const sourceTitle = (sourceDb.title || []).map((t) => t.plain_text).join('') || '(untitled)';
console.log(`[move-connectivity-db] source title : ${sourceTitle}`);
console.log(`[move-connectivity-db] source parent: ${JSON.stringify(sourceDb.parent)}`);

// 2. Resolve the destination page ID.
let destPageId = explicitDestId;
if (!destPageId) {
  console.log(`[move-connectivity-db] searching for destination page "${destTitle}"…`);
  const search = await notion('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: destTitle,
      filter: { property: 'object', value: 'page' },
      page_size: 25,
    }),
  });
  const matches = (search.results || []).filter((r) => {
    if (r.object !== 'page') return false;
    const t = readTitle(r.properties).trim().toLowerCase();
    return t === destTitle.trim().toLowerCase();
  });
  if (matches.length === 0) {
    console.error(`No page titled "${destTitle}" found (or integration is not connected to it).`);
    console.error('Open the page in Notion → ••• → Connections → add your integration.');
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple pages titled "${destTitle}" found:`);
    for (const m of matches) console.error(`  · ${m.id}  ${m.url}`);
    console.error('Set DESTINATION_PAGE_ID to disambiguate, then re-run.');
    process.exit(1);
  }
  destPageId = matches[0].id;
  console.log(`[move-connectivity-db] destination : ${destPageId}  (${matches[0].url})`);
} else {
  console.log(`[move-connectivity-db] destination : ${destPageId}  (from DESTINATION_PAGE_ID)`);
}

// 3. Confirm the integration can see the destination.
try {
  await notion(`/pages/${destPageId}`);
} catch (err) {
  console.error(`Could not retrieve destination page: ${err.message}`);
  console.error('Hint: add your integration to that page via ••• → Connections.');
  process.exit(1);
}

// 4. No-op if already parented correctly.
if (sourceDb.parent?.type === 'page_id' && sourceDb.parent.page_id?.replace(/-/g, '') === destPageId.replace(/-/g, '')) {
  console.log('Source database is already a child of the destination page. Nothing to do.');
  process.exit(0);
}

// 5. Move.
const movePayload = {
  parent: { type: 'page_id', page_id: destPageId },
};

if (!apply) {
  console.log('');
  console.log('Planned move:');
  console.log(`  from  : ${JSON.stringify(sourceDb.parent)}`);
  console.log(`  to    : ${JSON.stringify(movePayload.parent)}`);
  console.log('');
  console.log('(dry-run — re-run with --apply to commit)');
  process.exit(0);
}

console.log('');
console.log(`Moving database ${dbId} → page ${destPageId}…`);
try {
  await notion(`/pages/${dbId}/move`, {
    method: 'POST',
    body: JSON.stringify(movePayload),
  });
  console.log('Move complete.');
} catch (err) {
  // Older API versions don't expose /pages/{id}/move for databases.
  // Fall back to PATCH /v1/databases/{id} with the new parent.
  if (err.status === 404 || err.status === 405) {
    console.warn('move endpoint unavailable, retrying via PATCH /v1/databases/{id}…');
    await notion(`/databases/${dbId}`, {
      method: 'PATCH',
      body: JSON.stringify(movePayload),
    });
    console.log('Move complete (via databases PATCH).');
  } else {
    throw err;
  }
}
