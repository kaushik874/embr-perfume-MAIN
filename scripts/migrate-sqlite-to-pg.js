#!/usr/bin/env node
/**
 * migrate-sqlite-to-pg.js
 *
 * One-time data migration: reads ALL data from data/embr.db (SQLite)
 * and imports it into the PostgreSQL database specified by DATABASE_URL.
 *
 * Run once:
 *   node scripts/migrate-sqlite-to-pg.js
 *
 * Features:
 *  - Auto-detects actual PostgreSQL column names (handles camelCase vs lowercase)
 *  - Preserves ALL original IDs and timestamps
 *  - Inserts in FK dependency order
 *  - Skips existing rows (safe to re-run)
 *  - Resets identity sequences after import
 *  - Works with Neon, Supabase, Railway, standard PostgreSQL
 */

import Database from "better-sqlite3";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/embr.db");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: SQLite DB not found at ${dbPath}`);
  process.exit(1);
}

console.log("=".repeat(60));
console.log("Embr SQLite → PostgreSQL Migration");
console.log("=".repeat(60));
console.log(`Source: ${dbPath}`);
console.log(`Target: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);
console.log("");

const sqlite = new Database(dbPath, { readonly: true });
const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl });

/** Get all rows from SQLite table, or empty array if table missing */
function sqliteRows(table) {
  try {
    return sqlite.prepare(`SELECT * FROM "${table}"`).all();
  } catch {
    return [];
  }
}

/** Check if a table exists in SQLite */
function sqliteTableExists(table) {
  return Boolean(
    sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
  );
}

/**
 * Fetch the actual column names from PostgreSQL for a table.
 * Returns a Set of lowercase column names.
 */
async function pgColumns(client, table) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r) => r.column_name.toLowerCase()));
}

/**
 * Build an INSERT statement mapping SQLite columns → PostgreSQL columns.
 * Handles camelCase (SQLite) → lowercase (PG) mapping automatically.
 * Only includes columns that actually exist in PG.
 */
function buildInsert(table, sqliteRow, pgCols, conflictCol) {
  const colPairs = []; // { pgCol, value }

  for (const [sqliteCol, value] of Object.entries(sqliteRow)) {
    const lower = sqliteCol.toLowerCase();
    if (pgCols.has(lower)) {
      colPairs.push({ pgCol: lower, value: value === undefined ? null : value });
    }
    // If exact name exists (not just lowercase), prefer it
    else if (pgCols.has(sqliteCol)) {
      colPairs.push({ pgCol: sqliteCol, value: value === undefined ? null : value });
    }
  }

  if (colPairs.length === 0) return null;

  const colList = colPairs.map((p) => `"${p.pgCol}"`).join(", ");
  const placeholders = colPairs.map((_, i) => `$${i + 1}`).join(", ");
  const values = colPairs.map((p) => p.value);

  const sql = `
    INSERT INTO "${table}" (${colList})
    VALUES (${placeholders})
    ON CONFLICT ("${conflictCol}") DO NOTHING
  `;
  return { sql, values };
}

/** Migrate one table: auto-maps SQLite columns to PostgreSQL columns */
async function migrateTable(client, table, conflictCol = "id") {
  if (!sqliteTableExists(table)) {
    console.log(`  [skip] ${table}: not in SQLite`);
    return;
  }

  const rows = sqliteRows(table);
  if (rows.length === 0) {
    console.log(`  [skip] ${table}: empty`);
    return;
  }

  // Get real PG columns for this table
  const pgCols = await pgColumns(client, table);
  if (pgCols.size === 0) {
    console.log(`  [warn] ${table}: table not found in PostgreSQL, skipping`);
    return;
  }

  process.stdout.write(`  ${table} (${rows.length} rows)...`);
  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const built = buildInsert(table, row, pgCols, conflictCol);
    if (!built) {
      errors++;
      continue;
    }
    try {
      const result = await client.query(built.sql, built.values);
      if ((result.rowCount ?? 0) > 0) inserted++;
      else skipped++;
    } catch (err) {
      errors++;
      if (errors <= 3) {
        process.stdout.write(`\n  [!] ${table}: ${err.message}\n  `);
      }
    }
  }
  console.log(` ✓ ${inserted} new | ${skipped} already existed | ${errors} errors`);
}

/** Reset the PostgreSQL identity sequence to MAX(id)+1 */
async function resetSequence(client, table) {
  try {
    const seq = await client.query(
      `SELECT pg_get_serial_sequence('"${table}"', 'id') AS seq`
    );
    if (seq.rows[0]?.seq) {
      await client.query(
        `SELECT setval('${seq.rows[0].seq}',
           COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
      );
    }
  } catch {
    // No sequence (TEXT PK, etc.) — ignore
  }
}

/** Ensure the full schema exists in PostgreSQL before migrating */
async function ensureSchema(client) {
  console.log("  Creating/verifying PostgreSQL schema...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      google_id TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      notes TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      mrp INTEGER NOT NULL,
      image TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      discount_price INTEGER,
      stock INTEGER NOT NULL DEFAULT 0,
      sku TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      tags TEXT,
      collection_type TEXT NOT NULL DEFAULT 'secondary',
      bestseller INTEGER NOT NULL DEFAULT 0,
      key_features TEXT,
      how_to_apply TEXT,
      legal_information TEXT,
      head_notes TEXT,
      heart_notes TEXT,
      base_notes TEXT,
      review TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      total_paise INTEGER NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      shipping_name TEXT,
      shipping_email TEXT,
      shipping_phone TEXT,
      shipping_address TEXT,
      shipping_city TEXT,
      shipping_pincode TEXT,
      tracking_number TEXT,
      paid_at TIMESTAMPTZ,
      shipping_state TEXT,
      shipping_house_number TEXT,
      shipping_street TEXT,
      shipping_area TEXT,
      shipping_landmark TEXT,
      shipping_alternate_phone TEXT,
      shipping_company_name TEXT,
      shipping_address_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price_paise INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL,
      expiry_date TIMESTAMPTZ,
      usage_limit INTEGER,
      times_used INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      order_id INTEGER REFERENCES orders(id),
      title TEXT,
      images TEXT,
      video TEXT,
      reply TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_sections (
      key TEXT PRIMARY KEY,
      hidden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      email TEXT NOT NULL,
      ip TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      house_number TEXT NOT NULL,
      street TEXT NOT NULL,
      area TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      landmark TEXT,
      alternate_mobile TEXT,
      company_name TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      identifier TEXT NOT NULL,
      channel TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hero_banners (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      title TEXT,
      subtitle TEXT,
      description TEXT,
      imageurl TEXT NOT NULL,
      badge TEXT,
      buttontext TEXT,
      buttonlink TEXT,
      showtext INTEGER NOT NULL DEFAULT 1,
      isactive INTEGER NOT NULL DEFAULT 1,
      displayorder INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      productname TEXT,
      producturl TEXT,
      showbutton INTEGER NOT NULL DEFAULT 1,
      darkoverlay INTEGER NOT NULL DEFAULT 1,
      imagefit TEXT NOT NULL DEFAULT 'cover',
      imageposition TEXT NOT NULL DEFAULT 'center center',
      mobileimageposition TEXT NOT NULL DEFAULT 'center center'
    );

    CREATE TABLE IF NOT EXISTS about_banner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT 'Our Story',
      subtitle TEXT NOT NULL DEFAULT 'Crafted in shadow. Worn in light.',
      description TEXT NOT NULL DEFAULT 'Embr began in a small atelier on the edge of a cedar forest.',
      imageurl TEXT NOT NULL DEFAULT '',
      showtext INTEGER NOT NULL DEFAULT 1,
      isactive INTEGER NOT NULL DEFAULT 1,
      darkoverlay INTEGER NOT NULL DEFAULT 1,
      buttontext TEXT NOT NULL DEFAULT '',
      buttonlink TEXT NOT NULL DEFAULT '',
      showbutton INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS footer_columns (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Column',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS footer_links (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      column_id INTEGER NOT NULL REFERENCES footer_columns(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '#',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analytics_visitors (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      visitor_id TEXT NOT NULL UNIQUE,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      visit_count INTEGER NOT NULL DEFAULT 1,
      device TEXT,
      browser TEXT,
      os TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      landing_page TEXT,
      exit_page TEXT,
      referrer TEXT,
      referrer_source TEXT NOT NULL DEFAULT 'direct',
      pages_viewed INTEGER NOT NULL DEFAULT 0,
      is_bounce INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS analytics_page_views (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      session_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      page TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_product ON reviews(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last ON analytics_sessions(last_seen);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last ON analytics_visitors(last_seen);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_page ON analytics_page_views(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session ON analytics_page_views(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_created ON analytics_page_views(created_at);
  `);

  // Add any missing columns to existing tables (safe ALTER TABLE IF NOT EXISTS column)
  const alterStatements = [
    // users table — add missing columns if they exist in SQLite but not PG
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`,
    // products
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS bestseller INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS key_features TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS how_to_apply TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_information TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS head_notes TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS heart_notes TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS base_notes TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS review TEXT`,
    // orders
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_house_number TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_street TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_area TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_landmark TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_alternate_phone TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_company_name TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_id INTEGER`,
    // reviews
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id)`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS video TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_name TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_email TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_phone TEXT`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_pinned INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_featured INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden INTEGER NOT NULL DEFAULT 0`,
    // hero_banners
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS productname TEXT`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS producturl TEXT`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS showbutton INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS darkoverlay INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS imagefit TEXT NOT NULL DEFAULT 'cover'`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS imageposition TEXT NOT NULL DEFAULT 'center center'`,
    `ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS mobileimageposition TEXT NOT NULL DEFAULT 'center center'`,
    // about_banner
    `ALTER TABLE about_banner ADD COLUMN IF NOT EXISTS buttontext TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE about_banner ADD COLUMN IF NOT EXISTS buttonlink TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE about_banner ADD COLUMN IF NOT EXISTS showbutton INTEGER NOT NULL DEFAULT 0`,
  ];

  for (const stmt of alterStatements) {
    try {
      await client.query(stmt);
    } catch {
      // ignore — column may already exist or table may not support it
    }
  }

  console.log("  Schema ready.\n");
}

async function migrate() {
  const client = await pool.connect();
  try {
    await ensureSchema(client);

    // ── Phase 1: No FK dependencies ─────────────────────────────────
    console.log("Phase 1: Base tables");
    console.log("-".repeat(40));
    await migrateTable(client, "users",                  "id");       await resetSequence(client, "users");
    await migrateTable(client, "products",               "id");       await resetSequence(client, "products");
    await migrateTable(client, "coupons",                "id");       await resetSequence(client, "coupons");
    await migrateTable(client, "newsletter_subscribers", "id");       await resetSequence(client, "newsletter_subscribers");
    await migrateTable(client, "site_content",           "key");
    await migrateTable(client, "site_sections",          "key");
    await migrateTable(client, "hero_banners",           "id");       await resetSequence(client, "hero_banners");
    await migrateTable(client, "about_banner",           "id");
    await migrateTable(client, "footer_columns",         "id");       await resetSequence(client, "footer_columns");
    await migrateTable(client, "contact_messages",       "id");       await resetSequence(client, "contact_messages");
    await migrateTable(client, "analytics_visitors",     "visitor_id"); await resetSequence(client, "analytics_visitors");
    await migrateTable(client, "webhook_events",         "event_id");
    await migrateTable(client, "login_attempts",         "id");       await resetSequence(client, "login_attempts");

    // ── Phase 2: FK-dependent tables ────────────────────────────────
    console.log("\nPhase 2: FK-dependent tables");
    console.log("-".repeat(40));
    await migrateTable(client, "footer_links",           "id");       await resetSequence(client, "footer_links");
    await migrateTable(client, "product_images",         "id");       await resetSequence(client, "product_images");
    await migrateTable(client, "orders",                 "id");       await resetSequence(client, "orders");
    await migrateTable(client, "order_items",            "id");       await resetSequence(client, "order_items");
    await migrateTable(client, "reviews",                "id");       await resetSequence(client, "reviews");
    await migrateTable(client, "customer_addresses",     "id");       await resetSequence(client, "customer_addresses");
    await migrateTable(client, "otp_codes",              "id");       await resetSequence(client, "otp_codes");
    await migrateTable(client, "admin_logs",             "id");       await resetSequence(client, "admin_logs");
    await migrateTable(client, "analytics_sessions",     "session_id"); await resetSequence(client, "analytics_sessions");
    await migrateTable(client, "analytics_page_views",   "id");       await resetSequence(client, "analytics_page_views");

    console.log("\n" + "=".repeat(60));
    console.log("✅  Migration complete!");
    console.log("=".repeat(60));
    console.log("\nNext steps:");
    console.log("  1. npm run dev         — verify everything works locally");
    console.log("  2. npm run build       — production build");
    console.log("  3. Deploy to Render\n");
  } catch (err) {
    console.error("\n[FATAL]", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
