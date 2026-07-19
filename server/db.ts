import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient, types } from "pg";

type Queryable = Pick<Pool, "query"> | PoolClient;

export type RunResult = {
  changes: number;
  lastInsertRowid?: number | string;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it to your PostgreSQL connection string before starting the server.",
  );
}

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 15_000),
});

pool.on("error", (err) => {
  console.error("[PostgreSQL] Unexpected idle client error:", err);
});

const transactionStore = new AsyncLocalStorage<PoolClient>();

const camelCaseColumns: Record<string, string> = {
  imageurl: "imageUrl",
  productname: "productName",
  producturl: "productUrl",
  buttontext: "buttonText",
  buttonlink: "buttonLink",
  showbutton: "showButton",
  darkoverlay: "darkOverlay",
  imagefit: "imageFit",
  imageposition: "imagePosition",
  mobileimageposition: "mobileImagePosition",
  showtext: "showText",
  isactive: "isActive",
  displayorder: "displayOrder",
};

const insertIdTables = new Set([
  "about_banner",
  "admin_logs",
  "analytics_page_views",
  "analytics_sessions",
  "analytics_visitors",
  "contact_messages",
  "coupons",
  "customer_addresses",
  "footer_columns",
  "footer_links",
  "hero_banners",
  "login_attempts",
  "newsletter_subscribers",
  "order_items",
  "orders",
  "otp_codes",
  "product_images",
  "products",
  "reviews",
  "users",
]);

function currentExecutor(): Queryable {
  return transactionStore.getStore() ?? pool;
}

function normalizeRow<T>(row: T): T {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    normalized[camelCaseColumns[key] ?? key] = value;
  }
  return normalized as T;
}

function normalizeRows<T>(rows: T[]): T[] {
  return rows.map(normalizeRow);
}

function translateSqliteSyntax(sql: string) {
  let translated = sql;

  translated = translated.replace(
    /CAST\s*\(\s*\(\s*julianday\s*\(([^)]+)\)\s*-\s*julianday\s*\(([^)]+)\)\s*\)\s*\*\s*86400\s+AS\s+INTEGER\s*\)/gi,
    (_match, endValue: string, startValue: string) =>
      `GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${endValue.trim()}::timestamp - ${startValue.trim()}::timestamp)))::integer)`,
  );

  translated = translated.replace(
    /datetime\s*\(\s*'now'\s*,\s*'([+-])(\d+)\s+(minutes?|hours?|days?|months?)'\s*\)/gi,
    (_match, sign: string, amount: string, unit: string) =>
      `(CURRENT_TIMESTAMP ${sign} INTERVAL '${amount} ${unit}')`,
  );
  translated = translated.replace(/datetime\s*\(\s*'now'\s*\)/gi, "CURRENT_TIMESTAMP");
  translated = translated.replace(/date\s*\(\s*'now'\s*\)/gi, "CURRENT_DATE");
  translated = translated.replace(
    /datetime\s*\(\s*([^)]+?)\s*\)/gi,
    (_match, value: string) => `(${value.trim()}::timestamp)`,
  );
  translated = translated.replace(
    /date\s*\(\s*([^)]+?)\s*\)/gi,
    (_match, value: string) => `(${value.trim()}::timestamp::date)`,
  );
  translated = translated.replace(
    /strftime\s*\(\s*'%Y-%m-%d'\s*,\s*([^)]+?)\s*\)/gi,
    (_match, value: string) => `to_char(${value.trim()}::timestamp, 'YYYY-MM-DD')`,
  );
  translated = translated.replace(
    /strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+?)\s*\)/gi,
    (_match, value: string) => `to_char(${value.trim()}::timestamp, 'YYYY-MM')`,
  );
  translated = translated.replace(
    /strftime\s*\(\s*'%Y'\s*,\s*([^)]+?)\s*\)/gi,
    (_match, value: string) => `to_char(${value.trim()}::timestamp, 'YYYY')`,
  );
  translated = translated.replace(/MAX\s*\(\s*0\s*,\s*stock\s*-\s*\?\s*\)/gi, "GREATEST(0, stock - ?)");
  translated = translated.replace(/\bLIKE\b/g, "ILIKE");

  return translated;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  );
}

function buildQuery(sql: string, args: unknown[]) {
  let text = translateSqliteSyntax(sql);
  const values: unknown[] = [];

  if (args.length === 1 && isPlainObject(args[0]) && /@[a-zA-Z_][a-zA-Z0-9_]*/.test(text)) {
    const params = args[0];
    const indexes = new Map<string, number>();
    text = text.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
      const existing = indexes.get(key);
      if (existing) return `$${existing}`;
      values.push(params[key] ?? null);
      const index = values.length;
      indexes.set(key, index);
      return `$${index}`;
    });
  } else {
    values.push(...args);
    let index = 0;
    text = text.replace(/\?/g, () => `$${++index}`);
  }

  return { text, values };
}

function appendReturningId(text: string) {
  const match = text.match(/^\s*INSERT\s+INTO\s+("?([a-zA-Z_][a-zA-Z0-9_]*)"?)/i);
  if (!match) return text;
  if (/\bRETURNING\b/i.test(text)) return text;

  const tableName = match[2].toLowerCase();
  if (!insertIdTables.has(tableName)) return text;

  return `${text.trim().replace(/;$/, "")} RETURNING id`;
}

class PgStatement {
  constructor(private readonly sql: string) {}

  async all<T = unknown>(...args: unknown[]): Promise<T[]> {
    const { text, values } = buildQuery(this.sql, args);
    const result = await currentExecutor().query(text, values);
    return normalizeRows(result.rows as T[]);
  }

  async get<T = unknown>(...args: unknown[]): Promise<T | undefined> {
    const rows = await this.all<T>(...args);
    return rows[0];
  }

  async run(...args: unknown[]): Promise<RunResult> {
    const { text, values } = buildQuery(this.sql, args);
    const result = await currentExecutor().query(appendReturningId(text), values);
    const inserted = normalizeRow(result.rows?.[0] ?? {}) as { id?: number | string };

    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: inserted.id,
    };
  }
}

export const db = {
  prepare(sql: string) {
    return new PgStatement(sql);
  },

  async exec(sql: string) {
    return currentExecutor().query(sql);
  },

  transaction<T>(fn: () => Promise<T> | T) {
    return async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await transactionStore.run(client, async () => fn());
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    };
  },
};

export const postgresSchema = `
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
  description TEXT NOT NULL DEFAULT 'Embr began in a small atelier on the edge of a cedar forest. We believed fragrance should be felt before it is smelled - a presence, a memory, a whisper that lingers long after you have left the room.',
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
`;

export async function initDb(options: { seedDefaults?: boolean } = {}) {
  const { seedDefaults = true } = options;
  await db.exec(postgresSchema);

  if (!seedDefaults) return;

  await seedProducts();
  await ensureMilkyWay();
  await seedContentDefaults();
}

async function seedProducts() {
  const count = await db.prepare("SELECT COUNT(*) as c FROM products").get<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (slug, name, notes, description, price, mrp, image, featured, collection_type)
    VALUES (@slug, @name, @notes, @description, @price, @mrp, @image, @featured, @collection_type)
  `);

  const products = [
    {
      slug: "ember-oud",
      name: "Ember Oud",
      notes: "Oud - Saffron - Amber",
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
      notes: "Cedar - Pine - Vetiver",
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
      notes: "Birch - Leather - Musk",
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
      notes: "Iris - Patchouli - Tonka",
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
      notes: "Cypress - Sage - Moss",
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
      notes: "Tobacco - Vanilla - Oak",
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
      notes: "Rose - Saffron - Amber",
      description: "Velvet rose with rare saffron - signature edition.",
      price: 499,
      mrp: 899,
      image: "/images/bottle-rose.svg",
      featured: 1,
      collection_type: "primary",
    },
    {
      slug: "soft-petals",
      name: "Soft Petals",
      notes: "Jasmine - Bergamot - Musk",
      description: "White florals and sun-warmed citrus.",
      price: 399,
      mrp: 699,
      image: "/images/bottle-ivory.svg",
      featured: 0,
      collection_type: "secondary",
    },
  ];

  await db.transaction(async () => {
    for (const product of products) {
      await insert.run(product);
    }
  })();
}

async function ensureMilkyWay() {
  const product = {
    slug: "milky-way",
    name: "Milky Way",
    notes: "Creamy Milk - Warm Spice - Soft Woods",
    description:
      "Our most unique gourmand fragrance - creamy milk folded into warm spice and soft woods. A velvet elixir in emerald glass, bottled for slow evenings and lingering presence.",
    price: 499,
    mrp: 899,
    image: "/images/milky-way.png",
    featured: 1,
    collection_type: "primary",
  };

  await db
    .prepare(
      `INSERT INTO products (slug, name, notes, description, price, mrp, image, featured, collection_type)
       VALUES (@slug, @name, @notes, @description, @price, @mrp, @image, @featured, @collection_type)
       ON CONFLICT(slug) DO UPDATE SET
         name = EXCLUDED.name,
         notes = EXCLUDED.notes,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         mrp = EXCLUDED.mrp,
         image = EXCLUDED.image,
         featured = EXCLUDED.featured,
         collection_type = EXCLUDED.collection_type`,
    )
    .run(product);
}

async function seedContentDefaults() {
  const heroCount = await db.prepare("SELECT COUNT(*) as c FROM hero_banners").get<{ c: number }>();
  if ((heroCount?.c ?? 0) === 0) {
    await db
      .prepare(
        `INSERT INTO hero_banners (title, subtitle, description, imageUrl, productName, productUrl, badge, buttonText, buttonLink, showText, isActive, displayOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "Most Unique",
        "- EXTRAIT DE PARFUM - 50ML",
        "Creamy milk folded into warm spice and soft woods - our signature gourmand in emerald glass.",
        "/images/main-hero.png",
        "Milky Way",
        "/product/milky-way",
        "BEST SELLER",
        "Shop Now INR 499",
        "/product/milky-way",
        1,
        1,
        0,
      );
  }

  const aboutCount = await db.prepare("SELECT COUNT(*) as c FROM about_banner").get<{ c: number }>();
  if ((aboutCount?.c ?? 0) === 0) {
    await db.prepare("INSERT INTO about_banner (id) VALUES (1)").run();
  }

  const footerCount = await db.prepare("SELECT COUNT(*) as c FROM footer_columns").get<{ c: number }>();
  if ((footerCount?.c ?? 0) === 0) {
    await db.transaction(async () => {
      const insertColumn = db.prepare("INSERT INTO footer_columns (title, sort_order) VALUES (?, ?)");
      const insertLink = db.prepare("INSERT INTO footer_links (column_id, label, url, sort_order) VALUES (?, ?, ?, ?)");

      const shop = await insertColumn.run("SHOP", 0);
      const shopId = Number(shop.lastInsertRowid);
      await insertLink.run(shopId, "All Fragrances", "/#collection", 0);
      await insertLink.run(shopId, "Milky Way", "/product/milky-way", 1);
      await insertLink.run(shopId, "Your Bag", "/cart", 2);
      await insertLink.run(shopId, "Orders", "/account", 3);

      const info = await insertColumn.run("INFO", 1);
      const infoId = Number(info.lastInsertRowid);
      await insertLink.run(infoId, "About", "/about", 0);
      await insertLink.run(infoId, "Shipping", "/shipping", 1);
      await insertLink.run(infoId, "Returns", "/returns", 2);
      await insertLink.run(infoId, "FAQ", "/faq", 3);
      await insertLink.run(infoId, "Privacy Policy", "/policy", 4);

      const connect = await insertColumn.run("CONNECT", 2);
      const connectId = Number(connect.lastInsertRowid);
      await insertLink.run(connectId, "Instagram", "#", 0);
      await insertLink.run(connectId, "TikTok", "#", 1);
    })();
  }

  await db
    .prepare(
      `INSERT INTO site_content (key, value) VALUES ('site_logo', '/images/embr-logo.png')
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
    )
    .run();
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
