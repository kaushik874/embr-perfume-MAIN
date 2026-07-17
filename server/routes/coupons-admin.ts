import { Router } from "express";
import { db } from "../db.js";
import { z } from "zod";
import { logAdminAction } from "../middleware/security.js";

const router = Router();

const couponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().int().positive(),
  expiry_date: z.string().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
});

router.get("/coupons", (_req, res) => {
  const coupons = db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
  res.json({ coupons });
});

router.post("/coupons", (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { code, discount_type, discount_value, expiry_date, usage_limit } = parsed.data;
  try {
    const result = db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, expiry_date, usage_limit)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, discount_type, discount_value, expiry_date ?? null, usage_limit ?? null);

    logAdminAction(req.user!.userId, "create_coupon", `Created coupon ${code}`);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
      res.status(400).json({ error: "Coupon code already exists" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/coupons/:id", (req, res) => {
  const coupon = db.prepare("SELECT code FROM coupons WHERE id = ?").get(req.params.id) as any;
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  db.prepare("DELETE FROM coupons WHERE id = ?").run(req.params.id);
  logAdminAction(req.user!.userId, "delete_coupon", `Deleted coupon ${coupon.code}`);
  res.json({ ok: true });
});

export default router;
