import { db } from "../db.js";

export type CheckoutAddressInput = {
  name: string;
  email: string;
  phone: string;
  houseNumber: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  alternatePhone?: string;
  companyName?: string;
};

export function formatAddress(address: CheckoutAddressInput) {
  return [
    address.companyName,
    address.houseNumber,
    address.street,
    address.area,
    address.landmark ? `Landmark: ${address.landmark}` : "",
    address.city,
    address.state,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export async function saveCustomerAddress(
  userId: number,
  address: CheckoutAddressInput,
  opts: { existingAddressId?: number; setDefault?: boolean; updateExisting?: boolean } = {},
): Promise<number> {
  const count = await db
    .prepare("SELECT COUNT(*) as c FROM customer_addresses WHERE user_id = ?")
    .get(userId) as { c: number };
  const shouldDefault = opts.setDefault || count.c === 0;
  const shouldUpdate = Boolean(opts.updateExisting && opts.existingAddressId);

  return db.transaction(async () => {
    if (shouldDefault) {
      await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?").run(userId);
    }

    if (shouldUpdate && opts.existingAddressId) {
      const existing = await db
        .prepare("SELECT id FROM customer_addresses WHERE id = ? AND user_id = ?")
        .get(opts.existingAddressId, userId) as { id: number } | undefined;

      if (existing) {
        await db.prepare(`
          UPDATE customer_addresses
          SET full_name = ?, mobile = ?, email = ?, house_number = ?, street = ?,
              area = ?, city = ?, state = ?, pincode = ?, landmark = ?,
              alternate_mobile = ?, company_name = ?, is_default = ?,
              updated_at = datetime('now')
          WHERE id = ? AND user_id = ?
        `).run(
          address.name,
          address.phone,
          address.email,
          address.houseNumber,
          address.street,
          address.area,
          address.city,
          address.state,
          address.pincode,
          address.landmark || null,
          address.alternatePhone || null,
          address.companyName || null,
          shouldDefault ? 1 : 0,
          opts.existingAddressId,
          userId,
        );
        return opts.existingAddressId;
      }
    }

    const duplicate = await db.prepare(`
      SELECT id FROM customer_addresses 
      WHERE user_id = ? AND full_name = ? AND mobile = ? AND email = ? 
      AND house_number = ? AND street = ? AND area = ? AND city = ? 
      AND state = ? AND pincode = ?
    `).get(
      userId, address.name, address.phone, address.email,
      address.houseNumber, address.street, address.area, address.city,
      address.state, address.pincode
    ) as { id: number } | undefined;

    if (duplicate) {
      if (shouldDefault) {
        await db.prepare("UPDATE customer_addresses SET is_default = 1, updated_at = datetime('now') WHERE id = ?").run(duplicate.id);
      }
      return duplicate.id;
    }

    const result = await db.prepare(`
      INSERT INTO customer_addresses (
        user_id, full_name, mobile, email, house_number, street, area, city,
        state, pincode, landmark, alternate_mobile, company_name, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      address.name,
      address.phone,
      address.email,
      address.houseNumber,
      address.street,
      address.area,
      address.city,
      address.state,
      address.pincode,
      address.landmark || null,
      address.alternatePhone || null,
      address.companyName || null,
      shouldDefault ? 1 : 0,
    );

    return Number(result.lastInsertRowid);
  })();
}
