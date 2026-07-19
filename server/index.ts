import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import meRoutes from "./routes/me.js";
import adminRoutes from "./routes/admin.js";
import webhookRoutes from "./routes/webhooks.js";
import heroRoutes from "./routes/hero.js";
import heroAdminRoutes from "./routes/hero-admin.js";
import reviewsClientRoutes from "./routes/reviews-client.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import helmet from "helmet";
import {
  apiLimiter,
  authLimiter,
  blockRepeatedFailedLogins,
  csrfProtection,
  enforceHttps,
  otpLimiter,
  sanitizeBody,
  uploadLimiter,
} from "./middleware/security.js";
import { runMigrations } from "./lib/migrations.js";

// New enhanced admin routes
import productsAdminRoutes from "./routes/products-admin.js";
import ordersAdminRoutes from "./routes/orders-admin.js";
import customersAdminRoutes from "./routes/customers-admin.js";
import dashboardAdminRoutes from "./routes/dashboard-admin.js";
import backupsAdminRoutes from "./routes/backups-admin.js";
import couponsAdminRoutes from "./routes/coupons-admin.js";
import couponRoutes from "./routes/coupons.js";
import marketingAdminRoutes from "./routes/marketing-admin.js";
import contentAdminRoutes from "./routes/content-admin.js";
import contentRoutes from "./routes/content.js";
import configRoutes from "./routes/config.js";
import reviewsAdminRoutes from "./routes/reviews-admin.js";
import securityAdminRoutes from "./routes/security-admin.js";
import aboutAdminRoutes from "./routes/about-admin.js";
import footerAdminRoutes from "./routes/footer-admin.js";
import analyticsTrackRoutes from "./routes/analytics-track.js";
import analyticsAdminRoutes from "./routes/analytics-admin.js";
import { startAutomaticBackups } from "./lib/backups.js";
import { startOrderExpiryJob } from "./lib/orders.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

app.use(compression());
app.set("trust proxy", 1);
app.use(enforceHttps);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === clientUrl) return callback(null, true);
      // Only allow localhost origins in development
      if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com", "https://accounts.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", clientUrl, "https://accounts.google.com", "https://*.razorpay.com", "https://api.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://accounts.google.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// Webhook must be parsed as raw buffer before express.json()
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

app.use("/api/admin/products", express.json({ limit: "35mb" }));
app.use("/api/admin/hero/upload", express.json({ limit: "35mb" }));
app.use("/api/admin/about/upload", express.json({ limit: "35mb" }));
app.use("/api/admin/content/upload", express.json({ limit: "35mb" }));
// Rate limit review upload endpoints more aggressively
app.use("/api/admin/reviews", express.json({ limit: "100mb" }));
app.use("/api/reviews", express.json({ limit: "100mb" }));
app.use("/api/admin/reviews", uploadLimiter);
app.use("/api/reviews", uploadLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(csrfProtection);
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter, blockRepeatedFailedLogins);
app.use("/api/auth/register", authLimiter);
app.use("/api/otp", otpLimiter);
app.use(sanitizeBody);

// Serve uploaded product images
app.use("/uploads", express.static(path.resolve(process.cwd(), "public/uploads")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    payments: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    )
      ? "razorpay"
      : "demo",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/content", contentRoutes);
app.use("/api", configRoutes);
app.use("/api/reviews", reviewsClientRoutes);
app.use("/api", heroRoutes);
app.use("/api", aboutAdminRoutes); // public about-banner endpoint
app.use("/api", footerAdminRoutes); // public footer endpoint
app.use("/api/track", analyticsTrackRoutes); // public analytics tracking

app.use("/api/admin", requireAuth, requireAdmin, heroAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, aboutAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, footerAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, productsAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, ordersAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, customersAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, dashboardAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, backupsAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, couponsAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, marketingAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, contentAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, reviewsAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, securityAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, analyticsAdminRoutes);
app.use("/api/admin", requireAuth, requireAdmin, adminRoutes);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production: compiled server is at dist/server/index.js
// Frontend build is at dist/public/ (from vite build outDir)
// Uploaded images live in public/uploads/ (project root) - served separately above
const publicDir = path.resolve(__dirname, "../public");
// Also resolve the source uploads dir for when images are stored there (not in dist)
const sourceUploadsDir = path.resolve(process.cwd(), "public", "uploads");

if (process.env.NODE_ENV === "production") {
  // Serve uploaded files from the project-root public/uploads directory
  // (In case uploads are not included in the dist/public build)
  app.use("/uploads", express.static(sourceUploadsDir));
  // Serve frontend build
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}


// Global error handler — must be last middleware, catches all unhandled errors
import type { NextFunction, Request, Response } from "express";
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Unhandled Error]", err.message);
  res.status(500).json({ error: "An unexpected error occurred." });
});

async function startServer() {
  await initDb();
  await runMigrations();
  startAutomaticBackups();
  startOrderExpiryJob();

  app.listen(port, () => {
    console.log(`Embr API running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("[Startup Error]", err);
  process.exit(1);
});
