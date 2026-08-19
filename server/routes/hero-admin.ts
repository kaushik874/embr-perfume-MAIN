import { Router } from "express";
import { db } from "../db.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const router = Router();

type HeroBannerRow = {
  id: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  productName: string | null;
  productUrl: string | null;
  badge: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  showButton: number;
  darkOverlay: number;
  imageFit: string;
  imagePosition: string;
  mobileImagePosition: string;
  showText: number;
  isActive: number;
  displayOrder: number;
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function intValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function flagValue(value: unknown, fallback = 1) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["0", "false", "off", "no"].includes(normalized)) return 0;
    if (["1", "true", "on", "yes"].includes(normalized)) return 1;
  }
  return fallback;
}

function bannerValues(body: Record<string, unknown>, fallback?: HeroBannerRow) {
  const imageUrl = textValue(body.imageUrl, fallback?.imageUrl ?? "").trim();
  const mobileImageUrl = textValue(body.mobileImageUrl, fallback?.mobileImageUrl ?? "").trim();
  return {
    title: textValue(body.title, fallback?.title ?? ""),
    subtitle: textValue(body.subtitle, fallback?.subtitle ?? ""),
    description: textValue(body.description, fallback?.description ?? ""),
    imageUrl,
    mobileImageUrl,
    productName: textValue(body.productName, fallback?.productName ?? ""),
    productUrl: textValue(body.productUrl, fallback?.productUrl ?? ""),
    badge: textValue(body.badge, fallback?.badge ?? ""),
    buttonText: textValue(body.buttonText, fallback?.buttonText ?? ""),
    buttonLink: textValue(body.buttonLink, fallback?.buttonLink ?? ""),
    showButton: flagValue(body.showButton, fallback?.showButton ?? 1),
    darkOverlay: flagValue(body.darkOverlay, fallback?.darkOverlay ?? 1),
    imageFit: textValue(body.imageFit, fallback?.imageFit ?? "cover") || "cover",
    imagePosition: textValue(body.imagePosition, fallback?.imagePosition ?? "center center") || "center center",
    mobileImagePosition: textValue(body.mobileImagePosition, fallback?.mobileImagePosition ?? "center center") || "center center",
    showText: flagValue(body.showText, fallback?.showText ?? 1),
    isActive: flagValue(body.isActive, fallback?.isActive ?? 1),
    displayOrder: intValue(body.displayOrder, fallback?.displayOrder ?? 0),
  };
}

router.get("/hero", async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM hero_banners ORDER BY displayOrder ASC").all() as any[];
  const banners = rows.map(r => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    imageUrl: r.imageurl,
    mobileImageUrl: r.mobileimageurl,
    productName: r.productname,
    productUrl: r.producturl,
    badge: r.badge,
    buttonText: r.buttontext,
    buttonLink: r.buttonlink,
    showButton: r.showbutton,
    darkOverlay: r.darkoverlay,
    imageFit: r.imagefit,
    imagePosition: r.imageposition,
    mobileImagePosition: r.mobileimageposition,
    showText: r.showtext,
    isActive: r.isactive,
    displayOrder: r.displayorder
  }));
  res.json({ banners });
});

router.post("/hero/upload", async (req, res) => {
  const { name, data } = req.body as { name?: string; data?: string };
  if (!name || !data) return res.status(400).json({ error: "name and data required" });

  const match = data.match(/^data:(image\/[^;]+);base64,(.+)$/i);
  if (!match) return res.status(400).json({ error: "Only image uploads are allowed" });

  try {
    const { uploadToCloudinary } = await import("../lib/cloudinary.js");
    const url = await uploadToCloudinary(data, "hero");
    res.json({ url });
  } catch (error) {
    console.error("Hero upload error:", error);
    res.status(500).json({ error: "Upload failed: " + (error instanceof Error ? error.message : String(error)) });
  }
});

router.post("/hero", async (req, res) => {
  const values = bannerValues(req.body ?? {});
  if (!values.imageUrl && !values.mobileImageUrl) {
    return res.status(400).json({ error: "Desktop or mobile banner image is required" });
  }

  const stmt = db.prepare(`
    INSERT INTO hero_banners (title, subtitle, description, imageUrl, mobileImageUrl, productName, productUrl, badge, buttonText, buttonLink, showButton, darkOverlay, imageFit, imagePosition, mobileImagePosition, showText, isActive, displayOrder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = await stmt.run(
    values.title,
    values.subtitle,
    values.description,
    values.imageUrl,
    values.mobileImageUrl || null,
    values.productName,
    values.productUrl,
    values.badge,
    values.buttonText,
    values.buttonLink,
    values.showButton,
    values.darkOverlay,
    values.imageFit,
    values.imagePosition,
    values.mobileImagePosition,
    values.showText,
    values.isActive,
    values.displayOrder,
  );
  res.json({ id: info.lastInsertRowid });
});

router.put("/hero/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db
    .prepare("SELECT * FROM hero_banners WHERE id = ?")
    .get(id) as HeroBannerRow | undefined;
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  const values = bannerValues(req.body ?? {}, existing);
  if (!values.imageUrl && !values.mobileImageUrl) {
    return res.status(400).json({ error: "Desktop or mobile banner image is required" });
  }

  const stmt = db.prepare(`
    UPDATE hero_banners SET 
      title = ?, subtitle = ?, description = ?, imageUrl = ?, mobileImageUrl = ?, productName = ?, productUrl = ?, badge = ?, 
      buttonText = ?, buttonLink = ?, showButton = ?, darkOverlay = ?, imageFit = ?, imagePosition = ?, mobileImagePosition = ?, showText = ?, isActive = ?, displayOrder = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  await stmt.run(
    values.title,
    values.subtitle,
    values.description,
    values.imageUrl,
    values.mobileImageUrl || null,
    values.productName,
    values.productUrl,
    values.badge,
    values.buttonText,
    values.buttonLink,
    values.showButton,
    values.darkOverlay,
    values.imageFit,
    values.imagePosition,
    values.mobileImagePosition,
    values.showText,
    values.isActive,
    values.displayOrder,
    id,
  );
  res.json({ ok: true });
});

router.delete("/hero/:id", async (req, res) => {
  await db.prepare("DELETE FROM hero_banners WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.patch("/hero/reorder", async (req, res) => {
  const { orders } = req.body; // array of { id, displayOrder }
  if (!Array.isArray(orders)) return res.status(400).json({ error: "orders must be an array" });
  
  const stmt = db.prepare("UPDATE hero_banners SET displayOrder = ?, updated_at = datetime('now') WHERE id = ?");
  await db.transaction(async () => {
    for (const o of orders) {
      const bannerId = intValue(o?.id, 0);
      if (bannerId > 0) await stmt.run(intValue(o?.displayOrder, 0), bannerId);
    }
  })();
  res.json({ ok: true });
});

export default router;
