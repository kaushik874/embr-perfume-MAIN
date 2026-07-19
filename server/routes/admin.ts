import { Router } from "express";
import { db } from "../db.js";
import { z } from "zod";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  const totalOrders = ((await db.prepare("SELECT COUNT(*) as count FROM orders").get()) as any).count;
  const pendingOrders = ((await db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get()) as any).count;
  const paidOrders = ((await db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'paid'").get()) as any).count;
  
  const totalRevenuePaise = ((await db.prepare("SELECT SUM(total_paise) as sum FROM orders WHERE status = 'paid'").get()) as any).sum || 0;

  const recentOrders = await db.prepare(`
    SELECT o.id, o.status, o.total_paise, o.created_at, u.name as customer_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
    LIMIT 5
  `).all();

  const recentUsers = await db.prepare(`
    SELECT id, name, email, created_at, role
    FROM users
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  res.json({
    totalOrders,
    pendingOrders,
    paidOrders,
    totalRevenue: totalRevenuePaise / 100, // Returning as Rupees for UI
    recentOrders,
    recentUsers
  });
});

router.get("/orders", async (_req, res) => {
  const orders = await db.prepare(`
    SELECT o.id, o.status, o.total_paise, o.created_at, o.razorpay_order_id, o.razorpay_payment_id,
           o.shipping_name, o.shipping_email, o.shipping_phone,
           u.email as account_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();
  res.json({ orders });
});

router.get("/orders/:id", async (req, res) => {
  const orderId = req.params.id;
  const order = await db.prepare(`
    SELECT o.*, u.email as account_email, u.name as account_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db.prepare(`
    SELECT oi.quantity, oi.price_paise, p.name, p.slug
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderId);

  res.json({ order, items });
});

const statusSchema = z.object({
  status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"])
});

router.patch("/orders/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(parsed.data.status, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({ ok: true });
});

router.get("/users", async (_req, res) => {
  const users = await db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
           COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});

router.get("/products", async (_req, res) => {
  const products = await db.prepare("SELECT * FROM products ORDER BY id DESC").all();
  res.json({ products });
});

const productSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  notes: z.string(),
  description: z.string().optional(),
  price: z.number().int().positive(),
  mrp: z.number().int().positive(),
  discount_price: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  sku: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["draft", "published"]).default("published"),
  tags: z.string().optional(),
  image: z.string().optional(),
  featured: z.number().int().min(0).max(1).default(0)
});

router.post("/products", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const result = await db.prepare(`
      INSERT INTO products (slug, name, notes, description, price, mrp, discount_price, stock, sku, category, status, tags, image, featured)
      VALUES (@slug, @name, @notes, @description, @price, @mrp, @discount_price, @stock, @sku, @category, @status, @tags, @image, @featured)
    `).run(parsed.data);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/products/:id", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await db.prepare(`
    UPDATE products SET
      slug = @slug, name = @name, notes = @notes, description = @description,
      price = @price, mrp = @mrp, image = @image, featured = @featured
    WHERE id = @id
  `).run({ ...parsed.data, id: req.params.id });

  if (result.changes === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/products/:id", async (req, res) => {
  // Simple delete (in real app, consider soft delete or check if order_items depend on it)
  try {
    const result = await db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: "Cannot delete product, it may be linked to an order." });
  }
});

export default router;
