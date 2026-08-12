import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type Product } from "@/lib/api";
import { CATALOG_PRODUCTS } from "@/lib/catalog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useSiteContent } from "@/hooks/use-site-content";

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
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
        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5 md:mt-3 md:gap-3">
          <span className="text-base font-semibold text-ink md:font-display md:text-xl md:font-normal md:text-2xl md:text-gold-deep">₹{product.price}</span>
          <span className="text-[11px] text-ink-muted/60 line-through md:text-sm">₹{product.mrp}</span>
        </div>
        <p className="mt-3 hidden text-xs tracking-widest text-gold-deep opacity-0 transition-opacity group-hover:opacity-100 md:block">
          VIEW DETAILS →
        </p>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          add(product);
          toast.success(`${product.name} added to bag`);
        }}
        className="mt-2 w-full rounded-md bg-ink py-2.5 text-center text-[11px] font-semibold tracking-wide text-white md:absolute md:inset-x-0 md:bottom-0 md:mt-0 md:translate-y-full md:rounded-none md:py-4 md:text-center md:text-sm md:font-medium md:tracking-widest md:transition-transform md:duration-500 md:group-hover:translate-y-0"
      >
        <span className="md:hidden">Add To Cart</span>
        <span className="hidden md:inline">ADD TO BAG</span>
      </button>
    </article>
  );
}

export function Collection() {
  const { getVal, isHidden } = useSiteContent();

  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
    placeholderData: { products: CATALOG_PRODUCTS },
  });

  const primaryProducts = (data?.products ?? CATALOG_PRODUCTS).filter(
    (p) => p.collection_type === "primary" || (!p.collection_type && p.featured === 1)
  );

  const sorted = [...primaryProducts].sort((a, b) => {
    if (a.slug === "milky-way") return -1;
    if (b.slug === "milky-way") return 1;
    return (b.featured ?? 0) - (a.featured ?? 0);
  });

  if (isHidden("section_collection")) return null;

  return (
    <section id="collection" className="bg-page pt-4 pb-16 md:py-32">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 md:px-10">
        <div className="mb-8 md:mb-14 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="reveal">
            <p className="font-display text-xs tracking-[0.4em] text-gold-deep">{getVal("collection_eyebrow", "— THE EDIT")}</p>
            <h2 className="mt-3 font-serif text-3xl text-ink sm:text-4xl md:text-6xl">{getVal("collection_heading", "Our Collection")}</h2>
          </div>
          <Link
            href="/collections"
            className="reveal shrink-0 text-xs sm:text-sm tracking-widest text-ink-muted hover:text-gold-deep hover:underline"
          >
            ALL COLLECTION →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:gap-6 md:grid-cols-3">
          {sorted.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
