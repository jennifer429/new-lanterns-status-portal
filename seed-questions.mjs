import { getDb } from './server/db.ts';
import { questions } from './drizzle/schema.ts';
import { questionnaireSections } from './shared/questionnaireData.ts';

const db = await getDb();

console.log('Seeding questions table...');

let totalInserted = 0;

for (const section of questionnaireSections) {
  console.log(`\nProcessing section: ${section.title}`);
  
  for (let i = 0; i < section.questions.length; i++) {
    const question = section.questions[i];
    
    const questionData = {
      questionId: question.id,
      sectionId: section.id,
      sectionTitle: section.title,
      questionNumber: i + 1, // 1-indexed
      questionText: question.text,
      questionType: question.type,
      options: question.options ? JSON.stringify(question.options) : null,
      placeholder: question.placeholder || null,
      notes: question.notes || null,
      required: 1, // All questions are required eventually
    };
    
    await db.insert(questions).values(questionData);
    totalInserted++;
    console.log(`  ✓ Inserted Q${i + 1}: ${question.id} - ${question.text.substring(0, 60)}...`);
  }
}

console.log(`\n✅ Successfully seeded ${totalInserted} questions across ${questionnaireSections.length} sections`);

process.exit(0);
