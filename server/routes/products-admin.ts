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
  const product = await db.prepare("SELECT display_image_original_url FROM products WHERE id = ?").get(productId) as { display_image_original_url?: string | null } | undefined;
  if (product?.display_image_original_url) {
    return;
  }

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

function numberValue(value: unknown, fallback: number | null = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function saveProductImageFile(img: { name: string; type: string; data: string }, prefix = ""): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(img.type)) return null;

  const ext = path.extname(img.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return null;

  const buffer = Buffer.from(img.data, "base64");
  if (buffer.length > MAX_FILE_SIZE) return null;
  if (!hasImageSignature(buffer, img.type)) return null;

  const filename = `${crypto.randomUUID()}-${prefix}${sanitizeFilename(img.name)}`;

  await db.prepare("INSERT INTO uploaded_files (id, mime_type, data) VALUES (?, ?, ?)").run(
    filename,
    img.type,
    buffer
  );

  return `/api/files/${filename}`;
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

      const url = await saveProductImageFile({ name: img.name, type: img.type, data: img.data });
      if (!url) continue;

      const originalUrl =
        img.originalData && img.originalName && img.originalType
          ? await saveProductImageFile(
              { name: img.originalName, type: img.originalType, data: img.originalData },
              "original-",
            )
          : null;
      const crop = img.crop && typeof img.crop === "object" ? img.crop : {};
      savedUrls.push(url);

      await db.prepare(
        "INSERT INTO product_images (product_id, url, original_url, crop_x, crop_y, crop_zoom, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        req.params.id,
        url,
        originalUrl,
        numberValue(crop.x),
        numberValue(crop.y),
        numberValue(crop.zoom),
        maxSort + 1 + i,
      );
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
  const image = await db.prepare("SELECT url, original_url FROM product_images WHERE id = ? AND product_id = ?")
    .get(req.params.imageId, req.params.id) as { url: string; original_url?: string | null } | undefined;

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const filepath = publicFilePath(image.url);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  if (image.original_url && image.original_url !== image.url) {
    const originalPath = publicFilePath(image.original_url);
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }
  }

  await db.prepare("DELETE FROM product_images WHERE id = ?").run(req.params.imageId);

  await syncPrimaryProductImage(req.params.id);

  res.json({ ok: true });
});

router.patch("/products/:id/images/:imageId/crop", async (req, res) => {
  const existing = await db.prepare("SELECT id, original_url FROM product_images WHERE id = ? AND product_id = ?")
    .get(req.params.imageId, req.params.id) as { id: number; original_url?: string | null } | undefined;

  if (!existing) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const image = req.body?.image;
  if (!image?.name || !image?.type || !image?.data) {
    res.status(400).json({ error: "Cropped image is required" });
    return;
  }

  const url = await saveProductImageFile({ name: image.name, type: image.type, data: image.data }, "crop-");
  if (!url) {
    res.status(400).json({ error: "No valid cropped image was saved" });
    return;
  }

  const crop = req.body?.crop && typeof req.body.crop === "object" ? req.body.crop : {};
  await db.prepare(
    "UPDATE product_images SET url = ?, crop_x = ?, crop_y = ?, crop_zoom = ? WHERE id = ? AND product_id = ?"
  ).run(
    url,
    numberValue(crop.x),
    numberValue(crop.y),
    numberValue(crop.zoom),
    req.params.imageId,
    req.params.id,
  );

  await syncPrimaryProductImage(req.params.id);
  logAdminAction(req.user!.userId, "recrop_image", `Recropped image #${req.params.imageId} for product #${req.params.id}`);
  res.json({ url });
});

router.patch("/products/:id/display-crop", async (req, res) => {
  const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const image = req.body?.image;
  if (!image?.name || !image?.type || !image?.data) {
    res.status(400).json({ error: "Cropped image is required" });
    return;
  }

  const originalUrl = req.body?.original_url;
  if (!originalUrl || typeof originalUrl !== "string") {
    res.status(400).json({ error: "Original image URL is required" });
    return;
  }

  const url = await saveProductImageFile({ name: image.name, type: image.type, data: image.data }, "display-crop-");
  if (!url) {
    res.status(400).json({ error: "No valid cropped image was saved" });
    return;
  }

  const crop = req.body?.crop && typeof req.body.crop === "object" ? req.body.crop : {};
  await db.prepare(
    "UPDATE products SET image = ?, display_image_original_url = ?, display_crop_x = ?, display_crop_y = ?, display_crop_zoom = ? WHERE id = ?"
  ).run(
    url,
    originalUrl,
    numberValue(crop.x),
    numberValue(crop.y),
    numberValue(crop.zoom),
    req.params.id,
  );

  logAdminAction(req.user!.userId, "display_crop_image", `Set custom display crop for product #${req.params.id}`);
  res.json({ url });
});

router.delete("/products/:id/display-crop", async (req, res) => {
  await db.prepare(
    "UPDATE products SET display_image_original_url = NULL, display_crop_x = NULL, display_crop_y = NULL, display_crop_zoom = NULL WHERE id = ?"
  ).run(req.params.id);

  await syncPrimaryProductImage(req.params.id);
  logAdminAction(req.user!.userId, "clear_display_crop", `Cleared custom display crop for product #${req.params.id}`);
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


router.patch("/products/:id/shipping", async (req, res) => {
  const schema = z.object({ shipping_charge: z.number().int().nonnegative() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await db.prepare("UPDATE products SET shipping_charge = ? WHERE id = ?")
    .run(parsed.data.shipping_charge, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  logAdminAction(req.user!.userId, "update_shipping", `Updated shipping charge for product #${req.params.id} to ₹${parsed.data.shipping_charge}`);
  res.json({ ok: true });
});

export default router;
