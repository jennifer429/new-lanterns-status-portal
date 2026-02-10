/**
 * Sync questions from questionnaireData.ts to database
 * This script ensures the questions table is up-to-date with the source of truth
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { questions } from '../drizzle/schema.ts';
import { questionnaireSections } from '../shared/questionnaireData.ts';
import { eq } from 'drizzle-orm';

// Create database connection
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log('🔄 Syncing questions from questionnaireData.ts to database...\n');

let insertedCount = 0;
let updatedCount = 0;
let skippedCount = 0;

// Process each section
for (const section of questionnaireSections) {
  console.log(`📁 Processing section: ${section.title} (${section.id})`);
  
  let questionNumber = 1;
  
  // Process each question in the section
  for (const question of section.questions) {
    try {
      // Check if question already exists
      const existing = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, question.id))
        .limit(1);
      
      // Generate short title from question text (for filenames)
      const shortTitle = question.text
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);
      
      const questionData = {
        questionId: question.id,
        sectionId: section.id,
        sectionTitle: section.title,
        questionNumber: questionNumber,
        shortTitle: shortTitle,
        questionText: question.text,
        questionType: question.type,
        options: question.options ? JSON.stringify(question.options) : null,
        placeholder: question.placeholder || null,
        notes: question.notes || null,
        required: 0,
      };
      
      if (existing.length === 0) {
        // Insert new question
        await db.insert(questions).values(questionData);
        console.log(`  ✅ Inserted: ${question.id} - ${question.text.substring(0, 50)}...`);
        insertedCount++;
      } else {
        // Update existing question
        await db
          .update(questions)
          .set(questionData)
          .where(eq(questions.questionId, question.id));
        console.log(`  🔄 Updated: ${question.id} - ${question.text.substring(0, 50)}...`);
        updatedCount++;
      }
      
      questionNumber++;
    } catch (error) {
      console.error(`  ❌ Error processing ${question.id}:`, error.message);
    }
  }
  
  console.log('');
}

console.log('✅ Sync complete!');
console.log(`   Inserted: ${insertedCount}`);
console.log(`   Updated: ${updatedCount}`);
console.log(`   Skipped: ${skippedCount}`);

await connection.end();
