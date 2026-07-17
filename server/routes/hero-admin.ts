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
  return {
    title: textValue(body.title, fallback?.title ?? ""),
    subtitle: textValue(body.subtitle, fallback?.subtitle ?? ""),
    description: textValue(body.description, fallback?.description ?? ""),
    imageUrl,
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

router.get("/hero", (_req, res) => {
  const banners = db.prepare("SELECT * FROM hero_banners ORDER BY displayOrder ASC").all();
  res.json({ banners });
});

router.post("/hero/upload", (req, res) => {
  const { name, data } = req.body as { name?: string; data?: string };
  if (!name || !data) return res.status(400).json({ error: "name and data required" });

  const match = data.match(/^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,(.+)$/i);
  if (!match) return res.status(400).json({ error: "Only image uploads are allowed" });

  try {
    const mime = match[1].toLowerCase();
    const base64Data = match[2];
    const extByMime: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    };
    const ext = extByMime[mime] ?? (path.extname(name).replace(".", "") || "png");
    const filename = `hero-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const dir = path.resolve(process.cwd(), "public/uploads/hero");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), base64Data, "base64");
    res.json({ url: `/uploads/hero/${filename}` });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

router.post("/hero", (req, res) => {
  const values = bannerValues(req.body ?? {});
  if (!values.imageUrl) return res.status(400).json({ error: "Banner image is required" });

  const stmt = db.prepare(`
    INSERT INTO hero_banners (title, subtitle, description, imageUrl, productName, productUrl, badge, buttonText, buttonLink, showButton, darkOverlay, imageFit, imagePosition, mobileImagePosition, showText, isActive, displayOrder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    values.title,
    values.subtitle,
    values.description,
    values.imageUrl,
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

router.put("/hero/:id", (req, res) => {
  const { id } = req.params;
  const existing = db
    .prepare("SELECT * FROM hero_banners WHERE id = ?")
    .get(id) as HeroBannerRow | undefined;
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  const values = bannerValues(req.body ?? {}, existing);
  if (!values.imageUrl) return res.status(400).json({ error: "Banner image is required" });

  const stmt = db.prepare(`
    UPDATE hero_banners SET 
      title = ?, subtitle = ?, description = ?, imageUrl = ?, productName = ?, productUrl = ?, badge = ?, 
      buttonText = ?, buttonLink = ?, showButton = ?, darkOverlay = ?, imageFit = ?, imagePosition = ?, mobileImagePosition = ?, showText = ?, isActive = ?, displayOrder = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    values.title,
    values.subtitle,
    values.description,
    values.imageUrl,
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

router.delete("/hero/:id", (req, res) => {
  db.prepare("DELETE FROM hero_banners WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.patch("/hero/reorder", (req, res) => {
  const { orders } = req.body; // array of { id, displayOrder }
  if (!Array.isArray(orders)) return res.status(400).json({ error: "orders must be an array" });
  
  const stmt = db.prepare("UPDATE hero_banners SET displayOrder = ?, updated_at = datetime('now') WHERE id = ?");
  db.transaction(() => {
    for (const o of orders) {
      const bannerId = intValue(o?.id, 0);
      if (bannerId > 0) stmt.run(intValue(o?.displayOrder, 0), bannerId);
    }
  })();
  res.json({ ok: true });
});

export default router;
