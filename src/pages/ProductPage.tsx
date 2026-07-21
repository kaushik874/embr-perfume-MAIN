import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ChevronDown, ChevronLeft, ChevronUp, Minus, Plus, Star, Heart } from "lucide-react";
import { api, type Product } from "@/lib/api";
import { getCatalogProduct } from "@/lib/catalog";
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
  setSelectedImage: (url: string) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  relatedProducts: Product[];
  discount: number;
  noteList: string[];
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
  const [open, setOpen] = useState(Boolean(item.defaultOpen));

  return (
    <div className="border-b border-border-light first:border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-6 text-left font-display text-xl uppercase text-ink transition-colors hover:text-gold-deep"
        style={{
          minHeight: productPageSettings.layout.accordionHeight,
          paddingBlock: productPageSettings.layout.accordionPadding,
        }}
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
          open ? "max-h-[1400px] pb-8 opacity-100" : "max-h-0 opacity-0"
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
  mainImage,
  selectedImage,
  setSelectedImage,
}: SectionRenderContext) {
  const hasThumbnails = galleryImages.length > 1;

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
              const active = (selectedImage ?? galleryImages[0]) === url;
              return (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(url)}
                  className={`shrink-0 overflow-hidden rounded-[var(--radius-setting)] border bg-white transition-colors ${
                    active ? "border-ink" : "border-border-light hover:border-ink/50"
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

        <div className="order-1 flex min-h-[var(--mobile-image-height)] items-center justify-center overflow-hidden rounded-[var(--radius-setting)] border border-border-light bg-[#f7f7f5] lg:order-2 lg:min-h-[var(--main-image-height)]">
          <img
            src={mainImage}
            alt={product.name}
            fetchPriority="high"
            decoding="async"
            className="h-[var(--gallery-image-height)] w-[var(--gallery-image-width)] object-cover"
          />
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
          <span className="text-4xl font-semibold text-ink">{formatPrice(product.price)}</span>
          {product.mrp > product.price ? (
            <span className="pb-1 text-base text-ink-muted line-through">
              {formatPrice(product.mrp)}
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
            onClick={() => {
              add(product, quantity);
              toast.success(`${product.name} added to cart`);
            }}
            className="h-[var(--button-height)] w-[var(--button-width)] bg-ink px-8 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-gold-deep sm:flex-1"
          >
            {productPageSettings.text.addToCart} - {formatPrice(product.price * quantity)}
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
}: SectionRenderContext & { id: ProductAccordion["id"] }) {
  const item = productPageSettings.accordions.find((accordion) => accordion.id === id);
  if (!item?.visible) return null;

  const fallbackById: Partial<Record<ProductAccordion["id"], string | null | undefined>> = {
    description: product.description,
    features: product.key_features,
    apply: product.how_to_apply,
    legal: product.legal_information,
  };

  const fallback = fallbackById[id];
  if (!fallback && !item.content && !item.html && !item.bullets?.length) return null;

  return (
    <SectionShell>
      <AccordionItem item={item}>
        <RichContent item={item} fallback={fallback} />
      </AccordionItem>
    </SectionShell>
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

function renderSection(id: ProductPageSectionId, context: SectionRenderContext) {
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
    case "legal":
      return <AccordionSection key={id} id={id} {...context} />;
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

  const catalogProduct = getCatalogProduct(slug);

  const { data } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.product(slug),
    enabled: Boolean(slug),
    placeholderData: catalogProduct ? { product: catalogProduct } : undefined,
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
  });

  const product = data?.product ?? catalogProduct;
  const images = data?.images ?? [];

  const galleryImages = useMemo(() => {
    const ordered = images.map((img) => img.url).filter(Boolean);
    if (ordered.length > 0) return ordered;
    return product?.image ? [product.image] : [];
  }, [images, product?.image]);

  const mainImage = selectedImage ?? galleryImages[0] ?? "/images/bottle-mini.svg";

  useEffect(() => {
    if (!product) return;

    document.title = `${product.name} | Embr Parfums`;

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
        price: product.price,
        priceCurrency: "INR",
        availability:
          ((product as Product & { stock?: number }).stock ?? 1) > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    });

    return () => {
      document.title = "Embr Parfums";
      script.remove();
    };
  }, [product, mainImage]);

  if (!product) {
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

  const discount = product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;
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
        <Link
          href="/collections"
          className="mb-4 lg:mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted hover:text-gold-deep"
        >
          <ChevronLeft className="h-4 w-4" />
          {productPageSettings.text.backToCollections}
        </Link>

        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-[var(--column-gap)]">
          {heroIds.map((id) => renderSection(id, context))}
        </div>

        {bodyIds.map((id) => renderSection(id, context))}
      </main>
    </ShopLayout>
  );
}
