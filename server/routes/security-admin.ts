import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/security/logins", (_req, res) => {
  try {
    const attempts = db.prepare("SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT 100").all();
    res.json({ attempts });
  } catch {
    res.json({ attempts: [] });
  }
});

router.get("/security/actions", (_req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.email as admin_email 
      FROM admin_logs a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 100
    `).all();
    res.json({ logs });
  } catch {
    res.json({ logs: [] });
  }
});

export default router;
