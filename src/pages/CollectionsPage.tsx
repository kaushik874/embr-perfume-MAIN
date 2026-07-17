import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { api, type Product } from "@/lib/api";
import { CATALOG_PRODUCTS } from "@/lib/catalog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { useReveal } from "@/hooks/use-reveal";

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
  const [, setLocation] = useLocation();
  const eager = index < 3;
  const saving = product.mrp - product.price;

  return (
    <article
      className="reveal group relative flex flex-col overflow-hidden rounded-lg border border-border-light bg-white p-2.5 md:p-8 transition-all duration-500 md:hover:-translate-y-2 md:hover:border-gold-deep/40 md:hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)]"
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <Link href={`/product/${product.slug}`} className="block flex-1">
        <div className="relative mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-[#f5f5f5] md:mb-6 md:rounded-lg md:bg-forest-deep/5">
          {product.bestseller ? (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#1a3a6b] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
              BESTSELLER
            </span>
          ) : null}
          <div className="absolute inset-0 hidden bg-gold/15 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block" />
          <img
            src={product.image ?? "/images/bottle-mini.svg"}
            alt={product.name}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : undefined}
            decoding="async"
            className="relative h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
          />
        </div>
        <h3 className="truncate text-sm font-medium text-ink md:font-serif md:text-2xl md:whitespace-normal md:transition-colors md:group-hover:text-gold-deep">
          {product.name}
        </h3>
        <p className="mt-0.5 truncate text-[10px] tracking-wide text-ink-muted uppercase md:mt-1 md:text-xs md:tracking-widest md:whitespace-normal">
          {product.notes}
        </p>
        {saving > 0 && (
          <p className="mt-1 text-[11px] text-emerald-600 md:hidden">(Saving ₹{saving})</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5 md:mb-3 md:mt-3 md:gap-2">
          <span className="text-base font-semibold text-ink md:font-display md:text-xl md:font-normal md:text-2xl md:text-gold-deep">₹{product.price}</span>
          <span className="text-[11px] text-ink-muted/60 line-through md:text-sm">₹{product.mrp}</span>
        </div>
      </Link>

      <div className="mt-auto flex flex-col gap-2 pt-2 md:flex-row md:pt-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            add(product);
            toast.success(`${product.name} added to bag`);
          }}
          className="w-full rounded-md bg-ink py-2.5 text-[11px] font-semibold tracking-wide text-white md:w-1/2 md:rounded-full md:border-2 md:border-ink md:bg-transparent md:py-2.5 md:text-xs md:font-semibold md:tracking-widest md:text-ink md:transition-all md:hover:bg-ink md:hover:text-white"
        >
          <span className="md:hidden">Add To Cart</span>
          <span className="hidden md:inline">ADD TO BAG</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            add(product);
            toast.success(`${product.name} added to bag`);
            setLocation("/checkout");
          }}
          className="hidden w-full rounded-full bg-gradient-gold py-2.5 text-xs font-semibold tracking-widest text-charcoal shadow-gold transition-all hover:scale-[1.02] md:block md:w-1/2"
        >
          BUY NOW
        </button>
      </div>
    </article>
  );
}

export function CollectionsPage() {
  useReveal();
  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
    placeholderData: { products: CATALOG_PRODUCTS },
  });

  const sorted = [...(data?.products ?? CATALOG_PRODUCTS)].sort((a, b) => {
    if (a.slug === "milky-way") return -1;
    if (b.slug === "milky-way") return 1;
    return (b.featured ?? 0) - (a.featured ?? 0);
  });

  return (
    <ShopLayout promo="Free shipping on orders above ₹999 · Extrait de Parfum">
      <div className="bg-page py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 md:px-10">
          <div className="mb-14 text-center">
            <h1 className="font-serif text-4xl text-ink sm:text-5xl md:text-6xl lg:text-7xl">
              All Collections
            </h1>
            <p className="mt-4 text-ink-muted max-w-xl mx-auto">
              Explore our full range of handcrafted extrait de parfums.
              Discover signature scents that define your identity.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:gap-6 md:grid-cols-3">
            {sorted.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
