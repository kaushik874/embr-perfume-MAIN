import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Newsletter subscribers
router.get("/subscribers", async (_req, res) => {
  const subscribers = await db.prepare("SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC").all();
  res.json({ subscribers });
});

router.post("/subscribers", async (req, res) => {
  const { email } = req.body;
  try {
    await db.prepare("INSERT INTO newsletter_subscribers (email) VALUES (?)").run(email);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
       res.status(400).json({ error: "Email already subscribed" });
       return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/subscribers/:id", async (req, res) => {
  await db.prepare("DELETE FROM newsletter_subscribers WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Contact Messages
router.get("/messages", async (_req, res) => {
  const messages = await db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
  res.json({ messages });
});

router.patch("/messages/:id/status", async (req, res) => {
  const { status } = req.body;
  await db.prepare("UPDATE contact_messages SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

export default router;
