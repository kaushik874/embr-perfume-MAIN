import { db } from "../db.js";
import { formatAddress, type CheckoutAddressInput } from "./addresses.js";
import { razorpayEnabled, reconcilePendingRazorpayOrders } from "./payments.js";
import { releaseCouponUsage } from "./pricing.js";

export type LineItemInput = { productId?: number; slug?: string; variantId?: number; quantity: number };

export async function buildOrderLines(items: LineItemInput[]) {
  const getById = db.prepare(
    "SELECT id, name, price, stock FROM products WHERE id = ?",
  );
  const getBySlug = db.prepare(
    "SELECT id, name, price, stock FROM products WHERE slug = ?",
  );
  const getVariantById = db.prepare(
    "SELECT id, product_id, name, price, stock, is_active FROM product_variants WHERE id = ?",
  );

  let totalPaise = 0;
  const lineItems: {
    productId: number;
    variantId?: number;
    variantName?: string;
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

    let pricePaise = product.price * 100;
    let variantId: number | undefined;
    let variantName: string | undefined;

    if (item.variantId) {
      const variant = await getVariantById.get(item.variantId) as {
        id: number;
        product_id: number;
        name: string;
        price: number;
        stock: number;
        is_active: number;
      } | undefined;

      if (!variant) {
        throw new Error(`Variant not found for ${product.name}`);
      }
      if (variant.product_id !== product.id) {
        throw new Error(`Variant does not belong to ${product.name}`);
      }
      if (variant.is_active !== 1) {
        throw new Error(`Variant ${variant.name} is currently unavailable`);
      }
      if (variant.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name} (${variant.name}) (only ${variant.stock} left)`
        );
      }

      pricePaise = variant.price * 100;
      variantId = variant.id;
      variantName = variant.name;
    } else {
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (only ${product.stock} left)`);
      }
    }

    totalPaise += pricePaise * item.quantity;
    lineItems.push({
      productId: product.id,
      variantId,
      variantName,
      quantity: item.quantity,
      pricePaise,
      name: product.name,
    });
  }

  return { totalPaise, lineItems };
}

export type PricingBreakdown = {
  subtotalPaise?: number;
  shippingPaise?: number;
  couponCode?: string | null;
  couponDiscountType?: string | null;
  couponDiscountValue?: number | null;
  couponDiscountPaise?: number;
};

export async function createOrderRecord(
  userId: number,
  totalPaise: number,
  lineItems: {
    productId: number;
    variantId?: number;
    variantName?: string;
    quantity: number;
    pricePaise: number;
  }[],
  shipping?: CheckoutAddressInput & { addressId?: number },
  checkoutSessionId?: string,
  pricing?: PricingBreakdown,
) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      user_id, status, total_paise, checkout_session_id,
      shipping_name, shipping_email, shipping_phone,
      shipping_address, shipping_city, shipping_pincode,
      shipping_state, shipping_house_number, shipping_street, shipping_area,
      shipping_landmark, shipping_alternate_phone, shipping_company_name,
      shipping_address_id,
      subtotal_paise, shipping_paise, coupon_code, coupon_discount_type,
      coupon_discount_value, coupon_discount_paise
    )
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, variant_name, quantity, price_paise)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const decrementProductStock = db.prepare(
    "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?"
  );

  const decrementVariantStock = db.prepare(
    "UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?"
  );

  return db.transaction(async () => {
    const result = await insertOrder.run(
      userId,
      totalPaise,
      checkoutSessionId ?? null,
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
      pricing?.subtotalPaise ?? null,
      pricing?.shippingPaise ?? null,
      pricing?.couponCode ?? null,
      pricing?.couponDiscountType ?? null,
      pricing?.couponDiscountValue ?? null,
      pricing?.couponDiscountPaise ?? null,
    );
    const orderId = Number(result.lastInsertRowid);

    for (const line of lineItems) {
      await insertItem.run(
        orderId,
        line.productId,
        line.variantId ?? null,
        line.variantName ?? null,
        line.quantity,
        line.pricePaise,
      );
      if (line.variantId) {
        await decrementVariantStock.run(line.quantity, line.variantId);
      } else {
        await decrementProductStock.run(line.quantity, line.productId);
      }
    }

    return orderId;
  })();
}

export function startOrderExpiryJob() {
  const intervalMs = 15 * 60 * 1000; // Check every 15 minutes
  const expiryMinutes = Math.max(60, Number(process.env.PENDING_ORDER_EXPIRY_MINUTES ?? 24 * 60));

  const timer = setInterval(async () => {
    try {
      if (razorpayEnabled()) {
        await reconcilePendingRazorpayOrders({ limit: 100 });
      }

      const expiredOrders = await db.prepare(`
        SELECT id FROM orders 
        WHERE status = 'pending' 
        AND created_at < datetime('now', '-${expiryMinutes} minutes')
      `).all() as { id: number }[];

      if (expiredOrders.length === 0) return;

      const restoreProductStock = db.prepare(
        "UPDATE products SET stock = stock + ? WHERE id = ?"
      );
      const restoreVariantStock = db.prepare(
        "UPDATE product_variants SET stock = stock + ? WHERE id = ?"
      );
      const getItems = db.prepare(
        "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?"
      );
      const cancelOrder = db.prepare(
        "UPDATE orders SET status = 'cancelled' WHERE id = ?"
      );

      await db.transaction(async () => {
        for (const order of expiredOrders) {
          const items = await getItems.all(order.id) as { product_id: number; variant_id: number | null; quantity: number }[];
          for (const item of items) {
            if (item.variant_id) {
              await restoreVariantStock.run(item.quantity, item.variant_id);
            } else {
              await restoreProductStock.run(item.quantity, item.product_id);
            }
          }
          await cancelOrder.run(order.id);
          await releaseCouponUsage(order.id);
        }
      })();
      console.log(`[Orders] Cancelled ${expiredOrders.length} expired pending orders and restored stock.`);
    } catch (err) {
      console.error("[Orders] Failed to run expiry job:", err);
    }
  }, intervalMs);

  timer.unref();
}
