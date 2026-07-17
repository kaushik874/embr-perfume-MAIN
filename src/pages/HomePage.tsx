import { Hero } from "@/components/site/Hero";
import { Collection } from "@/components/site/Collection";
import { FeatureBanner } from "@/components/site/FeatureBanner";
import { TrustStrip } from "@/components/site/TrustStrip";
import { BrandStory } from "@/components/site/BrandStory";
import { Footer } from "@/components/site/Footer";
import { useReveal } from "@/hooks/use-reveal";

export function HomePage() {
  useReveal();
  return (
    <main>
      <Hero />
      <Collection />
      <TrustStrip />
      <FeatureBanner />
      <BrandStory />
      <Footer />
    </main>
  );
}
