import { db } from "../db.js";

export type PricingLineItem = {
  productId: number;
  quantity: number;
  pricePaise: number;
  shippingChargePaise: number;
  name: string;
};

export type CouponRecord = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  max_discount: number | null;
  per_customer_limit: number | null;
  usage_limit: number | null;
  times_used: number;
  starts_at: string | null;
  expiry_date: string | null;
  status: string;
};

export type PricingResult = {
  subtotalPaise: number;
  shippingPaise: number;
  couponCode: string | null;
  couponDiscountType: string | null;
  couponDiscountValue: number | null;
  couponDiscountPaise: number;
  totalPaise: number;
  lineItems: PricingLineItem[];
  coupon: CouponRecord | null;
};

export type LineItemInput = { productId?: number; slug?: string; quantity: number };

/**
 * Validates a coupon code and returns the coupon record if valid.
 * Throws an Error with a user-friendly message if invalid.
 */
export async function validateCoupon(
  code: string,
  subtotalPaise: number,
  userId?: number,
): Promise<CouponRecord> {
  const coupon = await db.prepare(
    "SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND status = 'active'"
  ).get(code) as CouponRecord | undefined;

  if (!coupon) {
    throw new Error("Invalid or expired coupon code");
  }

  // Check start date
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    throw new Error("This coupon is not yet active");
  }

  // Check expiry date
  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
    throw new Error("Coupon has expired");
  }

  // Check global usage limit
  if (coupon.usage_limit != null && coupon.times_used >= coupon.usage_limit) {
    throw new Error("Coupon usage limit reached");
  }

  // Check per-customer limit
  if (coupon.per_customer_limit != null && userId) {
    const usage = await db.prepare(
      "SELECT COUNT(*) as c FROM coupon_usages WHERE coupon_id = ? AND user_id = ?"
    ).get(coupon.id, userId) as { c: number };
    if (usage.c >= coupon.per_customer_limit) {
      throw new Error("You have already used this coupon the maximum number of times");
    }
  }

  // Check minimum order value (min_order_value is in INR, subtotalPaise is in paise)
  if (coupon.min_order_value != null && subtotalPaise < coupon.min_order_value * 100) {
    throw new Error(
      `Minimum order of ₹${coupon.min_order_value} required for this coupon`
    );
  }

  return coupon;
}

/**
 * Calculates the discount in paise for a validated coupon.
 */
export function calculateCouponDiscount(
  coupon: CouponRecord,
  subtotalPaise: number,
): number {
  let discountPaise = 0;

  if (coupon.discount_type === "percent") {
    // Math.round to nearest 100 paise (1 INR) to ensure no fractional rupees, perfectly matching UI
    const rawDiscountPaise = subtotalPaise * coupon.discount_value / 100;
    discountPaise = Math.round(rawDiscountPaise / 100) * 100;
  } else {
    // Fixed discount: discount_value is in INR
    discountPaise = coupon.discount_value * 100;
  }

  // Apply max discount cap (max_discount is in INR)
  if (coupon.max_discount != null) {
    discountPaise = Math.min(discountPaise, coupon.max_discount * 100);
  }

  // Discount cannot exceed subtotal
  discountPaise = Math.min(discountPaise, subtotalPaise);

  return discountPaise;
}

/**
 * Central pricing engine. Builds line items from DB, calculates shipping,
 * validates and applies coupon, and returns the complete pricing breakdown.
 *
 * @param items - Cart items with productId or slug and quantity
 * @param couponCode - Optional coupon code to apply
 * @param userId - Optional user ID for per-customer coupon limit checks
 */
export async function calculateOrderPricing(
  items: LineItemInput[],
  couponCode?: string,
  userId?: number,
): Promise<PricingResult> {
  const getById = db.prepare(
    "SELECT id, name, price, stock, shipping_charge FROM products WHERE id = ?",
  );
  const getBySlug = db.prepare(
    "SELECT id, name, price, stock, shipping_charge FROM products WHERE slug = ?",
  );

  let subtotalPaise = 0;
  const lineItems: PricingLineItem[] = [];
  const seenProductIds = new Set<number>();
  let shippingPaise = 0;

  for (const item of items) {
    let product: {
      id: number;
      name: string;
      price: number;
      stock: number;
      shipping_charge: number;
    } | undefined;

    if (item.productId) {
      product = await getById.get(item.productId) as typeof product;
    } else if (item.slug) {
      product = await getBySlug.get(item.slug) as typeof product;
    }

    if (!product) {
      const ref = item.slug ?? item.productId;
      throw new Error(`Product ${ref} not found`);
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `Insufficient stock for ${product.name} (only ${product.stock} left)`
      );
    }

    const pricePaise = product.price * 100;
    const shippingChargePaise = (product.shipping_charge ?? 0) * 100;
    subtotalPaise += pricePaise * item.quantity;

    // Shipping charge is per unique product, not per unit
    if (!seenProductIds.has(product.id)) {
      seenProductIds.add(product.id);
      shippingPaise += shippingChargePaise;
    }

    lineItems.push({
      productId: product.id,
      quantity: item.quantity,
      pricePaise,
      shippingChargePaise,
      name: product.name,
    });
  }

  // Coupon processing
  let coupon: CouponRecord | null = null;
  let couponDiscountPaise = 0;

  if (couponCode) {
    coupon = await validateCoupon(couponCode, subtotalPaise, userId);
    couponDiscountPaise = calculateCouponDiscount(coupon, subtotalPaise);
  }

  // Free Shipping Threshold logic
  const freeShippingThresholdContent = await db.prepare(
    "SELECT value FROM site_content WHERE key = 'free_shipping_threshold_inr'"
  ).get() as { value?: string } | undefined;

  let freeShippingThresholdPaise: number | null = null;
  if (freeShippingThresholdContent?.value) {
    const parsed = parseInt(freeShippingThresholdContent.value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      freeShippingThresholdPaise = parsed * 100;
    }
  }

  const finalSubtotalAfterCoupon = subtotalPaise - couponDiscountPaise;
  if (freeShippingThresholdPaise !== null && finalSubtotalAfterCoupon >= freeShippingThresholdPaise) {
    shippingPaise = 0; // Free shipping applies
  }

  const totalPaise = subtotalPaise - couponDiscountPaise + shippingPaise;

  return {
    subtotalPaise,
    shippingPaise,
    couponCode: coupon ? coupon.code : null,
    couponDiscountType: coupon ? coupon.discount_type : null,
    couponDiscountValue: coupon ? coupon.discount_value : null,
    couponDiscountPaise,
    totalPaise,
    lineItems,
    coupon,
  };
}

/**
 * Records coupon usage after a successful order creation.
 * Also increments the global times_used counter.
 */
export async function recordCouponUsage(
  couponId: number,
  userId: number,
  orderId: number,
): Promise<void> {
  await db.prepare(
    "INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES (?, ?, ?)"
  ).run(couponId, userId, orderId);

  await db.prepare(
    "UPDATE coupons SET times_used = times_used + 1 WHERE id = ?"
  ).run(couponId);
}

/**
 * Releases coupon usage when an order is cancelled or expired.
 * Called from the order expiry job.
 */
export async function releaseCouponUsage(orderId: number): Promise<void> {
  const usages = await db.prepare(
    "SELECT coupon_id FROM coupon_usages WHERE order_id = ?"
  ).all(orderId) as { coupon_id: number }[];

  for (const usage of usages) {
    await db.prepare(
      "UPDATE coupons SET times_used = GREATEST(0, times_used - 1) WHERE id = ?"
    ).run(usage.coupon_id);
  }

  await db.prepare(
    "DELETE FROM coupon_usages WHERE order_id = ?"
  ).run(orderId);
}
