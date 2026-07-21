// Temporary check - run from project root
const { createRequire } = await import("module");
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const db = new Database("data/embr.db", { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
tables.forEach(t => {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
  console.log(`${t.name} — ${count.c} rows`);
});
db.close();
