/**
 * Standalone Notion Backfill Script
 * Bypasses tRPC auth and directly calls sync functions.
 * Usage: node --loader tsx scripts/run-backfill.mjs [table]
 * If no table specified, runs all tables.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../drizzle/schema.ts';
import {
  syncAiChatLog,
  syncActivityFeed,
  syncOrgNote,
  syncPartnerDocument,
  syncPartnerDocAudit,
  syncOnboardingFeedback,
  syncOrgCustomTask,
  syncSectionProgress,
  syncVendorAudit,
  syncTaskFile,
  syncIntakeFile,
  syncPartnerTemplate,
  syncPartnerTaskTemplate,
  syncSpecification,
  syncSystemVendor,
  syncQuestion,
  syncQuestionOption,
  syncPortalUser,
  syncClient,
  syncOrganization,
  syncImplementationOrg,
} from '../server/notionDualWrite.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Rate limiter: max 3 requests per second to avoid Notion API limits
async function rateLimitedSync(rows, syncFn, label) {
  let synced = 0;
  let failed = 0;
  const total = rows.length;
  console.log(`  [${label}] Starting: ${total} rows`);
  
  for (let i = 0; i < rows.length; i++) {
    try {
      const result = await syncFn(rows[i]);
      if (result) synced++;
      else failed++;
    } catch (err) {
      failed++;
      if (i < 3) console.error(`  [${label}] Error on row ${i}:`, err.message);
    }
    // Rate limit: 3 per second
    if ((i + 1) % 3 === 0) {
      await new Promise(r => setTimeout(r, 1100));
    }
    // Progress every 20 rows
    if ((i + 1) % 20 === 0) {
      console.log(`  [${label}] Progress: ${i + 1}/${total} (${synced} ok, ${failed} failed)`);
    }
  }
  console.log(`  [${label}] Done: ${synced}/${total} synced, ${failed} failed`);
  return { synced, failed, total };
}

// Org name cache
const orgNameCache = new Map();
async function getOrgName(orgId) {
  if (orgNameCache.has(orgId)) return orgNameCache.get(orgId);
  const [org] = await db.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1);
  const name = org?.name || `Org #${orgId}`;
  orgNameCache.set(orgId, name);
  return name;
}

const clientNameCache = new Map();
async function getClientName(clientId) {
  if (clientNameCache.has(clientId)) return clientNameCache.get(clientId);
  const [client] = await db.select({ name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
  const name = client?.name || `Client #${clientId}`;
  clientNameCache.set(clientId, name);
  return name;
}

// Table sync functions
const tableSyncers = {
  async clients() {
    const rows = await db.select().from(schema.clients);
    return rateLimitedSync(rows, (row) => syncClient({
      mysqlId: row.id,
      name: row.name,
      slug: row.slug || null,
      contactName: row.contactName || null,
      contactEmail: row.contactEmail || null,
      active: row.active ?? true,
      createdAt: row.createdAt,
    }), 'clients');
  },

  async organizations() {
    const rows = await db.select().from(schema.organizations);
    return rateLimitedSync(rows, async (row) => {
      const clientName = row.clientId ? await getClientName(row.clientId) : null;
      return syncOrganization({
        mysqlId: row.id,
        name: row.name,
        slug: row.slug,
        clientId: row.clientId || null,
        clientName,
        contactName: row.contactName || null,
        contactEmail: row.contactEmail || null,
        status: row.status || 'active',
        goLiveDate: row.goLiveDate || null,
        createdAt: row.createdAt,
      });
    }, 'organizations');
  },

  async users() {
    const rows = await db.select().from(schema.users);
    return rateLimitedSync(rows, async (row) => {
      const orgName = row.organizationId ? await getOrgName(row.organizationId) : null;
      return syncPortalUser({
        mysqlId: row.id,
        email: row.email || '',
        name: row.name || '',
        role: row.role || 'user',
        clientId: row.clientId || null,
        organizationId: row.organizationId || null,
        orgName,
        active: !!row.isActive,
        lastLogin: row.lastLoginAt || null,
        createdAt: row.createdAt,
      });
    }, 'users');
  },

  async questions() {
    const rows = await db.select().from(schema.questions);
    return rateLimitedSync(rows, (row) => syncQuestion({
      mysqlId: row.id,
      key: row.questionId,
      section: row.sectionId || '',
      type: row.questionType || 'text',
      required: !!row.required,
      active: true,
      sortOrder: row.questionNumber || 0,
      fullText: row.questionText || row.questionId,
      createdAt: row.createdAt,
    }), 'questions');
  },

  async specifications() {
    const rows = await db.select().from(schema.specifications);
    return rateLimitedSync(rows, (row) => syncSpecification({
      mysqlId: row.id,
      title: row.title,
      key: row.fileName || row.title,
      description: row.description || null,
      category: row.category || null,
      active: !!row.isActive,
      createdAt: row.createdAt,
    }), 'specifications');
  },

  async implementationOrgs() {
    const rows = await db.select().from(schema.implementationOrgs);
    return rateLimitedSync(rows, async (row) => {
      const orgName = await getOrgName(row.organizationId);
      return syncImplementationOrg({
        mysqlId: row.id,
        organizationId: row.organizationId,
        orgName,
        name: row.name,
        orgType: row.orgType,
        color: row.color || null,
        sortOrder: row.sortOrder || 0,
        active: !!row.isActive,
        createdAt: row.createdAt,
      });
    }, 'implementationOrgs');
  },

  async orgNotes() {
    const rows = await db.select().from(schema.orgNotes);
    return rateLimitedSync(rows, async (row) => {
      const orgName = row.organizationId ? await getOrgName(row.organizationId) : 'Partner-level';
      return syncOrgNote({
        mysqlId: row.id,
        organizationId: row.organizationId || 0,
        orgName,
        clientId: row.clientId || null,
        label: row.label || null,
        fileName: row.fileName,
        fileUrl: row.fileUrl || null,
        driveFileId: row.driveFileId || null,
        fileSize: row.fileSize || null,
        mimeType: row.mimeType || null,
        uploadedBy: row.uploadedBy || null,
        createdAt: row.createdAt,
      });
    }, 'orgNotes');
  },

  async partnerDocuments() {
    const rows = await db.select().from(schema.partnerDocuments);
    return rateLimitedSync(rows, async (row) => {
      const partnerName = await getClientName(row.clientId);
      return syncPartnerDocument({
        mysqlId: row.id,
        clientId: row.clientId,
        partnerName,
        title: row.title,
        fileName: row.filename,
        fileUrl: row.url || null,
        driveFileId: row.driveFileId || null,
        mimeType: row.mimeType || null,
        fileSize: row.size || null,
        category: null,
        uploadedBy: row.uploadedByName || null,
        active: true,
        createdAt: row.createdAt,
      });
    }, 'partnerDocuments');
  },

  async activityFeed() {
    const rows = await db.select().from(schema.activityFeed);
    return rateLimitedSync(rows, async (row) => {
      const orgName = await getOrgName(row.organizationId);
      return syncActivityFeed({
        mysqlId: row.id,
        organizationId: row.organizationId,
        orgName,
        eventType: row.source || 'manual',
        actor: row.author || null,
        description: row.message || null,
        createdAt: row.createdAt,
      });
    }, 'activityFeed');
  },

  async aiAuditLogs() {
    const rows = await db.select().from(schema.aiAuditLogs);
    return rateLimitedSync(rows, async (row) => {
      const orgName = row.organizationId ? await getOrgName(row.organizationId) : null;
      return syncAiChatLog({
        mysqlId: row.id,
        organizationId: row.organizationId || null,
        orgName,
        userEmail: row.actorEmail || 'unknown',
        userRole: row.actorRole || 'user',
        prompt: row.userPrompt || '',
        response: row.aiResponse || '',
        model: row.action || 'unknown',
        tokensUsed: row.durationMs || null,
        toolCalls: row.toolArgs || null,
        createdAt: row.createdAt,
      });
    }, 'aiAuditLogs');
  },

  async onboardingFeedback() {
    const rows = await db.select().from(schema.onboardingFeedback);
    return rateLimitedSync(rows, async (row) => {
      const orgName = await getOrgName(row.organizationId);
      return syncOnboardingFeedback({
        mysqlId: row.id,
        organizationId: row.organizationId,
        orgName,
        rating: row.rating,
        comments: row.comments || null,
        submittedBy: row.submittedBy || null,
        createdAt: row.createdAt,
      });
    }, 'onboardingFeedback');
  },

  async orgCustomTasks() {
    const rows = await db.select().from(schema.orgCustomTasks);
    return rateLimitedSync(rows, async (row) => {
      const orgName = await getOrgName(row.organizationId);
      return syncOrgCustomTask({
        mysqlId: row.id,
        organizationId: row.organizationId,
        orgName,
        taskId: `custom-${row.id}`,
        title: row.title,
        section: row.section || null,
        description: row.description || null,
        owner: null,
        status: row.isComplete ? 'complete' : 'pending',
        createdBy: row.createdBy || null,
        createdAt: row.createdAt,
      });
    }, 'orgCustomTasks');
  },
};

// Main execution
const targetTable = process.argv[2] || 'all';
const allTables = Object.keys(tableSyncers);

console.log('=== Notion Backfill ===');
console.log(`Target: ${targetTable}`);
console.log(`Available tables: ${allTables.join(', ')}`);
console.log('');

const tablesToRun = targetTable === 'all' ? allTables : [targetTable];
const results = {};

for (const table of tablesToRun) {
  if (!tableSyncers[table]) {
    console.error(`Unknown table: ${table}`);
    continue;
  }
  console.log(`\n▶ Backfilling: ${table}`);
  try {
    results[table] = await tableSyncers[table]();
  } catch (err) {
    console.error(`  FATAL ERROR on ${table}:`, err.message);
    results[table] = { synced: 0, failed: 0, total: 0, error: err.message };
  }
}

console.log('\n=== RESULTS ===');
for (const [table, result] of Object.entries(results)) {
  console.log(`  ${table}: ${result.synced}/${result.total} synced, ${result.failed} failed${result.error ? ` (ERROR: ${result.error})` : ''}`);
}

process.exit(0);
