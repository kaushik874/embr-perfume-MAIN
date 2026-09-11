import type { Product, HeroBanner } from "@/lib/api";

/**
 * Catalog module:
 * Stale dummy fallbacks and obsolete localStorage caches have been removed.
 * All dynamic data is fetched live from the server.
 */
export const INITIAL_ADMIN_PRODUCTS: Product[] = [];
export const INITIAL_HERO_BANNERS: HeroBanner[] = [];

export const PRODUCTS_CACHE_KEY = "embr_admin_products_v2";
export const HERO_CACHE_KEY = "embr_hero_banners_v2";

export function getCachedAdminProducts(): Product[] {
  return [];
}

export function setCachedAdminProducts(_products: Product[]): void {
  // Obsolete: No longer cache products in localStorage
}

export function getCachedHeroBanners(): HeroBanner[] {
  return [];
}

export function setCachedHeroBanners(_banners: HeroBanner[]): void {
  // Obsolete: No longer cache hero banners in localStorage
}

export const CATALOG_PRODUCTS: Product[] = [];
export const PRELOAD_IMAGES: string[] = [];

export function getCatalogProduct(_slug: string): Product | undefined {
  return undefined;
}

export function preloadCatalogImages() {
  // No-op
}
