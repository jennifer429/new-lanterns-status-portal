/**
 * Migrate contacts and systems JSON blobs from MySQL → Notion v2 databases.
 *
 * Contacts v2 schema: Name (TITLE), Role (SELECT), Institution Group (MULTI_SELECT),
 *   Partner (SELECT), Site (SELECT), Email (EMAIL), Phone (RICH_TEXT), Notes (RICH_TEXT), Updated By (RICH_TEXT)
 *
 * Systems v2 schema: System Name (TITLE), System Type (SELECT), Institution Group (MULTI_SELECT),
 *   Partner (SELECT), Site (SELECT), Vendor (SELECT), Version (RICH_TEXT), Notes (RICH_TEXT), Updated By (RICH_TEXT)
 */

import { Client } from "@notionhq/client";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const CONTACTS_DB_ID = "c6f04901-bba7-4e3c-bf8e-51847c45ef06";
const SYSTEMS_DB_ID = "6eac7e0d-8a38-4279-86f4-db6a1bf6061b";

const notion = new Client({ auth: NOTION_API_KEY });

// Rate limit helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get org → partner (client) mapping
  const [orgs] = await conn.execute(
    "SELECT o.id, o.name, o.slug, c.name as clientName, c.slug as clientSlug FROM organizations o LEFT JOIN clients c ON o.clientId = c.id"
  );
  const orgMap = new Map();
  for (const o of orgs) {
    orgMap.set(o.id, {
      name: o.name,
      slug: o.slug,
      partner: o.clientName || o.clientSlug || "Unknown",
    });
  }

  console.log(`Loaded ${orgMap.size} organizations`);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTACTS MIGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n═══ CONTACTS MIGRATION ═══");

  const [contactRows] = await conn.execute(
    "SELECT r.organizationId, r.response FROM intakeResponses r WHERE r.questionId = 'A.contacts' AND r.response IS NOT NULL AND r.response != ''"
  );

  let contactsCreated = 0;
  let contactsSkipped = 0;

  for (const row of contactRows) {
    const org = orgMap.get(row.organizationId);
    if (!org) {
      console.warn(`  ⚠ Org ID ${row.organizationId} not found, skipping`);
      contactsSkipped++;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(row.response);
    } catch (e) {
      console.warn(`  ⚠ Invalid JSON for org ${org.slug}, skipping`);
      contactsSkipped++;
      continue;
    }

    // The JSON is either:
    // 1. { role_key: { name, phone, email, title?, notes? } } — single contacts per role
    // 2. { ..., additional_contacts: [ { name, email, org, role } ] } — array of additional contacts
    for (const [roleKey, contactData] of Object.entries(parsed)) {
      if (roleKey === "additional_contacts") {
        // Array of additional contacts
        if (Array.isArray(contactData)) {
          for (const ac of contactData) {
            if (!ac.name || ac.name.trim() === "") continue;
            const properties = buildContactProperties({
              name: ac.name,
              role: sanitizeSelect(ac.role || "Additional Contact"),
              email: ac.email || "",
              phone: ac.phone || "",
              notes: ac.org ? `Organization: ${ac.org}` : "",
              orgSlug: org.slug,
              partner: org.partner,
            });
            await createNotionPage(CONTACTS_DB_ID, properties);
            contactsCreated++;
            await sleep(350); // Rate limit: ~3 req/s
          }
        }
        continue;
      }

      // Single contact per role
      if (!contactData || typeof contactData !== "object") continue;
      if (!contactData.name || contactData.name.trim() === "") continue;

      const roleName = sanitizeSelect(formatRoleName(roleKey));
      const notes = [contactData.title, contactData.notes]
        .filter(Boolean)
        .join(". ");

      const properties = buildContactProperties({
        name: contactData.name,
        role: roleName,
        email: contactData.email || "",
        phone: contactData.phone || "",
        notes,
        orgSlug: org.slug,
        partner: org.partner,
      });

      await createNotionPage(CONTACTS_DB_ID, properties);
      contactsCreated++;
      await sleep(350);
    }

    console.log(`  ✓ ${org.slug}: contacts migrated`);
  }

  console.log(
    `\nContacts done: ${contactsCreated} created, ${contactsSkipped} skipped`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEMS MIGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n═══ SYSTEMS MIGRATION ═══");

  const [systemRows] = await conn.execute(
    "SELECT r.organizationId, r.response FROM intakeResponses r WHERE r.questionId = 'ARCH.systems' AND r.response IS NOT NULL AND r.response != ''"
  );

  let systemsCreated = 0;
  let systemsSkipped = 0;

  for (const row of systemRows) {
    const org = orgMap.get(row.organizationId);
    if (!org) {
      console.warn(`  ⚠ Org ID ${row.organizationId} not found, skipping`);
      systemsSkipped++;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(row.response);
    } catch (e) {
      console.warn(`  ⚠ Invalid JSON for org ${org.slug}, skipping`);
      systemsSkipped++;
      continue;
    }

    // Systems is a JSON array: [ { id, name, type, description, vendor?, version? } ]
    if (!Array.isArray(parsed)) {
      console.warn(`  ⚠ Systems for ${org.slug} is not an array, skipping`);
      systemsSkipped++;
      continue;
    }

    for (const sys of parsed) {
      if (!sys.name || sys.name.trim() === "") continue;

      const properties = buildSystemProperties({
        name: sys.name,
        type: sys.type || "",
        vendor: sys.vendor || "",
        version: sys.version || "",
        notes: sys.description || "",
        orgSlug: org.slug,
        partner: org.partner,
      });

      await createNotionPage(SYSTEMS_DB_ID, properties);
      systemsCreated++;
      await sleep(350);
    }

    console.log(`  ✓ ${org.slug}: ${parsed.length} systems migrated`);
  }

  console.log(
    `\nSystems done: ${systemsCreated} created, ${systemsSkipped} skipped`
  );

  await conn.end();
  console.log("\n✅ Migration complete!");
  console.log(`   Contacts: ${contactsCreated} rows created`);
  console.log(`   Systems: ${systemsCreated} rows created`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRoleName(key) {
  // Convert snake_case keys like "escalation_cerner" → "Escalation Cerner"
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Notion select values cannot contain commas — replace with semicolons */
function sanitizeSelect(val) {
  if (!val) return val;
  return val.replace(/,/g, ";").trim();
}

function buildContactProperties({ name, role, email, phone, notes, orgSlug, partner }) {
  const properties = {
    Name: { title: [{ text: { content: name.substring(0, 200) } }] },
    Role: { select: { name: role.substring(0, 100) } },
    "Institution Group": { multi_select: [{ name: orgSlug }] },
    Partner: { select: { name: partner } },
    Site: { select: { name: orgSlug } },
    "Updated By": {
      rich_text: [{ text: { content: "migration" } }],
    },
  };

  if (email && email.trim()) {
    properties.Email = { email: email.trim() };
  }
  if (phone && phone.trim()) {
    properties.Phone = {
      rich_text: [{ text: { content: phone.trim().substring(0, 50) } }],
    };
  }
  if (notes && notes.trim()) {
    properties.Notes = {
      rich_text: [{ text: { content: notes.trim().substring(0, 2000) } }],
    };
  }

  return properties;
}

function buildSystemProperties({ name, type, vendor, version, notes, orgSlug, partner }) {
  const properties = {
    "System Name": { title: [{ text: { content: name.substring(0, 200) } }] },
    "Institution Group": { multi_select: [{ name: orgSlug }] },
    Partner: { select: { name: partner } },
    Site: { select: { name: orgSlug } },
    "Updated By": {
      rich_text: [{ text: { content: "migration" } }],
    },
  };

  if (type && type.trim()) {
    properties["System Type"] = { select: { name: type.trim() } };
  }
  if (vendor && vendor.trim()) {
    properties.Vendor = { select: { name: vendor.trim() } };
  }
  if (version && version.trim()) {
    properties.Version = {
      rich_text: [{ text: { content: version.trim().substring(0, 200) } }],
    };
  }
  if (notes && notes.trim()) {
    properties.Notes = {
      rich_text: [{ text: { content: notes.trim().substring(0, 2000) } }],
    };
  }

  return properties;
}

async function createNotionPage(databaseId, properties) {
  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to create page:`, error.message);
    // Retry once after a pause
    await sleep(1000);
    try {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties,
      });
      return true;
    } catch (retryError) {
      console.error(`  ✗✗ Retry also failed:`, retryError.message);
      // Don't throw — skip this row and continue
      return false;
    }
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
