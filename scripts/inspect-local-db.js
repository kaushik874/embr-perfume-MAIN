import { DatabaseSync } from 'node:sqlite';

try {
  const db = new DatabaseSync('data/embr.db', { readOnly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log("=== Local SQLite Database (data/embr.db) Contents ===");
  for (const t of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
      console.log(`- ${t.name}: ${count.c} rows`);
    } catch (err) {
      console.log(`- ${t.name}: error (${err.message})`);
    }
  }
} catch (e) {
  console.error("Could not open data/embr.db:", e.message);
}
