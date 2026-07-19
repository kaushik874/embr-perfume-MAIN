import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = await db
    .prepare("SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?")
    .get(req.user!.userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

const addressSchema = z.object({
  full_name: z.string().min(2).max(80),
  mobile: z.string().min(10).max(15).regex(/^[0-9+\-\s]+$/),
  email: z.string().email(),
  house_number: z.string().min(1).max(80),
  street: z.string().min(2).max(120),
  area: z.string().min(2).max(120),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  landmark: z.string().max(120).optional(),
  alternate_mobile: z.string().max(15).optional(),
  company_name: z.string().max(120).optional(),
  is_default: z.boolean().optional(),
});

router.get("/addresses", requireAuth, async (req, res) => {
  const addresses = await db
    .prepare(
      `SELECT * FROM customer_addresses
       WHERE user_id = ?
       ORDER BY id DESC`,
    )
    .all(req.user!.userId);

  res.json({ addresses });
});

router.post("/addresses", requireAuth, async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const count = await db
    .prepare("SELECT COUNT(*) as c FROM customer_addresses WHERE user_id = ?")
    .get(req.user!.userId) as { c: number };
  const isDefault = data.is_default || count.c === 0;

  const id = await db.transaction(async () => {
    if (isDefault) {
      await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?").run(req.user!.userId);
    }
    const result = await db.prepare(`
      INSERT INTO customer_addresses (
        user_id, full_name, mobile, email, house_number, street, area, city,
        state, pincode, landmark, alternate_mobile, company_name, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.userId,
      data.full_name,
      data.mobile,
      data.email,
      data.house_number,
      data.street,
      data.area,
      data.city,
      data.state,
      data.pincode,
      data.landmark || null,
      data.alternate_mobile || null,
      data.company_name || null,
      isDefault ? 1 : 0,
    );
    return Number(result.lastInsertRowid);
  })();

  res.status(201).json({ id });
});

router.patch("/addresses/:id", requireAuth, async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const addressId = Number(req.params.id);
  const isDefault = Boolean(data.is_default);

  const changes = await db.transaction(async () => {
    if (isDefault) {
      await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?").run(req.user!.userId);
    }
    const result = await db.prepare(`
      UPDATE customer_addresses
      SET full_name = ?, mobile = ?, email = ?, house_number = ?, street = ?,
          area = ?, city = ?, state = ?, pincode = ?, landmark = ?,
          alternate_mobile = ?, company_name = ?, is_default = ?,
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      data.full_name,
      data.mobile,
      data.email,
      data.house_number,
      data.street,
      data.area,
      data.city,
      data.state,
      data.pincode,
      data.landmark || null,
      data.alternate_mobile || null,
      data.company_name || null,
      isDefault ? 1 : 0,
      addressId,
      req.user!.userId,
    );
    return result.changes;
  })();

  if (!changes) {
    res.status(404).json({ error: "Address not found" });
    return;
  }

  res.json({ ok: true });
});

router.post("/addresses/:id/default", requireAuth, async (req, res) => {
  const addressId = Number(req.params.id);
  const existing = await db
    .prepare("SELECT id FROM customer_addresses WHERE id = ? AND user_id = ?")
    .get(addressId, req.user!.userId);

  if (!existing) {
    res.status(404).json({ error: "Address not found" });
    return;
  }

  await db.transaction(async () => {
    await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?").run(req.user!.userId);
    await db.prepare("UPDATE customer_addresses SET is_default = 1, updated_at = datetime('now') WHERE id = ?").run(addressId);
  })();

  res.json({ ok: true });
});

router.delete("/addresses/:id", requireAuth, async (req, res) => {
  const result = await db
    .prepare("DELETE FROM customer_addresses WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user!.userId);

  if (!result.changes) {
    res.status(404).json({ error: "Address not found" });
    return;
  }

  const defaultExists = await db
    .prepare("SELECT id FROM customer_addresses WHERE user_id = ? AND is_default = 1")
    .get(req.user!.userId);

  if (!defaultExists) {
    const next = await db
      .prepare("SELECT id FROM customer_addresses WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1")
      .get(req.user!.userId) as { id: number } | undefined;
    if (next) {
      await db.prepare("UPDATE customer_addresses SET is_default = 1 WHERE id = ?").run(next.id);
    }
  }

  res.json({ ok: true });
});

export default router;
