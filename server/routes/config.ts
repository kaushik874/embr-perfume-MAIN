import { Router } from "express";

const router = Router();

router.get("/config/public", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "",
  });
});

export default router;
