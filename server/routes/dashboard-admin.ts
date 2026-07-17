import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/dashboard", (_req, res) => {
  const totalProducts = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c;
  const publishedProducts = (db.prepare("SELECT COUNT(*) as c FROM products WHERE status = 'published'").get() as any).c;
  const draftProducts = (db.prepare("SELECT COUNT(*) as c FROM products WHERE status = 'draft'").get() as any).c;

  const totalOrders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
  const todayOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get() as any).c;
  const pendingOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get() as any).c;
  const paidOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'paid'").get() as any).c;
  const shippedOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'shipped'").get() as any).c;
  const deliveredOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get() as any).c;
  const cancelledOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get() as any).c;

  const totalRevenue = (db.prepare(
    "SELECT COALESCE(SUM(total_paise), 0) as s FROM orders WHERE status IN ('paid','shipped','delivered')"
  ).get() as any).s / 100;

  const monthlyRevenue = (db.prepare(
    "SELECT COALESCE(SUM(total_paise), 0) as s FROM orders WHERE status IN ('paid','shipped','delivered') AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
  ).get() as any).s / 100;

  const recentOrders = db.prepare(`
    SELECT o.id, o.status, o.total_paise, o.created_at, u.name as customer_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC LIMIT 10
  `).all();

  const lowStockProducts = db.prepare(`
    SELECT id, name, slug, stock, sku
    FROM products
    WHERE stock > 0 AND stock <= 5
    ORDER BY stock ASC LIMIT 10
  `).all();

  const outOfStockProducts = db.prepare(`
    SELECT COUNT(*) as c FROM products WHERE stock = 0
  `).get() as { c: number };

  const totalCustomers = (db.prepare(
    "SELECT COUNT(*) as c FROM users WHERE role = 'user'"
  ).get() as any).c;

  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.slug, p.image,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.price_paise) as total_revenue_paise
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status IN ('paid','shipped','delivered')
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 5
  `).all();

  res.json({
    totalProducts,
    publishedProducts,
    draftProducts,
    totalOrders,
    todayOrders,
    pendingOrders,
    paidOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue,
    monthlyRevenue,
    recentOrders,
    lowStockProducts,
    outOfStockCount: outOfStockProducts.c,
    totalCustomers,
    topProducts,
  });
});

export default router;
