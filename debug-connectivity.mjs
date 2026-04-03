import { Client } from '@notionhq/client';

const dsId = process.env.NOTION_CONNECTIVITY_DATASOURCE_ID;
const apiKey = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
console.log('dsId:', dsId);
console.log('apiKey present:', !!apiKey);
if (!dsId || !apiKey) { console.log('Missing config'); process.exit(0); }

const client = new Client({ auth: apiKey });

const resp = await client.dataSources.query({ data_source_id: dsId, page_size: 100 });
console.log('Total results:', resp.results.length);

const sites = resp.results.map(p => {
  const props = p.properties;
  const keys = Object.keys(props);
  // Find site field
  for (const [k, v] of Object.entries(props)) {
    if (k.toLowerCase().includes('site') || k.toLowerCase().includes('organization') || k.toLowerCase().includes('facility')) {
      let val = '';
      if (v.type === 'title') val = v.title.map(t => t.plain_text).join('');
      else if (v.type === 'rich_text') val = v.rich_text.map(t => t.plain_text).join('');
      else if (v.type === 'select') val = v.select?.name || '';
      if (val) return { id: p.id, site: val, key: k };
    }
  }
  return { id: p.id, site: '(no site field)', keys };
});

console.log(JSON.stringify(sites, null, 2));

// Check normalise matching for San Ramon
function normalise(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const slugNorm = normalise('sanramon');
const nameNorm = normalise('San Ramon Hospital');
console.log('\nSlug norm:', slugNorm, '| Name norm:', nameNorm);

const matched = sites.filter(r => {
  if (!r.site || r.site === '(no site field)') return true;
  const siteNorm = normalise(r.site);
  const match = siteNorm === slugNorm || siteNorm.includes(slugNorm) || slugNorm.includes(siteNorm) ||
    siteNorm.includes(nameNorm) || nameNorm.includes(siteNorm);
  if (!match) console.log('  NO MATCH:', r.site, '->', siteNorm, 'vs', slugNorm, '/', nameNorm);
  return match;
});
console.log('\nMatched rows for San Ramon:', matched.length);
