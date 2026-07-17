/**
 * Analytics utility functions
 * - Bot detection (blocks crawlers/bots)
 * - User-Agent parser (device, browser, OS)
 * - Referrer source classifier
 */

// ── Bot Detection ────────────────────────────────────────────────────────────
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /scrape/i,
  /wget/i, /curl/i, /python/i, /java\//i, /go-http/i,
  /axios/i, /postman/i, /lighthouse/i, /headless/i,
  /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
  /prerender/i, /facebookexternalhit/i, /twitterbot/i,
  /googlebot/i, /bingbot/i, /yandex/i, /baidu/i,
  /duckduckbot/i, /whatsapp/i, /telegrambot/i, /linkedinbot/i,
  /applebot/i, /semrushbot/i, /ahrefsbot/i, /mj12bot/i,
  /dotbot/i, /petalbot/i, /bytespider/i, /gptbot/i,
];

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

// ── Device Detection ─────────────────────────────────────────────────────────
export function getDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|opera mini|iemobile|wpdesktop/i.test(ua)) return "mobile";
  return "desktop";
}

// ── Browser Detection ────────────────────────────────────────────────────────
export function getBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "edge";
  if (/opr\/|opera/i.test(ua)) return "opera";
  if (/chrome\/[0-9]/i.test(ua) && !/chromium/i.test(ua)) return "chrome";
  if (/firefox\//i.test(ua)) return "firefox";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "safari";
  if (/msie|trident/i.test(ua)) return "ie";
  return "other";
}

// ── OS Detection ─────────────────────────────────────────────────────────────
export function getOS(ua: string): string {
  if (/windows/i.test(ua)) return "windows";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "other";
}

// ── Referrer Source ──────────────────────────────────────────────────────────
export function getReferrerSource(referrer: string): string {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (/google\./i.test(host)) return "google";
    if (/bing\./i.test(host)) return "bing";
    if (/yahoo\./i.test(host)) return "yahoo";
    if (/duckduckgo\./i.test(host)) return "duckduckgo";
    if (/facebook\.com|fb\.com/i.test(host)) return "facebook";
    if (/instagram\.com/i.test(host)) return "instagram";
    if (/youtube\.com|youtu\.be/i.test(host)) return "youtube";
    if (/twitter\.com|x\.com/i.test(host)) return "twitter";
    if (/whatsapp\.com/i.test(host)) return "whatsapp";
    if (/t\.me|telegram/i.test(host)) return "telegram";
    if (/linkedin\.com/i.test(host)) return "linkedin";
    return "referral";
  } catch {
    return "direct";
  }
}

// ── IP Geo (simple, no external dependency) ──────────────────────────────────
export function getClientIp(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
