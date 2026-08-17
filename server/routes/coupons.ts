import { Router } from "express";
import { z } from "zod";
import {
  calculateOrderPricing,
  validateCoupon,
  calculateCouponDiscount,
} from "../lib/pricing.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

const validateSchema = z.object({
  code: z.string().optional(),
  items: z.array(
    z.object({
      slug: z.string().min(1).optional(),
      productId: z.number().int().positive().optional(),
      quantity: z.number().int().min(1).max(10),
    }).refine((item) => item.productId || item.slug, {
      message: "Each item needs productId or slug",
    })
  ).min(1),
});

// Public endpoint – no auth required so checkout can validate coupons
// Optionally reads the auth cookie to check per-customer limits
router.post("/validate", async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { code, items } = parsed.data;

  // Try to extract userId from auth cookie for per-customer limit checks
  let userId: number | undefined;
  const token =
    req.cookies?.embr_token ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);
  if (token) {
    const payload = verifyToken(token);
    if (payload) userId = payload.userId;
  }

  try {
    const normalizedCode = code?.trim() || undefined;
    const pricing = await calculateOrderPricing(items, normalizedCode, userId);
    res.json({
      valid: true,
      coupon: pricing.coupon
        ? {
            code: pricing.coupon.code,
            discount_type: pricing.coupon.discount_type,
            discount_value: pricing.coupon.discount_value,
            min_order_value: pricing.coupon.min_order_value,
            max_discount: pricing.coupon.max_discount,
          }
        : null,
      subtotalPaise: pricing.subtotalPaise,
      shippingPaise: pricing.shippingPaise,
      couponDiscountPaise: pricing.couponDiscountPaise,
      totalPaise: pricing.totalPaise,
    });
  } catch (err) {
    res.status(400).json({
      valid: false,
      error: err instanceof Error ? err.message : "Invalid coupon",
    });
  }
});

export default router;
