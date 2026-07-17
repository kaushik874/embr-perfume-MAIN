import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Public endpoint – no auth required so checkout can validate coupons
router.post("/validate", (req, res) => {
  const { code, orderTotalPaise } = req.body;
  if (!code) { res.status(400).json({ error: "Coupon code required" }); return; }

  const coupon = db.prepare(
    "SELECT * FROM coupons WHERE code = ? AND status = 'active'"
  ).get(String(code).toUpperCase()) as any;

  if (!coupon) { res.status(404).json({ error: "Invalid or expired coupon code" }); return; }

  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
    res.status(400).json({ error: "Coupon has expired" }); return;
  }
  if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
    res.status(400).json({ error: "Coupon usage limit reached" }); return;
  }

  let discountPaise = 0;
  if (coupon.discount_type === "percent") {
    discountPaise = Math.floor((Number(orderTotalPaise) || 0) * coupon.discount_value / 100);
  } else {
    discountPaise = coupon.discount_value * 100;
  }

  res.json({ ok: true, coupon, discountPaise });
});

export default router;
