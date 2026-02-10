import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';

config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

console.log('Creating RadOne client and linking existing organizations...\n');

// 1. Check if RadOne client exists, create if not
console.log('Step 1: Checking for RadOne client...');
let radoneClientId;
const [existingClient] = await db
  .select()
  .from(schema.clients)
  .where(eq(schema.clients.slug, 'radone'))
  .limit(1);

if (existingClient) {
  radoneClientId = existingClient.id;
  console.log(`✓ RadOne client already exists (ID: ${radoneClientId})\n`);
} else {
  const [radoneClient] = await db.insert(schema.clients).values({
    name: 'RadOne',
    slug: 'radone',
    description: 'Radiology One - PACS implementation client',
    status: 'active',
  });
  radoneClientId = radoneClient.insertId;
  console.log(`✓ Created RadOne client (ID: ${radoneClientId})\n`);
}

// 2. Get all existing organizations
console.log('Step 2: Fetching existing organizations...');
const existingOrgs = await db.select().from(schema.organizations);
console.log(`Found ${existingOrgs.length} organizations:\n`);

existingOrgs.forEach(org => {
  console.log(`  - ${org.name} (${org.slug})`);
});

// 3. Link all organizations to RadOne client
console.log('\nStep 3: Linking organizations to RadOne client...');
for (const org of existingOrgs) {
  await db
    .update(schema.organizations)
    .set({ clientId: radoneClientId })
    .where(eq(schema.organizations.id, org.id));
  
  console.log(`  ✓ Linked ${org.name} to RadOne`);
}

console.log('\n✅ Migration complete!');
console.log(`   RadOne client ID: ${radoneClientId}`);
console.log(`   Organizations linked: ${existingOrgs.length}`);

await conn.end();
