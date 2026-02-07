const mysql = require('mysql2/promise');
require('dotenv/config');

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.query(`
    SELECT 
      r.id,
      q.questionId,
      q.questionText,
      q.sectionId,
      r.response,
      r.createdAt
    FROM responses r
    JOIN questions q ON r.questionId = q.id
    JOIN organizations o ON r.organizationId = o.id
    WHERE o.slug = 'srv-rrmc'
    ORDER BY q.sectionId, q.questionId
  `);

  console.log('RRMC Responses:');
  console.log('================');
  rows.forEach(row => {
    console.log(`\nQuestion ID: ${row.questionId}`);
    console.log(`Section ID: ${row.sectionId}`);
    console.log(`Question: ${row.questionText.substring(0, 80)}...`);
    console.log(`Response: ${row.response || '(empty)'}`);
    console.log(`Created: ${row.createdAt}`);
  });

  console.log(`\nTotal responses: ${rows.length}`);

  await conn.end();
})();
