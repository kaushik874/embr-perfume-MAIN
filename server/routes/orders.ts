import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, verifyToken } from "../middleware/auth.js";
import { setAuthCookie } from "../lib/auth-cookie.js";
import { buildOrderLines, createOrderRecord } from "../lib/orders.js";
import { calculateOrderPricing, recordCouponUsage } from "../lib/pricing.js";
import { ensureUserFromShipping } from "../lib/users.js";
import { saveCustomerAddress } from "../lib/addresses.js";
import { sendEmail } from "../lib/email.js";
import { orderConfirmationEmail } from "../lib/email-templates.js";
import {
  failureInfoFromPayment,
  getRazorpay,
  markOrderPaidFromRazorpay,
  razorpayEnabled,
  reconcileOrderWithRazorpay,
  recordOrderPaymentFailure,
  verifyPaymentWithRazorpay,
  verifyRazorpayCheckoutSignature,
} from "../lib/payments.js";

const router = Router();

const itemSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    slug: z.string().min(1).optional(),
    quantity: z.number().int().min(1).max(10),
  })
  .refine((item) => item.productId || item.slug, {
    message: "Each item needs productId or slug",
  });

const shippingSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^[0-9+\-\s]+$/),
  houseNumber: z.string().min(1).max(80),
  street: z.string().min(2).max(120),
  area: z.string().min(2).max(120),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6 digit PIN code"),
  landmark: z.string().max(120).optional(),
  alternatePhone: z.string().max(15).optional(),
  companyName: z.string().max(120).optional(),
  addressId: z.number().int().positive().optional(),
  saveAddress: z.boolean().optional(),
  setDefault: z.boolean().optional(),
  updateAddress: z.boolean().optional(),
});

const guestCheckoutSchema = z.object({
  items: z.array(itemSchema).min(1),
  shipping: shippingSchema,
  couponCode: z.string().max(50).optional(),
  checkoutSessionId: z
    .string()
    .min(12)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

const razorpayOrderIdSchema = z.string().regex(/^order_[A-Za-z0-9]+$/);
const razorpayPaymentIdSchema = z.string().regex(/^pay_[A-Za-z0-9]+$/);
const razorpaySignatureSchema = z.string().regex(/^[A-Fa-f0-9]{64}$/);
const paidOrderStatuses = new Set(["paid", "shipped", "delivered"]);

type CheckoutOrder = {
  id: number;
  status: string;
  total_paise: number;
  razorpay_order_id: string | null;
};

async function findReusableCheckoutOrder(
  userId: number,
  checkoutSessionId: string | undefined,
) {
  if (!checkoutSessionId) return undefined;

  return await db.prepare(`
    SELECT id, status, total_paise, razorpay_order_id
    FROM orders
    WHERE user_id = ?
      AND checkout_session_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, checkoutSessionId) as CheckoutOrder | undefined;
}

function getOptionalUserId(req: Request) {
  const token =
    req.cookies?.embr_token ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return null;
  return verifyToken(token)?.userId ?? null;
}

function canReadPaymentOrder(req: Request, order: {
  user_id: number;
  checkout_session_id: string | null;
  razorpay_order_id: string | null;
}) {
  const userId = getOptionalUserId(req);
  if (userId && userId === order.user_id) return true;

  const checkoutSessionId = typeof req.query.checkoutSessionId === "string"
    ? req.query.checkoutSessionId
    : undefined;
  const razorpayOrderId = typeof req.query.razorpayOrderId === "string"
    ? req.query.razorpayOrderId
    : undefined;

  if (
    checkoutSessionId &&
    order.checkout_session_id === checkoutSessionId &&
    (!razorpayOrderId || order.razorpay_order_id === razorpayOrderId)
  ) {
    return true;
  }

  return false;
}

router.get("/mine", requireAuth, async (req, res) => {
  const orders = await db
    .prepare(
      `SELECT id, status, total_paise, razorpay_order_id, razorpay_payment_id, created_at,
              shipping_name, shipping_email, shipping_phone, shipping_address,
              shipping_city, shipping_pincode, shipping_state, tracking_number
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(req.user!.userId) as any[];

  for (const order of orders) {
    order.items = await db
      .prepare(
        `SELECT oi.quantity, oi.price_paise as price_at_time, p.name, p.slug, p.image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
      )
      .all(order.id);
  }

  res.json({ orders });
});

router.post("/guest-checkout", async (req, res) => {
  const parsed = guestCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { items, shipping, checkoutSessionId, couponCode } = parsed.data;

  let totalPaise: number;
  let lineItems: Awaited<ReturnType<typeof buildOrderLines>>["lineItems"];
  let pricingBreakdown: {
    subtotalPaise: number;
    shippingPaise: number;
    couponCode: string | null;
    couponDiscountType: string | null;
    couponDiscountValue: number | null;
    couponDiscountPaise: number;
    couponId: number | null;
  } | undefined;

  try {
    const pricing = await calculateOrderPricing(items, couponCode);
    totalPaise = pricing.totalPaise;
    lineItems = pricing.lineItems;
    pricingBreakdown = {
      subtotalPaise: pricing.subtotalPaise,
      shippingPaise: pricing.shippingPaise,
      couponCode: pricing.couponCode,
      couponDiscountType: pricing.couponDiscountType,
      couponDiscountValue: pricing.couponDiscountValue,
      couponDiscountPaise: pricing.couponDiscountPaise,
      couponId: pricing.coupon?.id ?? null,
    };
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid cart",
    });
    return;
  }

  if (totalPaise < 100) {
    res.status(400).json({ error: "Order amount must be at least 1 INR (100 paise)" });
    return;
  }

  const user = await ensureUserFromShipping({
    name: shipping.name,
    email: shipping.email,
    phone: shipping.phone,
  });

  let checkoutOrder = await findReusableCheckoutOrder(user.id, checkoutSessionId);
  if (checkoutOrder && paidOrderStatuses.has(checkoutOrder.status)) {
    res.json({
      mode: "paid",
      orderId: checkoutOrder.id,
      user: { id: user.id, name: user.name, email: user.email },
      razorpayOrderId: checkoutOrder.razorpay_order_id,
      amount: checkoutOrder.total_paise,
      currency: "INR",
      checkoutSessionId,
      message: "This checkout is already paid.",
    });
    return;
  }

  if (checkoutOrder && checkoutOrder.status !== "pending") {
    res.status(409).json({ error: "This checkout has expired. Please review your bag and try again." });
    return;
  }

  if (checkoutOrder && checkoutOrder.total_paise !== totalPaise) {
    // If the cart total changed (e.g. shipping was dynamically added or coupon applied),
    // invalidate the old order's session ID to free it up for a fresh order.
    await db.prepare("UPDATE orders SET checkout_session_id = NULL WHERE id = ?").run(checkoutOrder.id);
    checkoutOrder = undefined;
  }

  let orderId = checkoutOrder?.id;
  if (!orderId) {
    let addressId: number | undefined;
    if (shipping.saveAddress !== false) {
      try {
        addressId = await saveCustomerAddress(user.id, shipping, {
          existingAddressId: shipping.addressId,
          setDefault: shipping.setDefault,
          updateExisting: shipping.updateAddress === true,
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Could not save address",
        });
        return;
      }
    } else {
      addressId = shipping.addressId;
    }

    try {
      orderId = await createOrderRecord(user.id, totalPaise, lineItems, {
        ...shipping,
        addressId,
      }, checkoutSessionId, pricingBreakdown);
    } catch (err: any) {
      if (checkoutSessionId && err?.code === "23505") {
        checkoutOrder = await findReusableCheckoutOrder(user.id, checkoutSessionId);
        if (checkoutOrder && checkoutOrder.total_paise === totalPaise) {
          orderId = checkoutOrder.id;
        }
      }

      if (!orderId) {
        throw err;
      }
    }
  }

  // Record coupon usage if a coupon was applied
  if (pricingBreakdown?.couponId && orderId) {
    try {
      await recordCouponUsage(pricingBreakdown.couponId, user.id, orderId);
    } catch (err) {
      console.error("[Orders] Failed to record coupon usage:", err);
    }
  }

  if (user.isNew) {
    setAuthCookie(res, user.id, user.email);
  }

  if (!razorpayEnabled()) {
    await db.prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = 'demo', paid_at = COALESCE(paid_at, datetime('now')) WHERE id = ?`,
    ).run(orderId);

    const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
    if (order) {
      sendEmail(user.email, user.name, `Order #${orderId} Confirmed`, orderConfirmationEmail(order, lineItems)).catch(console.error);
    }

    res.json({
      mode: "demo",
      orderId,
      user: { id: user.id, name: user.name, email: user.email },
      amount: totalPaise,
      checkoutSessionId,
      message: "Order placed — add Razorpay keys in .env for live payments",
    });
    return;
  }

  if (checkoutOrder?.razorpay_order_id) {
    res.json({
      mode: "razorpay",
      orderId,
      user: { id: user.id, name: user.name, email: user.email },
      razorpayOrderId: checkoutOrder.razorpay_order_id,
      amount: totalPaise,
      checkoutSessionId,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
    return;
  }

  try {
    const razorpay = getRazorpay();
    const rzOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: `embr_${orderId}`,
      notes: {
        orderId: String(orderId),
        checkoutSessionId: checkoutSessionId ?? "",
        customerEmail: shipping.email,
        customerPhone: shipping.phone,
      },
      customer_details: {
        name: shipping.name,
        email: shipping.email,
        contact: shipping.phone,
        shipping_address: {
          line1: shipping.houseNumber,
          line2: `${shipping.street}, ${shipping.area}`,
          city: shipping.city,
          state: shipping.state,
          zipcode: shipping.pincode,
          country: "IN",
        },
        billing_address: {
          line1: shipping.houseNumber,
          line2: `${shipping.street}, ${shipping.area}`,
          city: shipping.city,
          state: shipping.state,
          zipcode: shipping.pincode,
          country: "IN",
        },
      },
      payment: {
        capture: "automatic",
        capture_options: {
          automatic_expiry_period: 12,
          manual_expiry_period: 7200,
          refund_speed: "normal",
        },
      },
    });

    const saved = await db.prepare(
      "UPDATE orders SET razorpay_order_id = ? WHERE id = ? AND razorpay_order_id IS NULL",
    ).run(rzOrder.id, orderId);

    if (saved.changes === 0) {
      const existing = await db
        .prepare("SELECT razorpay_order_id FROM orders WHERE id = ?")
        .get(orderId) as { razorpay_order_id: string | null } | undefined;
      if (existing?.razorpay_order_id) {
        res.json({
          mode: "razorpay",
          orderId,
          user: { id: user.id, name: user.name, email: user.email },
          razorpayOrderId: existing.razorpay_order_id,
          amount: totalPaise,
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID,
          checkoutSessionId,
        });
        return;
      }
    }

    res.json({
      mode: "razorpay",
      orderId,
      user: { id: user.id, name: user.name, email: user.email },
      razorpayOrderId: rzOrder.id,
      amount: totalPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      checkoutSessionId,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(502).json({ error: "Payment gateway unavailable" });
  }
});

const markPaidSchema = z.object({
  orderId: z.number().int().positive(),
  razorpay_payment_id: z.string().min(10).max(100),  // Required — must be a real payment ID
  razorpay_order_id: z.string().min(10).max(100),    // Required — must match stored order
});

// This endpoint is only for confirming payment on the client side AFTER
// Razorpay callback. It requires both payment_id AND order_id to match.
// Real signature verification is enforced separately via /orders/verify.
router.post("/mark-paid", requireAuth, async (req, res) => {
  const parsed = markPaidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  res.status(400).json({ error: "Payment must be verified with Razorpay before it can be marked paid." });
});

const paymentFailureSchema = z.object({
  orderId: z.number().int().positive(),
  razorpay_order_id: razorpayOrderIdSchema,
  checkoutSessionId: z
    .string()
    .min(12)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  code: z.string().max(120).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  reason: z.string().max(200).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  step: z.string().max(100).nullable().optional(),
  paymentId: razorpayPaymentIdSchema.nullable().optional(),
});

router.post("/payment-failed", async (req, res) => {
  const parsed = paymentFailureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { orderId, razorpay_order_id, checkoutSessionId, ...failureInfo } = parsed.data;
  const order = await db
    .prepare("SELECT id, user_id, status, checkout_session_id, razorpay_order_id FROM orders WHERE id = ?")
    .get(orderId) as {
      id: number;
      user_id: number;
      status: string;
      checkout_session_id: string | null;
      razorpay_order_id: string | null;
    } | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
    res.status(403).json({ error: "Payment reference does not match this order." });
    return;
  }

  const userId = getOptionalUserId(req);
  const canWriteFailure =
    userId === order.user_id ||
    (checkoutSessionId && order.checkout_session_id === checkoutSessionId);

  if (!canWriteFailure) {
    res.status(403).json({ error: "Payment reference does not match this checkout." });
    return;
  }

  await recordOrderPaymentFailure(razorpay_order_id, failureInfo);
  res.json({ ok: true });
});

const verifySchema = z.object({
  orderId: z.number().int().positive(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

router.post("/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  if (
    !razorpayOrderIdSchema.safeParse(razorpay_order_id).success ||
    !razorpayPaymentIdSchema.safeParse(razorpay_payment_id).success ||
    !razorpaySignatureSchema.safeParse(razorpay_signature).success
  ) {
    res.status(400).json({ error: "Invalid payment reference." });
    return;
  }

  const order = await db
    .prepare("SELECT id, user_id, status, total_paise, razorpay_order_id FROM orders WHERE id = ?")
    .get(orderId) as {
      id: number;
      user_id: number;
      status: string;
      total_paise: number;
      razorpay_order_id: string | null;
    } | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!razorpayEnabled()) {
    res.status(400).json({ error: "Razorpay not configured" });
    return;
  }

  if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
    res.status(403).json({ error: "Payment reference does not match this order." });
    return;
  }

  if (!verifyRazorpayCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  let verification: Awaited<ReturnType<typeof verifyPaymentWithRazorpay>>;
  try {
    verification = await verifyPaymentWithRazorpay({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      expectedAmount: order.total_paise,
    });
  } catch (err) {
    console.error("Razorpay payment verification failed:", err);
    res.status(502).json({ error: "Could not verify payment with Razorpay. The order remains pending." });
    return;
  }

  if (verification.payment.status === "failed") {
    await recordOrderPaymentFailure(
      razorpay_order_id,
      failureInfoFromPayment(verification.payment),
    );
    res.status(400).json({ error: "Payment was not completed." });
    return;
  }

  if (!verification.paid) {
    try {
      const reconciled = await reconcileOrderWithRazorpay({
        razorpayOrderId: razorpay_order_id,
        expectedAmount: order.total_paise,
      });

      if (reconciled.paid) {
        res.json({
          ok: true,
          paid: true,
          orderId: reconciled.localOrderId ?? orderId,
          razorpayPaymentId: reconciled.paymentId ?? razorpay_payment_id,
          amount: order.total_paise,
        });
        return;
      }
    } catch (err) {
      console.error("Razorpay payment reconciliation failed after checkout callback:", err);
    }

    res.json({
      ok: true,
      paid: false,
      orderId,
      paymentStatus: verification.payment.status,
      orderStatus: verification.order.status,
      message: "Payment is still pending confirmation from Razorpay.",
    });
    return;
  }

  const paid = await markOrderPaidFromRazorpay({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    expectedAmount: order.total_paise,
  });

  res.json({
    ok: true,
    paid: true,
    orderId: paid.orderId ?? orderId,
    razorpayPaymentId: razorpay_payment_id,
    amount: order.total_paise,
  });
});

router.get("/:orderId/payment-status", async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.orderId);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order id." });
    return;
  }

  const orderId = parsed.data;
  const loadOrder = async () =>
    await db
      .prepare(
        `SELECT id, user_id, status, total_paise, checkout_session_id,
                razorpay_order_id, razorpay_payment_id,
                payment_failure_code, payment_failure_reason
         FROM orders WHERE id = ?`,
      )
      .get(orderId) as {
        id: number;
        user_id: number;
        status: string;
        total_paise: number;
        checkout_session_id: string | null;
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        payment_failure_code: string | null;
        payment_failure_reason: string | null;
      } | undefined;

  let order = await loadOrder();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!canReadPaymentOrder(req, order)) {
    res.status(403).json({ error: "Payment reference does not match this checkout." });
    return;
  }

  if (!paidOrderStatuses.has(order.status) && razorpayEnabled() && order.razorpay_order_id) {
    try {
      await reconcileOrderWithRazorpay({
        razorpayOrderId: order.razorpay_order_id,
        expectedAmount: order.total_paise,
      });
      order = await loadOrder();
    } catch (err) {
      console.error("Razorpay payment status sync failed:", err);
    }
  }

  res.json({
    orderId,
    status: order?.status ?? "pending",
    paid: order ? paidOrderStatuses.has(order.status) : false,
    amount: order?.total_paise ?? 0,
    razorpayOrderId: order?.razorpay_order_id ?? null,
    razorpayPaymentId: order?.razorpay_payment_id ?? null,
    failureCode: order?.payment_failure_code ?? null,
    failureReason: order?.payment_failure_reason ?? null,
  });
});

export default router;
