import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const products = await db
    .prepare(
      `SELECT id, slug, name, notes, description, price, mrp, image, featured, collection_type, bestseller, key_features, how_to_apply, legal_information, head_notes, heart_notes, base_notes, review, variant_selector_heading
       FROM products
       WHERE status = 'published'
       ORDER BY featured DESC, name ASC`,
    )
    .all() as any[];

  function parseVariantImages(v: any) {
    let list: string[] = [];
    try {
      list = v.images ? JSON.parse(v.images) : [];
    } catch {}
    if (!list.length && v.image) {
      list = [v.image];
    }
    v.images = list;
    v.image = list[0] || v.image || null;
    return v;
  }

  const variants = await db
    .prepare(
      `SELECT id, product_id, name, price, compare_price, stock, is_active, sort_order, image, images
       FROM product_variants
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    )
    .all() as any[];

  const variantsByProductId = new Map<number, any[]>();
  for (const rawV of variants) {
    const v = parseVariantImages(rawV);
    const list = variantsByProductId.get(v.product_id) || [];
    list.push(v);
    variantsByProductId.set(v.product_id, list);
  }

  for (const p of products) {
    p.variants = variantsByProductId.get(p.id) || [];
  }

  res.json({ products });
});

router.get("/:slug", async (req, res) => {
  const product = await db
    .prepare(
      `SELECT id, slug, name, notes, description, price, mrp, image, featured, collection_type, bestseller, key_features, how_to_apply, legal_information, head_notes, heart_notes, base_notes, review, variant_selector_heading
       FROM products WHERE slug = ? AND status = 'published'`,
    )
    .get(req.params.slug);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const images = await db
    .prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC")
    .all((product as any).id);

  const rawVariants = await db
    .prepare(
      "SELECT id, product_id, name, price, compare_price, stock, is_active, sort_order, image, images FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC"
    )
    .all((product as any).id) as any[];

  const variants = rawVariants.map((v) => {
    let list: string[] = [];
    try {
      list = v.images ? JSON.parse(v.images) : [];
    } catch {}
    if (!list.length && v.image) {
      list = [v.image];
    }
    v.images = list;
    v.image = list[0] || v.image || null;
    return v;
  });

  (product as any).variants = variants;

  res.json({ product, images, variants });
});

export default router;
