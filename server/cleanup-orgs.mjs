import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { organizations, users } from '../drizzle/schema.ts';
import { sql, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('Checking organizations...\n');

// Get all organizations with user counts
const orgs = await db.select({
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  createdAt: organizations.createdAt
}).from(organizations).orderBy(organizations.createdAt);

for (const org of orgs) {
  const userCount = await db.select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.organizationId, org.id));
  
  console.log(`${org.id}: ${org.name} (${org.slug}) - ${userCount[0].count} users - Created: ${org.createdAt}`);
}

console.log('\n--- Deleting first 5 organizations with no users ---\n');

let deleted = 0;
for (const org of orgs) {
  if (deleted >= 5) break;
  
  const userCount = await db.select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.organizationId, org.id));
  
  if (userCount[0].count === 0) {
    console.log(`Deleting: ${org.name} (${org.slug})`);
    await db.delete(organizations).where(eq(organizations.id, org.id));
    deleted++;
  }
}

console.log(`\nDeleted ${deleted} organizations`);

console.log('\n--- Creating admin user for Ryan Chen ---\n');

// Check if user already exists
const existingUser = await db.select()
  .from(users)
  .where(eq(users.email, 'ryan@newlantern.ai'))
  .limit(1);

if (existingUser.length > 0) {
  console.log('User ryan@newlantern.ai already exists');
} else {
  const bcrypt = await import('bcrypt');
  const hashedPassword = await bcrypt.hash('ABC1234!', 10);
  
  await db.insert(users).values({
    email: 'ryan@newlantern.ai',
    password: hashedPassword,
    firstName: 'Ryan',
    lastName: 'Chen',
    role: 'admin',
    openId: 'ryan-chen-' + Date.now()
  });
  
  console.log('Created admin user: Ryan Chen (ryan@newlantern.ai)');
}

console.log('\n--- Final organization list ---\n');

const finalOrgs = await db.select({
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug
}).from(organizations).orderBy(organizations.createdAt);

for (const org of finalOrgs) {
  const userCount = await db.select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.organizationId, org.id));
  
  console.log(`${org.name} (${org.slug}) - ${userCount[0].count} users`);
}

await connection.end();
console.log('\nDone!');
