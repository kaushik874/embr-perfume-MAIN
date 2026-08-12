import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import {
  failureInfoFromPayment,
  markOrderPaidFromRazorpay,
  razorpayEnabled,
  reconcileOrderWithRazorpay,
  recordOrderPaymentFailure,
  verifyRazorpayWebhookSignature,
} from "../lib/payments.js";

const router = Router();

type RazorpayWebhookPayment = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
};

type RazorpayWebhookOrder = {
  id?: string;
  status?: string;
  amount?: number | string;
  amount_paid?: number | string;
  currency?: string;
};

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookPayment };
    order?: { entity?: RazorpayWebhookOrder };
  };
};

type LocalPaymentOrder = {
  id: number;
  status: string;
  total_paise: number;
};

function eventIdFromRequest(rawBody: Buffer, headerValue: string | string[] | undefined) {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return `body_${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
}

function amountMatches(value: number | string | undefined, expectedAmount: number) {
  return Number(value) === expectedAmount;
}

async function reserveWebhookEvent(eventId: string) {
  const result = await db
    .prepare("INSERT INTO webhook_events (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING")
    .run(eventId);

  return result.changes > 0;
}

async function releaseWebhookEvent(eventId: string) {
  await db.prepare("DELETE FROM webhook_events WHERE event_id = ?").run(eventId);
}

async function findLocalOrder(razorpayOrderId: string) {
  return await db
    .prepare("SELECT id, status, total_paise FROM orders WHERE razorpay_order_id = ?")
    .get(razorpayOrderId) as LocalPaymentOrder | undefined;
}

async function handleCapturedPayment(payment: RazorpayWebhookPayment) {
  if (!payment.order_id || payment.status !== "captured") return;

  const order = await findLocalOrder(payment.order_id);
  if (!order) return;

  if (!amountMatches(payment.amount, order.total_paise) || payment.currency !== "INR") {
    console.error(`Webhook payment amount/currency mismatch for ${payment.order_id}`);
    return;
  }

  await markOrderPaidFromRazorpay({
    razorpayOrderId: payment.order_id,
    razorpayPaymentId: payment.id ?? null,
    expectedAmount: order.total_paise,
  });
}

async function handlePaidOrder(orderEntity: RazorpayWebhookOrder, payment?: RazorpayWebhookPayment) {
  const razorpayOrderId = orderEntity.id ?? payment?.order_id;
  if (!razorpayOrderId) return;

  const order = await findLocalOrder(razorpayOrderId);
  if (!order) return;

  if (orderEntity.amount !== undefined && !amountMatches(orderEntity.amount, order.total_paise)) {
    console.error(`Webhook order amount mismatch for ${razorpayOrderId}`);
    return;
  }

  if (orderEntity.currency && orderEntity.currency !== "INR") {
    console.error(`Webhook order currency mismatch for ${razorpayOrderId}`);
    return;
  }

  if (
    payment?.status === "captured" &&
    amountMatches(payment.amount, order.total_paise) &&
    payment.currency === "INR"
  ) {
    await markOrderPaidFromRazorpay({
      razorpayOrderId,
      razorpayPaymentId: payment.id ?? null,
      expectedAmount: order.total_paise,
    });
    return;
  }

  if (razorpayEnabled()) {
    await reconcileOrderWithRazorpay({
      razorpayOrderId,
      expectedAmount: order.total_paise,
    });
    return;
  }

  await markOrderPaidFromRazorpay({
    razorpayOrderId,
    razorpayPaymentId: payment?.id ?? null,
    expectedAmount: order.total_paise,
  });
}

async function handleFailedPayment(payment: RazorpayWebhookPayment) {
  if (!payment.order_id) return;
  await recordOrderPaymentFailure(payment.order_id, failureInfoFromPayment(payment));
}

async function processRazorpayEvent(event: RazorpayWebhookEvent) {
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;

  switch (event.event) {
    case "payment.captured":
      if (payment) await handleCapturedPayment(payment);
      return;
    case "order.paid":
      if (order) await handlePaidOrder(order, payment);
      return;
    case "payment.failed":
      if (payment) await handleFailedPayment(payment);
      return;
    default:
      return;
  }
}

router.post("/razorpay", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("Webhook received but RAZORPAY_WEBHOOK_SECRET is not set.");
    res.status(500).send("Webhook secret not configured");
    return;
  }

  const signature = req.headers["x-razorpay-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).send("Missing signature");
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    console.error("Webhook route received non-buffer body. Check express.raw() configuration.");
    res.status(500).send("Internal configuration error");
    return;
  }

  if (!verifyRazorpayWebhookSignature(req.body, signature, secret)) {
    console.error("Webhook signature verification failed");
    res.status(400).send("Invalid signature");
    return;
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(req.body.toString("utf8")) as RazorpayWebhookEvent;
  } catch {
    console.error("Failed to parse webhook JSON body");
    res.status(400).send("Invalid JSON payload");
    return;
  }

  const eventId = eventIdFromRequest(req.body, req.headers["x-razorpay-event-id"]);
  let reserved = false;
  try {
    reserved = await reserveWebhookEvent(eventId);
  } catch (err) {
    console.error("Database error while checking webhook idempotency:", err);
    res.status(500).send("Webhook idempotency check failed");
    return;
  }

  if (!reserved) {
    res.status(200).send("OK");
    return;
  }

  try {
    await processRazorpayEvent(event);
  } catch (err) {
    await releaseWebhookEvent(eventId).catch(() => {});
    console.error("Razorpay webhook processing failed:", err);
    res.status(500).send("Webhook processing failed");
    return;
  }

  res.status(200).send("OK");
});

export default router;
