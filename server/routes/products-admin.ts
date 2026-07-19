import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { logAdminAction } from "../middleware/security.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const MAX_PRODUCT_IMAGES = 20;

function publicFilePath(url: string) {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

async function syncPrimaryProductImage(productId: string | number) {
  const firstImage = await db.prepare(
    "SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1"
  ).get(productId) as { url: string } | undefined;

  await db.prepare("UPDATE products SET image = ? WHERE id = ?")
    .run(firstImage?.url || null, productId);
}

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/products");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const productSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  notes: z.string().max(500).optional().default(""),
  description: z.string().optional().default(""),
  price: z.number().int().positive(),
  mrp: z.number().int().positive(),
  discount_price: z.number().int().nonnegative().optional().nullable().default(null),
  stock: z.number().int().nonnegative().default(0),
  sku: z.string().max(50).optional().nullable().default(null),
  category: z.string().max(100).optional().nullable().default(null),
  status: z.enum(["draft", "published"]).default("published"),
  tags: z.string().max(500).optional().nullable().default(null),
  image: z.string().optional().nullable().default(null),
  collection_type: z.enum(["primary", "secondary"]).default("secondary"),
  bestseller: z.number().int().min(0).max(1).default(0),
  key_features: z.string().optional().nullable().default(null),
  how_to_apply: z.string().optional().nullable().default(null),
  legal_information: z.string().optional().nullable().default(null),
  head_notes: z.string().optional().nullable().default(null),
  heart_notes: z.string().optional().nullable().default(null),
  base_notes: z.string().optional().nullable().default(null),
  review: z.string().optional().nullable().default(null),
});

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

router.get("/products", async (req, res) => {
  const search = (req.query.search as string) || "";
  const category = (req.query.category as string) || "";
  const status = (req.query.status as string) || "";
  const stockFilter = (req.query.stock as string) || "";
  const sort = (req.query.sort as string) || "newest";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (search) {
    where += " AND (name LIKE ? OR slug LIKE ? OR sku LIKE ? OR tags LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (category) {
    where += " AND category = ?";
    params.push(category);
  }
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (stockFilter === "low") {
    where += " AND stock > 0 AND stock <= 5";
  } else if (stockFilter === "out") {
    where += " AND stock = 0";
  } else if (stockFilter === "in") {
    where += " AND stock > 5";
  }

  let orderBy = "ORDER BY id DESC";
  if (sort === "price_asc") orderBy = "ORDER BY price ASC";
  else if (sort === "price_desc") orderBy = "ORDER BY price DESC";
  else if (sort === "name") orderBy = "ORDER BY name ASC";
  else if (sort === "stock") orderBy = "ORDER BY stock ASC";

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM products ${where}`
  ).get(...params) as { total: number };

  const products = await db.prepare(
    `SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({
    products,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
});

router.get("/products/categories", async (_req, res) => {
  const categories = await db.prepare(
    "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
  ).all() as { category: string }[];
  res.json({ categories: categories.map((c) => c.category) });
});

router.get("/products/low-stock", async (_req, res) => {
  const products = await db.prepare(
    "SELECT id, name, slug, stock, sku FROM products WHERE stock > 0 AND stock <= 5 ORDER BY stock ASC"
  ).all();
  res.json({ products });
});

router.get("/products/:id", async (req, res) => {
  const product = await db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const images = await db.prepare(
    "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC"
  ).all(req.params.id);
  res.json({ product, images });
});

router.post("/products", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const result = await db.prepare(`
      INSERT INTO products (slug, name, notes, description, price, mrp, discount_price, stock, sku, category, status, tags, image, featured, collection_type, bestseller, key_features, how_to_apply, legal_information, head_notes, heart_notes, base_notes, review)
      VALUES (@slug, @name, @notes, @description, @price, @mrp, @discount_price, @stock, @sku, @category, @status, @tags, @image, 0, @collection_type, @bestseller, @key_features, @how_to_apply, @legal_information, @head_notes, @heart_notes, @base_notes, @review)
    `).run(parsed.data);
    const id = Number(result.lastInsertRowid);
    logAdminAction(req.user!.userId, "create_product", `Created product #${id}: ${parsed.data.name}`);
    res.json({ id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/products/:id", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await db.prepare(`
    UPDATE products SET
      slug = @slug, name = @name, notes = @notes, description = @description,
      price = @price, mrp = @mrp, discount_price = @discount_price,
      stock = @stock, sku = @sku, category = @category, status = @status,
      tags = @tags, image = @image, collection_type = @collection_type, bestseller = @bestseller,
      key_features = @key_features, how_to_apply = @how_to_apply, legal_information = @legal_information,
      head_notes = @head_notes, heart_notes = @heart_notes, base_notes = @base_notes, review = @review
    WHERE id = @id
  `).run({ ...parsed.data, id: req.params.id });

  if (result.changes === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  logAdminAction(req.user!.userId, "update_product", `Updated product #${req.params.id}`);
  res.json({ ok: true });
});

router.delete("/products/:id", async (req, res) => {
  try {
    await db.prepare("DELETE FROM product_images WHERE product_id = ?").run(req.params.id);
    const result = await db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    logAdminAction(req.user!.userId, "delete_product", `Deleted product #${req.params.id}`);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Cannot delete product, it may be linked to an order." });
  }
});

router.post("/products/:id/images", async (req, res) => {
  try {
    const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const { images } = req.body;
    if (!Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "No images provided" });
      return;
    }

    // Check existing images count to enforce total limit
    const existingCount = ((await db.prepare(
      "SELECT COUNT(*) as c FROM product_images WHERE product_id = ?"
    ).get(req.params.id)) as { c: number }).c;

    const maxSort = ((await db.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM product_images WHERE product_id = ?"
    ).get(req.params.id)) as { m: number }).m;

    if (existingCount + images.length > MAX_PRODUCT_IMAGES) {
      res.status(400).json({
        error: `You can have a maximum of ${MAX_PRODUCT_IMAGES} images per product. Currently ${existingCount} images exist — you can add ${MAX_PRODUCT_IMAGES - existingCount} more.`,
      });
      return;
    }
    if (images.length > MAX_PRODUCT_IMAGES) {
      res.status(400).json({ error: `Maximum ${MAX_PRODUCT_IMAGES} images are allowed per upload.` });
      return;
    }

    const savedUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || !img.data || !img.name || !img.type) {
        continue;
      }

      if (!ALLOWED_TYPES.includes(img.type)) {
        continue;
      }

      const ext = path.extname(img.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        continue;
      }

      const buffer = Buffer.from(img.data, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        continue;
      }
      if (!hasImageSignature(buffer, img.type)) {
        continue;
      }

      const filename = `${crypto.randomUUID()}-${sanitizeFilename(img.name)}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      if (!path.resolve(filepath).startsWith(path.resolve(UPLOAD_DIR))) {
        continue;
      }
      fs.writeFileSync(filepath, buffer);

      const url = `/uploads/products/${filename}`;
      savedUrls.push(url);

      await db.prepare(
        "INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)"
      ).run(req.params.id, url, maxSort + 1 + i);
    }

    if (savedUrls.length === 0) {
      res.status(400).json({ error: "No valid images were saved" });
      return;
    }

    await syncPrimaryProductImage(req.params.id);

    logAdminAction(req.user!.userId, "upload_images", `Uploaded ${savedUrls.length} images for product #${req.params.id}`);
    res.json({ images: savedUrls });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function hasImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg") {
    return buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
  }
  if (mimeType === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

router.delete("/products/:id/images/:imageId", async (req, res) => {
  const image = await db.prepare("SELECT url FROM product_images WHERE id = ? AND product_id = ?")
    .get(req.params.imageId, req.params.id) as { url: string } | undefined;

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const filepath = publicFilePath(image.url);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  await db.prepare("DELETE FROM product_images WHERE id = ?").run(req.params.imageId);

  await syncPrimaryProductImage(req.params.id);

  res.json({ ok: true });
});

router.patch("/products/:id/images/order", async (req, res) => {
  const schema = z.object({
    imageIds: z.array(z.number().int().positive()).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const existing = await db.prepare(
    "SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC"
  ).all(req.params.id) as { id: number }[];

  if (parsed.data.imageIds.length !== existing.length) {
    res.status(400).json({ error: "Provide the full image order for this product." });
    return;
  }

  const existingIds = new Set(existing.map((img) => img.id));
  if (!parsed.data.imageIds.every((id) => existingIds.has(id))) {
    res.status(400).json({ error: "Invalid image order." });
    return;
  }

  await db.transaction(async () => {
    for (const [index, imageId] of parsed.data.imageIds.entries()) {
      await db.prepare("UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?")
        .run(index, imageId, req.params.id);
    }
  })();

  await syncPrimaryProductImage(req.params.id);
  logAdminAction(req.user!.userId, "reorder_images", `Reordered images for product #${req.params.id}`);
  res.json({ ok: true });
});

router.patch("/products/:id/stock", async (req, res) => {
  const schema = z.object({ stock: z.number().int().nonnegative() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await db.prepare("UPDATE products SET stock = ? WHERE id = ?")
    .run(parsed.data.stock, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  logAdminAction(req.user!.userId, "update_stock", `Updated stock for product #${req.params.id} to ${parsed.data.stock}`);
  res.json({ ok: true });
});

export default router;
