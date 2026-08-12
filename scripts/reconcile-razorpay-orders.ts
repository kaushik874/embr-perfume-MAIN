import "dotenv/config";
import { db, initDb, pool } from "../server/db.js";
import {
  findRazorpayOrderByReceipt,
  razorpayEnabled,
  reconcileOrderWithRazorpay,
} from "../server/lib/payments.js";

type PendingOrder = {
  id: number;
  status: string;
  total_paise: number;
  razorpay_order_id: string | null;
  shipping_name: string | null;
  shipping_email: string | null;
  shipping_phone: string | null;
  created_at: string;
};

type ReportRow = {
  orderId: number;
  customer: string;
  amount: string;
  razorpayOrderId: string | null;
  previousStatus: string;
  createdAt: string;
  status: string;
};

function money(paise: number) {
  return `Rs ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function maskEmail(email: string | null) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string | null) {
  if (!phone) return "";
  return phone.replace(/\d(?=\d{4})/g, "*");
}

function customer(order: PendingOrder) {
  return [
    order.shipping_name,
    maskEmail(order.shipping_email),
    maskPhone(order.shipping_phone),
  ].filter(Boolean).join(" | ");
}

function describeError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const data = err as {
      error?: { description?: string; reason?: string; code?: string };
      description?: string;
      reason?: string;
      statusCode?: number;
    };
    return [
      data.error?.description ?? data.description,
      data.error?.reason ?? data.reason,
      data.error?.code,
      data.statusCode ? `status:${data.statusCode}` : null,
    ].filter(Boolean).join(" | ") || "Could not check Razorpay";
  }
  return "Could not check Razorpay";
}

function printRows(title: string, rows: ReportRow[]) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `#${row.orderId} | ${row.previousStatus} | ${row.createdAt} | ${row.customer || "Unknown customer"} | ${row.amount} | ${row.status} | ${row.razorpayOrderId ?? "no Razorpay order"}`,
    );
  }
}

async function main() {
  await initDb({ seedDefaults: false });

  const pendingOrders = await db
    .prepare(
      `SELECT id, status, total_paise, razorpay_order_id,
              shipping_name, shipping_email, shipping_phone, created_at
       FROM orders
       WHERE status IN ('pending', 'cancelled')
       ORDER BY created_at ASC`,
    )
    .all() as PendingOrder[];

  const paid: ReportRow[] = [];
  const failed: ReportRow[] = [];
  const stillPending: ReportRow[] = [];
  const noGatewayOrder: ReportRow[] = [];
  const errors: ReportRow[] = [];

  console.log(`Pending/cancelled orders found: ${pendingOrders.length}`);

  if (!razorpayEnabled()) {
    console.log("Razorpay keys are not configured, so gateway reconciliation cannot run.");
    return;
  }

  for (const order of pendingOrders) {
    const base = {
      orderId: order.id,
      customer: customer(order),
      amount: money(order.total_paise),
      razorpayOrderId: order.razorpay_order_id,
      previousStatus: order.status,
      createdAt: order.created_at,
    };

    let razorpayOrderId = order.razorpay_order_id;
    if (!razorpayOrderId) {
      try {
        const gatewayOrder = await findRazorpayOrderByReceipt(`embr_${order.id}`, order.total_paise);
        razorpayOrderId = gatewayOrder?.id ?? null;
        if (razorpayOrderId) {
          await db
            .prepare("UPDATE orders SET razorpay_order_id = ? WHERE id = ? AND razorpay_order_id IS NULL")
            .run(razorpayOrderId, order.id);
        }
      } catch (err) {
        errors.push({
          ...base,
          status: describeError(err),
        });
        continue;
      }
    }

    if (!razorpayOrderId) {
      noGatewayOrder.push({ ...base, status: "No matching Razorpay order found by saved id or receipt" });
      continue;
    }

    try {
      const result = await reconcileOrderWithRazorpay({
        razorpayOrderId,
        expectedAmount: order.total_paise,
      });

      if (result.paid) {
        paid.push({
          ...base,
          razorpayOrderId,
          status: `Updated to paid (${result.paymentId ?? "confirmed"})`,
        });
      } else if (result.payment?.status === "failed") {
        failed.push({
          ...base,
          razorpayOrderId,
          status: `Payment failed (${result.paymentId ?? "no payment id"})`,
        });
      } else {
        stillPending.push({
          ...base,
          razorpayOrderId,
          status: `Not paid yet (Razorpay order: ${result.order.status ?? "unknown"})`,
        });
      }
    } catch (err) {
      errors.push({
        ...base,
        razorpayOrderId,
        status: describeError(err),
      });
    }
  }

  printRows("Updated paid orders", paid);
  printRows("Failed payment attempts", failed);
  printRows("Still not paid", stillPending);
  printRows("No matching Razorpay order", noGatewayOrder);
  printRows("Could not verify", errors);
}

main()
  .catch((err) => {
    console.error("Reconcile failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
