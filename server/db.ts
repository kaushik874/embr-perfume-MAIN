import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath =
  process.env.DATABASE_PATH ?? path.join(dataDir, "embr.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      notes TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      mrp INTEGER NOT NULL,
      discount_price INTEGER,
      stock INTEGER NOT NULL DEFAULT 0,
      sku TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      tags TEXT,
      image TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_paise INTEGER NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_paise INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL,
      expiry_date TEXT,
      usage_limit INTEGER,
      times_used INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      rating INTEGER NOT NULL,
      title TEXT,
      comment TEXT,
      images TEXT,
      video TEXT,
      reply TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      ip TEXT NOT NULL,
      success INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

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

  migrateSchema();

  const count = db
    .prepare("SELECT COUNT(*) as c FROM products")
    .get() as { c: number };

  if (count.c === 0) {
    const insert = db.prepare(`
      INSERT INTO products (slug, name, notes, description, price, mrp, image, featured, collection_type)
      VALUES (@slug, @name, @notes, @description, @price, @mrp, @image, @featured, @collection_type)
    `);

    const products = [
      {
        slug: "ember-oud",
        name: "Ember Oud",
        notes: "Oud · Saffron · Amber",
        description: "Smoky oud wrapped in warm amber resin.",
        price: 399,
        mrp: 699,
        image: "/images/bottle-forest.svg",
        featured: 1,
        collection_type: "primary",
      },
      {
        slug: "forest-veil",
        name: "Forest Veil",
        notes: "Cedar · Pine · Vetiver",
        description: "Deep green woods after rain.",
        price: 449,
        mrp: 799,
        image: "/images/bottle-forest.svg",
        featured: 0,
        collection_type: "secondary",
      },
      {
        slug: "midnight-smoke",
        name: "Midnight Smoke",
        notes: "Birch · Leather · Musk",
        description: "Nocturnal leather and birch tar.",
        price: 499,
        mrp: 899,
        image: "/images/bottle-forest.svg",
        featured: 1,
        collection_type: "primary",
      },
      {
        slug: "black-iris",
        name: "Black Iris",
        notes: "Iris · Patchouli · Tonka",
        description: "Powdery iris on a dark patchouli base.",
        price: 429,
        mrp: 749,
        image: "/images/bottle-rose.svg",
        featured: 0,
        collection_type: "secondary",
      },
      {
        slug: "wild-cypress",
        name: "Wild Cypress",
        notes: "Cypress · Sage · Moss",
        description: "Mediterranean herbs and sun-warmed moss.",
        price: 379,
        mrp: 649,
        image: "/images/bottle-mist.svg",
        featured: 0,
        collection_type: "secondary",
      },
      {
        slug: "velvet-ash",
        name: "Velvet Ash",
        notes: "Tobacco · Vanilla · Oak",
        description: "Creamy tobacco and aged vanilla.",
        price: 549,
        mrp: 949,
        image: "/images/bottle-sand.svg",
        featured: 0,
        collection_type: "secondary",
      },
      {
        slug: "sacred-love",
        name: "Sacred Love",
        notes: "Rose · Saffron · Amber",
        description: "Velvet rose with rare saffron — signature edition.",
        price: 499,
        mrp: 899,
        image: "/images/bottle-rose.svg",
        featured: 1,
        collection_type: "primary",
      },
      {
        slug: "soft-petals",
        name: "Soft Petals",
        notes: "Jasmine · Bergamot · Musk",
        description: "White florals and sun-warmed citrus.",
        price: 399,
        mrp: 699,
        image: "/images/bottle-ivory.svg",
        featured: 0,
        collection_type: "secondary",
      },
    ];

    const seed = db.transaction(() => {
      for (const p of products) insert.run(p);
    });
    seed();
  }

  ensureMilkyWay();
}

function migrateSchema() {
  const userCols = db.prepare("PRAGMA table_info(users)").all() as {
    name: string;
  }[];
  if (!userCols.some((c) => c.name === "phone")) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  }
  if (!userCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  const productCols = db.prepare("PRAGMA table_info(products)").all() as {
    name: string;
  }[];
  const addProductCol = (col: string, sql: string) => {
    if (!productCols.some((c) => c.name === col)) db.exec(sql);
  };
  addProductCol("discount_price", "ALTER TABLE products ADD COLUMN discount_price INTEGER");
  addProductCol("stock", "ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0");
  addProductCol("sku", "ALTER TABLE products ADD COLUMN sku TEXT");
  addProductCol("category", "ALTER TABLE products ADD COLUMN category TEXT");
  addProductCol("status", "ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'published'");
  addProductCol("tags", "ALTER TABLE products ADD COLUMN tags TEXT");
  addProductCol("collection_type", "ALTER TABLE products ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'secondary'");
  addProductCol("bestseller", "ALTER TABLE products ADD COLUMN bestseller INTEGER NOT NULL DEFAULT 0");
  addProductCol("key_features", "ALTER TABLE products ADD COLUMN key_features TEXT");
  addProductCol("how_to_apply", "ALTER TABLE products ADD COLUMN how_to_apply TEXT");
  addProductCol("legal_information", "ALTER TABLE products ADD COLUMN legal_information TEXT");
  addProductCol("head_notes", "ALTER TABLE products ADD COLUMN head_notes TEXT");
  addProductCol("heart_notes", "ALTER TABLE products ADD COLUMN heart_notes TEXT");
  addProductCol("base_notes", "ALTER TABLE products ADD COLUMN base_notes TEXT");
  addProductCol("review", "ALTER TABLE products ADD COLUMN review TEXT");

  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as {
    name: string;
  }[];
  const addOrderCol = (col: string, sql: string) => {
    if (!orderCols.some((c) => c.name === col)) db.exec(sql);
  };
  addOrderCol("shipping_name", "ALTER TABLE orders ADD COLUMN shipping_name TEXT");
  addOrderCol("shipping_email", "ALTER TABLE orders ADD COLUMN shipping_email TEXT");
  addOrderCol("shipping_phone", "ALTER TABLE orders ADD COLUMN shipping_phone TEXT");
  addOrderCol("shipping_address", "ALTER TABLE orders ADD COLUMN shipping_address TEXT");
  addOrderCol("shipping_city", "ALTER TABLE orders ADD COLUMN shipping_city TEXT");
  addOrderCol("shipping_pincode", "ALTER TABLE orders ADD COLUMN shipping_pincode TEXT");
  addOrderCol("shipping_state", "ALTER TABLE orders ADD COLUMN shipping_state TEXT");
  addOrderCol("shipping_house_number", "ALTER TABLE orders ADD COLUMN shipping_house_number TEXT");
  addOrderCol("shipping_street", "ALTER TABLE orders ADD COLUMN shipping_street TEXT");
  addOrderCol("shipping_area", "ALTER TABLE orders ADD COLUMN shipping_area TEXT");
  addOrderCol("shipping_landmark", "ALTER TABLE orders ADD COLUMN shipping_landmark TEXT");
  addOrderCol("shipping_alternate_phone", "ALTER TABLE orders ADD COLUMN shipping_alternate_phone TEXT");
  addOrderCol("shipping_company_name", "ALTER TABLE orders ADD COLUMN shipping_company_name TEXT");
  addOrderCol("shipping_address_id", "ALTER TABLE orders ADD COLUMN shipping_address_id INTEGER");
  addOrderCol("tracking_number", "ALTER TABLE orders ADD COLUMN tracking_number TEXT");

  const reviewCols = db.prepare("PRAGMA table_info(reviews)").all() as {
    name: string;
  }[];
  const addReviewCol = (col: string, sql: string) => {
    if (!reviewCols.some((c) => c.name === col)) db.exec(sql);
  };
  addReviewCol("order_id", "ALTER TABLE reviews ADD COLUMN order_id INTEGER REFERENCES orders(id)");
  addReviewCol("title", "ALTER TABLE reviews ADD COLUMN title TEXT");
  addReviewCol("images", "ALTER TABLE reviews ADD COLUMN images TEXT");
  addReviewCol("video", "ALTER TABLE reviews ADD COLUMN video TEXT");
  addReviewCol("reply", "ALTER TABLE reviews ADD COLUMN reply TEXT");
  addReviewCol("customer_name", "ALTER TABLE reviews ADD COLUMN customer_name TEXT");
  addReviewCol("customer_email", "ALTER TABLE reviews ADD COLUMN customer_email TEXT");
  addReviewCol("customer_phone", "ALTER TABLE reviews ADD COLUMN customer_phone TEXT");
  addReviewCol("is_pinned", "ALTER TABLE reviews ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0");
  addReviewCol("is_featured", "ALTER TABLE reviews ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0");
  addReviewCol("is_hidden", "ALTER TABLE reviews ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0");
}

function ensureMilkyWay() {
  const existing = db
    .prepare("SELECT id FROM products WHERE slug = ?")
    .get("milky-way") as { id: number } | undefined;

  const product = {
    slug: "milky-way",
    name: "Milky Way",
    notes: "Creamy Milk · Warm Spice · Soft Woods",
    description:
      "Our most unique gourmand fragrance — creamy milk folded into warm spice and soft woods. A velvet elixir in emerald glass, bottled for slow evenings and lingering presence.",
    price: 499,
    mrp: 899,
    image: "/images/milky-way.png",
    featured: 1,
    collection_type: "primary"
  };

  if (existing) {
    db.prepare(
      `UPDATE products SET name = @name, notes = @notes, description = @description,
       price = @price, mrp = @mrp, image = @image, featured = @featured, collection_type = @collection_type WHERE slug = @slug`,
    ).run(product);
  } else {
    db.prepare(
      `INSERT INTO products (slug, name, notes, description, price, mrp, image, featured, collection_type)
       VALUES (@slug, @name, @notes, @description, @price, @mrp, @image, @featured, @collection_type)`,
    ).run(product);
  }
}

export type UserRow = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
};

export type ProductRow = {
  id: number;
  slug: string;
  name: string;
  notes: string;
  description: string | null;
  price: number;
  mrp: number;
  discount_price: number | null;
  stock: number;
  sku: string | null;
  category: string | null;
  status: string;
  tags: string | null;
  image: string | null;
  featured: number;
  collection_type: string;
  bestseller: number;
  key_features: string | null;
  how_to_apply: string | null;
  legal_information: string | null;
  head_notes: string | null;
  heart_notes: string | null;
  base_notes: string | null;
  review: string | null;
};
