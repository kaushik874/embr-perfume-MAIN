import { Router } from "express";
import { db } from "../db.js";
import fs from "fs";
import path from "path";

const router = Router();

// GET all content
router.get("/content", async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM site_content").all() as { key: string; value: string }[];
  const content = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json({ content });
});

// POST upsert a single key
router.post("/content", async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  await db.prepare(`
    INSERT INTO site_content (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value ?? "");
  res.json({ ok: true });
});

// POST upload content image
router.post("/content/upload", async (req, res) => {
  const { name, data } = req.body;
  if (!data || !name) return res.status(400).json({ error: "name and data required" });
  try {
    const mimeMatch = data.match(/^data:(image\/\w+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const ext = name.split('.').pop() || 'png';
    const filename = `cms-${Date.now()}.${ext}`;
    
    await db.prepare("INSERT INTO uploaded_files (id, mime_type, data) VALUES (?, ?, ?)").run(
      filename,
      mime,
      Buffer.from(base64Data, "base64")
    );
    
    res.json({ url: `/api/files/${filename}` });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// DELETE a content key
router.delete("/content/:key", async (req, res) => {
  const { key } = req.params;
  await db.prepare("DELETE FROM site_content WHERE key = ?").run(key);
  res.json({ ok: true });
});

// GET all section visibility flags
router.get("/sections", async (_req, res) => {
  let sections: { key: string; hidden: number }[] = [];
  try {
    sections = await db.prepare("SELECT * FROM site_sections").all() as { key: string; hidden: number }[];
  } catch {
    // table not ready yet
  }
  res.json({ sections });
});

// PATCH section visibility
router.patch("/sections/:key", async (req, res) => {
  const { key } = req.params;
  const { hidden } = req.body;
  const val = hidden ? 1 : 0;
  await db.prepare(`
    INSERT INTO site_sections (key, hidden) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET hidden = excluded.hidden
  `).run(key, val);
  res.json({ ok: true });
});

export default router;
