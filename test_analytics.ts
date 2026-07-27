import { initDb, db } from "./server/db.js";

async function test() {
  await initDb();
  
  const now = new Date().toISOString();
  
  try {
    await db.prepare(`
      INSERT INTO analytics_visitors (visitor_id, first_seen, last_seen, visit_count, device, browser, os, ip)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen = ?,
        visit_count = CASE WHEN ? = 1 THEN analytics_visitors.visit_count + 1 ELSE analytics_visitors.visit_count END,
        device = COALESCE(EXCLUDED.device, analytics_visitors.device),
        browser = COALESCE(EXCLUDED.browser, analytics_visitors.browser),
        os = COALESCE(EXCLUDED.os, analytics_visitors.os)
    `).run('test-vis', now, now, 'Desktop', 'Chrome', 'Windows', '127.0.0.1', now, 1);
    
    console.log("Visitor inserted");
    
    await db.prepare(`
        INSERT INTO analytics_sessions
          (session_id, visitor_id, started_at, last_seen, landing_page, referrer, referrer_source, pages_viewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO NOTHING
      `).run('test-sess', 'test-vis', now, now, '/', '', 'direct');
      
    console.log("Session inserted");
    
    await db.prepare(`
        UPDATE analytics_sessions
        SET last_seen = ?,
            pages_viewed = pages_viewed + 1,
            exit_page = ?,
            duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER),
            is_bounce = CASE WHEN pages_viewed >= 1 THEN 0 ELSE 1 END
        WHERE session_id = ?
      `).run(now, '/', now, 'test-sess');
      
    console.log("Session updated");
    
  } catch (err) {
    console.error("Test failed:", err);
  }
  
  process.exit(0);
}

test();
