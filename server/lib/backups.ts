import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../db.js";

const backupDir = path.resolve(process.cwd(), "data", "backups");

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

export async function createDatabaseBackup(label = "manual") {
  ensureBackupDir();
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tempFilename = `embr-${safeLabel}-${stamp}.db`;
  const encFilename = `embr-${safeLabel}-${stamp}.db.enc`;
  const tempDestination = path.join(backupDir, tempFilename);
  const encDestination = path.join(backupDir, encFilename);
  
  await db.backup(tempDestination);

  // Encrypt the backup at rest
  const key = crypto.scryptSync(process.env.JWT_SECRET || "default_fallback_key_do_not_use", "embr_salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  const input = fs.readFileSync(tempDestination);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Store IV + AuthTag + EncryptedData
  fs.writeFileSync(encDestination, Buffer.concat([iv, authTag, encrypted]));
  fs.unlinkSync(tempDestination);

  return { filename: encFilename, path: encDestination };
}

export function listDatabaseBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".db.enc") || file.endsWith(".db"))
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
