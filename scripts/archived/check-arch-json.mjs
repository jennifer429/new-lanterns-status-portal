import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT questionId, response FROM responses WHERE response LIKE '%{%' AND questionId LIKE '%ARCH%' LIMIT 3"
);
for (const row of rows) {
  console.log('---', row.questionId);
  console.log(row.response.substring(0, 800));
}
const [rows2] = await conn.execute(
  "SELECT questionId, response FROM responses WHERE response LIKE '%{%' AND questionId NOT LIKE '%workflow_config%' AND response NOT LIKE '[%' LIMIT 5"
);
console.log('\n=== Non-workflow, non-array JSON answers ===');
for (const row of rows2) {
  console.log('---', row.questionId);
  console.log(row.response.substring(0, 800));
}
await conn.end();
process.exit(0);
