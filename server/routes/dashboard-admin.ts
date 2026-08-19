import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  const [
    totalProductsRes, publishedProductsRes, draftProductsRes,
    totalOrdersRes, todayOrdersRes, pendingOrdersRes,
    paidOrdersRes, shippedOrdersRes, deliveredOrdersRes, cancelledOrdersRes,
    totalRevenueRes, monthlyRevenueRes, recentOrders,
    lowStockProducts, outOfStockProductsRes, totalCustomersRes, topProducts
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM products").get(),
    db.prepare("SELECT COUNT(*) as c FROM products WHERE status = 'published'").get(),
    db.prepare("SELECT COUNT(*) as c FROM products WHERE status = 'draft'").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'paid'").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'shipped'").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get(),
    db.prepare("SELECT COALESCE(SUM(total_paise), 0) as s FROM orders WHERE status IN ('paid','shipped','delivered')").get(),
    db.prepare("SELECT COALESCE(SUM(total_paise), 0) as s FROM orders WHERE status IN ('paid','shipped','delivered') AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").get(),
    db.prepare(`
      SELECT o.id, o.status, o.total_paise, o.created_at, u.name as customer_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 10
    `).all(),
    db.prepare(`
      SELECT id, name, slug, stock, sku
      FROM products
      WHERE stock > 0 AND stock <= 5
      ORDER BY stock ASC LIMIT 10
    `).all(),
    db.prepare("SELECT COUNT(*) as c FROM products WHERE stock = 0").get(),
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'user'").get(),
    db.prepare(`
      SELECT p.id, p.name, p.slug, p.image,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price_paise) as total_revenue_paise
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('paid','shipped','delivered')
      GROUP BY p.id, p.name, p.slug, p.image
      ORDER BY total_sold DESC
      LIMIT 5
    `).all()
  ]);

  const totalProducts = (totalProductsRes as any).c;
  const publishedProducts = (publishedProductsRes as any).c;
  const draftProducts = (draftProductsRes as any).c;
  const totalOrders = (totalOrdersRes as any).c;
  const todayOrders = (todayOrdersRes as any).c;
  const pendingOrders = (pendingOrdersRes as any).c;
  const paidOrders = (paidOrdersRes as any).c;
  const shippedOrders = (shippedOrdersRes as any).c;
  const deliveredOrders = (deliveredOrdersRes as any).c;
  const cancelledOrders = (cancelledOrdersRes as any).c;
  const totalRevenue = (totalRevenueRes as any).s / 100;
  const monthlyRevenue = (monthlyRevenueRes as any).s / 100;
  const outOfStockProducts = outOfStockProductsRes as { c: number };
  const totalCustomers = (totalCustomersRes as any).c;

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
