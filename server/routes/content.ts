import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Public read-only endpoint – no auth required
// Returns all site_content keys and section visibility flags
router.get("/", async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM site_content").all() as { key: string; value: string }[];
  const content = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);

  let sections: Record<string, boolean> = {};
  try {
    const sectionRows = await db.prepare("SELECT * FROM site_sections").all() as { key: string; hidden: number }[];
    sections = sectionRows.reduce((acc, row) => ({ ...acc, [row.key]: row.hidden === 1 }), {} as Record<string, boolean>);
  } catch {
    // Table may not exist yet on first boot – graceful fallback
  }

  res.json({ content, sections });
});

export default router;
