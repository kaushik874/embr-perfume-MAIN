import { db } from "../db.js";

let _migrated = false;

/**
 * Run schema migrations for new features.
 * This is safe to call multiple times — it checks for existing columns before adding.
 */
export function runMigrations() {
  if (_migrated) return;
  _migrated = true;

  const productCols = db.prepare("PRAGMA table_info(products)").all() as { name: string }[];
  const addProductCol = (col: string, sql: string) => {
    if (!productCols.some((c) => c.name === col)) db.exec(sql);
  };
  addProductCol("discount_price", "ALTER TABLE products ADD COLUMN discount_price INTEGER");
  addProductCol("stock", "ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0");
  addProductCol("sku", "ALTER TABLE products ADD COLUMN sku TEXT");
  addProductCol("category", "ALTER TABLE products ADD COLUMN category TEXT");
  addProductCol("status", "ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'published'");
  addProductCol("tags", "ALTER TABLE products ADD COLUMN tags TEXT");

  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const addOrderCol = (col: string, sql: string) => {
    if (!orderCols.some((c) => c.name === col)) db.exec(sql);
  };
  addOrderCol("tracking_number", "ALTER TABLE orders ADD COLUMN tracking_number TEXT");
  addOrderCol("paid_at", "ALTER TABLE orders ADD COLUMN paid_at TEXT");
  addOrderCol("shipping_state", "ALTER TABLE orders ADD COLUMN shipping_state TEXT");
  addOrderCol("shipping_house_number", "ALTER TABLE orders ADD COLUMN shipping_house_number TEXT");
  addOrderCol("shipping_street", "ALTER TABLE orders ADD COLUMN shipping_street TEXT");
  addOrderCol("shipping_area", "ALTER TABLE orders ADD COLUMN shipping_area TEXT");
  addOrderCol("shipping_landmark", "ALTER TABLE orders ADD COLUMN shipping_landmark TEXT");
  addOrderCol("shipping_alternate_phone", "ALTER TABLE orders ADD COLUMN shipping_alternate_phone TEXT");
  addOrderCol("shipping_company_name", "ALTER TABLE orders ADD COLUMN shipping_company_name TEXT");
  addOrderCol("shipping_address_id", "ALTER TABLE orders ADD COLUMN shipping_address_id INTEGER");

  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "google_id")) {
    db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      identifier TEXT NOT NULL,
      channel TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      ip TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hero_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      subtitle TEXT,
      description TEXT,
      imageUrl TEXT NOT NULL,
      productName TEXT,
      productUrl TEXT,
      badge TEXT,
      buttonText TEXT,
      buttonLink TEXT,
      showButton INTEGER NOT NULL DEFAULT 1,
      darkOverlay INTEGER NOT NULL DEFAULT 1,
      imageFit TEXT NOT NULL DEFAULT 'cover',
      imagePosition TEXT NOT NULL DEFAULT 'center center',
      mobileImagePosition TEXT NOT NULL DEFAULT 'center center',
      showText INTEGER NOT NULL DEFAULT 1,
      isActive INTEGER NOT NULL DEFAULT 1,
      displayOrder INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const heroCols = db.prepare("PRAGMA table_info(hero_banners)").all() as { name: string }[];
  const addHeroCol = (col: string, sql: string) => {
    if (!heroCols.some((c) => c.name === col)) db.exec(sql);
  };
  addHeroCol("productName", "ALTER TABLE hero_banners ADD COLUMN productName TEXT");
  addHeroCol("productUrl", "ALTER TABLE hero_banners ADD COLUMN productUrl TEXT");
  addHeroCol("showButton", "ALTER TABLE hero_banners ADD COLUMN showButton INTEGER NOT NULL DEFAULT 1");
  addHeroCol("darkOverlay", "ALTER TABLE hero_banners ADD COLUMN darkOverlay INTEGER NOT NULL DEFAULT 1");
  addHeroCol("imageFit", "ALTER TABLE hero_banners ADD COLUMN imageFit TEXT NOT NULL DEFAULT 'cover'");
  addHeroCol("imagePosition", "ALTER TABLE hero_banners ADD COLUMN imagePosition TEXT NOT NULL DEFAULT 'center center'");
  addHeroCol("mobileImagePosition", "ALTER TABLE hero_banners ADD COLUMN mobileImagePosition TEXT NOT NULL DEFAULT 'center center'");
  db.exec(`
    UPDATE hero_banners
    SET
      productName = CASE WHEN productName IS NULL OR productName = '' THEN COALESCE(title, '') ELSE productName END,
      productUrl = CASE WHEN productUrl IS NULL OR productUrl = '' THEN COALESCE(buttonLink, '') ELSE productUrl END
  `);

  const count = db.prepare("SELECT COUNT(*) as c FROM hero_banners").get() as { c: number };
  if (count.c === 0) {
    db.prepare(`
      INSERT INTO hero_banners (title, subtitle, description, imageUrl, productName, productUrl, badge, buttonText, buttonLink, showText, isActive, displayOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Most Unique", 
      "— EXTRAIT DE PARFUM · 50ML", 
      "Creamy milk folded into warm spice and soft woods — our signature gourmand in emerald glass.", 
      "/images/main-hero.png", 
      "Milky Way",
      "/product/milky-way",
      "BEST SELLER", 
      "Shop Now ₹499", 
      "/product/milky-way", 
      1, 
      1, 
      0
    );
  }

  // About page banner table
  db.exec(`
    CREATE TABLE IF NOT EXISTS about_banner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT 'Our Story',
      subtitle TEXT NOT NULL DEFAULT 'Crafted in shadow. Worn in light.',
      description TEXT NOT NULL DEFAULT 'Embr began in a small atelier on the edge of a cedar forest. We believed fragrance should be felt before it is smelled — a presence, a memory, a whisper that lingers long after you have left the room.',
      imageUrl TEXT NOT NULL DEFAULT '',
      showText INTEGER NOT NULL DEFAULT 1,
      isActive INTEGER NOT NULL DEFAULT 1,
      darkOverlay INTEGER NOT NULL DEFAULT 1,
      buttonText TEXT NOT NULL DEFAULT '',
      buttonLink TEXT NOT NULL DEFAULT '',
      showButton INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure exactly one row exists
  const aboutCount = db.prepare("SELECT COUNT(*) as c FROM about_banner").get() as { c: number };
  if (aboutCount.c === 0) {
    db.prepare("INSERT INTO about_banner (id) VALUES (1)").run();
  }

  // Dynamic footer columns + links tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS footer_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Column',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS footer_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '#',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (column_id) REFERENCES footer_columns(id) ON DELETE CASCADE
    );
  `);

  // Seed default footer columns if empty
  const fcCount = db.prepare("SELECT COUNT(*) as c FROM footer_columns").get() as { c: number };
  if (fcCount.c === 0) {
    const insertCol = db.prepare("INSERT INTO footer_columns (title, sort_order) VALUES (?, ?)");
    const insertLink = db.prepare("INSERT INTO footer_links (column_id, label, url, sort_order) VALUES (?, ?, ?, ?)");

    const shop = insertCol.run("SHOP", 0).lastInsertRowid as number;
    insertLink.run(shop, "All Fragrances", "/#collection", 0);
    insertLink.run(shop, "Milky Way", "/product/milky-way", 1);
    insertLink.run(shop, "Your Bag", "/cart", 2);
    insertLink.run(shop, "Orders", "/account", 3);

    const info = insertCol.run("INFO", 1).lastInsertRowid as number;
    insertLink.run(info, "About", "/about", 0);
    insertLink.run(info, "Shipping", "/shipping", 1);
    insertLink.run(info, "Returns", "/returns", 2);
    insertLink.run(info, "FAQ", "/faq", 3);
    insertLink.run(info, "Privacy Policy", "/policy", 4);

    const connect = insertCol.run("CONNECT", 2).lastInsertRowid as number;
    insertLink.run(connect, "Instagram", "#", 0);
    insertLink.run(connect, "TikTok", "#", 1);
  }

  db.prepare(`
    INSERT INTO site_content (key, value) VALUES ('site_logo', '/images/embr-logo.png')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run();

  // ── Analytics Tables ───────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL UNIQUE,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      landing_page TEXT,
      exit_page TEXT,
      referrer TEXT,
      referrer_source TEXT NOT NULL DEFAULT 'direct',
      pages_viewed INTEGER NOT NULL DEFAULT 0,
      is_bounce INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS analytics_page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      page TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last ON analytics_sessions(last_seen);
    CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last ON analytics_visitors(last_seen);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_page ON analytics_page_views(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session ON analytics_page_views(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_created ON analytics_page_views(created_at);

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_product ON reviews(user_id, product_id);
  `);
}
