import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users, organizations, clients } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { mode: 'default' });

console.log('Assigning users to clients based on their organization...\n');

// Get all clients
const allClients = await db.select().from(clients);
const clientMap = {};
for (const client of allClients) {
  clientMap[client.id] = client.name;
}

// Get all organizations with their clientId
const allOrgs = await db.select().from(organizations);
const orgToClientMap = {};
for (const org of allOrgs) {
  orgToClientMap[org.id] = org.clientId;
}

// Get all users
const allUsers = await db.select().from(users);

let updated = 0;
let skipped = 0;

for (const user of allUsers) {
  if (user.clientId) {
    console.log(`  ⊘ User ${user.email} already has clientId`);
    skipped++;
    continue;
  }

  if (user.organizationId) {
    const clientId = orgToClientMap[user.organizationId];
    if (clientId) {
      await db.update(users)
        .set({ clientId })
        .where(eq(users.id, user.id));
      console.log(`  ✓ Assigned ${user.email} to client ${clientMap[clientId]}`);
      updated++;
    } else {
      console.log(`  ⚠ User ${user.email} has organizationId ${user.organizationId} but no matching client found`);
    }
  } else {
    console.log(`  ⊘ User ${user.email} has no organizationId, skipping`);
    skipped++;
  }
}

console.log(`\n✅ Updated ${updated} users, skipped ${skipped} users`);

await connection.end();
