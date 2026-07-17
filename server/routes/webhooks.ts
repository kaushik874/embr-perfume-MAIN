import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";

const router = Router();

router.post("/razorpay", (req, res) => {
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

  // We are assuming `req.body` is a raw Buffer because of `express.raw()` in index.ts
  if (!Buffer.isBuffer(req.body)) {
    console.error("Webhook route received non-buffer body. Check express.raw() configuration.");
    res.status(500).send("Internal configuration error");
    return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  if (expectedSignature !== signature) {
    console.error("Webhook signature verification failed");
    res.status(400).send("Invalid signature");
    return;
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    console.error("Failed to parse webhook JSON body");
    res.status(400).send("Invalid JSON payload");
    return;
  }

  const eventId = req.headers["x-razorpay-event-id"];
  if (eventId && typeof eventId === "string") {
    try {
      const existing = db
        .prepare("SELECT event_id FROM webhook_events WHERE event_id = ?")
        .get(eventId);

      if (existing) {
        console.log(`Duplicate webhook ignored: ${eventId}`);
        res.status(200).send("OK");
        return;
      }
      db.prepare("INSERT INTO webhook_events (event_id) VALUES (?)").run(eventId);
    } catch (err) {
      console.error("Database error while checking webhook idempotency:", err);
      // We will proceed but this is risky if duplicate events actually process twice.
    }
  }

  console.log(`Processing valid Razorpay webhook event: ${event.event}`);

  if (event.event === "payment.captured" || event.event === "payment.authorized") {
    const payment = event.payload.payment.entity;
    const razorpay_order_id = payment.order_id;
    const razorpay_payment_id = payment.id;

    if (razorpay_order_id) {
      db.prepare(
        `UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status != 'paid'`
      ).run(razorpay_payment_id, razorpay_order_id);
      console.log(`Webhook marked order ${razorpay_order_id} as paid.`);
    }
  }

  res.status(200).send("OK");
});

export default router;
