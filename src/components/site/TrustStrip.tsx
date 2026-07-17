import { useSiteContent } from "@/hooks/use-site-content";

export function TrustStrip() {
  const { getVal, isHidden } = useSiteContent();
  const items = [
    { icon: "◷", title: getVal("trust_1_title", "Long Lasting"), sub: getVal("trust_1_sub", "8–10 hours wear") },
    { icon: "✦", title: getVal("trust_2_title", "Premium Oil"), sub: getVal("trust_2_sub", "18% concentration") },
    { icon: "→", title: getVal("trust_3_title", "Free Shipping"), sub: getVal("trust_3_sub", "On all orders") },
    { icon: "↻", title: getVal("trust_4_title", "7 Day Returns"), sub: getVal("trust_4_sub", "No questions asked") },
  ];

  if (isHidden("section_trust")) return null;

  return (
    <section className="border-y border-border-light bg-page py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 md:grid-cols-4 md:gap-8 md:px-10">
        {items.map((it) => (
          <div key={it.title} className="reveal flex items-center gap-3 sm:gap-4">
            <span className="text-2xl text-gold-deep sm:text-3xl">{it.icon}</span>
            <div>
              <p className="text-xs tracking-widest text-ink uppercase sm:text-sm">{it.title}</p>
              <p className="text-xs text-ink-muted">{it.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
