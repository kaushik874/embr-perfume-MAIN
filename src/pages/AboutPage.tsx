import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { api } from "@/lib/api";

type AboutBanner = {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  showText: number;
  isActive: number;
  darkOverlay: number;
  buttonText: string;
  buttonLink: string;
  showButton: number;
};

export function AboutPage() {
  const [banner, setBanner] = useState<AboutBanner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAboutBanner()
      .then((res) => setBanner(res.banner ?? null))
      .catch(() => setBanner(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main>
        <Header variant="light" />
        <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden bg-black">
          <div className="absolute inset-0 flex items-center justify-center text-white/50">
            Loading...
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  if (!banner || !banner.isActive) {
    return (
      <main>
        <Header variant="light" />
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24 text-center min-h-[calc(100svh-5rem)]">
          <p className="font-display text-xs tracking-[0.4em] text-gold-deep">— OUR STORY</p>
          <h1 className="mt-4 font-serif text-4xl text-ink md:text-5xl">Embr Parfums</h1>
          <p className="mt-6 max-w-xl mx-auto text-ink-muted leading-relaxed">
            Embr Parfums crafts luxury fragrances inspired by memory, mood, and the quiet moments between day and night.
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  const hasBannerImage = Boolean(banner.imageUrl);

  return (
    <main>
      <Header variant="light" />
      <section className="relative min-h-[calc(100svh-5rem)] w-full overflow-hidden bg-white group">
        
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 opacity-100">
            {hasBannerImage && (
              <img
                src={banner.imageUrl}
                alt={banner.title || "Our Story"}
                style={{ objectFit: "cover", objectPosition: "center center" }}
                className="h-full w-full"
              />
            )}
            {banner.darkOverlay === 1 && hasBannerImage && (
              <div className="absolute inset-0 bg-black/25 sm:bg-gradient-to-r sm:from-black/55 sm:via-black/20 sm:to-transparent" />
            )}
          </div>
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 mx-auto flex h-full min-h-[calc(100svh-5rem)] max-w-7xl flex-col justify-center px-5 sm:px-6 md:px-10 pb-20 pt-10 sm:pb-16 sm:pt-16 pointer-events-none">
          {banner.showText === 1 && (
            <div className="max-w-[min(86vw,34rem)] animate-fade-in space-y-2.5 sm:max-w-2xl sm:space-y-6 pointer-events-auto">
              {banner.subtitle && (
                <p className="font-display text-[9px] sm:text-sm tracking-[0.22em] sm:tracking-[0.4em] text-gold-deep uppercase">
                  {banner.subtitle}
                </p>
              )}
              
              {banner.title && (
                <h1 className="font-serif text-[clamp(2rem,12vw,3.5rem)] leading-[1.05] drop-shadow-lg text-white">
                  <span dangerouslySetInnerHTML={{ __html: banner.title.replace(/\*(.*?)\*/g, '<em class="italic text-gold-deep">$1</em>') }} />
                </h1>
              )}
              
              {banner.description && (
                <p className="max-w-[72vw] text-sm leading-relaxed sm:max-w-md sm:text-lg drop-shadow-md text-gray-100">
                  {banner.description}
                </p>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:pt-6 sm:flex-row">
                {banner.showButton === 1 && banner.buttonLink && (
                  banner.buttonLink.startsWith("/") ? (
                    <Link href={banner.buttonLink}>
                      <button className="min-h-12 w-auto max-w-[calc(100vw-3rem)] rounded-full bg-gradient-gold px-7 py-3 text-sm font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                        {banner.buttonText || "Shop Now"}
                      </button>
                    </Link>
                  ) : (
                    <a href={banner.buttonLink} target="_blank" rel="noopener noreferrer">
                      <button className="min-h-12 w-auto max-w-[calc(100vw-3rem)] rounded-full bg-gradient-gold px-7 py-3 text-sm font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                        {banner.buttonText || "Shop Now"}
                      </button>
                    </a>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

