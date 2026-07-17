import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db.js";

export function ensureUserFromShipping(input: {
  name: string;
  email: string;
  phone: string;
}): { id: number; email: string; name: string } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone.trim();

  const existingByEmail = db
    .prepare("SELECT id, email, name FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; name: string } | undefined;

  if (existingByEmail) {
    db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(
      name,
      phone,
      existingByEmail.id,
    );
    return { id: existingByEmail.id, email: existingByEmail.email, name };
  }

  const existingByPhone = db
    .prepare("SELECT id, email, name FROM users WHERE phone = ? ORDER BY id DESC LIMIT 1")
    .get(phone) as { id: number; email: string; name: string } | undefined;

  if (existingByPhone) {
    db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(
      name,
      email,
      existingByPhone.id,
    );
    return { id: existingByPhone.id, email, name };
  }

  const password_hash = bcrypt.hashSync(
    crypto.randomBytes(24).toString("hex"),
    10,
  );
  const result = db
    .prepare(
      "INSERT INTO users (email, name, password_hash, phone) VALUES (?, ?, ?, ?)",
    )
    .run(email, name, password_hash, phone);

  return {
    id: Number(result.lastInsertRowid),
    email,
    name,
  };
}
