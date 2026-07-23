import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db.js";

export async function ensureUserFromShipping(input: {
  name: string;
  email: string;
  phone: string;
}): Promise<{ id: number; email: string; name: string; isNew: boolean }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone.trim();

  const existingByEmail = await db
    .prepare("SELECT id, email, name FROM users WHERE lower(email) = ?")
    .get(email) as { id: number; email: string; name: string } | undefined;

  if (existingByEmail) {
    await db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(
      name,
      phone,
      existingByEmail.id,
    );
    return { id: existingByEmail.id, email: existingByEmail.email, name, isNew: false };
  }

  const password_hash = bcrypt.hashSync(
    crypto.randomBytes(24).toString("hex"),
    10,
  );
  const result = await db
    .prepare(
      "INSERT INTO users (email, name, password_hash, phone) VALUES (?, ?, ?, ?)",
    )
    .run(email, name, password_hash, phone);

  return {
    id: Number(result.lastInsertRowid),
    email,
    name,
    isNew: true,
  };
}
