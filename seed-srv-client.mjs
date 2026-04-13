import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

console.log('Creating SRV client with Boulder and RRMC organizations...\n');

// 1. Check if SRV client exists, create if not
console.log('Step 1: Checking for SRV client...');
let srvClientId;
const [existingClient] = await db
  .select()
  .from(schema.clients)
  .where(eq(schema.clients.slug, 'srv'))
  .limit(1);

if (existingClient) {
  srvClientId = existingClient.id;
  console.log(`✓ SRV client already exists (ID: ${srvClientId})\n`);
} else {
  const [srvClient] = await db.insert(schema.clients).values({
    name: 'SRV',
    slug: 'srv',
    description: 'SRV - PACS implementation client',
    status: 'active',
  });
  srvClientId = srvClient.insertId;
  console.log(`✓ Created SRV client (ID: ${srvClientId})\n`);
}

// 2. Create Boulder organization
console.log('Step 2: Creating Boulder organization...');
const [existingBoulder] = await db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.slug, 'boulder'))
  .limit(1);

if (existingBoulder) {
  console.log(`✓ Boulder organization already exists (ID: ${existingBoulder.id})\n`);
  // Make sure it's linked to SRV client
  await db.update(schema.organizations)
    .set({ clientId: srvClientId })
    .where(eq(schema.organizations.id, existingBoulder.id));
} else {
  const [boulder] = await db.insert(schema.organizations).values({
    name: 'Boulder Community Health',
    slug: 'boulder',
    clientId: srvClientId,
    status: 'active',
  });
  console.log(`✓ Created Boulder organization (ID: ${boulder.insertId})\n`);
}

// 3. Create RRMC organization
console.log('Step 3: Creating RRMC organization...');
const [existingRrmc] = await db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.slug, 'rrmc'))
  .limit(1);

if (existingRrmc) {
  console.log(`✓ RRMC organization already exists (ID: ${existingRrmc.id})\n`);
  // Make sure it's linked to SRV client
  await db.update(schema.organizations)
    .set({ clientId: srvClientId })
    .where(eq(schema.organizations.id, existingRrmc.id));
} else {
  const [rrmc] = await db.insert(schema.organizations).values({
    name: 'RRMC - Rose Medical Center',
    slug: 'rrmc',
    clientId: srvClientId,
    status: 'active',
  });
  console.log(`✓ Created RRMC organization (ID: ${rrmc.insertId})\n`);
}

// 4. Create SRV admin user
console.log('Step 4: Creating SRV admin user...');
const [existingSrvAdmin] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.email, 'admin@srv.com'))
  .limit(1);

if (existingSrvAdmin) {
  console.log(`✓ SRV admin user already exists (ID: ${existingSrvAdmin.id})\n`);
  // Make sure clientId is set
  await db.update(schema.users)
    .set({ clientId: srvClientId })
    .where(eq(schema.users.id, existingSrvAdmin.id));
} else {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await db.insert(schema.users).values({
    openId: `srv-admin-${Date.now()}`,
    email: 'admin@srv.com',
    name: 'SRV Admin',
    role: 'admin',
    passwordHash,
    clientId: srvClientId,
  });
  console.log(`✓ Created SRV admin user (admin@srv.com / admin123)\n`);
}

// 5. Create Boulder client user
console.log('Step 5: Creating Boulder client user...');
const [boulderOrg] = await db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.slug, 'boulder'))
  .limit(1);

const [existingBoulderUser] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.email, 'boulder@srv.com'))
  .limit(1);

if (existingBoulderUser) {
  console.log(`✓ Boulder user already exists (ID: ${existingBoulderUser.id})\n`);
} else {
  const passwordHash = await bcrypt.hash('boulder123', 10);
  await db.insert(schema.users).values({
    openId: `srv-boulder-${Date.now()}`,
    email: 'boulder@srv.com',
    name: 'Boulder IT Admin',
    role: 'user',
    passwordHash,
    clientId: srvClientId,
    organizationId: boulderOrg?.id || null,
  });
  console.log(`✓ Created Boulder user (boulder@srv.com / boulder123)\n`);
}

// 6. Create RRMC client user
console.log('Step 6: Creating RRMC client user...');
const [rrmcOrg] = await db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.slug, 'rrmc'))
  .limit(1);

const [existingRrmcUser] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.email, 'rrmc@srv.com'))
  .limit(1);

if (existingRrmcUser) {
  console.log(`✓ RRMC user already exists (ID: ${existingRrmcUser.id})\n`);
} else {
  const passwordHash = await bcrypt.hash('rrmc123', 10);
  await db.insert(schema.users).values({
    openId: `srv-rrmc-${Date.now()}`,
    email: 'rrmc@srv.com',
    name: 'RRMC IT Admin',
    role: 'user',
    passwordHash,
    clientId: srvClientId,
    organizationId: rrmcOrg?.id || null,
  });
  console.log(`✓ Created RRMC user (rrmc@srv.com / rrmc123)\n`);
}

console.log('\n✅ SRV setup complete!');
console.log('   SRV Client ID:', srvClientId);
console.log('   Organizations: Boulder Community Health, RRMC - Rose Medical Center');
console.log('   Admin: admin@srv.com / admin123');
console.log('   Boulder user: boulder@srv.com / boulder123');
console.log('   RRMC user: rrmc@srv.com / rrmc123');
console.log('\n   Login URLs after deployment:');
console.log('   Admin: /org/srv/admin');
console.log('   Boulder: /org/srv/boulder');
console.log('   RRMC: /org/srv/rrmc');

await conn.end();
