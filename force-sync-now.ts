import 'dotenv/config';
import { runNotionSyncBack } from './server/notionSyncBack';
import { runContactsSystemsSync } from './server/notionSyncContacts';
import { runTaskValidationSyncBack } from './server/notionSyncBackTasks';

async function main() {
  console.log('=== Questionnaire Sync ===');
  try {
    const r1 = await runNotionSyncBack();
    console.log(JSON.stringify(r1, null, 2));
  } catch (e: any) { console.error('Questionnaire sync error:', e.message); }

  console.log('\n=== Contacts/Systems Sync ===');
  try {
    const r2 = await runContactsSystemsSync();
    console.log(JSON.stringify(r2, null, 2));
  } catch (e: any) { console.error('Contacts/Systems sync error:', e.message); }

  console.log('\n=== Task/Validation Sync ===');
  try {
    const r3 = await runTaskValidationSyncBack();
    console.log(JSON.stringify(r3, null, 2));
  } catch (e: any) { console.error('Task/Validation sync error:', e.message); }

  process.exit(0);
}
main();
