import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "embr-dev-secret-change-in-production";
const JWT_ISSUER = "embr-api";
const JWT_AUDIENCE = "embr-app";

export type AuthPayload = { userId: number; email: string; role?: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: crypto.randomUUID(),
  });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as AuthPayload;
  } catch {
    return null;
  }
}

/** Refuse to start in production without a strong, non-default JWT secret. */
export function assertJwtSecretConfigured() {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === "embr-dev-secret-change-in-production") {
    console.error("[Security] JWT_SECRET must be set to a random string of at least 32 characters in production.");
    process.exit(1);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.embr_token ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.user = payload;
  next();
}

import { db } from "../db.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  // Fetch the role directly from the database to avoid relying solely on the JWT
  const user = await db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(req.user.userId) as { role: string } | undefined;

  const validAdminRoles = ["admin", "superadmin", "manager", "staff"];
  const role = (user?.role || "").trim().toLowerCase();

  if (!user || !validAdminRoles.includes(role)) {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return;
  }
  
  req.user.role = role;

  next();
}

export { JWT_SECRET };
