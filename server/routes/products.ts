import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (_req, res) => {
  const products = db
    .prepare(
      `SELECT id, slug, name, notes, description, price, mrp, image, featured, collection_type, bestseller, key_features, how_to_apply, legal_information, head_notes, heart_notes, base_notes, review
       FROM products
       WHERE status = 'published'
       ORDER BY featured DESC, name ASC`,
    )
    .all();

  res.json({ products });
});

router.get("/:slug", (req, res) => {
  const product = db
    .prepare(
      `SELECT id, slug, name, notes, description, price, mrp, image, featured, collection_type, bestseller, key_features, how_to_apply, legal_information, head_notes, heart_notes, base_notes, review
       FROM products WHERE slug = ? AND status = 'published'`,
    )
    .get(req.params.slug);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const images = db
    .prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC")
    .all((product as any).id);

  res.json({ product, images });
});

export default router;
