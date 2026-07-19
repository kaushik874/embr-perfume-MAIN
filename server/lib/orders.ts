import { db } from "../db.js";
import { formatAddress, type CheckoutAddressInput } from "./addresses.js";

export type LineItemInput = { productId?: number; slug?: string; quantity: number };

export async function buildOrderLines(items: LineItemInput[]) {
  const getById = db.prepare(
    "SELECT id, name, price, stock FROM products WHERE id = ?",
  );
  const getBySlug = db.prepare(
    "SELECT id, name, price, stock FROM products WHERE slug = ?",
  );

  let totalPaise = 0;
  const lineItems: {
    productId: number;
    quantity: number;
    pricePaise: number;
    name: string;
  }[] = [];

  for (const item of items) {
    let product: { id: number; name: string; price: number; stock: number } | undefined;

    if (item.productId) {
      product = await getById.get(item.productId) as typeof product;
    } else if (item.slug) {
      product = await getBySlug.get(item.slug) as typeof product;
    }

    if (!product) {
      const ref = item.slug ?? item.productId;
      throw new Error(`Product ${ref} not found`);
    }

    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name} (only ${product.stock} left)`);
    }

    const pricePaise = product.price * 100;
    totalPaise += pricePaise * item.quantity;
    lineItems.push({
      productId: product.id,
      quantity: item.quantity,
      pricePaise,
      name: product.name,
    });
  }

  return { totalPaise, lineItems };
}

export async function createOrderRecord(
  userId: number,
  totalPaise: number,
  lineItems: {
    productId: number;
    quantity: number;
    pricePaise: number;
  }[],
  shipping?: CheckoutAddressInput & { addressId?: number },
) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      user_id, status, total_paise,
      shipping_name, shipping_email, shipping_phone,
      shipping_address, shipping_city, shipping_pincode,
      shipping_state, shipping_house_number, shipping_street, shipping_area,
      shipping_landmark, shipping_alternate_phone, shipping_company_name,
      shipping_address_id
    )
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, price_paise)
    VALUES (?, ?, ?, ?)
  `);

  const decrementStock = db.prepare(
    "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?"
  );

  return db.transaction(async () => {
    const result = await insertOrder.run(
      userId,
      totalPaise,
      shipping?.name ?? null,
      shipping?.email ?? null,
      shipping?.phone ?? null,
      shipping ? formatAddress(shipping) : null,
      shipping?.city ?? null,
      shipping?.pincode ?? null,
      shipping?.state ?? null,
      shipping?.houseNumber ?? null,
      shipping?.street ?? null,
      shipping?.area ?? null,
      shipping?.landmark ?? null,
      shipping?.alternatePhone ?? null,
      shipping?.companyName ?? null,
      shipping?.addressId ?? null,
    );
    const orderId = Number(result.lastInsertRowid);

    for (const line of lineItems) {
      await insertItem.run(
        orderId,
        line.productId,
        line.quantity,
        line.pricePaise,
      );
      await decrementStock.run(line.quantity, line.productId);
    }

    return orderId;
  })();
}

export function startOrderExpiryJob() {
  const intervalMs = 15 * 60 * 1000; // Check every 15 minutes
  const expiryMinutes = 30; // Expire after 30 minutes

  const timer = setInterval(async () => {
    try {
      const expiredOrders = await db.prepare(`
        SELECT id FROM orders 
        WHERE status = 'pending' 
        AND created_at < datetime('now', '-${expiryMinutes} minutes')
      `).all() as { id: number }[];

      if (expiredOrders.length === 0) return;

      const restoreStock = db.prepare(
        "UPDATE products SET stock = stock + ? WHERE id = ?"
      );
      const getItems = db.prepare(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
      );
      const cancelOrder = db.prepare(
        "UPDATE orders SET status = 'cancelled' WHERE id = ?"
      );

      await db.transaction(async () => {
        for (const order of expiredOrders) {
          const items = await getItems.all(order.id) as { product_id: number; quantity: number }[];
          for (const item of items) {
            await restoreStock.run(item.quantity, item.product_id);
          }
          await cancelOrder.run(order.id);
        }
      })();
      console.log(`[Orders] Cancelled ${expiredOrders.length} expired pending orders and restored stock.`);
    } catch (err) {
      console.error("[Orders] Failed to run expiry job:", err);
    }
  }, intervalMs);

  timer.unref();
}
