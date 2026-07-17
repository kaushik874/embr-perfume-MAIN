import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "embr-dev-secret-change-in-production";

export type AuthPayload = { userId: number; email: string; role?: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  // Fetch the role directly from the database to avoid relying solely on the JWT
  const user = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(req.user.userId) as { role: string } | undefined;

  const validAdminRoles = ["admin", "superadmin", "manager", "staff"];

  if (!user || !validAdminRoles.includes(user.role)) {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return;
  }
  
  req.user.role = user.role;

  next();
}

export { JWT_SECRET };
