import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { logAdminAction } from "../middleware/security.js";

const router = Router();

router.get("/orders", async (req, res) => {
  const status = (req.query.status as string) || "";
  const search = (req.query.search as string) || "";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (status) {
    where += " AND o.status = ?";
    params.push(status);
  }
  if (search) {
    where += " AND (CAST(o.id AS TEXT) LIKE ? OR o.shipping_name LIKE ? OR o.shipping_email LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM orders o ${where}`
  ).get(...params) as { total: number };

  const orders = await db.prepare(`
    SELECT o.*, u.email as account_email, u.name as account_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    orders,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
});

router.get("/orders/stats", async (_req, res) => {
  const total = ((await db.prepare("SELECT COUNT(*) as c FROM orders").get()) as any).c;
  const pending = ((await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get()) as any).c;
  const paid = ((await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'paid'").get()) as any).c;
  const shipped = ((await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'shipped'").get()) as any).c;
  const delivered = ((await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get()) as any).c;
  const cancelled = ((await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get()) as any).c;
  const revenue = ((await db.prepare("SELECT COALESCE(SUM(total_paise), 0) as s FROM orders WHERE status IN ('paid','shipped','delivered')").get()) as any).s;

  res.json({ total, pending, paid, shipped, delivered, cancelled, revenue: revenue / 100 });
});

const bulkIdsSchema = z.object({
  ids: z.array(z.number()),
});

const bulkStatusSchema = z.object({
  ids: z.array(z.number()),
  status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]),
});

router.patch("/orders/bulk/status", async (req, res) => {
  const parsed = bulkStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { ids, status } = parsed.data;
  if (ids.length === 0) {
    res.json({ ok: true, count: 0 });
    return;
  }

  const placeholders = ids.map(() => "?").join(",");
  const params = [status, ...ids];

  if (status === "paid") {
    await db.prepare(`UPDATE orders SET status = ?, paid_at = datetime('now') WHERE id IN (${placeholders})`).run(...params);
  } else {
    await db.prepare(`UPDATE orders SET status = ? WHERE id IN (${placeholders})`).run(...params);
  }

  logAdminAction(req.user!.userId, "bulk_update_order_status", `Updated status to ${status} for ${ids.length} orders`);

  res.json({ ok: true, count: ids.length });
});

router.post("/orders/bulk-delete", async (req, res) => {
  const parsed = bulkIdsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { ids } = parsed.data;
  if (ids.length === 0) {
    res.json({ ok: true, count: 0 });
    return;
  }

  try {
    const placeholders = ids.map(() => "?").join(",");
    await db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...ids);
    await db.prepare(`DELETE FROM reviews WHERE order_id IN (${placeholders})`).run(...ids);
    await db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...ids);

    logAdminAction(req.user!.userId, "bulk_delete_orders", `Deleted ${ids.length} orders`);

    res.json({ ok: true, count: ids.length });
  } catch (err: any) {
    console.error("Bulk delete error:", err);
    res.status(500).json({ error: err.message || "Failed to delete orders due to a database constraint." });
  }
});

router.get("/orders/:id", async (req, res) => {
  const order = await db.prepare(`
    SELECT o.*, u.email as account_email, u.name as account_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db.prepare(`
    SELECT oi.*, p.name, p.slug, p.image
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(req.params.id);

  res.json({ order, items });
});

const statusSchema = z.object({
  status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]),
});

router.patch("/orders/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updates: string[] = ["status = ?"];
  const params: any[] = [parsed.data.status];

  if (parsed.data.status === "paid") {
    updates.push("paid_at = datetime('now')");
  }

  params.push(req.params.id);
  const result = await db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  if (result.changes === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  logAdminAction(
    req.user!.userId,
    "update_order_status",
    `Updated order #${req.params.id} status to ${parsed.data.status}`,
  );

  res.json({ ok: true });
});

const trackingSchema = z.object({
  tracking_number: z.string().max(200),
});

router.patch("/orders/:id/tracking", async (req, res) => {
  const parsed = trackingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await db.prepare("UPDATE orders SET tracking_number = ? WHERE id = ?")
    .run(parsed.data.tracking_number, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  logAdminAction(
    req.user!.userId,
    "update_tracking",
    `Added tracking ${parsed.data.tracking_number} to order #${req.params.id}`,
  );

  res.json({ ok: true });
});

const shippingSchema = z.object({
  shipping_name: z.string().optional(),
  shipping_email: z.string().optional(),
  shipping_phone: z.string().optional(),
  shipping_address: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_pincode: z.string().optional(),
});

router.patch("/orders/:id/shipping", async (req, res) => {
  const parsed = shippingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const setClauses: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (setClauses.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  params.push(req.params.id);
  const result = await db.prepare(`UPDATE orders SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

  if (result.changes === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  logAdminAction(req.user!.userId, "update_shipping", `Updated shipping for order #${req.params.id}`);

  res.json({ ok: true });
});

router.delete("/orders/:id", async (req, res) => {
  try {
    const result = await db.prepare("DELETE FROM order_items WHERE order_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM reviews WHERE order_id = ?").run(req.params.id);
    
    if (result.changes === 0) {
      const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(req.params.id);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
    }

    const deleted = await db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
    if (deleted.changes === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    logAdminAction(req.user!.userId, "delete_order", `Deleted order #${req.params.id}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: err.message || "Failed to delete order due to a database constraint." });
  }
});

export default router;
