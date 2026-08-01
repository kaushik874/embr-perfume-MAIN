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
import { sendEmail } from "../lib/email.js";
import { otpEmail, welcomeEmail, passwordResetSuccessEmail } from "../lib/email-templates.js";

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

router.post("/otp/send-signup", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  
  // Check if already registered
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  // Generate and save OTP
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = bcrypt.hashSync(otp, 10);

  // Expire any existing signup OTPs for this email
  await db.prepare("UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE email = ? AND purpose = 'signup' AND consumed_at IS NULL").run(email);

  await db.prepare(`
    INSERT INTO email_otps (email, purpose, otp_hash, expires_at)
    VALUES (?, 'signup', ?, (CURRENT_TIMESTAMP + INTERVAL '5 minutes'))
  `).run(email, otpHash);

  // Send via Brevo
  const emailRes = await sendEmail(email, undefined, "Verify your Email - Embr Perfume", otpEmail(otp));
  
  let deliveryMessage = "OTP sent to your email";
  let demoOtp: string | undefined;

  if (!emailRes.success && process.env.NODE_ENV !== "production") {
    demoOtp = otp;
    deliveryMessage = "Email delivery not configured. Use code shown on screen.";
  } else if (!emailRes.success) {
    res.status(500).json({ error: "Failed to send OTP email. Please try again later." });
    return;
  }

  const responsePayload: Record<string, unknown> = { ok: true, message: deliveryMessage };
  if (demoOtp) responsePayload.demoOtp = demoOtp;

  res.json(responsePayload);
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);

  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  // Create User
  const password_hash = bcrypt.hashSync(password, 10);
  const result = await db
    .prepare(
      "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    )
    .run(email, name, password_hash);

  const token = signToken({ userId: Number(result.lastInsertRowid), email, role: "user" });
  setAuthCookie(res, token);

  // Send Welcome Email asynchronously
  sendEmail(email, name, "Welcome to Embr Perfume", welcomeEmail(name)).catch(console.error);

  res.status(201).json({
    user: { id: result.lastInsertRowid, name, email, role: "user" },
  });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);

  // Always return success to prevent email enumeration, but only actually send if user exists
  if (user) {
    try {
      const otp = String(crypto.randomInt(100000, 1000000));
      const otpHash = bcrypt.hashSync(otp, 10);

      // Create table if somehow missed by initDb
      await db.exec(`CREATE TABLE IF NOT EXISTS email_otps (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL,
        purpose TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

      await db.prepare("UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE email = ? AND purpose = 'reset' AND consumed_at IS NULL").run(email);
      
      await db.prepare(`
        INSERT INTO email_otps (email, purpose, otp_hash, expires_at)
        VALUES (?, 'reset', ?, (CURRENT_TIMESTAMP + INTERVAL '10 minutes'))
      `).run(email, otpHash);

      const emailRes = await sendEmail(email, undefined, "Reset your password - Embr Perfume", otpEmail(otp));
      
      if (!emailRes.success) {
        console.error("[OTP] Email failed to send via Brevo");
        if (process.env.NODE_ENV !== "production") {
          res.json({ ok: true, message: "Email delivery failed (check Brevo settings). Using demo OTP.", demoOtp: otp });
          return;
        } else {
          res.status(500).json({ error: "Failed to send reset email due to provider error. Please check Brevo configuration." });
          return;
        }
      }
    } catch (err) {
      console.error("[OTP Error]", err);
      res.status(500).json({ error: "An internal server error occurred while processing OTP." });
      return;
    }
  }

  res.json({ ok: true, message: "If an account exists, a reset code has been sent." });
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^[0-9]{6}$/, "Must be a 6 digit code"),
  password: z.string().min(6).max(128),
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { password, otp } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const otpRow = await db.prepare(`
    SELECT id, otp_hash, attempts FROM email_otps 
    WHERE email = ? AND purpose = 'reset' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    ORDER BY id DESC LIMIT 1
  `).get(email) as { id: number, otp_hash: string, attempts: number } | undefined;

  if (!otpRow) {
    res.status(401).json({ error: "Reset code expired or invalid" });
    return;
  }

  if (otpRow.attempts >= 5) {
    await db.prepare("UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(otpRow.id);
    res.status(429).json({ error: "Too many failed attempts. Please request a new code." });
    return;
  }

  if (!bcrypt.compareSync(otp, otpRow.otp_hash)) {
    await db.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?").run(otpRow.id);
    res.status(401).json({ error: "Invalid reset code" });
    return;
  }

  const user = await db.prepare("SELECT id, name FROM users WHERE email = ?").get(email) as { id: number, name: string } | undefined;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.prepare("UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(otpRow.id);
  
  const password_hash = bcrypt.hashSync(password, 10);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, user.id);

  sendEmail(email, user.name, "Password Reset Successful", passwordResetSuccessEmail()).catch(console.error);

  res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const emailOrPhone = (parsed.data.identifier ?? parsed.data.email ?? "").trim().toLowerCase();
  const { password } = parsed.data;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const user = await db
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
  await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

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
  const user = await db
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

  await db.prepare(`
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

router.post("/otp/verify", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const otpRow = await db.prepare(`
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

  await db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(otpRow.id);
  setSessionCookie(res, otpRow.user_id, otpRow.email, otpRow.role);
  logSuccessfulLogin(otpRow.email, req.ip || req.socket.remoteAddress || "unknown");
  await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(otpRow.user_id);

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

    let user = await db.prepare("SELECT id, email, name, role FROM users WHERE lower(email) = ?").get(email) as
      | { id: number; email: string; name: string; role: string }
      | undefined;

    if (!user) {
      const password_hash = bcrypt.hashSync(crypto.randomUUID(), 10);
      const result = await db
        .prepare("INSERT INTO users (email, name, password_hash, google_id) VALUES (?, ?, ?, ?)")
        .run(email, name, password_hash, googleId);
      user = {
        id: Number(result.lastInsertRowid),
        email,
        name,
        role: "user",
      };
    } else if (googleId) {
      await db.prepare("UPDATE users SET google_id = COALESCE(google_id, ?), name = COALESCE(NULLIF(name, ''), ?) WHERE id = ?")
        .run(googleId, name, user.id);
    }

    setSessionCookie(res, user.id, user.email, user.role);
    logSuccessfulLogin(user.email, ip);
    await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("[Google Auth]", err);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

export default router;
