import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/customers", async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  let where = "WHERE u.role = 'user'";
  const params: any[] = [];

  if (search) {
    where += " AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM users u ${where}`
  ).get(...params) as { total: number };

  const customers = await db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.created_at,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
      (SELECT COALESCE(SUM(total_paise), 0) FROM orders WHERE user_id = u.id AND status IN ('paid','shipped','delivered')) as total_spent
    FROM users u
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    customers,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
});

router.get("/customers/:id", async (req, res) => {
  const customer = await db.prepare(`
    SELECT id, name, email, phone, created_at FROM users WHERE id = ? AND role = 'user'
  `).get(req.params.id);

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const orders = await db.prepare(`
    SELECT id, status, total_paise, created_at, razorpay_payment_id,
           shipping_name, shipping_phone, shipping_address, shipping_city,
           shipping_state, shipping_pincode, tracking_number
    FROM orders WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  const addresses = await db.prepare(`
    SELECT * FROM customer_addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, updated_at DESC, id DESC
  `).all(req.params.id);

  res.json({ customer, orders, addresses });
});

export default router;
