import { initDb, db } from "./server/db.js";

async function test() {
  await initDb();
  const now = new Date().toISOString();
  
  try {
    const isNewSession = true;
    const visitorId = "test-real-1";
    const device = "d", browser = "b", os = "o", ip = "1.2.3.4";
    
    await db.prepare(`
      INSERT INTO analytics_visitors (visitor_id, first_seen, last_seen, visit_count, device, browser, os, ip)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen = ?,
        visit_count = CASE WHEN ? = 1 THEN visit_count + 1 ELSE visit_count END,
        device = COALESCE(device, ?),
        browser = COALESCE(browser, ?),
        os = COALESCE(os, ?)
    `).run(visitorId, now, now, device, browser, os, ip, now, isNewSession ? 1 : 0, device, browser, os);
    
    console.log("Visitor inserted/updated successfully");
  } catch (err) {
    console.error("Test failed:", err);
  }
  process.exit(0);
}
test();
