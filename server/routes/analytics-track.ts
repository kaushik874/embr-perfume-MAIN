import { Router } from "express";
import { db } from "../db.js";
import { isBot, getDevice, getBrowser, getOS, getReferrerSource, getClientIp } from "../lib/analytics.js";

const router = Router();

// ── POST /api/track  — record a page view ─────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const ua = req.headers["user-agent"] || "";
    if (isBot(ua)) {
      res.json({ ok: true, counted: false });
      return;
    }

    const { visitorId, sessionId, page, referrer, isNewSession } = req.body as {
      visitorId?: string;
      sessionId?: string;
      page?: string;
      referrer?: string;
      isNewSession?: boolean;
    };

    if (!visitorId || !sessionId || !page) {
      res.json({ ok: true, counted: false });
      return;
    }

    const now = new Date().toISOString();
    const device = getDevice(ua);
    const browser = getBrowser(ua);
    const os = getOS(ua);
    const refSource = getReferrerSource(referrer || "");
    const ip = getClientIp(req);
    const pagePath = page.substring(0, 500);

    // Upsert visitor
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

    // Upsert session
    if (isNewSession) {
      await db.prepare(`
        INSERT INTO analytics_sessions
          (session_id, visitor_id, started_at, last_seen, landing_page, referrer, referrer_source, pages_viewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO NOTHING
      `).run(sessionId, visitorId, now, now, pagePath, referrer || "", refSource);
    } else {
      // Update existing session
      await db.prepare(`
        UPDATE analytics_sessions
        SET last_seen = ?,
            pages_viewed = pages_viewed + 1,
            exit_page = ?,
            duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER),
            is_bounce = CASE WHEN pages_viewed >= 1 THEN 0 ELSE 1 END
        WHERE session_id = ?
      `).run(now, pagePath, now, sessionId);
    }

    // Record page view
    await db.prepare(`
      INSERT INTO analytics_page_views (session_id, visitor_id, page, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, visitorId, pagePath, now);

    res.json({ ok: true, counted: true });
  } catch (err) {
    console.error("Analytics track error:", err);
    res.json({ ok: true, counted: false });
  }
});

// ── PATCH /api/track/heartbeat — keep session alive ──────────────────────
router.patch("/heartbeat", async (req, res) => {
  try {
    const ua = req.headers["user-agent"] || "";
    if (isBot(ua)) { res.json({ ok: true }); return; }

    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) { res.json({ ok: true }); return; }

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE analytics_sessions
      SET last_seen = ?,
          duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)
      WHERE session_id = ?
    `).run(now, now, sessionId);

    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics heartbeat error:", err);
    res.json({ ok: true });
  }
});

export default router;
