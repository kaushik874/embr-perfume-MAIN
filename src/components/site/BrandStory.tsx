import { Link } from "wouter";
import { useSiteContent } from "@/hooks/use-site-content";

export function BrandStory() {
  const { getVal, isHidden } = useSiteContent();

  const stats = [
    { n: getVal("story_stat_1_n", "12"), l: getVal("story_stat_1_l", "Rare Notes") },
    { n: getVal("story_stat_2_n", "90"), l: getVal("story_stat_2_l", "Days Aged") },
    { n: getVal("story_stat_3_n", "18%"), l: getVal("story_stat_3_l", "Oil Purity") },
    { n: getVal("story_stat_4_n", "50K+"), l: getVal("story_stat_4_l", "Happy Souls") },
  ];

  if (isHidden("section_story")) return null;

  const storyImage = getVal("story_image", "");
  const showBgImage = getVal("story_show_bg_image", "0");
  const isHeroMode = storyImage && showBgImage === "1";

  const darkOverlayEnabled = getVal("story_dark_overlay", "1") !== "0";
  const buttonText = getVal("story_btn_text", "");
  const buttonLink = getVal("story_btn_link", "");
  const showButton = getVal("story_show_button", "0") === "1" && buttonText && buttonLink;

  /* ─── HERO MODE (full-bleed image) ─── */
  if (isHeroMode) {
    return (
      <section id="story" className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[calc(100svh-5rem)] w-full overflow-hidden bg-black group">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            src={storyImage}
            alt={getVal("story_heading", "Our Story")}
            style={{ objectPosition: "center center" }}
            className="h-full w-full object-cover"
          />
          {darkOverlayEnabled && (
            <div className="absolute inset-0 bg-black/25 sm:bg-gradient-to-r sm:from-black/55 sm:via-black/20 sm:to-transparent" />
          )}
        </div>

        {/* Content overlay */}
        <div className="relative z-10 mx-auto flex h-full sm:min-h-[calc(100svh-5rem)] max-w-7xl flex-col justify-center px-4 sm:px-6 md:px-10 py-4 sm:pb-16 sm:pt-16 pointer-events-none">
          <div className="max-w-[min(90vw,34rem)] animate-fade-in space-y-1.5 sm:max-w-2xl sm:space-y-6 pointer-events-auto">
            <p className="font-display text-[8px] sm:text-sm tracking-[0.2em] sm:tracking-[0.4em] text-gold-deep uppercase">
              {getVal("story_eyebrow", "— OUR STORY")}
            </p>

            <h2 className="font-serif text-3xl leading-[1.05] text-white drop-shadow-lg">
              {getVal("story_heading", "Crafted in shadow.")}
              {getVal("story_em", "") && (
                <><br /><em className="italic text-gold-deep">{getVal("story_em", "Worn in light.")}</em></>
              )}
            </h2>

            {getVal("story_body1", "") && (
              <p className="max-w-[85vw] text-[11px] leading-snug sm:max-w-md sm:text-lg sm:leading-relaxed drop-shadow-md text-gray-100">
                {getVal("story_body1", "Embr began in a small atelier on the edge of a cedar forest.")}
              </p>
            )}

            {getVal("story_body2", "") && (
              <p className="max-w-[85vw] text-[11px] leading-snug sm:max-w-md sm:text-base sm:leading-relaxed drop-shadow-md text-gray-200">
                {getVal("story_body2", "")}
              </p>
            )}

            {showButton && (
              <div className="flex flex-col gap-3 pt-2 sm:pt-6 sm:flex-row">
                {buttonLink.startsWith("/") ? (
                  <Link href={buttonLink}>
                    <button className="min-h-10 w-auto rounded-full bg-gradient-gold px-5 py-2 text-[11px] font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                      {buttonText}
                    </button>
                  </Link>
                ) : (
                  <a href={buttonLink} target="_blank" rel="noopener noreferrer">
                    <button className="min-h-10 w-auto rounded-full bg-gradient-gold px-5 py-2 text-[11px] font-medium tracking-wide text-charcoal shadow-gold transition-all hover:scale-[1.03] sm:min-h-14 sm:px-8 sm:py-4 sm:text-base">
                      {buttonText}
                    </button>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ─── DEFAULT MODE (original card layout) ─── */
  return (
    <section id="story" className="bg-page py-16 md:py-32">
      {/* Optional background image (non-fullscreen) */}
      {storyImage && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${storyImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 sm:px-6 md:grid-cols-2 md:gap-16 md:px-10">
        <div className="reveal space-y-6">
          <p className="font-display text-xs tracking-[0.4em] text-gold-deep">{getVal("story_eyebrow", "— OUR STORY")}</p>
          <h2 className="font-serif text-4xl text-ink md:text-6xl leading-[1.05]">
            {getVal("story_heading", "Crafted in shadow.")}<br /><em className="text-gold-deep">{getVal("story_em", "Worn in light.")}</em>
          </h2>
          <p className="text-ink-muted leading-relaxed">
            {getVal("story_body1", "Embr began in a small atelier on the edge of a cedar forest. We believed fragrance should be felt before it is smelled — a presence, a memory, a whisper that lingers long after you've left the room.")}
          </p>
          <p className="text-ink-muted leading-relaxed">
            {getVal("story_body2", "Every batch is hand-blended in small lots and aged in oak for ninety nights before bottling.")}
          </p>

          <div className="grid grid-cols-2 gap-6 pt-6">
            {stats.map((s) => (
              <div key={s.l} className="border-l-2 border-gold-deep pl-4">
                <div className="font-display text-4xl text-ink">{s.n}</div>
                <div className="mt-1 text-xs tracking-widest text-ink-muted uppercase">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal relative aspect-[4/5] overflow-hidden rounded-2xl border border-border-light bg-[#fafafa] flex flex-col items-center justify-center gap-8 p-8 md:p-12">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span
              className="font-display select-none"
              style={{
                fontSize: "min(28vw, 16rem)",
                color: "transparent",
                WebkitTextStroke: "2px rgba(176,138,74,0.20)",
              }}
            >
              E
            </span>
          </div>
          <div className="relative z-10 text-center space-y-6">
            <div className="mx-auto h-px w-24 bg-gold-deep" />
            <p className="font-display text-xs tracking-[0.5em] text-gold-deep">{getVal("story_card_eyebrow", "— EST. 2024")}</p>
            <p className="font-serif text-4xl text-ink md:text-5xl leading-tight">
              {getVal("story_card_title", "For the")}<br /><em className="text-gold-deep">{getVal("story_card_em", "unseen souls.")}</em>
            </p>
            <div className="mx-auto h-px w-24 bg-gold-deep" />
            <p className="text-sm text-ink-muted tracking-widest uppercase">{getVal("story_card_footer", "Oak Aged · Hand Blended · Small Batch")}</p>
          </div>
          <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-gold-deep/40" />
          <div className="absolute right-10 top-10 h-8 w-8 rounded-full bg-gold-deep/20" />
          <div className="absolute left-6 bottom-6 h-12 w-12 rounded-full border border-gold-deep/30" />
        </div>
      </div>
    </section>
  );
}
