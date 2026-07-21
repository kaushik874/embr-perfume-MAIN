import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const tables = [
  "about_banner","admin_logs","analytics_page_views","analytics_sessions","analytics_visitors",
  "contact_messages","coupons","customer_addresses","footer_columns","footer_links",
  "hero_banners","login_attempts","newsletter_subscribers","order_items","orders",
  "otp_codes","product_images","products","reviews","site_content","site_sections",
  "users","webhook_events"
];
for (const t of tables) {
  try {
    const r = await pool.query(`SELECT COUNT(*) as c FROM "${t}"`);
    console.log(`${t} — ${r.rows[0].c} rows`);
  } catch (e) {
    console.log(`${t} — TABLE MISSING`);
  }
}
await pool.end();
