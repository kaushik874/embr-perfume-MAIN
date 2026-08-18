import { Router } from "express";
import { db } from "../db.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const router = Router();

type AboutBannerRow = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  showText: number;
  isActive: number;
  darkOverlay: number;
  buttonText: string;
  buttonLink: string;
  showButton: number;
  updated_at: string;
};

// Public route - get about banner
router.get("/about-banner", async (_req, res) => {
  const banner = await db.prepare("SELECT * FROM about_banner WHERE id = 1").get() as AboutBannerRow | undefined;
  res.json({ banner: banner ?? null });
});

// Admin: get about banner
router.get("/about", async (_req, res) => {
  const banner = await db.prepare("SELECT * FROM about_banner WHERE id = 1").get() as AboutBannerRow | undefined;
  res.json({ banner: banner ?? null });
});

// Admin: update about banner
router.put("/about", async (req, res) => {
  const body = req.body as Partial<AboutBannerRow>;

  const flag = (v: unknown, fallback: number) => {
    if (v === undefined || v === null || v === "") return fallback;
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = Number(v);
    return Number.isFinite(n) ? (n ? 1 : 0) : fallback;
  };

  const text = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

  await db.prepare(`
    UPDATE about_banner SET
      title = ?,
      subtitle = ?,
      description = ?,
      imageUrl = ?,
      showText = ?,
      isActive = ?,
      darkOverlay = ?,
      buttonText = ?,
      buttonLink = ?,
      showButton = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    text(body.title, "Our Story"),
    text(body.subtitle),
    text(body.description),
    text(body.imageUrl),
    flag(body.showText, 1),
    flag(body.isActive, 1),
    flag(body.darkOverlay, 1),
    text(body.buttonText),
    text(body.buttonLink),
    flag(body.showButton, 0),
  );

  res.json({ ok: true });
});

// Admin: upload image for about banner
router.post("/about/upload", (req, res) => {
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
    const filename = `about-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const dir = path.resolve(process.cwd(), "public/uploads/about");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), base64Data, "base64");
    res.json({ url: `/uploads/about/${filename}` });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
