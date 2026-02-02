/**
 * Script to add all users to the database
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema.ts';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const users = [
  { email: "jennifer@newlantern.ai", password: "ABC1234!", firstName: "Jennifer", lastName: "Starling", org: "RadOne - Munson", role: "admin" },
  { email: "dsuida@mhc.net", password: "ABC1234!", firstName: "Doug", lastName: "Suida", org: "RadOne - Munson", role: "user" },
  { email: "lgenwright@mhc.net", password: "ABC1234!", firstName: "Lorrin", lastName: "Genwright", org: "RadOne - Munson", role: "user" },
  { email: "dharrison@mhc.net", password: "ABC1234!", firstName: "Drew", lastName: "Harrison", org: "RadOne - Munson", role: "user" },
  { email: "ashley.morgan@radiologyone.com", password: "ABC1234!", firstName: "Ashley", lastName: "Morgan", org: "RadOne - Munson", role: "user" },
  { email: "kevin.kadakia@radiologyone.com", password: "ABC1234!", firstName: "Kevin", lastName: "Kadakia", org: "RadOne - Munson", role: "user" },
  { email: "kathy.rangel@mercyone.org", password: "ABC1234!", firstName: "Kathaleen", lastName: "Rangel", org: "RadOne - JCRHC", role: "user" },
  { email: "kolin.w.huth@mercyone.org", password: "ABC1234!", firstName: "Kolin", lastName: "Huth", org: "RadOne - JCRHC", role: "user" },
  { email: "shonna.simpson@baycare.org", password: "ABC1234!", firstName: "Shonna", lastName: "Simpson", org: "RadOne - Baycare", role: "user" },
  { email: "christopher.parisi@baycare.org", password: "ABC1234!", firstName: "Christopher", lastName: "Parisi", org: "RadOne - Baycare", role: "user" },
  { email: "jessica.reilly@baycare.org", password: "ABC1234!", firstName: "Jessica", lastName: "Reilly", org: "RadOne - Baycare", role: "user" },
  { email: "jaime.hernandez@baycare.org", password: "ABC1234!", firstName: "Jaime", lastName: "Hernandez", org: "RadOne - Baycare", role: "user" },
  { email: "heather.morrison@baycare.org", password: "ABC1234!", firstName: "Heather", lastName: "Morrison", org: "RadOne - Baycare", role: "user" },
  { email: "carl.blackman@baycare.org", password: "ABC1234!", firstName: "Carl", lastName: "Blackman", org: "RadOne - Baycare", role: "user" },
  { email: "joyce.lachapelle@baycare.org", password: "ABC1234!", firstName: "Joyce", lastName: "La Chapelle", org: "RadOne - Baycare", role: "user" },
  { email: "shanon.carter@baycare.org", password: "ABC1234!", firstName: "Shanon", lastName: "Carter", org: "RadOne - Baycare", role: "user" },
  { email: "lhobson@tuscrad.com", password: "ABC1234!", firstName: "Leigh Ann", lastName: "Hobson", org: "SRV - Boulder", role: "user" },
  { email: "dshulman@tuscrad.com", password: "ABC1234!", firstName: "David", lastName: "Shulman", org: "SRV - Boulder", role: "user" },
  { email: "cnail@scipiotech.com", password: "ABC1234!", firstName: "Chris", lastName: "Nail", org: "SRV - Boulder", role: "user" },
  { email: "nlevasseur@radbusiness.com", password: "ABC1234!", firstName: "Nicole", lastName: "Levasseur", org: "SRV - Boulder", role: "user" },
  { email: "peter@truenorthit.com", password: "ABC1234!", firstName: "Peter", lastName: "Billig", org: "SRV - Boulder", role: "user" },
  { email: "rblanchet@boulderinternalmed.com", password: "ABC1234!", firstName: "Renee", lastName: "Blanchet", org: "SRV - Boulder", role: "user" },
  { email: "cmanchester@boulderinternalmed.com", password: "ABC1234!", firstName: "Christine", lastName: "Manchester", org: "SRV - Boulder", role: "user" },
  { email: "cathy@bouldercentre.com", password: "ABC1234!", firstName: "Cathy", lastName: "Boulder", org: "SRV - Boulder", role: "user" },
  { email: "aaronk@bouldercentre.com", password: "ABC1234!", firstName: "Aaron", lastName: "K", org: "SRV - Boulder", role: "user" },
  { email: "david@srvimaging.com", password: "ABC1234!", firstName: "David", lastName: "", org: "SRV - Boulder", role: "user" },
  { email: "dschaefer@caimarad.com", password: "ABC1234!", firstName: "David", lastName: "Schaefer", org: "Caima - SouthCenter", role: "user" },
  { email: "eagubiya@caimarad.com", password: "ABC1234!", firstName: "Edward", lastName: "Agubiya", org: "Caima - SouthCenter", role: "user" },
  { email: "jcox@caimarad.com", password: "ABC1234!", firstName: "Jonathan", lastName: "Cox", org: "Caima - SouthCenter", role: "user" },
  { email: "mchesler@caimarad.com", password: "ABC1234!", firstName: "Matt", lastName: "Chesler", org: "Caima - SouthCenter", role: "user" },
  { email: "aambekar@caimarad.com", password: "ABC1234!", firstName: "Avanti", lastName: "Ambekar", org: "Caima - SouthCenter", role: "user" },
  { email: "mmcdonald@orthoimaging.com", password: "ABC1234!", firstName: "Marin", lastName: "McDonald", org: "Intellirad", role: "user" },
  { email: "jmarkuske@intelliradimaging.com", password: "ABC1234!", firstName: "Janene", lastName: "Markuske", org: "Intellirad", role: "user" },
  { email: "kdezayas@intelliradimaging.com", password: "ABC1234!", firstName: "Kevin", lastName: "Dezayas", org: "Intellirad", role: "user" },
];

console.log(`Adding ${users.length} users...`);

for (const user of users) {
  try {
    // Find or create organization
    let org = await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.name, user.org),
    });

    if (!org) {
      console.log(`Creating organization: ${user.org}`);
      const [newOrg] = await db.insert(schema.organizations).values({
        name: user.org,
        slug: user.org.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        contactName: user.firstName + ' ' + user.lastName,
        contactEmail: user.email,
        goalDate: "2026-06-30",
      });
      
      // Fetch the created org
      org = await db.query.organizations.findFirst({
        where: (orgs, { eq }) => eq(orgs.name, user.org),
      });
    }

    if (!org) {
      console.error(`Failed to create/find organization: ${user.org}`);
      continue;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, 10);

    // Create user
    await db.insert(schema.users).values({
      email: user.email,
      password: hashedPassword,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      organizationId: org.id,
      openId: `local_${user.email}`,
    });

    console.log(`✓ Created user: ${user.email} (${user.org})`);
  } catch (error) {
    console.error(`✗ Failed to create user ${user.email}:`, error.message);
  }
}

console.log('Done!');
await connection.end();
process.exit(0);
