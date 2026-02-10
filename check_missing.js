const mysql = require('mysql2/promise');
require('dotenv').config();

// Import questionnaire data
const { questionnaireSections } = require('./shared/questionnaireData.ts');

(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get RRAL responses
  const [responses] = await connection.execute(
    `SELECT questionId FROM intakeResponses WHERE organizationId = 240001`
  );
  
  const savedQuestionIds = new Set(responses.map(r => r.questionId));
  console.log(`Saved responses: ${savedQuestionIds.size}`);
  
  // Get all required question IDs from questionnaireData
  const allQuestionIds = [];
  questionnaireSections.forEach(section => {
    if (section.questions) {
      section.questions.forEach(q => {
        allQuestionIds.push(q.id);
      });
    }
    // Add workflow config IDs
    if (section.type === 'workflow') {
      allQuestionIds.push(`${section.id}_config`);
    }
  });
  
  console.log(`Total questions in questionnaire: ${allQuestionIds.length}`);
  
  // Find missing questions
  const missingQuestions = allQuestionIds.filter(id => !savedQuestionIds.has(id));
  
  console.log(`\nMissing questions (${missingQuestions.length}):`);
  missingQuestions.forEach(id => {
    // Find which section this question belongs to
    for (const section of questionnaireSections) {
      if (section.questions) {
        const question = section.questions.find(q => q.id === id);
        if (question) {
          console.log(`  ${id}: ${question.text.substring(0, 80)}... (Section: ${section.title})`);
          if (question.conditionalOn) {
            console.log(`    → Conditional on ${question.conditionalOn.questionId} = "${question.conditionalOn.value}"`);
          }
        }
      }
    }
  });
  
  await connection.end();
})();
