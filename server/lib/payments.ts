import crypto from "crypto";
import Razorpay from "razorpay";
import { db } from "../db.js";
import { sendEmail } from "./email.js";
import { orderConfirmationEmail } from "./email-templates.js";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
};

type RazorpayOrderEntity = {
  id?: string;
  status?: string;
  amount?: number | string;
  amount_paid?: number | string;
  currency?: string;
  receipt?: string;
};

type RazorpayOrderPayments = {
  items?: RazorpayPaymentEntity[];
};

type RazorpayOrdersList = {
  items?: RazorpayOrderEntity[];
};

type PaymentFailureInfo = {
  paymentId?: string | null;
  code?: string | null;
  description?: string | null;
  reason?: string | null;
  source?: string | null;
  step?: string | null;
};

const PAID_ORDER_STATUSES = new Set(["paid", "shipped", "delivered"]);
let paymentSyncTimer: NodeJS.Timeout | null = null;
let paymentSyncRunning = false;

function asAmount(value: number | string | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isPaymentCaptured(payment: RazorpayPaymentEntity | undefined, expectedAmount: number) {
  return (
    payment?.status === "captured" &&
    asAmount(payment.amount) === expectedAmount &&
    payment.currency === "INR"
  );
}

function isPaymentAuthorized(payment: RazorpayPaymentEntity | undefined, expectedAmount: number) {
  return (
    payment?.status === "authorized" &&
    Boolean(payment.id) &&
    asAmount(payment.amount) === expectedAmount &&
    payment.currency === "INR"
  );
}

function isOrderPaid(order: RazorpayOrderEntity, expectedAmount: number) {
  return order.status === "paid" && asAmount(order.amount_paid) === expectedAmount;
}

function assertOrderAmount(order: RazorpayOrderEntity, expectedAmount: number) {
  if (asAmount(order.amount) !== expectedAmount) {
    throw new Error("Razorpay order amount does not match this order.");
  }

  if (order.currency !== "INR") {
    throw new Error("Razorpay order currency does not match this order.");
  }
}

export function razorpayEnabled() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
}

export function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

function safeCompareHex(expectedHex: string, actualHex: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || !/^[a-f0-9]{64}$/i.test(actualHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verifyRazorpayCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return safeCompareHex(expected, signature);
}

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeCompareHex(expected, signature);
}

export async function verifyPaymentWithRazorpay(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expectedAmount: number;
}) {
  const razorpay = getRazorpay();
  const [payment, order] = await Promise.all([
    razorpay.payments.fetch(params.razorpayPaymentId) as Promise<RazorpayPaymentEntity>,
    razorpay.orders.fetch(params.razorpayOrderId) as Promise<RazorpayOrderEntity>,
  ]);

  if (payment.id !== params.razorpayPaymentId || payment.order_id !== params.razorpayOrderId) {
    throw new Error("Payment does not belong to this Razorpay order.");
  }

  if (order.id !== params.razorpayOrderId) {
    throw new Error("Razorpay order could not be verified.");
  }

  assertOrderAmount(order, params.expectedAmount);

  const paymentAmount = asAmount(payment.amount);
  if (paymentAmount !== params.expectedAmount) {
    throw new Error("Payment amount does not match this order.");
  }

  if (payment.currency !== "INR") {
    throw new Error("Payment currency does not match this order.");
  }

  return {
    payment,
    order,
    paid: isPaymentCaptured(payment, params.expectedAmount) || isOrderPaid(order, params.expectedAmount),
  };
}

async function sendOrderPaidEmail(orderId: number) {
  const updatedOrder = await db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  if (!updatedOrder) return;

  const items = await db.prepare(`
    SELECT oi.*, p.name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderId);

  const account = await db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(updatedOrder.user_id) as { email?: string } | undefined;
  const userEmail = updatedOrder.shipping_email || account?.email;

  if (userEmail) {
    sendEmail(
      userEmail,
      updatedOrder.shipping_name,
      `Order #${orderId} Confirmed`,
      orderConfirmationEmail(updatedOrder, items),
    ).catch(console.error);
  }
}

async function reserveStockAgainForRecoveredOrder(orderId: number) {
  const items = await db
    .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as { product_id: number; quantity: number }[];
  const decrementStock = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?");

  for (const item of items) {
    await decrementStock.run(item.quantity, item.product_id);
  }
}

export async function markOrderPaidFromRazorpay(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  expectedAmount?: number;
}) {
  const orderBeforeUpdate = await db
    .prepare("SELECT id, status, total_paise FROM orders WHERE razorpay_order_id = ?")
    .get(params.razorpayOrderId) as { id: number; status: string; total_paise: number } | undefined;

  if (!orderBeforeUpdate) {
    return {
      changed: false,
      orderId: undefined,
      alreadyPaid: false,
      status: undefined,
    };
  }

  if (params.expectedAmount !== undefined && orderBeforeUpdate.total_paise !== params.expectedAmount) {
    throw new Error("Razorpay payment amount does not match local order amount.");
  }

  const result = await db.transaction(async () => {
    const updateResult = await db.prepare(`
      UPDATE orders
      SET status = 'paid',
          razorpay_payment_id = COALESCE(?, razorpay_payment_id),
          razorpay_signature = COALESCE(?, razorpay_signature),
          paid_at = COALESCE(paid_at, datetime('now')),
          payment_verified_at = COALESCE(payment_verified_at, datetime('now')),
          payment_failure_code = NULL,
          payment_failure_reason = NULL
      WHERE razorpay_order_id = ?
        AND status NOT IN ('paid', 'shipped', 'delivered')
    `).run(params.razorpayPaymentId ?? null, params.razorpaySignature ?? null, params.razorpayOrderId);

    if (updateResult.changes > 0 && orderBeforeUpdate.status === "cancelled") {
      await reserveStockAgainForRecoveredOrder(orderBeforeUpdate.id);
    }

    return updateResult;
  })();

  const order = await db
    .prepare("SELECT id, status FROM orders WHERE razorpay_order_id = ?")
    .get(params.razorpayOrderId) as { id: number; status: string } | undefined;

  if (result.changes > 0 && order) {
    await sendOrderPaidEmail(order.id);
  }

  return {
    changed: result.changes > 0,
    orderId: order?.id,
    alreadyPaid: order ? PAID_ORDER_STATUSES.has(order.status) : false,
    status: order?.status,
  };
}

export async function reconcileOrderWithRazorpay(params: {
  razorpayOrderId: string;
  expectedAmount: number;
}) {
  const razorpay = getRazorpay();
  const [order, paymentsResponse] = await Promise.all([
    razorpay.orders.fetch(params.razorpayOrderId) as Promise<RazorpayOrderEntity>,
    razorpay.orders.fetchPayments(params.razorpayOrderId) as Promise<RazorpayOrderPayments>,
  ]);

  if (order.id !== params.razorpayOrderId) {
    throw new Error("Razorpay order could not be verified.");
  }

  assertOrderAmount(order, params.expectedAmount);

  const payments = paymentsResponse.items ?? [];
  const capturedPayment = payments.find((payment) =>
    payment.order_id === params.razorpayOrderId && isPaymentCaptured(payment, params.expectedAmount),
  );
  const authorizedPayment = payments.find((payment) =>
    payment.order_id === params.razorpayOrderId && isPaymentAuthorized(payment, params.expectedAmount),
  );
  const failedPayment = payments.find((payment) =>
    payment.order_id === params.razorpayOrderId && payment.status === "failed",
  );

  let capturedAfterSync: RazorpayPaymentEntity | undefined;
  if (!capturedPayment && authorizedPayment?.id) {
    try {
      capturedAfterSync = await razorpay.payments.capture(
        authorizedPayment.id,
        params.expectedAmount,
        "INR",
      ) as RazorpayPaymentEntity;
    } catch (err) {
      console.error(`[Payments] Could not capture authorized Razorpay payment ${authorizedPayment.id}:`, err);
    }
  }

  const paidPayment = capturedPayment ??
    (isPaymentCaptured(capturedAfterSync, params.expectedAmount) ? capturedAfterSync : undefined);

  if (paidPayment || isOrderPaid(order, params.expectedAmount)) {
    const paymentId = paidPayment?.id ?? payments.find((payment) => payment.order_id === params.razorpayOrderId)?.id ?? null;
    const paid = await markOrderPaidFromRazorpay({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: paymentId,
      expectedAmount: params.expectedAmount,
    });

    return {
      paid: true,
      order,
      payment: paidPayment,
      paymentId,
      localOrderId: paid.orderId,
    };
  }

  if (failedPayment) {
    await recordOrderPaymentFailure(params.razorpayOrderId, failureInfoFromPayment(failedPayment));
  }

  return {
    paid: false,
    order,
    payment: failedPayment,
    paymentId: failedPayment?.id ?? null,
    localOrderId: undefined,
  };
}

export async function findRazorpayOrderByReceipt(receipt: string, expectedAmount: number) {
  const razorpay = getRazorpay();
  const response = await razorpay.orders.all({
    receipt,
    count: 10,
  }) as RazorpayOrdersList;

  return (response.items ?? []).find((order) =>
    order.id &&
    order.receipt === receipt &&
    asAmount(order.amount) === expectedAmount &&
    order.currency === "INR"
  );
}

export type PendingPaymentSyncSummary = {
  checked: number;
  paid: number;
  failed: number;
  stillPending: number;
  errors: number;
  skipped: number;
  paidOrderIds: number[];
  failedOrderIds: number[];
  pendingOrderIds: number[];
  skippedOrderIds: number[];
  errorOrderIds: number[];
};

type PendingPaymentOrder = {
  id: number;
  status: string;
  total_paise: number;
  razorpay_order_id: string | null;
};

export async function reconcilePendingRazorpayOrders(options: {
  limit?: number;
  includeRecentlyCancelled?: boolean;
} = {}): Promise<PendingPaymentSyncSummary> {
  const summary: PendingPaymentSyncSummary = {
    checked: 0,
    paid: 0,
    failed: 0,
    stillPending: 0,
    errors: 0,
    skipped: 0,
    paidOrderIds: [],
    failedOrderIds: [],
    pendingOrderIds: [],
    skippedOrderIds: [],
    errorOrderIds: [],
  };

  if (!razorpayEnabled()) return summary;

  const limit = Math.min(200, Math.max(1, options.limit ?? Number(process.env.RAZORPAY_SYNC_BATCH_SIZE ?? 50)));
  const includeRecentlyCancelled = options.includeRecentlyCancelled ?? true;
  const pendingOrders = await db
    .prepare(
      `SELECT id, total_paise, razorpay_order_id
       FROM orders
       WHERE (
          status = 'pending'
          OR (
            ? = 1
            AND status = 'cancelled'
            AND created_at >= datetime('now', '-7 days')
          )
       )
         AND razorpay_order_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(includeRecentlyCancelled ? 1 : 0, limit) as PendingPaymentOrder[];

  for (const order of pendingOrders) {
    if (!order.razorpay_order_id) {
      summary.skipped += 1;
      summary.skippedOrderIds.push(order.id);
      continue;
    }

    summary.checked += 1;
    try {
      const result = await reconcileOrderWithRazorpay({
        razorpayOrderId: order.razorpay_order_id,
        expectedAmount: order.total_paise,
      });

      if (result.paid) {
        summary.paid += 1;
        summary.paidOrderIds.push(order.id);
      } else if (result.payment?.status === "failed") {
        summary.failed += 1;
        summary.failedOrderIds.push(order.id);
      } else {
        summary.stillPending += 1;
        summary.pendingOrderIds.push(order.id);
      }
    } catch (err) {
      summary.errors += 1;
      summary.errorOrderIds.push(order.id);
      console.error(`[Payments] Razorpay sync failed for local order #${order.id}:`, err);
    }
  }

  return summary;
}

export function startRazorpayPaymentSyncJob() {
  if (!razorpayEnabled()) return null;
  if (paymentSyncTimer) return paymentSyncTimer;

  const intervalMs = Math.max(15_000, Number(process.env.RAZORPAY_SYNC_INTERVAL_MS ?? 60_000));
  const runSync = async (reason: "startup" | "interval") => {
    if (paymentSyncRunning) return;
    paymentSyncRunning = true;
    try {
      const summary = await reconcilePendingRazorpayOrders();
      if (summary.checked > 0 || summary.errors > 0) {
        console.log(
          `[Payments] Razorpay ${reason} sync: checked=${summary.checked}, paid=${summary.paid}, failed=${summary.failed}, pending=${summary.stillPending}, errors=${summary.errors}`,
        );
      }
    } catch (err) {
      console.error("[Payments] Razorpay payment sync job failed:", err);
    } finally {
      paymentSyncRunning = false;
    }
  };

  void runSync("startup");
  paymentSyncTimer = setInterval(() => {
    void runSync("interval");
  }, intervalMs);
  paymentSyncTimer.unref();

  return paymentSyncTimer;
}

function compactFailureReason(info: PaymentFailureInfo) {
  const parts = [
    info.description,
    info.reason,
    info.step,
    info.source,
    info.paymentId ? `payment:${info.paymentId}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ").slice(0, 1000) : null;
}

export async function recordOrderPaymentFailure(
  razorpayOrderId: string,
  info: PaymentFailureInfo,
) {
  const code = info.code ? info.code.slice(0, 120) : null;
  const reason = compactFailureReason(info);

  const result = await db.prepare(`
    UPDATE orders
    SET payment_failure_code = ?,
        payment_failure_reason = ?
    WHERE razorpay_order_id = ?
      AND status IN ('pending', 'cancelled')
  `).run(code, reason, razorpayOrderId);

  return { changed: result.changes > 0 };
}

export function failureInfoFromPayment(payment: RazorpayPaymentEntity): PaymentFailureInfo {
  return {
    paymentId: payment.id ?? null,
    code: payment.error_code ?? null,
    description: payment.error_description ?? null,
    reason: payment.error_reason ?? null,
    source: payment.error_source ?? null,
    step: payment.error_step ?? null,
  };
}
