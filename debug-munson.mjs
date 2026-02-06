import { getDb } from './server/db.ts';
import { intakeResponses, organizations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

// Get Munson org
const [munson] = await db.select().from(organizations).where(eq(organizations.slug, 'radone-munson')).limit(1);
console.log('Munson org ID:', munson.id);

// Get all responses
const responses = await db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, munson.id)).limit(20);

console.log('\nFirst 20 responses:');
responses.forEach(r => {
  console.log(`Section: ${r.section}, QuestionID: ${r.questionId}, Response: ${r.response ? r.response.substring(0, 50) : 'NULL'}`);
});

// Count by section
const sectionCounts = {};
const allResponses = await db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, munson.id));
allResponses.forEach(r => {
  sectionCounts[r.section] = (sectionCounts[r.section] || 0) + 1;
});

console.log('\nCounts by section:');
console.log(sectionCounts);

// Count completed
const completed = allResponses.filter(r => r.response && r.response !== '');
console.log(`\nTotal responses: ${allResponses.length}`);
console.log(`Completed responses: ${completed.length}`);
console.log(`Completion percentage: ${Math.round((completed.length / 51) * 100)}%`);

process.exit(0);
