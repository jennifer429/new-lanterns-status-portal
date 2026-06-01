import 'dotenv/config';

// We need to call the sync functions directly via the running server.
// The easiest way is to hit a tRPC endpoint or call the functions directly.
// Since the functions are server-side only, let's use the dev server's internal API.

// Alternative: just curl the dev server to trigger a sync via an admin endpoint.
// But there's no such endpoint. Let's import and run the functions directly.

import { createRequire } from 'module';

// Use tsx to run TypeScript directly
const args = process.argv.slice(2);
console.log('Triggering full Notion → MySQL sync...\n');

// We'll use fetch to hit the local server if there's an endpoint,
// otherwise we need to run the TS files directly via tsx.
// Let's just exec tsx with inline code.

import { execSync } from 'child_process';

const script = `
import 'dotenv/config';
import { runNotionSyncBack } from './server/notionSyncBack';
import { runContactsSystemsSync } from './server/notionSyncContacts';
import { runTaskValidationSyncBack } from './server/notionSyncBackTasks';

async function main() {
  console.log('=== Questionnaire Sync ===');
  try {
    const r1 = await runNotionSyncBack();
    console.log(JSON.stringify(r1, null, 2));
  } catch (e) { console.error('Questionnaire sync error:', e.message); }

  console.log('\\n=== Contacts/Systems Sync ===');
  try {
    const r2 = await runContactsSystemsSync();
    console.log(JSON.stringify(r2, null, 2));
  } catch (e) { console.error('Contacts/Systems sync error:', e.message); }

  console.log('\\n=== Task/Validation Sync ===');
  try {
    const r3 = await runTaskValidationSyncBack();
    console.log(JSON.stringify(r3, null, 2));
  } catch (e) { console.error('Task/Validation sync error:', e.message); }

  process.exit(0);
}
main();
`;

import { writeFileSync } from 'fs';
writeFileSync('/tmp/force-sync-inner.ts', script);

try {
  const output = execSync('cd /home/ubuntu/new-lanterns-status-portal && npx tsx /tmp/force-sync-inner.ts', {
    encoding: 'utf-8',
    timeout: 120000,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  console.log(output);
} catch (e) {
  console.error('Sync failed:', e.stdout || e.stderr || e.message);
}
