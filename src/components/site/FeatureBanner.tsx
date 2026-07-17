import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useSiteContent } from "@/hooks/use-site-content";

const bottleEmber = "/images/bottle-forest.svg";

export function FeatureBanner() {
  const { add } = useCart();
  const { getVal, isHidden } = useSiteContent();
  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
  });
  const featured = data?.products.find((p) => p.slug === "ember-oud");

  if (isHidden("section_banner")) return null;

  return (
    <section className="relative overflow-hidden bg-page py-16 md:py-32">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="font-display leading-none select-none whitespace-nowrap"
          style={{
            fontSize: "24vw",
            color: "transparent",
            WebkitTextStroke: "2px rgba(176,138,74,0.15)",
          }}
        >
          EMBR
        </span>
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 md:grid-cols-2 md:px-10">
        <div className="space-y-6">
          <p className="reveal font-display text-xs tracking-[0.4em] text-gold-deep">
            {getVal("banner_eyebrow", "— BESTSELLER")}
          </p>
          <h2 className="reveal font-serif text-4xl leading-[1] text-ink sm:text-5xl md:text-7xl">
            {getVal("banner_title1", "Ember ")}<em className="text-gold-deep">{getVal("banner_em", "Oud")}</em>
            <br />
            {getVal("banner_title2", "in a Bottle")}
          </h2>
          <p className="reveal max-w-md text-ink-muted leading-relaxed">
            {getVal("banner_desc", "Smoky oud wrapped in warm amber resin. A true classic.")}
          </p>
          <div className="reveal flex flex-wrap items-baseline gap-3 pt-2 sm:gap-4">
            <span className="font-display text-4xl text-gold-deep sm:text-5xl">₹399</span>
            <span className="text-ink-muted/60 line-through">₹699</span>
            <span className="rounded-full bg-gold-deep/15 px-3 py-1 text-xs tracking-widest text-gold-deep">
              SAVE 44%
            </span>
          </div>
          <div className="reveal flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (featured) {
                  add(featured);
                  toast.success("Ember Oud added to bag");
                }
              }}
              className="rounded-full border-2 border-ink bg-ink px-10 py-4 font-medium tracking-widest text-parchment transition-all hover:scale-[1.03] hover:bg-ink/90"
            >
              {getVal("banner_btn", "ORDER NOW")}
            </button>
            <Link
              href="/product/ember-oud"
              className="text-sm tracking-widest text-gold-deep hover:underline"
            >
              View details →
            </Link>
          </div>
        </div>

        <div className="relative flex h-[280px] items-center justify-center rounded-2xl bg-forest-deep/5 sm:h-[360px] md:h-[460px]">
          <div className="absolute h-[200px] w-[200px] rounded-full bg-gold/20 blur-3xl animate-glow sm:h-[280px] sm:w-[280px] md:h-[340px] md:w-[340px]" />
          <img
            src={bottleEmber}
            alt="Ember Oud perfume"
            width={420}
            height={520}
            className="relative z-10 h-[280px] w-auto object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.25)] md:h-[360px] animate-float"
          />
          <span className="absolute right-4 top-6 z-20 rotate-12 rounded-full bg-gradient-gold px-4 py-2 font-display text-xs tracking-widest text-charcoal">
            {getVal("banner_badge", "NEW")}
          </span>
        </div>
      </div>
    </section>
  );
}
