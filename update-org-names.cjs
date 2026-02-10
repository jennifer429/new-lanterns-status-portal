const mysql = require('mysql2/promise');
require('dotenv/config');

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Query current organization names
  const [orgs] = await conn.query('SELECT id, name, slug FROM organizations ORDER BY name');
  
  console.log('Current Organization Names:');
  console.log('===========================');
  orgs.forEach(org => {
    console.log(`ID: ${org.id} | Name: ${org.name} | Slug: ${org.slug}`);
  });
  
  console.log('\n\nUpdating names to remove "Radiology One - " prefix...\n');
  
  // Update each organization that has the prefix
  for (const org of orgs) {
    if (org.name.startsWith('Radiology One - ')) {
      const newName = org.name.replace('Radiology One - ', '');
      await conn.query('UPDATE organizations SET name = ? WHERE id = ?', [newName, org.id]);
      console.log(`✓ Updated: "${org.name}" → "${newName}"`);
    } else {
      console.log(`- Skipped: "${org.name}" (no prefix found)`);
    }
  }
  
  console.log('\n\nUpdated Organization Names:');
  console.log('===========================');
  const [updatedOrgs] = await conn.query('SELECT id, name, slug FROM organizations ORDER BY name');
  updatedOrgs.forEach(org => {
    console.log(`ID: ${org.id} | Name: ${org.name} | Slug: ${org.slug}`);
  });

  await conn.end();
  console.log('\n✅ Done!');
})();
