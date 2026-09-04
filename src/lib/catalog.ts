import type { Product } from "@/lib/api";

/**
 * Static catalog removed — website now shows ONLY admin-panel products.
 * Kept as empty arrays so existing imports don't break.
 */
export const CATALOG_PRODUCTS: Product[] = [];

export const PRELOAD_IMAGES: string[] = [];

export function getCatalogProduct(_slug: string): Product | undefined {
  return undefined;
}

export function preloadCatalogImages() {
  // no-op: nothing to preload
}

