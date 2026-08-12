import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/hero", async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM hero_banners WHERE isActive = 1 ORDER BY displayOrder ASC").all() as any[];
  const banners = rows.map(r => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    imageUrl: r.imageurl,
    mobileImageUrl: r.mobileimageurl,
    productName: r.productname,
    productUrl: r.producturl,
    badge: r.badge,
    buttonText: r.buttontext,
    buttonLink: r.buttonlink,
    showButton: r.showbutton,
    darkOverlay: r.darkoverlay,
    imageFit: r.imagefit,
    imagePosition: r.imageposition,
    mobileImagePosition: r.mobileimageposition,
    showText: r.showtext,
    isActive: r.isactive,
    displayOrder: r.displayorder
  }));
  res.json({ banners });
});

export default router;
