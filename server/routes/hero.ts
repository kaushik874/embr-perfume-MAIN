import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/hero", (_req, res) => {
  const banners = db.prepare("SELECT * FROM hero_banners WHERE isActive = 1 ORDER BY displayOrder ASC").all();
  res.json({ banners });
});

export default router;
