/**
 * One-off migration: update RRAL org's slug from "RRMC" to "RRAL".
 *
 * Why: the Notion connectivity filter (server/routers/connectivity.ts)
 * matches a row's Site column against the org's slug/name. RRAL's DB record
 * has name="RRAL" but slug="RRMC", which leaves "rrmc" as the primary match
 * key. Aligning the slug with the name makes the Notion rows visible again
 * and also keeps the URL readable (/org/<client>/RRAL/...).
 *
 * Safe to re-run: checks current state before updating.
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { organizations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const OLD_SLUG = 'RRMC';
const NEW_SLUG = 'RRAL';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { mode: 'default' });

const [target] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.slug, OLD_SLUG));

if (!target) {
  const [already] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, NEW_SLUG));
  if (already) {
    console.log(`✓ Nothing to do — org "${already.name}" already has slug "${NEW_SLUG}" (id=${already.id})`);
  } else {
    console.log(`✗ No org found with slug "${OLD_SLUG}" or "${NEW_SLUG}"`);
  }
  await connection.end();
  process.exit(0);
}

console.log(`Found org id=${target.id} name="${target.name}" slug="${target.slug}"`);

const [conflict] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.slug, NEW_SLUG));

if (conflict && conflict.id !== target.id) {
  console.error(`✗ Cannot rename: slug "${NEW_SLUG}" is already used by org id=${conflict.id} ("${conflict.name}")`);
  await connection.end();
  process.exit(1);
}

await db
  .update(organizations)
  .set({ slug: NEW_SLUG, updatedAt: new Date() })
  .where(eq(organizations.id, target.id));

console.log(`✓ Updated org id=${target.id} slug: "${OLD_SLUG}" → "${NEW_SLUG}"`);

await connection.end();
