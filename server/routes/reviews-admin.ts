import { Router } from "express";
import { db } from "../db.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logAdminAction } from "../middleware/security.js";

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
    return buffer.subarray(4, 8).equals(Buffer.from("ftyp", "ascii"));
  }
  return false;
}

function saveMediaFiles(files: any[]) {
  const savedImages: string[] = [];
  let savedVideo: string | null = null;
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  for (const file of files) {
    if (!file.data || !file.name || !file.type) continue;
    const match = file.data.match(/^data:(.+);base64,(.+)$/);
    if (!match) continue;
    
    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > MAX_FILE_SIZE) continue;

    if (!hasImageSignature(buffer, mimeType) && mimeType !== "video/webm") {
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

const manualReviewSchema = z.object({
  product_id: z.number(),
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().optional().or(z.literal("")),
  rating: z.number().min(1).max(5),
  title: z.string().optional().default(""),
  comment: z.string().optional().default(""),
  mediaFiles: z.array(z.object({
    name: z.string(),
    type: z.string(),
    data: z.string()
  })).optional().default([]),
  created_at: z.string().optional()
});

router.get("/reviews", async (_req, res) => {
  const reviews = await db.prepare(`
    SELECT r.*, p.name as product_name, p.image as product_image, u.name as user_name, u.email as user_email
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `).all() as any[];

  // Parse JSON for frontend
  const formattedReviews = reviews.map(r => ({
    ...r,
    images: r.images ? JSON.parse(r.images) : []
  }));

  res.json({ reviews: formattedReviews });
});

router.post("/reviews", async (req, res) => {
  const parsed = manualReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { savedImages, savedVideo } = saveMediaFiles(parsed.data.mediaFiles);

  const result = await db.prepare(`
    INSERT INTO reviews (product_id, user_id, rating, title, comment, customer_name, customer_email, customer_phone, images, video, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
  `).run(
    parsed.data.product_id,
    req.user!.userId, // Link to admin who created it if no user
    parsed.data.rating,
    parsed.data.title,
    parsed.data.comment,
    parsed.data.customer_name,
    parsed.data.customer_email || null,
    parsed.data.customer_phone || null,
    JSON.stringify(savedImages),
    savedVideo,
    parsed.data.created_at || new Date().toISOString()
  );

  logAdminAction(req.user!.userId, "add_manual_review", `Added manual review #${result.lastInsertRowid}`);
  res.json({ id: result.lastInsertRowid });
});

router.put("/reviews/:id", async (req, res) => {
  const parsed = manualReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }

  let images = existing.images ? JSON.parse(existing.images) : [];
  let video = existing.video;

  if (parsed.data.mediaFiles && parsed.data.mediaFiles.length > 0) {
    const { savedImages, savedVideo } = saveMediaFiles(parsed.data.mediaFiles);
    // Overwrite for admin edit
    images = savedImages;
    if (savedVideo) video = savedVideo;
  }

  await db.prepare(`
    UPDATE reviews SET 
      product_id = ?, rating = ?, title = ?, comment = ?, 
      customer_name = ?, customer_email = ?, customer_phone = ?,
      images = ?, video = ?, created_at = ?
    WHERE id = ?
  `).run(
    parsed.data.product_id,
    parsed.data.rating,
    parsed.data.title,
    parsed.data.comment,
    parsed.data.customer_name,
    parsed.data.customer_email || null,
    parsed.data.customer_phone || null,
    JSON.stringify(images),
    video,
    parsed.data.created_at || existing.created_at,
    req.params.id
  );

  logAdminAction(req.user!.userId, "edit_review", `Edited review #${req.params.id}`);
  res.json({ ok: true });
});

router.patch("/reviews/:id/status", async (req, res) => {
  const { status, is_pinned, is_featured, is_hidden } = req.body;
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
       res.status(400).json({ error: "Invalid status" });
       return;
    }
    updates.push("status = ?");
    values.push(status);
  }
  
  if (is_pinned !== undefined) {
    updates.push("is_pinned = ?");
    values.push(is_pinned ? 1 : 0);
  }
  
  if (is_featured !== undefined) {
    updates.push("is_featured = ?");
    values.push(is_featured ? 1 : 0);
  }
  
  if (is_hidden !== undefined) {
    updates.push("is_hidden = ?");
    values.push(is_hidden ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    await db.prepare(`UPDATE reviews SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    logAdminAction(req.user!.userId, "update_review_status", `Updated flags/status for review #${req.params.id}`);
  }

  res.json({ ok: true });
});

router.patch("/reviews/:id/reply", async (req, res) => {
  const schema = z.object({ reply: z.string().max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Reply must be a string under 2000 characters." });
    return;
  }
  await db.prepare("UPDATE reviews SET reply = ? WHERE id = ?").run(parsed.data.reply, req.params.id);
  logAdminAction(req.user!.userId, "reply_review", `Replied to review #${req.params.id}`);
  res.json({ ok: true });
});

router.delete("/reviews/:id", async (req, res) => {
  await db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
  logAdminAction(req.user!.userId, "delete_review", `Deleted review #${req.params.id}`);
  res.json({ ok: true });
});

export default router;
