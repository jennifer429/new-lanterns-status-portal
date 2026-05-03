import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check table columns first
const [cols] = await conn.query(`SHOW COLUMNS FROM organizations`);
console.log('=== organizations columns ===');
for (const c of cols) console.log(`  ${c.Field} (${c.Type})`);

// Find RRAL org
const [orgs] = await conn.query(`SELECT * FROM organizations WHERE name LIKE '%RRAL%' OR name LIKE '%RRMC%' OR slug LIKE '%rral%' OR slug LIKE '%rrmc%'`);
console.log('\n=== RRAL/RRMC orgs ===');
console.log(JSON.stringify(orgs, null, 2));

// All orgs
const [allOrgs] = await conn.query(`SELECT id, name, slug FROM organizations ORDER BY name`);
console.log('\n=== All orgs ===');
for (const o of allOrgs) {
  console.log(`  ${o.id}: ${o.name} (slug: ${o.slug})`);
}

// Check intake responses for RRAL
if (orgs.length > 0) {
  const orgId = orgs[0].id;
  const [responses] = await conn.query(`SELECT questionId, answer FROM intakeResponses WHERE organizationId = ? LIMIT 10`, [orgId]);
  console.log(`\n=== RRAL intake responses (first 10, orgId=${orgId}) ===`);
  console.log(JSON.stringify(responses, null, 2));
}

await conn.end();
