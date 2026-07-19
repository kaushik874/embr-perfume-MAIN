import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// ── GET /api/admin/analytics/summary ─────────────────────────────────────
router.get("/summary", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const last7Start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
    const last30Start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const liveThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const totalVisits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions").get()) as any).c;
    const totalUnique = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_visitors").get()) as any).c;
    const returning = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_visitors WHERE visit_count > 1").get()) as any).c;
    const live = ((await db.prepare("SELECT COUNT(DISTINCT visitor_id) as c FROM analytics_sessions WHERE last_seen >= ?").get(liveThreshold)) as any).c;

    const todayVisits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ?").get(todayStart)) as any).c;
    const yesterdayVisits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ? AND started_at < ?").get(yesterdayStart, todayStart)) as any).c;
    const last7Visits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ?").get(last7Start)) as any).c;
    const last30Visits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ?").get(last30Start)) as any).c;
    const monthVisits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ?").get(monthStart)) as any).c;
    const yearVisits = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE started_at >= ?").get(yearStart)) as any).c;

    const avgDuration = ((await db.prepare("SELECT AVG(duration_seconds) as v FROM analytics_sessions WHERE duration_seconds > 0").get()) as any).v || 0;
    const totalForBounce = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions").get()) as any).c;
    const computedBounceRate = await (async () => {
      const total = totalForBounce;
      if (!total) return 0;
      const bounced = ((await db.prepare("SELECT COUNT(*) as c FROM analytics_sessions WHERE is_bounce = 1 OR pages_viewed <= 1").get()) as any).c;
      return Math.round((bounced / total) * 100);
    })();
    const avgPages = ((await db.prepare("SELECT AVG(pages_viewed) as v FROM analytics_sessions").get()) as any).v || 0;

    res.json({
      totalVisits, totalUnique, returning, live,
      todayVisits, yesterdayVisits, last7Visits, last30Visits, monthVisits, yearVisits,
      avgDuration: Math.round(avgDuration),
      bounceRate: computedBounceRate,
      avgPages: Math.round(avgPages * 10) / 10,
    });
  } catch (err) {
    console.error("Analytics summary error:", err);
    res.status(500).json({ error: "Failed to load analytics summary" });
  }
});

// ── GET /api/admin/analytics/chart ───────────────────────────────────────
router.get("/chart", async (req, res) => {
  try {
    const range = (req.query.range as string) || "7d";
    let sql: string;
    let params: any[] = [];

    if (range === "7d") {
      sql = `
        SELECT strftime('%Y-%m-%d', started_at) as date, COUNT(*) as visits,
               COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_sessions
        WHERE started_at >= datetime('now', '-6 days')
        GROUP BY date ORDER BY date
      `;
    } else if (range === "30d") {
      sql = `
        SELECT strftime('%Y-%m-%d', started_at) as date, COUNT(*) as visits,
               COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_sessions
        WHERE started_at >= datetime('now', '-29 days')
        GROUP BY date ORDER BY date
      `;
    } else if (range === "12m") {
      sql = `
        SELECT strftime('%Y-%m', started_at) as date, COUNT(*) as visits,
               COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_sessions
        WHERE started_at >= datetime('now', '-12 months')
        GROUP BY date ORDER BY date
      `;
    } else {
      // yearly — each year
      sql = `
        SELECT strftime('%Y', started_at) as date, COUNT(*) as visits,
               COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_sessions
        GROUP BY date ORDER BY date
      `;
    }

    const rows = await db.prepare(sql).all(...params);
    res.json({ chart: rows });
  } catch (err) {
    console.error("Analytics chart error:", err);
    res.status(500).json({ error: "Failed to load chart data" });
  }
});

// ── GET /api/admin/analytics/pages ───────────────────────────────────────
router.get("/pages", async (_req, res) => {
  try {
    const topPages = await db.prepare(`
      SELECT page, COUNT(*) as views
      FROM analytics_page_views
      GROUP BY page ORDER BY views DESC LIMIT 20
    `).all();

    const landingPages = await db.prepare(`
      SELECT landing_page as page, COUNT(*) as sessions
      FROM analytics_sessions
      WHERE landing_page IS NOT NULL AND landing_page != ''
      GROUP BY landing_page ORDER BY sessions DESC LIMIT 20
    `).all();

    res.json({ topPages, landingPages });
  } catch (err) {
    res.status(500).json({ error: "Failed to load pages data" });
  }
});

// ── GET /api/admin/analytics/devices ─────────────────────────────────────
router.get("/devices", async (_req, res) => {
  try {
    const devices = await db.prepare(`
      SELECT device, COUNT(*) as count FROM analytics_visitors
      WHERE device IS NOT NULL GROUP BY device ORDER BY count DESC
    `).all();

    const browsers = await db.prepare(`
      SELECT browser, COUNT(*) as count FROM analytics_visitors
      WHERE browser IS NOT NULL GROUP BY browser ORDER BY count DESC
    `).all();

    const os = await db.prepare(`
      SELECT os, COUNT(*) as count FROM analytics_visitors
      WHERE os IS NOT NULL GROUP BY os ORDER BY count DESC
    `).all();

    res.json({ devices, browsers, os });
  } catch (err) {
    res.status(500).json({ error: "Failed to load device data" });
  }
});

// ── GET /api/admin/analytics/geo ─────────────────────────────────────────
router.get("/geo", async (_req, res) => {
  try {
    const countries = await db.prepare(`
      SELECT country, COUNT(*) as count FROM analytics_visitors
      WHERE country IS NOT NULL AND country != '' AND country != 'unknown'
      GROUP BY country ORDER BY count DESC LIMIT 20
    `).all();

    const cities = await db.prepare(`
      SELECT city, region, country, COUNT(*) as count FROM analytics_visitors
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city, region, country ORDER BY count DESC LIMIT 20
    `).all();

    res.json({ countries, cities });
  } catch (err) {
    res.status(500).json({ error: "Failed to load geo data" });
  }
});

// ── GET /api/admin/analytics/referrers ───────────────────────────────────
router.get("/referrers", async (_req, res) => {
  try {
    const sources = await db.prepare(`
      SELECT referrer_source as source, COUNT(*) as count
      FROM analytics_sessions
      WHERE referrer_source IS NOT NULL
      GROUP BY referrer_source ORDER BY count DESC
    `).all();

    const referrers = await db.prepare(`
      SELECT referrer, COUNT(*) as count
      FROM analytics_sessions
      WHERE referrer IS NOT NULL AND referrer != '' AND referrer_source = 'referral'
      GROUP BY referrer ORDER BY count DESC LIMIT 20
    `).all();

    res.json({ sources, referrers });
  } catch (err) {
    res.status(500).json({ error: "Failed to load referrer data" });
  }
});

// ── GET /api/admin/analytics/live ────────────────────────────────────────
router.get("/live", async (_req, res) => {
  try {
    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const count = ((await db.prepare(
      "SELECT COUNT(DISTINCT visitor_id) as c FROM analytics_sessions WHERE last_seen >= ?"
    ).get(threshold)) as any).c;

    res.json({ live: count });
  } catch (err) {
    res.json({ live: 0 });
  }
});

export default router;
