import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "wouter";
import { Header } from "@/components/site/Header";
import { api, HeroBanner } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HERO_CACHE_KEY = "embr_hero_banners";

function getCachedBanners(): HeroBanner[] {
  try {
    const raw = sessionStorage.getItem(HERO_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function Hero() {
  const [banners, setBanners] = useState<HeroBanner[]>(getCachedBanners);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    api.getHeroBanners().then((res) => {
      setBanners(res.banners);
      try { sessionStorage.setItem(HERO_CACHE_KEY, JSON.stringify(res.banners)); } catch {}
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const nextSlide = () => setCurrent((c) => (c + 1) % banners.length);
  const prevSlide = () => setCurrent((c) => (c - 1 + banners.length) % banners.length);
  const goToSlide = (idx: number) => setCurrent(idx);

  if (banners.length === 0) {
    return (
      <>
        <Header variant="light" />
        <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden bg-page">
          <div className="absolute inset-0 flex items-center justify-center text-white/50">
            Loading Hero...
          </div>
        </section>
      </>
    );
  }

  const activeBanner = banners[current];
  const shopLink = activeBanner.productUrl || activeBanner.buttonLink;
  const showShopButton = activeBanner.showButton !== 0 && Boolean(shopLink);

  const imageStyle = (banner: HeroBanner) => ({
    "--hero-desktop-position": banner.imagePosition || "center center",
    "--hero-mobile-position": banner.mobileImagePosition || banner.imagePosition || "center center",
  }) as CSSProperties & Record<string, string>;

  return (
    <>
      <Header variant="light" />
      <section className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[calc(100svh-5rem)] w-full overflow-hidden bg-page group">

      {/* Background Images Carousel */}
      <div className="absolute inset-0 z-0">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              i === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <img
              src={b.imageUrl}
              alt={b.title || "Hero Banner"}
              fetchPriority={i === 0 ? "high" : "auto"}
              style={imageStyle(b)}
              className="h-full w-full object-cover [object-position:var(--hero-mobile-position)] md:[object-position:var(--hero-desktop-position)]"
            />
            {b.darkOverlay === 1 && (
              <div className="absolute inset-0 bg-black/25 sm:bg-gradient-to-r sm:from-black/55 sm:via-black/20 sm:to-transparent" />
            )}
          </div>
        ))}
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 mx-auto flex h-full sm:min-h-[calc(100svh-5rem)] max-w-7xl flex-col justify-center px-4 sm:px-6 md:px-10 py-4 sm:pb-16 sm:pt-16 pointer-events-none">
        {activeBanner.showText === 1 && (
          <div className="max-w-[min(90vw,34rem)] animate-fade-in space-y-1.5 sm:max-w-2xl sm:space-y-6 pointer-events-auto">
            {activeBanner.subtitle && (
              <p className="font-display text-[8px] sm:text-sm tracking-[0.2em] sm:tracking-[0.4em] text-gold-deep uppercase">
                {activeBanner.subtitle}
              </p>
            )}
            
            {activeBanner.title && (
              <h1 className="font-serif text-3xl leading-[1.05] text-white sm:text-6xl md:text-7xl lg:text-8xl drop-shadow-lg">
                <span dangerouslySetInnerHTML={{ __html: activeBanner.title.replace(/\*(.*?)\*/g, '<em class="italic text-gold-deep">$1</em>') }} />
              </h1>
            )}
            
            {activeBanner.description && (
              <p className="max-w-[85vw] text-[11px] leading-snug text-gray-100 sm:max-w-md sm:text-lg sm:leading-relaxed drop-shadow-md">
                {activeBanner.description}
              </p>
            )}

            {activeBanner.productName && (
              <p className="font-display text-[8px] tracking-[0.2em] text-white/85 uppercase sm:text-sm sm:tracking-[0.25em]">
                {activeBanner.productName}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:pt-6 sm:flex-row">
              {showShopButton && (
                 shopLink.startsWith("/") ? (
                   <Link href={shopLink}>
                    <button className="min-h-10 w-auto rounded-full bg-gradient-gold px-5 py-2 text-[11px] font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                      {activeBanner.buttonText || "Shop Now"}
                    </button>
                   </Link>
                 ) : (
                   <a href={shopLink} target="_blank" rel="noopener noreferrer">
                    <button className="min-h-10 w-auto rounded-full bg-gradient-gold px-5 py-2 text-[11px] font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                      {activeBanner.buttonText || "Shop Now"}
                    </button>
                   </a>
                 )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Sliding Controls */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/30 text-white backdrop-blur-md transition-opacity hover:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/30 text-white backdrop-blur-md transition-opacity hover:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          
          {/* Dots Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-8 bg-gold-deep" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Floating Badge (Only shows if there's text displayed) */}
      {activeBanner.badge && activeBanner.showText === 1 && (
        <span className="absolute right-6 top-10 z-10 rotate-12 rounded-full bg-gradient-gold px-3 sm:px-4 py-1.5 font-display text-[9px] sm:text-xs tracking-widest text-charcoal shadow-gold animate-float hidden sm:block">
          {activeBanner.badge}
        </span>
      )}
      </section>
    </>
  );
}
