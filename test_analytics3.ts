import { initDb, db } from "./server/db.js";

async function test() {
  await initDb();
  const now = new Date().toISOString();
  
  try {
    const isNewSession = true;
    const visitorId = "test-real-3";
    const device = "d", browser = "b", os = "o", ip = "1.2.3.4";
    
    await db.prepare(`
      INSERT INTO analytics_visitors (visitor_id, first_seen, last_seen, visit_count, device, browser, os, ip)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen = ?,
        visit_count = CASE WHEN ? = 1 THEN analytics_visitors.visit_count + 1 ELSE analytics_visitors.visit_count END,
        device = COALESCE(analytics_visitors.device, ?),
        browser = COALESCE(analytics_visitors.browser, ?),
        os = COALESCE(analytics_visitors.os, ?)
    `).run(visitorId, now, now, device, browser, os, ip, now, isNewSession ? 1 : 0, device, browser, os);
    
    console.log("Visitor inserted/updated successfully");
  } catch (err) {
    console.error("Test failed:", err);
  }
  process.exit(0);
}
test();
