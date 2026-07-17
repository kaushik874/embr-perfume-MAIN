import type { Response } from "express";
import { signToken } from "../middleware/auth.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export function setAuthCookie(res: Response, userId: number, email: string, role: string = "user") {
  const token = signToken({ userId, email, role });
  res.cookie("embr_token", token, COOKIE_OPTS);
}
