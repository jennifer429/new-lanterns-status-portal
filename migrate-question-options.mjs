import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('Migrating question options from JSON to question_options table...\n');

// Get all questions that have options (dropdown, multi-select)
const questionsWithOptions = await db
  .select()
  .from(schema.questions)
  .where(sql`options IS NOT NULL AND options != ''`);

console.log(`Found ${questionsWithOptions.length} questions with options\n`);

let totalOptionsInserted = 0;

for (const question of questionsWithOptions) {
  console.log(`Processing ${question.questionId} (${question.shortTitle})...`);
  
  try {
    // Parse JSON options
    const options = JSON.parse(question.options);
    
    if (!Array.isArray(options) || options.length === 0) {
      console.log(`  ⚠️  Skipping - invalid or empty options array`);
      continue;
    }
    
    // Insert each option
    for (let i = 0; i < options.length; i++) {
      const optionText = options[i];
      
      // Create value and label
      // For simple options, value = label (lowercase, no spaces)
      const optionValue = optionText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const optionLabel = optionText;
      
      await db.insert(schema.questionOptions).values({
        questionId: question.id,
        optionValue,
        optionLabel,
        displayOrder: i + 1,
        isActive: 1,
      });
      
      totalOptionsInserted++;
    }
    
    console.log(`  ✓ Inserted ${options.length} options`);
    
  } catch (error) {
    console.error(`  ❌ Error parsing options for ${question.questionId}:`, error.message);
  }
}

console.log(`\n✅ Migration complete!`);
console.log(`   Total options inserted: ${totalOptionsInserted}`);
console.log(`   Questions processed: ${questionsWithOptions.length}`);

await connection.end();
