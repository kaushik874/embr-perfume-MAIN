import { useMemo, useState, useEffect, useRef, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ChevronDown, ChevronLeft, ChevronUp, Minus, Plus, Star, Heart } from "lucide-react";
import { api, type Product, type ProductVariant } from "@/lib/api";
import { QueryErrorState } from "@/components/ui/QueryErrorState";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { ReviewsSection } from "@/components/ReviewsSection";
import { toast } from "sonner";
import {
  productPageSettings,
  type ProductAccordion,
  type ProductPageSectionId,
} from "@/lib/product-page-settings";

type SectionRenderContext = {
  product: Product;
  galleryImages: string[];
  mainImage: string;
  selectedImage: string | null;
  setSelectedImage: (url: string | null) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  relatedProducts: Product[];
  discount: number;
  noteList: string[];
  activeVariants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  setSelectedVariantId: (id: number) => void;
  currentPrice: number;
  currentMrp: number;
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function splitNotes(value?: string | null) {
  return (value ?? "")
    .split(/[·,|]/)
    .map((note) => note.trim())
    .filter(Boolean);
}

function SectionShell({
  children,
  className = "",
  noMargin = false,
}: {
  children: React.ReactNode;
  className?: string;
  noMargin?: boolean;
}) {
  return (
    <section className={`w-full ${className}`} style={noMargin ? {} : { marginTop: "var(--section-gap)" }}>
      {children}
    </section>
  );
}

function AccordionItem({
  item,
  children,
}: {
  item: ProductAccordion;
  children: React.ReactNode;
}) {
  const storageKey = `embr_product_accordion_${window.location.pathname}_${item.id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved === null ? Boolean(item.defaultOpen) : saved === "1";
    } catch {
      return Boolean(item.defaultOpen);
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [open, storageKey]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-6 text-left font-display text-lg uppercase text-ink transition-colors hover:text-gold-deep py-4"
      >
        <span>{item.title}</span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-ink" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-ink" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-[1400px] pb-6 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function RichContent({
  item,
  fallback,
}: {
  item: ProductAccordion;
  fallback?: string | null;
}) {
  const content = fallback || item.content;

  return (
    <div className="max-w-5xl text-[15px] leading-[var(--line-height)] text-ink-muted md:text-base">
      {item.html ? (
        <div
          className="prose max-w-none prose-p:text-ink-muted prose-li:text-ink-muted prose-strong:text-ink"
          dangerouslySetInnerHTML={{ __html: item.html }}
        />
      ) : (
        <p className="whitespace-pre-line">{content}</p>
      )}

      {item.bullets && item.bullets.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {item.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {item.images && item.images.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {item.images.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt={`${item.title} ${index + 1}`}
              className="aspect-[4/3] w-full rounded-[var(--radius-setting)] border border-border-light object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductGallery({
  product,
  galleryImages,
  selectedImage,
  setSelectedImage,
}: SectionRenderContext) {
  const hasThumbnails = galleryImages.length > 1;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollTimer = useRef<number | null>(null);

  // Mouse drag state for desktop
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false);

  // When galleryImages changes (variant change or new product), reset to first slide
  useEffect(() => {
    setActiveIndex(0);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [galleryImages]);

  const goToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(index);
    setSelectedImage(galleryImages[index] || null);
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: "smooth",
    });
  };

  // Debounced scroll listener so gestures run 100% natively on the GPU thread without React re-rendering
  const handleScroll = () => {
    if (isMouseDown.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      const clamped = Math.max(0, Math.min(galleryImages.length - 1, idx));
      setActiveIndex(clamped);
      setSelectedImage(galleryImages[clamped] || null);
    }, 50);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    const el = scrollRef.current;
    if (!el) return;
    isMouseDown.current = true;
    hasDragged.current = false;
    startX.current = e.pageX;
    scrollLeftPos.current = el.scrollLeft;
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const delta = e.pageX - startX.current;
    if (Math.abs(delta) > 5) {
      hasDragged.current = true;
    }
    el.scrollLeft = scrollLeftPos.current - delta;
  };

  const handleMouseUpOrLeave = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    const el = scrollRef.current;
    if (!el) return;
    el.style.scrollSnapType = "x mandatory";
    el.style.scrollBehavior = "smooth";
    if (hasDragged.current && el.clientWidth > 0) {
      const targetIdx = Math.max(0, Math.min(galleryImages.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
      el.scrollTo({ left: targetIdx * el.clientWidth, behavior: "smooth" });
      setActiveIndex(targetIdx);
      setSelectedImage(galleryImages[targetIdx] || null);
    }
  };

  return (
    <SectionShell className="lg:mt-0" noMargin={true}>
      <div
        className={`grid gap-4 ${
          hasThumbnails ? "lg:grid-cols-[var(--thumb-size)_minmax(0,1fr)]" : "lg:grid-cols-1"
        }`}
      >
        {hasThumbnails ? (
          <div className="order-2 flex gap-3 overflow-x-auto pb-1 lg:order-1 lg:max-h-[var(--main-image-height)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
            {galleryImages.map((url, index) => {
              const active = activeIndex === index;
              return (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-[var(--radius-setting)] border bg-white transition-colors ${
                    active ? "border-ink shadow-sm ring-1 ring-ink" : "border-border-light hover:border-ink/50"
                  }`}
                  style={{ width: "var(--thumb-size)", height: "var(--thumb-size)" }}
                >
                  <img
                    src={url}
                    alt={`${product.name} view ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Swipeable / Scrollable Main Image Display */}
        <div className="order-1 relative aspect-[943/1404] lg:aspect-auto w-full overflow-hidden rounded-[var(--radius-setting)] border border-border-light bg-[#f7f7f5] lg:order-2 lg:min-h-[var(--main-image-height)] select-none">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="flex h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain cursor-grab active:cursor-grabbing touch-manipulation"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x pan-y",
            }}
          >
            {galleryImages.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center"
              >
                <img
                  src={url}
                  alt={`${product.name} view ${index + 1}`}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover lg:h-[var(--gallery-image-height)] lg:w-[var(--gallery-image-width)] select-none pointer-events-none"
                />
              </div>
            ))}
          </div>

          {/* Dots Indicator (Only if multiple images) */}
          {hasThumbnails && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
              {galleryImages.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => goToIndex(dotIdx)}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
                    dotIdx === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
                  }`}
                  aria-label={`Go to image ${dotIdx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function ProductInfo({
  product,
  quantity,
  setQuantity,
  discount,
  noteList,
  activeVariants,
  selectedVariant,
  setSelectedVariantId,
  setSelectedImage,
  currentPrice,
  currentMrp,
}: SectionRenderContext) {
  const { add } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const category =
    "category" in product && product.category
      ? String(product.category)
      : productPageSettings.text.productFallbackCategory;

  const { data: reviewsData } = useQuery({
    queryKey: ["/api/reviews", product.slug, "newest"],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${product.slug}?sort=newest`);
      if (!res.ok) return { reviews: [] };
      return res.json();
    }
  });

  const reviews = reviewsData?.reviews || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";
  const reviewCount = reviews.length;

  const isOutOfStock = selectedVariant ? selectedVariant.stock <= 0 : (product.stock ?? 1) <= 0;

  return (
    <SectionShell className="lg:mt-0" noMargin={true}>
      <div className="flex h-full flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">
          {category}
        </p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="font-display text-5xl uppercase leading-none text-ink sm:text-6xl lg:text-7xl">
            {product.name}
          </h1>
          <button
            onClick={() => toggleWishlist(product.id)}
            className="mt-2 shrink-0 rounded-full bg-white p-2.5 text-gray-400 shadow-sm transition-all hover:scale-110 hover:text-red-500"
          >
            <Heart className={`h-6 w-6 ${isWishlisted(product.id) ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink">
          <Star className="h-4 w-4 fill-gold-deep text-gold-deep" />
          <span className="font-semibold">{avgRating}</span>
          <span className="text-ink-muted">
            ({reviewCount} reviews)
          </span>
        </div>

        <div className="mt-7 flex flex-wrap items-end gap-3">
          <span className="text-4xl font-semibold text-ink">{formatPrice(currentPrice)}</span>
          {currentMrp > currentPrice ? (
            <span className="pb-1 text-base text-ink-muted line-through">
              {formatPrice(currentMrp)}
            </span>
          ) : null}
          {discount > 0 ? (
            <span className="mb-1 border border-gold-deep bg-gold-deep/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-ink">
              {discount}% off
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
          {productPageSettings.text.priceLabel}
        </p>

        <p className="mt-7 max-w-xl text-[15px] leading-[var(--line-height)] text-ink-muted">
          {product.description || productPageSettings.text.shortDescriptionFallback}
        </p>

        {noteList.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {noteList.map((note) => (
              <span
                key={note}
                className="border border-border-light px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-muted"
              >
                {note}
              </span>
            ))}
          </div>
        ) : null}

        {activeVariants && activeVariants.length > 0 ? (
          <div className="mt-7">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
              {product.variant_selector_heading || "SELECT ONE"}
            </p>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {activeVariants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id;
                const variantOutOfStock = variant.stock <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setSelectedImage(null);
                    }}
                    disabled={variantOutOfStock}
                    className={`rounded-md px-5 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all ${
                      isSelected
                        ? "border-2 border-ink bg-ink text-white shadow-sm"
                        : variantOutOfStock
                        ? "border border-border-light/60 bg-gray-100 text-ink-muted/50 cursor-not-allowed line-through"
                        : "border border-border-light bg-white text-ink hover:border-ink/60"
                    }`}
                  >
                    {variant.name}
                    {variantOutOfStock && <span className="ml-1.5 text-[10px] lowercase no-underline">(out of stock)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
              {productPageSettings.text.quantityLabel}
            </p>
            <div className="grid h-[var(--button-height)] w-36 grid-cols-3 border border-border-light">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex items-center justify-center border-r border-border-light hover:bg-black/5"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex items-center justify-center text-sm font-medium">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                className="flex items-center justify-center border-l border-border-light hover:bg-black/5"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={() => {
              add(product, quantity, selectedVariant);
              toast.success(
                selectedVariant
                  ? `${product.name} (${selectedVariant.name}) added to cart`
                  : `${product.name} added to cart`
              );
            }}
            className={`h-[var(--button-height)] w-[var(--button-width)] px-8 text-sm font-bold uppercase tracking-wide transition-colors sm:flex-1 ${
              isOutOfStock
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-ink text-white hover:bg-gold-deep"
            }`}
          >
            {isOutOfStock
              ? "OUT OF STOCK"
              : `${productPageSettings.text.addToCart} - ${formatPrice(currentPrice * quantity)}`}
          </button>
        </div>
      </div>
    </SectionShell>
  );
}

function NotesSection({ product }: SectionRenderContext) {
  const productNotes = {
    head: splitNotes(product.head_notes),
    heart: splitNotes(product.heart_notes),
    base: splitNotes(product.base_notes),
  };

  const groups = productPageSettings.notes
    .filter((group) => group.visible)
    .map((group) => ({
      ...group,
      notes: productNotes[group.id].length
        ? productNotes[group.id].map((name) => ({ name, image: "" }))
        : group.notes,
    }))
    .filter((group) => group.notes.length > 0);

  if (groups.length === 0) return null;

  return (
    <SectionShell>
      <h2 className="text-center font-display text-3xl uppercase text-ink">
        {productPageSettings.text.notesHeading}
      </h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[var(--column-gap)]">
        {groups.map((group) => (
          <div
            key={group.id}
            className="border-t border-border-light px-4 pt-5 text-center"
          >
            <h3 className="font-display text-xl uppercase text-ink">{group.title}</h3>
            {group.image ? (
              <img
                src={group.image}
                alt={group.title}
                className="mx-auto mt-5 object-contain"
                style={{
                  width: productPageSettings.layout.noteImageWidth,
                  height: productPageSettings.layout.noteImageHeight,
                }}
                loading="lazy"
              />
            ) : null}
            <div className="mt-5 flex flex-wrap justify-center gap-5">
              {group.notes.map((note) => (
                <div key={note.name} className="flex min-w-20 flex-col items-center gap-2">
                  {note.image ? (
                    <img
                      src={note.image}
                      alt={note.name}
                      className="object-contain"
                      style={{
                        width: productPageSettings.layout.noteImageWidth,
                        height: productPageSettings.layout.noteImageHeight,
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-full border border-border-light bg-[#f7f7f5] font-serif text-xl text-ink-muted"
                      style={{
                        width: productPageSettings.layout.noteImageHeight,
                        height: productPageSettings.layout.noteImageHeight,
                      }}
                    >
                      {note.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-xs text-ink-muted">{note.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function AccordionSection({
  id,
  product,
  isFirstAccordion,
}: SectionRenderContext & { id: ProductAccordion["id"]; isFirstAccordion?: boolean }) {
  if (id === "legal") return null;
  const item = productPageSettings.accordions.find((accordion) => accordion.id === id);
  if (!item?.visible) return null;

  const fallbackById: Partial<Record<ProductAccordion["id"], string | null | undefined>> = {
    description: product.description,
    features: product.key_features,
    apply: product.how_to_apply,
  };

  const fallback = fallbackById[id];
  if (!fallback && !item.content && !item.html && !item.bullets?.length) return null;

  return (
    <div className={`w-full border-b border-border-light ${isFirstAccordion ? "mt-12 border-t" : ""}`}>
      <AccordionItem item={item}>
        <RichContent item={item} fallback={fallback} />
      </AccordionItem>
    </div>
  );
}

// ReviewsSection is imported from @/components/ReviewsSection

function RelatedProducts({ relatedProducts }: SectionRenderContext) {
  if (relatedProducts.length === 0) return null;

  return (
    <SectionShell>
      <h2 className="font-display text-3xl uppercase text-ink">
        {productPageSettings.text.relatedTitle}
      </h2>
      <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {relatedProducts.map((product) => (
          <Link
            key={product.slug}
            href={`/product/${product.slug}`}
            className="group block border border-border-light bg-white p-2 transition-colors hover:border-ink"
          >
            <div className="aspect-square overflow-hidden bg-[#f7f7f5]">
              <img
                src={product.image ?? "/images/bottle-mini.svg"}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h3 className="mt-3 truncate text-sm font-medium text-ink">{product.name}</h3>
            <p className="mt-1 text-sm font-semibold text-ink">{formatPrice(product.price)}</p>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function renderSection(id: ProductPageSectionId, context: SectionRenderContext, isFirstAccordion?: boolean) {
  if (!productPageSettings.sections[id]?.visible) return null;

  switch (id) {
    case "gallery":
      return <ProductGallery key={id} {...context} />;
    case "info":
      return <ProductInfo key={id} {...context} />;
    case "notes":
      return <NotesSection key={id} {...context} />;
    case "description":
    case "features":
    case "apply":
    case "ingredients":
      return <AccordionSection key={id} id={id} {...context} isFirstAccordion={isFirstAccordion} />;
    case "legal":
      return null;
    case "reviews":
      return <ReviewsSection key={id} {...context} />;
    case "related":
      return <RelatedProducts key={id} {...context} />;
    default:
      return null;
  }
}

export function ProductPage() {
  const [, params] = useRoute("/product/:slug");
  const slug = params?.slug ?? "";
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.product(slug),
    enabled: Boolean(slug),
    staleTime: 0,
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
  });

  const product = data?.product ?? null;
  const images = data?.images ?? [];
  const variants = data?.variants ?? product?.variants ?? [];
  const activeVariants = useMemo(() => (variants || []).filter((v) => v.is_active !== 0), [variants]);

  useEffect(() => {
    setSelectedImage(null);
  }, [selectedVariantId, slug]);

  useEffect(() => {
    if (activeVariants.length > 0) {
      if (!selectedVariantId || !activeVariants.some((v) => v.id === selectedVariantId)) {
        setSelectedVariantId(activeVariants[0].id);
      }
    } else {
      setSelectedVariantId(null);
    }
  }, [activeVariants, selectedVariantId]);

  const selectedVariant = useMemo(
    () => activeVariants.find((v) => v.id === selectedVariantId) ?? (activeVariants.length > 0 ? activeVariants[0] : null),
    [activeVariants, selectedVariantId],
  );

  const currentPrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0);
  const currentMrp = selectedVariant && selectedVariant.compare_price ? selectedVariant.compare_price : (product?.mrp ?? 0);
  const discount = currentMrp > currentPrice ? Math.round((1 - currentPrice / currentMrp) * 100) : 0;

  const variantImages = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images;
    }
    if (selectedVariant?.image) {
      return [selectedVariant.image];
    }
    return null;
  }, [selectedVariant]);

  const defaultGalleryImages = useMemo(() => {
    const ordered = images.map((img) => img.url).filter(Boolean);
    if (ordered.length > 0) return ordered;
    return product?.image ? [product.image] : [];
  }, [images, product?.image]);

  const galleryImages = variantImages ?? defaultGalleryImages;
  const defaultImage = galleryImages[0] ?? product?.image ?? "/images/bottle-mini.svg";
  const mainImage = selectedImage ?? defaultImage;

  useEffect(() => {
    if (!product) return;

    document.title = `${product.name} | EMBR Perfume`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", (product.description ?? "").substring(0, 160));

    const jsonLdId = "product-json-ld";
    let script = document.getElementById(jsonLdId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = jsonLdId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description ?? "",
      image: mainImage,
      offers: {
        "@type": "Offer",
        price: currentPrice,
        priceCurrency: "INR",
        availability:
          (selectedVariant ? selectedVariant.stock : ((product as Product & { stock?: number }).stock ?? 1)) > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    });

    return () => {
      document.title = "EMBR Perfume | Premium Long-Lasting Fragrances";
      script.remove();
    };
  }, [product, mainImage, currentPrice, selectedVariant]);

  if (!product) {
    if (isLoading) {
      return (
        <ShopLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink border-t-transparent"></div>
          </div>
        </ShopLayout>
      );
    }

    if (isError) {
      return (
        <ShopLayout>
          <div className="min-h-[60vh] flex items-center justify-center">
            <QueryErrorState
              title="Unable to load product details"
              message="Please check your internet connection and try again."
              onRetry={() => refetch()}
            />
          </div>
        </ShopLayout>
      );
    }
    
    return (
      <ShopLayout>
        <div className="mx-auto max-w-lg px-6 py-32 text-center">
          <h1 className="font-serif text-3xl text-ink">Product not found</h1>
          <Link href="/collections" className="mt-6 inline-block text-gold-deep hover:underline">
            Back to collections
          </Link>
        </div>
      </ShopLayout>
    );
  }

  const noteList = splitNotes(product.notes);
  const relatedProducts =
    productsData?.products
      ?.filter((item) => item.slug !== product.slug)
      .slice(0, 4) ?? [];

  const context: SectionRenderContext = {
    product,
    galleryImages,
    mainImage,
    selectedImage,
    setSelectedImage,
    quantity,
    setQuantity,
    relatedProducts,
    discount,
    noteList,
    activeVariants,
    selectedVariant,
    setSelectedVariantId,
    currentPrice,
    currentMrp,
  };

  const style = {
    "--product-container-width": productPageSettings.layout.containerWidth,
    "--section-gap": productPageSettings.layout.sectionGap,
    "--column-gap": productPageSettings.layout.columnGap,
    "--page-padding": productPageSettings.layout.padding,
    "--page-margin": productPageSettings.layout.margin,
    "--main-image-height": productPageSettings.layout.galleryMainImageHeight,
    "--mobile-image-height": productPageSettings.layout.galleryMobileImageHeight,
    "--gallery-image-width": productPageSettings.layout.galleryImageWidth,
    "--gallery-image-height": productPageSettings.layout.galleryImageHeight,
    "--thumb-size": productPageSettings.layout.thumbnailSize,
    "--radius-setting": productPageSettings.layout.borderRadius,
    "--shadow-setting": productPageSettings.layout.shadow,
    "--base-font-size": productPageSettings.layout.fontSize,
    "--base-font-weight": productPageSettings.layout.fontWeight,
    "--letter-spacing": productPageSettings.layout.letterSpacing,
    "--line-height": productPageSettings.layout.lineHeight,
    "--button-width": productPageSettings.layout.buttonWidth,
    "--button-height": productPageSettings.layout.buttonHeight,
  } as CSSProperties;

  const heroIds = productPageSettings.sectionOrder.filter((id) => id === "gallery" || id === "info");
  const bodyIds = productPageSettings.sectionOrder.filter((id) => id !== "gallery" && id !== "info");

  return (
    <ShopLayout promo={productPageSettings.text.promo}>
      <main
        className="mx-auto w-full px-[var(--page-padding)] pb-20 pt-5 text-[length:var(--base-font-size)] font-[var(--base-font-weight)] tracking-[var(--letter-spacing)]"
        style={{ ...style, maxWidth: "var(--product-container-width)", margin: "var(--page-margin) auto" }}
      >
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/collections";
            }
          }}
          className="mb-4 lg:mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted hover:text-gold-deep cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          {productPageSettings.text.backToCollections}
        </button>

        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-[var(--column-gap)]">
          {heroIds.map((id) => renderSection(id, context))}
        </div>

        {(() => {
          let hasRenderedAccordionHeader = false;
          return bodyIds.map((id) => {
            const isAccordion = id === "description" || id === "features" || id === "apply" || id === "ingredients";
            let isFirst = false;
            if (isAccordion) {
              if (!hasRenderedAccordionHeader) {
                isFirst = true;
                hasRenderedAccordionHeader = true;
              }
            }
            return renderSection(id, context, isFirst);
          });
        })()}
      </main>
    </ShopLayout>
  );
}
