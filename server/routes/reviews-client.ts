import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = Router();
const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/reviews");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

function hasImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === "image/webp") {
    return buffer.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
           buffer.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]));
  }
  if (mimeType === "video/mp4") {
    // Basic MP4 signature check (ftyp)
    return buffer.subarray(4, 8).equals(Buffer.from("ftyp", "ascii"));
  }
  return false;
}

// GET /api/reviews/:slug - Fetch reviews for a product
router.get("/:slug", async (req, res) => {
  const product = await db.prepare("SELECT id FROM products WHERE slug = ?").get(req.params.slug) as { id: number } | undefined;
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const sortBy = req.query.sort || "newest";
  let orderClause = "r.created_at DESC";
  
  if (sortBy === "oldest") orderClause = "r.created_at ASC";
  if (sortBy === "highest") orderClause = "r.rating DESC, r.created_at DESC";
  if (sortBy === "lowest") orderClause = "r.rating ASC, r.created_at DESC";

  const reviews = await db.prepare(`
    SELECT r.*, u.name as user_name
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ? AND r.is_hidden = 0 AND r.status = 'approved'
    ORDER BY r.is_pinned DESC, r.is_featured DESC, ${orderClause}
    LIMIT 10
  `).all(product.id) as any[];

  // Parse JSON strings
  const formattedReviews = reviews.map(r => ({
    ...r,
    images: r.images ? JSON.parse(r.images) : [],
    // If manual customer name exists, use it over user_name
    author: r.customer_name || r.user_name || "Guest"
  }));

  res.json({ reviews: formattedReviews });
});

// GET /api/reviews/eligibility/:slug - Check if user can review
router.get("/eligibility/:slug", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const product = await db.prepare("SELECT id FROM products WHERE slug = ?").get(req.params.slug) as { id: number } | undefined;
  
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Find if user has a paid or delivered order for this product
  const eligibleOrder = await db.prepare(`
    SELECT o.id 
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('paid', 'delivered')
    LIMIT 1
  `).get(userId, product.id) as { id: number } | undefined;

  // Find if user reached max reviews (5)
  const existingReviewsCount = (await db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE user_id = ? AND product_id = ?
  `).get(userId, product.id) as { count: number }).count;

  res.json({
    eligible: !!eligibleOrder,
    hasReviewed: existingReviewsCount >= 5,
    orderId: eligibleOrder?.id,
    reviewId: null // We don't rely on this for editing anymore, we'll edit directly from the list
  });
});

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().max(200).optional().default(""),
  comment: z.string().max(2000).optional().default(""),
  order_id: z.number().optional().nullable().default(null),
  mediaFiles: z.array(z.object({
    name: z.string(),
    type: z.string(),
    data: z.string()
  })).optional().default([])
});

// Helper to save media
function saveMediaFiles(files: any[]) {
  const savedImages: string[] = [];
  let savedVideo: string | null = null;
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  for (const file of files) {
    if (!file.data || !file.name || !file.type) continue;
    
    // Parse base64
    const match = file.data.match(/^data:(.+);base64,(.+)$/);
    if (!match) continue;
    
    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > MAX_FILE_SIZE) continue;

    if (!hasImageSignature(buffer, mimeType) && mimeType !== "video/webm") {
      // Very basic validation - webm might not have simple magic bytes but we allow it for video
      if (mimeType !== "video/mp4" && mimeType !== "video/webm") {
        continue;
      }
    }

    const filename = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    if (!path.resolve(filepath).startsWith(path.resolve(UPLOAD_DIR))) continue;

    fs.writeFileSync(filepath, buffer);
    const url = `/uploads/reviews/${filename}`;

    if (mimeType.startsWith("video/") && !savedVideo) {
      savedVideo = url;
    } else if (mimeType.startsWith("image/")) {
      savedImages.push(url);
    }
  }

  return { savedImages, savedVideo };
}

// POST /api/reviews/:slug - Create a new review
router.post("/:slug", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const product = await db.prepare("SELECT id FROM products WHERE slug = ?").get(req.params.slug) as { id: number } | undefined;
  
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Check if eligible
  const eligibleOrder = await db.prepare(`
    SELECT o.id 
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('paid', 'delivered')
    LIMIT 1
  `).get(userId, product.id) as { id: number } | undefined;

  if (!eligibleOrder) {
    res.status(403).json({ error: "You must purchase this product to review it." });
    return;
  }

  // Max 5 reviews check
  const reviewCount = (await db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE user_id = ? AND product_id = ?
  `).get(userId, product.id) as { count: number }).count;

  if (reviewCount >= 5) {
    res.status(400).json({ error: "You have reached the maximum of 5 reviews for this product." });
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { savedImages, savedVideo } = saveMediaFiles(parsed.data.mediaFiles);

  const result = await db.prepare(`
    INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, images, video, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
  `).run(
    product.id,
    userId,
    eligibleOrder.id, // Enforce real order
    parsed.data.rating,
    parsed.data.title,
    parsed.data.comment,
    JSON.stringify(savedImages),
    savedVideo
  );

  res.json({ id: result.lastInsertRowid });
});

// PUT /api/reviews/:id - Edit review
router.put("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const reviewId = req.params.id;

  const review = await db.prepare("SELECT * FROM reviews WHERE id = ? AND user_id = ?").get(reviewId, userId) as any;
  if (!review) {
    res.status(403).json({ error: "Review not found or unauthorized" });
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Handle new media uploads (appends to existing or replaces? Let's just append for now, or replace if provided)
  let images = review.images ? JSON.parse(review.images) : [];
  let video = review.video;

  if (parsed.data.mediaFiles && parsed.data.mediaFiles.length > 0) {
    const { savedImages, savedVideo } = saveMediaFiles(parsed.data.mediaFiles);
    // Replace logic for simplicity, or we could merge them.
    images = savedImages; 
    if (savedVideo) video = savedVideo;
  }

  await db.prepare(`
    UPDATE reviews 
    SET rating = ?, title = ?, comment = ?, images = ?, video = ?, status = 'approved'
    WHERE id = ?
  `).run(
    parsed.data.rating,
    parsed.data.title,
    parsed.data.comment,
    JSON.stringify(images),
    video,
    reviewId
  );

  res.json({ ok: true });
});

// DELETE /api/reviews/:id - Delete own review
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const reviewId = req.params.id;

  const existing = await db.prepare("SELECT id, user_id FROM reviews WHERE id = ?").get(reviewId) as { id: number, user_id: number } | undefined;
  
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }

  if (existing.user_id !== userId) {
    res.status(403).json({ error: "You can only delete your own reviews" });
    return;
  }

  await db.prepare("DELETE FROM reviews WHERE id = ?").run(reviewId);
  res.json({ success: true });
});

export default router;
