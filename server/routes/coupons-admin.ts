import { Router } from "express";
import { db } from "../db.js";
import { z } from "zod";
import { logAdminAction } from "../middleware/security.js";

const router = Router();

const couponSchema = z.object({
  code: z.string().min(2).max(50),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().int().positive(),
  min_order_value: z.number().int().nonnegative().nullable().optional(),
  max_discount: z.number().int().positive().nullable().optional(),
  per_customer_limit: z.number().int().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

router.get("/coupons", async (_req, res) => {
  const coupons = await db.prepare(
    "SELECT * FROM coupons ORDER BY created_at DESC"
  ).all();
  res.json({ coupons });
});

router.post("/coupons", async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const code = data.code.toUpperCase();
  try {
    const result = await db.prepare(`
      INSERT INTO coupons (
        code, discount_type, discount_value, min_order_value, max_discount,
        per_customer_limit, usage_limit, starts_at, expiry_date, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code,
      data.discount_type,
      data.discount_value,
      data.min_order_value ?? null,
      data.max_discount ?? null,
      data.per_customer_limit ?? null,
      data.usage_limit ?? null,
      data.starts_at ?? null,
      data.expiry_date ?? null,
      data.status,
    );

    logAdminAction(req.user!.userId, "create_coupon", `Created coupon ${code}`);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err: any) {
    if (err.message?.includes("unique") || err.message?.includes("UNIQUE") || err.code === "23505") {
      res.status(400).json({ error: "Coupon code already exists" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.put("/coupons/:id", async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const code = data.code.toUpperCase();
  try {
    const result = await db.prepare(`
      UPDATE coupons SET
        code = ?, discount_type = ?, discount_value = ?,
        min_order_value = ?, max_discount = ?, per_customer_limit = ?,
        usage_limit = ?, starts_at = ?, expiry_date = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      code,
      data.discount_type,
      data.discount_value,
      data.min_order_value ?? null,
      data.max_discount ?? null,
      data.per_customer_limit ?? null,
      data.usage_limit ?? null,
      data.starts_at ?? null,
      data.expiry_date ?? null,
      data.status,
      req.params.id,
    );
    if (result.changes === 0) {
      res.status(404).json({ error: "Coupon not found" });
      return;
    }
    logAdminAction(req.user!.userId, "update_coupon", `Updated coupon ${code}`);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.message?.includes("unique") || err.message?.includes("UNIQUE") || err.code === "23505") {
      res.status(400).json({ error: "Coupon code already exists" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch("/coupons/:id/status", async (req, res) => {
  const schema = z.object({ status: z.enum(["active", "inactive"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await db.prepare(
    "UPDATE coupons SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(parsed.data.status, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  logAdminAction(req.user!.userId, "toggle_coupon", `Set coupon #${req.params.id} to ${parsed.data.status}`);
  res.json({ ok: true });
});

router.delete("/coupons/:id", async (req, res) => {
  const coupon = await db.prepare("SELECT code FROM coupons WHERE id = ?").get(req.params.id) as any;
  if (!coupon) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  await db.prepare("DELETE FROM coupon_usages WHERE coupon_id = ?").run(req.params.id);
  await db.prepare("DELETE FROM coupons WHERE id = ?").run(req.params.id);
  logAdminAction(req.user!.userId, "delete_coupon", `Deleted coupon ${coupon.code}`);
  res.json({ ok: true });
});

export default router;
