import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSiteContent } from "@/hooks/use-site-content";
import { api, FooterColumn } from "@/lib/api";
import { SITE_LOGO, SITE_NAME } from "@/lib/site-brand";

const FOOTER_CACHE_KEY = "embr_footer_columns";

function getCachedFooter(): FooterColumn[] {
  try {
    const raw = sessionStorage.getItem(FOOTER_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function Footer() {
  const { getVal } = useSiteContent();
  const [columns, setColumns] = useState<FooterColumn[]>(getCachedFooter);

  useEffect(() => {
    api.getFooter()
      .then((res) => {
        setColumns(res.columns);
        try { sessionStorage.setItem(FOOTER_CACHE_KEY, JSON.stringify(res.columns)); } catch {}
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-border-light bg-page pt-12 pb-8 md:pt-20">
      <div className="mx-auto grid max-w-7xl grid-cols-3 gap-8 px-6 md:grid-cols-4 md:px-10">
        {/* Brand column - always first */}
        <div className="col-span-3 md:col-span-1">
          <img
            src={getVal("site_logo", SITE_LOGO)}
            alt={getVal("site_name", SITE_NAME)}
            className="mb-2 h-10 w-auto object-contain"
          />
          <p className="mt-4 max-w-xs text-sm text-ink-muted leading-relaxed">
            {getVal("footer_tagline", "Luxury fragrances forged from fire, forest, petals, and the patience of time.")}
          </p>
        </div>

        {/* Dynamic columns */}
        {columns.map((col) => (
          <div key={col.id}>
            <h4 className="font-display text-sm tracking-[0.3em] text-gold-deep">{col.title}</h4>
            <ul className="mt-5 space-y-3 text-sm text-ink">
              {col.links.map((link) => {
                const isExternal = link.url.startsWith("http");
                return (
                  <li key={link.id}>
                    {isExternal ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gold-deep transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.url} className="hover:text-gold-deep transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-border-light px-6 pt-6 text-xs text-ink-muted md:flex-row md:px-10">
        <span>{getVal("footer_copyright", "© 2026 Embr Parfums. All rights reserved.")}</span>
        <span className="tracking-widest">{getVal("footer_slogan", "— SCENT THE UNSEEN —")}</span>
      </div>
    </footer>
  );
}
