/**
 * Migrate contacts and systems JSON blobs from MySQL into the new Notion databases.
 * 
 * Contacts: Each role (admin, it, clinical, radiologist, pm) becomes its own row.
 * Systems: Each system in the array becomes its own row.
 */
import mysql from 'mysql2/promise';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Database IDs for the new tables
const CONTACTS_DB_ID = process.env.NOTION_CONTACTS_DATABASE_ID || '27797850-6128-4121-ba7d-29c23fbc4391';
const SYSTEMS_DB_ID = process.env.NOTION_SYSTEMS_DATABASE_ID || 'a053d7e4-b0bf-46a6-9375-b5fe7264aa57';

const ROLE_MAP = {
  admin: 'Administrative',
  it: 'IT Connectivity',
  clinical: 'Clinical',
  radiologist: 'Radiologist Champion',
  pm: 'Project Manager',
  itPostProd: 'IT Post-Production',
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createNotionPage(databaseId, properties, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await notion.pages.create({
        parent: { database_id: databaseId },
        properties,
      });
      return result;
    } catch (err) {
      if (err.code === 'rate_limited' && attempt < retries) {
        const waitMs = (err.headers?.['retry-after'] || 2) * 1000;
        console.log(`  Rate limited, waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

async function migrateContacts(conn) {
  console.log('\n=== MIGRATING CONTACTS ===');
  
  const [rows] = await conn.query(`
    SELECT o.slug, o.name as orgName, r.response 
    FROM intakeResponses r 
    JOIN organizations o ON r.organizationId = o.id 
    WHERE r.questionId = 'A.contacts' AND r.response != ''
    ORDER BY o.slug
  `);
  
  console.log(`Found ${rows.length} orgs with contacts data`);
  
  let created = 0;
  let errors = 0;
  
  for (const row of rows) {
    let contactData;
    try {
      contactData = JSON.parse(row.response);
    } catch (e) {
      console.log(`  [ERROR] Failed to parse contacts for ${row.slug}: ${e.message}`);
      errors++;
      continue;
    }
    
    // Each key in contactData is a role
    for (const [roleKey, contact] of Object.entries(contactData)) {
      if (!contact || (!contact.name && !contact.email && !contact.phone)) {
        continue; // Skip empty contacts
      }
      
      const roleName = ROLE_MAP[roleKey] || roleKey;
      
      const properties = {
        'Name': {
          title: [{ text: { content: contact.name || `${roleName} (${row.slug})` } }],
        },
        'Role': {
          select: { name: roleName },
        },
        'Institution Group': {
          select: { name: row.slug },
        },
        'Email': {
          email: contact.email || null,
        },
        'Phone': {
          phone_number: contact.phone || null,
        },
        'Title': {
          rich_text: contact.title ? [{ text: { content: contact.title } }] : [],
        },
        'Notes': {
          rich_text: contact.notes ? [{ text: { content: contact.notes.substring(0, 2000) } }] : [],
        },
      };
      
      try {
        await createNotionPage(CONTACTS_DB_ID, properties);
        created++;
        process.stdout.write(`\r  Created: ${created} (${row.slug} - ${roleName})`);
        await sleep(400); // Rate limit: ~2.5 req/sec
      } catch (err) {
        console.log(`\n  [ERROR] ${row.slug} ${roleName}: ${err.message}`);
        errors++;
      }
    }
  }
  
  console.log(`\n  DONE: ${created} contacts created, ${errors} errors`);
  return { created, errors };
}

async function migrateSystems(conn) {
  console.log('\n=== MIGRATING SYSTEMS ===');
  
  const [rows] = await conn.query(`
    SELECT o.slug, o.name as orgName, r.response 
    FROM intakeResponses r 
    JOIN organizations o ON r.organizationId = o.id 
    WHERE r.questionId = 'ARCH.systems' AND r.response != ''
    ORDER BY o.slug
  `);
  
  console.log(`Found ${rows.length} orgs with systems data`);
  
  let created = 0;
  let errors = 0;
  
  for (const row of rows) {
    let systemsData;
    try {
      systemsData = JSON.parse(row.response);
    } catch (e) {
      console.log(`  [ERROR] Failed to parse systems for ${row.slug}: ${e.message}`);
      errors++;
      continue;
    }
    
    if (!Array.isArray(systemsData)) {
      console.log(`  [WARN] Systems data for ${row.slug} is not an array, skipping`);
      continue;
    }
    
    for (const system of systemsData) {
      if (!system || (!system.name && !system.type)) {
        continue; // Skip empty systems
      }
      
      const properties = {
        'System Name': {
          title: [{ text: { content: system.name || 'Unknown' } }],
        },
        'System Type': {
          select: { name: system.type || 'Other' },
        },
        'Institution Group': {
          select: { name: row.slug },
        },
        'Vendor': {
          rich_text: system.vendor ? [{ text: { content: system.vendor } }] : [],
        },
        'Notes': {
          rich_text: system.description ? [{ text: { content: system.description.substring(0, 2000) } }] : [],
        },
      };
      
      try {
        await createNotionPage(SYSTEMS_DB_ID, properties);
        created++;
        process.stdout.write(`\r  Created: ${created} (${row.slug} - ${system.name})`);
        await sleep(400); // Rate limit
      } catch (err) {
        console.log(`\n  [ERROR] ${row.slug} ${system.name}: ${err.message}`);
        errors++;
      }
    }
  }
  
  console.log(`\n  DONE: ${created} systems created, ${errors} errors`);
  return { created, errors };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const contactsResult = await migrateContacts(conn);
    const systemsResult = await migrateSystems(conn);
    
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Contacts: ${contactsResult.created} created, ${contactsResult.errors} errors`);
    console.log(`Systems: ${systemsResult.created} created, ${systemsResult.errors} errors`);
    console.log(`Total errors: ${contactsResult.errors + systemsResult.errors}`);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
