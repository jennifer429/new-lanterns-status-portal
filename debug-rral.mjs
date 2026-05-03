import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Check what org RRAL resolves to
const [orgs] = await conn.execute(
  `SELECT id, name, slug, clientId FROM organizations WHERE slug = 'RRAL' OR LOWER(slug) = LOWER('RRAL') OR LOWER(name) = LOWER('RRAL')`
);
console.log('=== Orgs matching RRAL ===');
console.log(JSON.stringify(orgs, null, 2));

if (orgs.length > 0) {
  const orgId = orgs[0].id;
  
  // 2. Count total responses for this org
  const [countResult] = await conn.execute(
    `SELECT COUNT(*) as total FROM intakeResponses WHERE organizationId = ?`, [orgId]
  );
  console.log(`\n=== Total responses for org ${orgId}: ${countResult[0].total} ===`);
  
  // 3. Check the most recent responses (by updatedAt)
  const [recent] = await conn.execute(
    `SELECT questionId, LEFT(response, 80) as response_preview, updatedBy, updatedAt 
     FROM intakeResponses WHERE organizationId = ? 
     ORDER BY updatedAt DESC LIMIT 10`, [orgId]
  );
  console.log('\n=== 10 most recently updated responses ===');
  console.table(recent);
  
  // 4. Check if there are duplicate org IDs that might be confusing things
  const [allRRAL] = await conn.execute(
    `SELECT id, name, slug, clientId FROM organizations WHERE name LIKE '%RRAL%' OR slug LIKE '%RRAL%' OR slug LIKE '%rrmc%' OR slug LIKE '%RRMC%'`
  );
  console.log('\n=== All orgs with RRAL/RRMC in name or slug ===');
  console.log(JSON.stringify(allRRAL, null, 2));
  
  // 5. Check if there are responses under a different org ID that might be the "old" RRAL
  if (allRRAL.length > 1) {
    for (const org of allRRAL) {
      const [cnt] = await conn.execute(
        `SELECT COUNT(*) as total FROM intakeResponses WHERE organizationId = ?`, [org.id]
      );
      console.log(`  Org ${org.id} (${org.slug}/${org.name}): ${cnt[0].total} responses`);
    }
  }
}

await conn.end();
