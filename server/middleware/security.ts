import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";

/**
 * Stricter rate limiter for login and OTP endpoints.
 * Prevents brute-force attacks by limiting rapid attempts from the same IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate rate limiter for general API requests.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: "Too many requests from this IP." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for review/media upload endpoints.
 * Prevents memory-exhaustion DoS via large JSON bodies.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many upload requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (req.secure || forwardedProto === "https") {
    next();
    return;
  }

  res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const allowed = [clientUrl];

  if (process.env.NODE_ENV !== "production") {
    allowed.push("http://localhost:5173");
  }

  const isAllowed = (value?: string) =>
    !value ||
    allowed.some((allowedOrigin) => value === allowedOrigin || value.startsWith(`${allowedOrigin}/`)) ||
    /^http:\/\/localhost:\d+(\/|$)?/.test(value);

  if (!isAllowed(origin) || !isAllowed(referer)) {
    res.status(403).json({ error: "Request origin is not allowed." });
    return;
  }

  next();
}

export function blockRepeatedFailedLogins(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const recentFailures = db
    .prepare(
      "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND success = 0 AND created_at >= datetime('now', '-30 minutes')",
    )
    .get(ip) as { count: number };

  if (recentFailures.count >= 15) {
    res.status(429).json({
      error: "Too many failed login attempts. This IP is temporarily blocked.",
    });
    return;
  }

  next();
}

/**
 * Log failed login attempts to detect brute-force patterns.
 */
export function logFailedLogin(email: string, ip: string) {
  try {
    db.prepare(
      "INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, 0)"
    ).run(email, ip);
  } catch {
    // login_attempts table may not exist yet
  }
}

export function logSuccessfulLogin(email: string, ip: string) {
  try {
    db.prepare(
      "INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, 1)"
    ).run(email, ip);
  } catch {
    // login_attempts table may not exist yet
  }
}

/**
 * Log admin actions for audit trail.
 */
export function logAdminAction(userId: number, action: string, details: string) {
  try {
    db.prepare(
      "INSERT INTO admin_logs (user_id, action, details) VALUES (?, ?, ?)"
    ).run(userId, action, details);
  } catch {
    // admin_logs table may not exist yet
  }
}

/**
 * Basic XSS prevention — strips dangerous patterns from string values.
 * Defense-in-depth measure; DB prepared statements handle the primary protection.
 */
export function sanitize(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "");
}

/**
 * Recursively sanitize all string values in an object (including nested objects).
 * Handles checkout shipping fields and any other deeply nested input.
 */
function sanitizeDeep(value: unknown): unknown {
  if (typeof value === "string") return sanitize(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeDeep(v);
    }
    return result;
  }
  return value;
}

/**
 * Middleware to recursively sanitize all string fields in request body.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }
  next();
}
