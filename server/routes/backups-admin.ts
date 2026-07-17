import { Router } from "express";
import { createDatabaseBackup, listDatabaseBackups } from "../lib/backups.js";
import { logAdminAction } from "../middleware/security.js";

const router = Router();

router.get("/backups", (_req, res) => {
  res.json({ backups: listDatabaseBackups() });
});

router.post("/backups", async (req, res) => {
  const backup = await createDatabaseBackup("admin");
  logAdminAction(req.user!.userId, "create_backup", `Created database backup ${backup.filename}`);
  res.json({ backup });
});

export default router;
