import { Router } from "express";
import { db } from "../db.js";
import fs from "fs";
import path from "path";

const router = Router();

// GET all content
router.get("/content", (_req, res) => {
  const rows = db.prepare("SELECT * FROM site_content").all() as { key: string; value: string }[];
  const content = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json({ content });
});

// POST upsert a single key
router.post("/content", (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  db.prepare(`
    INSERT INTO site_content (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value ?? "");
  res.json({ ok: true });
});

// POST upload content image
router.post("/content/upload", (req, res) => {
  const { name, data } = req.body;
  if (!data || !name) return res.status(400).json({ error: "name and data required" });
  try {
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const ext = name.split('.').pop() || 'png';
    const filename = `cms-${Date.now()}.${ext}`;
    const dir = path.resolve(process.cwd(), "public/uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), base64Data, "base64");
    res.json({ url: `/uploads/${filename}` });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// DELETE a content key
router.delete("/content/:key", (req, res) => {
  const { key } = req.params;
  db.prepare("DELETE FROM site_content WHERE key = ?").run(key);
  res.json({ ok: true });
});

// GET all section visibility flags
router.get("/sections", (_req, res) => {
  let sections: { key: string; hidden: number }[] = [];
  try {
    sections = db.prepare("SELECT * FROM site_sections").all() as { key: string; hidden: number }[];
  } catch {
    // table not ready yet
  }
  res.json({ sections });
});

// PATCH section visibility
router.patch("/sections/:key", (req, res) => {
  const { key } = req.params;
  const { hidden } = req.body;
  const val = hidden ? 1 : 0;
  db.prepare(`
    INSERT INTO site_sections (key, hidden) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET hidden = excluded.hidden
  `).run(key, val);
  res.json({ ok: true });
});

export default router;
