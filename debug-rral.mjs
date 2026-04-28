/**
 * Diagnostic: trace why intake imports don't persist for RRAL.
 *
 * Prints:
 *  - All orgs whose name OR slug contains "RRAL", "RRMC", or shares slug "RRMC"
 *  - Latest intakeResponses for each candidate org (timestamp + questionId)
 *  - All users with clientId matching the candidate orgs (so we can see if
 *    the user accessing the page is bound to a different clientId)
 *
 * Usage:  node debug-rral.mjs
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { organizations, intakeResponses, users, clients } from './drizzle/schema.ts';
import { or, like, eq, desc, inArray } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { mode: 'default' });

console.log('── Candidate orgs (name or slug matches RRAL/RRMC) ──');
const candidates = await db
  .select()
  .from(organizations)
  .where(
    or(
      like(organizations.name, '%RRAL%'),
      like(organizations.name, '%RRMC%'),
      like(organizations.slug, '%RRAL%'),
      like(organizations.slug, '%RRMC%'),
    ),
  );

if (candidates.length === 0) {
  console.log('  (none found)');
  await connection.end();
  process.exit(0);
}

for (const o of candidates) {
  console.log(
    `  id=${o.id}  name="${o.name}"  slug="${o.slug}"  clientId=${o.clientId}  status=${o.status}  updatedAt=${o.updatedAt}`,
  );
}

const candidateIds = candidates.map((o) => o.id);
const candidateClientIds = [...new Set(candidates.map((o) => o.clientId).filter(Boolean))];

console.log('\n── Clients referenced ──');
if (candidateClientIds.length) {
  const clientRows = await db
    .select()
    .from(clients)
    .where(inArray(clients.id, candidateClientIds));
  for (const c of clientRows) {
    console.log(`  id=${c.id}  name="${c.name}"  slug="${c.slug}"  status=${c.status}`);
  }
}

console.log('\n── Latest 10 intakeResponses per candidate org ──');
for (const o of candidates) {
  const rows = await db
    .select({
      id: intakeResponses.id,
      questionId: intakeResponses.questionId,
      preview: intakeResponses.response,
      updatedBy: intakeResponses.updatedBy,
      updatedAt: intakeResponses.updatedAt,
    })
    .from(intakeResponses)
    .where(eq(intakeResponses.organizationId, o.id))
    .orderBy(desc(intakeResponses.updatedAt))
    .limit(10);

  console.log(`\n  org id=${o.id} ("${o.name}", slug="${o.slug}") — ${rows.length} most-recent responses:`);
  if (rows.length === 0) {
    console.log('    (no responses)');
  } else {
    for (const r of rows) {
      const preview = (r.preview ?? '').toString().slice(0, 60).replace(/\n/g, ' ');
      console.log(
        `    ${r.updatedAt?.toISOString?.() ?? r.updatedAt}  ${r.questionId.padEnd(28)}  by=${r.updatedBy ?? '?'}  "${preview}"`,
      );
    }
  }
}

console.log('\n── Users tied to these clients ──');
if (candidateClientIds.length) {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      organizationId: users.organizationId,
      clientId: users.clientId,
      isActive: users.isActive,
    })
    .from(users)
    .where(inArray(users.clientId, candidateClientIds));
  for (const u of userRows) {
    console.log(
      `  id=${u.id}  email=${u.email}  role=${u.role}  orgId=${u.organizationId}  clientId=${u.clientId}  active=${u.isActive}`,
    );
  }
}

await connection.end();
