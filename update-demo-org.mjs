import Database from "better-sqlite3";

const db = new Database("./local.db");

// Update demo organization with a test Linear issue ID
db.prepare(`
  UPDATE organizations 
  SET linearIssueId = 'TEST-123',
      clickupListId = '123456789',
      googleDriveFolderId = '1a2b3c4d5e6f7g8h9i0j'
  WHERE slug = 'demo'
`).run();

console.log("Demo organization updated with integration IDs");
db.close();
