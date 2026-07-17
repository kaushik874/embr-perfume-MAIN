import type { Product } from "@/lib/api";

/** Instant catalog — works without API so pages load immediately */
export const CATALOG_PRODUCTS: Product[] = [

  {
    id: 2,
    slug: "ember-oud",
    name: "Ember Oud",
    notes: "Oud · Saffron · Amber",
    description: "Smoky oud wrapped in warm amber resin.",
    price: 399,
    mrp: 699,
    image: "/images/bottle-forest.svg",
    featured: 1,
  },
  {
    id: 3,
    slug: "forest-veil",
    name: "Forest Veil",
    notes: "Cedar · Pine · Vetiver",
    description: "Deep green woods after rain.",
    price: 449,
    mrp: 799,
    image: "/images/bottle-forest.svg",
    featured: 0,
  },
  {
    id: 4,
    slug: "midnight-smoke",
    name: "Midnight Smoke",
    notes: "Birch · Leather · Musk",
    description: "Nocturnal leather and birch tar.",
    price: 499,
    mrp: 899,
    image: "/images/bottle-forest.svg",
    featured: 1,
  },
  {
    id: 5,
    slug: "black-iris",
    name: "Black Iris",
    notes: "Iris · Patchouli · Tonka",
    description: "Powdery iris on a dark patchouli base.",
    price: 429,
    mrp: 749,
    image: "/images/bottle-rose.svg",
    featured: 0,
  },
  {
    id: 6,
    slug: "wild-cypress",
    name: "Wild Cypress",
    notes: "Cypress · Sage · Moss",
    description: "Mediterranean herbs and sun-warmed moss.",
    price: 379,
    mrp: 649,
    image: "/images/bottle-mist.svg",
    featured: 0,
  },
];

export const PRELOAD_IMAGES = [

  "/images/bottle-forest.svg",
  "/images/bottle-rose.svg",
  "/images/bottle-mist.svg",
];

export function getCatalogProduct(slug: string): Product | undefined {
  return CATALOG_PRODUCTS.find((p) => p.slug === slug);
}

export function preloadCatalogImages() {
  for (const src of PRELOAD_IMAGES) {
    const img = new Image();
    img.src = src;
  }
}
