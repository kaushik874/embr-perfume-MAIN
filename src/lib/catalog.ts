import type { Product, HeroBanner } from "@/lib/api";

/**
 * EXACT REAL ADMIN PANEL PRODUCTS (Only products listed in Admin Panel).
 * Used as instant synchronous fallback so first-load and slow networks respond immediately.
 */
export const INITIAL_ADMIN_PRODUCTS: Product[] = [
  {
    id: 10,
    slug: "Intense",
    name: "Intense",
    notes: "Pineapple · Lavender · Jasmine · Vanilla",
    description: "Our most unique gourmand fragrance — creamy milk folded into warm spice and soft woods. A velvet elixir in emerald glass, bottled for slow evenings and lingering presence.",
    price: 259,
    mrp: 899,
    image: "/uploads/products/5bb4732a-f09d-405f-932e-5ea88be71dd3-file_00000000f6c8722fa0d66bc879051c31.webp",
    featured: 1,
    collection_type: "primary",
    bestseller: 1,
    head_notes: "pinapal, levender",
    heart_notes: "jhesmin",
    base_notes: "venilla",
    review: "0",
  },
  {
    id: 1,
    slug: "ember-oud",
    name: "Ember Oud",
    notes: "Oud · Saffron · Amber",
    description: "Smoky oud wrapped in warm amber resin.",
    price: 1,
    mrp: 699,
    image: "https://res.cloudinary.com/rla3fbe1/image/upload/v1787986113/embr/products/ulkbiglqgcainafafz6y.webp",
    featured: 1,
    collection_type: "primary",
    bestseller: 1,
    head_notes: null,
    heart_notes: null,
    base_notes: null,
    review: null,
  },
];

export const INITIAL_HERO_BANNERS: HeroBanner[] = [
  {
    id: 13,
    title: "Most Unique",
    subtitle: "",
    description: "Creamy milk folded into warm spice and soft woods — our signature gourmand in emerald glass.",
    imageUrl: "https://res.cloudinary.com/rla3fbe1/image/upload/v1787985963/embr/hero/nc9wkyry5oqukcvra5tk.jpg",
    mobileImageUrl: "https://res.cloudinary.com/rla3fbe1/image/upload/v1787985892/embr/hero/jmrhotsf1aprnxfhqd0l.png",
    productName: "EXTRAIT DE PARFUM · 30ML",
    productUrl: "/product/Intense",
    badge: "",
    buttonText: "Shop Now",
    buttonLink: "/product/Intense",
    showButton: 0,
    darkOverlay: 0,
    imageFit: "cover",
    imagePosition: "center center",
    mobileImagePosition: "center center",
    showText: 0,
    isActive: 1,
    displayOrder: 0,
  },
];

const PRODUCTS_CACHE_KEY = "embr_admin_products_v2";
const HERO_CACHE_KEY = "embr_hero_banners_v2";

export function getCachedAdminProducts(): Product[] {
  if (typeof window === "undefined") return INITIAL_ADMIN_PRODUCTS;
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((p: Product) => p && p.collection_type !== "secondary");
        if (filtered.length > 0) return filtered;
      }
    }
  } catch {}
  return INITIAL_ADMIN_PRODUCTS;
}

export function setCachedAdminProducts(products: Product[]): void {
  if (typeof window === "undefined" || !Array.isArray(products) || products.length === 0) return;
  try {
    const filtered = products.filter((p) => p && p.collection_type !== "secondary");
    if (filtered.length > 0) {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(filtered));
    }
  } catch {}
}

export function getCachedHeroBanners(): HeroBanner[] {
  if (typeof window === "undefined") return INITIAL_HERO_BANNERS;
  try {
    const raw = localStorage.getItem(HERO_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_HERO_BANNERS;
}

export function setCachedHeroBanners(banners: HeroBanner[]): void {
  if (typeof window === "undefined" || !Array.isArray(banners) || banners.length === 0) return;
  try {
    localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(banners));
  } catch {}
}

export const CATALOG_PRODUCTS: Product[] = INITIAL_ADMIN_PRODUCTS;
export const PRELOAD_IMAGES: string[] = [];

export function getCatalogProduct(slug: string): Product | undefined {
  return getCachedAdminProducts().find((p) => p.slug === slug);
}

export function preloadCatalogImages() {
  // Preload primary images
  if (typeof window === "undefined") return;
  const prods = getCachedAdminProducts();
  for (const p of prods) {
    if (p.image) {
      const img = new Image();
      img.src = p.image;
    }
  }
}


