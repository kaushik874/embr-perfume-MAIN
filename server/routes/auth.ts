import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db.js";
import { signToken } from "../middleware/auth.js";
import { setAuthCookie as setSessionCookie } from "../lib/auth-cookie.js";
import { logFailedLogin, logSuccessfulLogin } from "../middleware/security.js";
import { deliverOtp } from "../lib/otp-delivery.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  identifier: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1),
}).refine((data) => data.identifier || data.email, {
  message: "Email or mobile number is required",
});

const requestOtpSchema = z.object({
  identifier: z.string().min(3).max(120),
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(3).max(120),
  otp: z.string().regex(/^[0-9]{6}$/),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie("embr_token", token, COOKIE_OPTS);
}

router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, email, password } = parsed.data;
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);

  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    )
    .run(email, name, password_hash);

  const token = signToken({ userId: Number(result.lastInsertRowid), email, role: "user" });
  setAuthCookie(res, token);

  res.status(201).json({
    user: { id: result.lastInsertRowid, name, email, role: "user" },
  });
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const emailOrPhone = (parsed.data.identifier ?? parsed.data.email ?? "").trim().toLowerCase();
  const { password } = parsed.data;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const user = db
    .prepare("SELECT id, email, name, password_hash, role FROM users WHERE lower(email) = ? OR phone = ?")
    .get(emailOrPhone, emailOrPhone) as
    | { id: number; email: string; name: string; password_hash: string; role: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logFailedLogin(emailOrPhone, ip);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);
  logSuccessfulLogin(user.email, ip);

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post("/otp/request", async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const channel = identifier.includes("@") ? "email" : "mobile";
  const user = db
    .prepare("SELECT id, email, name, role FROM users WHERE lower(email) = ? OR phone = ? ORDER BY id DESC LIMIT 1")
    .get(identifier, identifier) as
    | { id: number; email: string; name: string; role: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: "No account found for this email or mobile number" });
    return;
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = bcrypt.hashSync(otp, 10);
  const destination = channel === "email" ? user.email : identifier;

  db.prepare(`
    INSERT INTO otp_codes (user_id, identifier, channel, otp_hash, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))
  `).run(user.id, identifier, channel, otpHash);

  let deliveryMessage = `OTP sent to your ${channel === "email" ? "email" : "mobile number"}`;
  let demoOtp: string | undefined;

  try {
    const delivery = await deliverOtp(channel, destination, otp);
    deliveryMessage = delivery.message;
    // Only expose OTP when delivery genuinely failed (dev/demo mode only)
    if (!delivery.delivered && process.env.NODE_ENV !== "production") {
      demoOtp = otp;
    }
  } catch (err) {
    console.error("[OTP] Delivery failed:", err);
    // In production, never expose OTP in response even on error
    if (process.env.NODE_ENV !== "production") {
      deliveryMessage = "Use the verification code shown on screen.";
      demoOtp = otp;
    } else {
      deliveryMessage = "OTP delivery failed. Please try again or contact support.";
    }
  }

  // Never return OTP in production
  const responsePayload: Record<string, unknown> = { ok: true, channel, message: deliveryMessage };
  if (demoOtp && process.env.NODE_ENV !== "production") responsePayload.demoOtp = demoOtp;

  res.json(responsePayload);
});

router.post("/otp/verify", (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const otpRow = db.prepare(`
    SELECT o.id, o.otp_hash, o.user_id, u.email, u.name, u.role
    FROM otp_codes o
    JOIN users u ON u.id = o.user_id
    WHERE o.identifier = ?
      AND o.consumed_at IS NULL
      AND datetime(o.expires_at) > datetime('now')
    ORDER BY o.id DESC
    LIMIT 1
  `).get(identifier) as
    | { id: number; otp_hash: string; user_id: number; email: string; name: string; role: string }
    | undefined;

  if (!otpRow || !bcrypt.compareSync(parsed.data.otp, otpRow.otp_hash)) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }

  db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(otpRow.id);
  setSessionCookie(res, otpRow.user_id, otpRow.email, otpRow.role);
  logSuccessfulLogin(otpRow.email, req.ip || req.socket.remoteAddress || "unknown");

  res.json({
    user: {
      id: otpRow.user_id,
      name: otpRow.name,
      email: otpRow.email,
      role: otpRow.role,
    },
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("embr_token", { path: "/" });
  res.json({ ok: true });
});

const googleSchema = z.object({
  credential: z.string().min(10),
});

router.post("/google", async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google sign-in is not configured" });
    return;
  }

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: parsed.data.credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(401).json({ error: "Google account email is required" });
      return;
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];
    const googleId = payload.sub;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    let user = db.prepare("SELECT id, email, name, role FROM users WHERE lower(email) = ?").get(email) as
      | { id: number; email: string; name: string; role: string }
      | undefined;

    if (!user) {
      const password_hash = bcrypt.hashSync(crypto.randomUUID(), 10);
      const result = db
        .prepare("INSERT INTO users (email, name, password_hash, google_id) VALUES (?, ?, ?, ?)")
        .run(email, name, password_hash, googleId);
      user = {
        id: Number(result.lastInsertRowid),
        email,
        name,
        role: "user",
      };
    } else if (googleId) {
      db.prepare("UPDATE users SET google_id = COALESCE(google_id, ?), name = COALESCE(NULLIF(name, ''), ?) WHERE id = ?")
        .run(googleId, name, user.id);
    }

    setSessionCookie(res, user.id, user.email, user.role);
    logSuccessfulLogin(user.email, ip);

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("[Google Auth]", err);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

export default router;
