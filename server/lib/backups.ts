import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, pool } from "../db.js";

const backupDir = path.resolve(process.cwd(), "data", "backups");

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

// PostgreSQL backup: exports all table data as a JSON dump
export async function createDatabaseBackup(label = "manual") {
  ensureBackupDir();
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const encFilename = `embr-${safeLabel}-${stamp}.json.enc`;
  const encDestination = path.join(backupDir, encFilename);

  // Dump all tables to JSON
  const tables = [
    "users",
    "products",
    "product_images",
    "orders",
    "order_items",
    "coupons",
    "reviews",
    "contact_messages",
    "newsletter_subscribers",
    "site_content",
    "site_sections",
    "hero_banners",
    "about_banner",
    "footer_columns",
    "footer_links",
    "customer_addresses",
    "analytics_visitors",
    "analytics_sessions",
    "analytics_page_views",
    "admin_logs",
  ];

  const backup: Record<string, unknown[]> = {};
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT * FROM ${table}`);
      backup[table] = result.rows;
    } catch {
      backup[table] = [];
    }
  }

  const jsonData = JSON.stringify(backup, null, 2);
  const jsonBuffer = Buffer.from(jsonData, "utf8");

  // Encrypt the backup at rest
  const key = crypto.scryptSync(process.env.JWT_SECRET || "default_fallback_key_do_not_use", "embr_salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(jsonBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store IV + AuthTag + EncryptedData
  fs.writeFileSync(encDestination, Buffer.concat([iv, authTag, encrypted]));

  return { filename: encFilename, path: encDestination };
}

export function listDatabaseBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".json.enc") || file.endsWith(".db.enc") || file.endsWith(".db"))
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      return {
        filename: file,
        size: stat.size,
        created_at: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function startAutomaticBackups() {
  if (process.env.AUTO_DB_BACKUPS === "false") return;

  const intervalMs = Number(process.env.BACKUP_INTERVAL_MS) || 6 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    createDatabaseBackup("auto").catch((err) => {
      console.error("Automatic database backup failed", err);
    });
  }, intervalMs);

  timer.unref();
}
