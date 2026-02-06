import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { clients, organizations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { mode: 'default' });

console.log('Creating SRV client and organizations...\n');

// Check if SRV client already exists
const existingSRV = await db.select().from(clients).where(eq(clients.slug, 'srv'));

let srvClientId;

if (existingSRV.length > 0) {
  console.log('✓ SRV client already exists');
  srvClientId = existingSRV[0].id;
} else {
  // Create SRV client
  const [srvResult] = await db.insert(clients).values({
    name: 'SRV',
    slug: 'srv',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  srvClientId = srvResult.insertId;
  console.log('✓ Created SRV client (ID:', srvClientId, ')');
}

// Check if RRMC organization exists
const existingRRMC = await db.select().from(organizations).where(eq(organizations.slug, 'srv-rrmc'));

if (existingRRMC.length > 0) {
  console.log('✓ RRMC organization already exists');
} else {
  // Create RRMC organization
  await db.insert(organizations).values({
    clientId: srvClientId,
    name: 'RRMC',
    slug: 'srv-rrmc',
    contactName: 'RRMC Contact',
    contactEmail: 'contact@rrmc.org',
    contactPhone: '(555) 000-0000',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('✓ Created RRMC organization');
}

// Check if Boulder organization exists
const existingBoulder = await db.select().from(organizations).where(eq(organizations.slug, 'srv-boulder'));

if (existingBoulder.length > 0) {
  console.log('✓ Boulder organization already exists');
} else {
  // Create Boulder organization
  await db.insert(organizations).values({
    clientId: srvClientId,
    name: 'Boulder',
    slug: 'srv-boulder',
    contactName: 'Boulder Contact',
    contactEmail: 'contact@boulder.org',
    contactPhone: '(555) 000-0001',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('✓ Created Boulder organization');
}

console.log('\n✅ SRV client and organizations created successfully!');

await connection.end();
