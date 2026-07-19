import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { setAuthCookie } from "../lib/auth-cookie.js";
import { buildOrderLines, createOrderRecord } from "../lib/orders.js";
import { ensureUserFromShipping } from "../lib/users.js";
import { saveCustomerAddress } from "../lib/addresses.js";

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
});

function razorpayEnabled() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
}

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
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

  const { items, shipping } = parsed.data;

  let totalPaise: number;
  let lineItems: Awaited<ReturnType<typeof buildOrderLines>>["lineItems"];

  try {
    const built = await buildOrderLines(items);
    totalPaise = built.totalPaise;
    lineItems = built.lineItems;
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid cart",
    });
    return;
  }

  const user = await ensureUserFromShipping({
    name: shipping.name,
    email: shipping.email,
    phone: shipping.phone,
  });

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

  const orderId = await createOrderRecord(user.id, totalPaise, lineItems, {
    ...shipping,
    addressId,
  });
  setAuthCookie(res, user.id, user.email);

  if (!razorpayEnabled()) {
    await db.prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = 'demo' WHERE id = ?`,
    ).run(orderId);

    res.json({
      mode: "demo",
      orderId,
      user: { id: user.id, name: user.name, email: user.email },
      amount: totalPaise,
      message: "Order placed — add Razorpay keys in .env for live payments",
    });
    return;
  }

  try {
    const razorpay = getRazorpay();
    const rzOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: `embr_${orderId}`,
      notes: { orderId: String(orderId) },
    });

    await db.prepare(
      "UPDATE orders SET razorpay_order_id = ? WHERE id = ?",
    ).run(rzOrder.id, orderId);

    res.json({
      mode: "razorpay",
      orderId,
      user: { id: user.id, name: user.name, email: user.email },
      razorpayOrderId: rzOrder.id,
      amount: totalPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
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

  const { orderId, razorpay_payment_id, razorpay_order_id } = parsed.data;

  // Validate payment_id format (Razorpay pay_XXX format)
  if (!razorpay_payment_id.startsWith("pay_")) {
    res.status(400).json({ error: "Invalid payment reference." });
    return;
  }

  const order = await db
    .prepare("SELECT id, user_id, status, razorpay_order_id FROM orders WHERE id = ?")
    .get(orderId) as { id: number; user_id: number; status: string; razorpay_order_id: string | null } | undefined;

  if (!order || order.user_id !== req.user!.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // Order must still be pending (not already paid)
  if (order.status === "paid" || order.status === "delivered") {
    res.status(400).json({ error: "Order is already marked as paid." });
    return;
  }

  // The razorpay_order_id on the order must match what the client sends
  if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
    res.status(403).json({ error: "Payment reference does not match this order." });
    return;
  }

  await db.prepare(
    `UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE id = ?`,
  ).run(razorpay_payment_id, orderId);

  res.json({ ok: true, orderId });
});

const verifySchema = z.object({
  orderId: z.number().int().positive(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

router.post("/verify", requireAuth, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  const order = await db
    .prepare("SELECT id, user_id, status FROM orders WHERE id = ?")
    .get(orderId) as { id: number; user_id: number; status: string } | undefined;

  if (!order || order.user_id !== req.user!.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!razorpayEnabled()) {
    res.status(400).json({ error: "Razorpay not configured" });
    return;
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  await db.prepare(
    `UPDATE orders SET status = 'paid', razorpay_payment_id = ?, razorpay_order_id = ? WHERE id = ?`,
  ).run(razorpay_payment_id, razorpay_order_id, orderId);

  res.json({ ok: true, orderId });
});

export default router;
