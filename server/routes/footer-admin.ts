import { Router } from "express";
import { db } from "../db.js";

const router = Router();

type FooterColumn = { id: number; title: string; sort_order: number };
type FooterLink = { id: number; column_id: number; label: string; url: string; sort_order: number };

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// GET /api/footer — public, returns columns + their links
router.get("/footer", async (_req, res) => {
  const columns = await db.prepare("SELECT * FROM footer_columns ORDER BY sort_order ASC, id ASC").all() as FooterColumn[];
  const links = await db.prepare("SELECT * FROM footer_links ORDER BY sort_order ASC, id ASC").all() as FooterLink[];

  const result = columns.map((col) => ({
    ...col,
    links: links.filter((l) => l.column_id === col.id),
  }));

  res.json({ columns: result });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// GET /api/admin/footer — same as public but behind auth
router.get("/footer", async (_req, res) => {
  const columns = await db.prepare("SELECT * FROM footer_columns ORDER BY sort_order ASC, id ASC").all() as FooterColumn[];
  const links = await db.prepare("SELECT * FROM footer_links ORDER BY sort_order ASC, id ASC").all() as FooterLink[];

  const result = columns.map((col) => ({
    ...col,
    links: links.filter((l) => l.column_id === col.id),
  }));

  res.json({ columns: result });
});

// POST /api/admin/footer/columns — create new column
router.post("/footer/columns", async (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  const maxOrder = ((await db.prepare("SELECT MAX(sort_order) as m FROM footer_columns").get()) as { m: number | null }).m ?? -1;
  const result = await db.prepare("INSERT INTO footer_columns (title, sort_order) VALUES (?, ?)").run(title.trim(), maxOrder + 1);
  const row = await db.prepare("SELECT * FROM footer_columns WHERE id = ?").get(result.lastInsertRowid) as FooterColumn;
  res.json({ column: { ...row, links: [] } });
});

// PUT /api/admin/footer/columns/:id — update column title / order
router.put("/footer/columns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, sort_order } = req.body as { title?: string; sort_order?: number };
  if (title !== undefined) await db.prepare("UPDATE footer_columns SET title = ? WHERE id = ?").run(title.trim(), id);
  if (sort_order !== undefined) await db.prepare("UPDATE footer_columns SET sort_order = ? WHERE id = ?").run(sort_order, id);
  res.json({ ok: true });
});

// DELETE /api/admin/footer/columns/:id — delete column + its links (cascade)
router.delete("/footer/columns/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.prepare("DELETE FROM footer_links WHERE column_id = ?").run(id);
  await db.prepare("DELETE FROM footer_columns WHERE id = ?").run(id);
  res.json({ ok: true });
});

// POST /api/admin/footer/links — add link to column
router.post("/footer/links", async (req, res) => {
  const { column_id, label, url } = req.body as { column_id?: number; label?: string; url?: string };
  if (!column_id || !label?.trim()) return res.status(400).json({ error: "column_id and label required" });

  const maxOrder = ((await db.prepare("SELECT MAX(sort_order) as m FROM footer_links WHERE column_id = ?").get(column_id)) as { m: number | null }).m ?? -1;
  const result = await db.prepare("INSERT INTO footer_links (column_id, label, url, sort_order) VALUES (?, ?, ?, ?)").run(
    column_id, label.trim(), url?.trim() || "#", maxOrder + 1
  );
  const row = await db.prepare("SELECT * FROM footer_links WHERE id = ?").get(result.lastInsertRowid) as FooterLink;
  res.json({ link: row });
});

// PUT /api/admin/footer/links/:id — edit a link
router.put("/footer/links/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { label, url, sort_order } = req.body as { label?: string; url?: string; sort_order?: number };
  if (label !== undefined) await db.prepare("UPDATE footer_links SET label = ? WHERE id = ?").run(label.trim(), id);
  if (url !== undefined) await db.prepare("UPDATE footer_links SET url = ? WHERE id = ?").run(url.trim(), id);
  if (sort_order !== undefined) await db.prepare("UPDATE footer_links SET sort_order = ? WHERE id = ?").run(sort_order, id);
  res.json({ ok: true });
});

// DELETE /api/admin/footer/links/:id — delete a link
router.delete("/footer/links/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.prepare("DELETE FROM footer_links WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default router;
