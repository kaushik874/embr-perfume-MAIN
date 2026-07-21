import type { ReactNode } from "react";
import { Header } from "@/components/site/Header";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/hooks/use-site-content";

type ShopLayoutProps = {
  children: ReactNode;
  promo?: string;
  className?: string;
};

/** White shop pages: product, cart, checkout, login, account */
export function ShopLayout({ children, promo, className }: ShopLayoutProps) {
  const { getVal, isHidden } = useSiteContent();
  const globalPromo = getVal("promo_banner", "");
  const isPromoHidden = isHidden("section_promo");
  
  const displayPromo = !isPromoHidden && (globalPromo || promo);

  return (
    <div className={cn("min-h-screen bg-page text-ink flex flex-col", className)}>
      {displayPromo && (
        <div className="bg-gradient-gold px-4 py-2.5 text-center text-xs font-medium tracking-wide text-charcoal">
          {displayPromo}
        </div>
      )}
      <Header variant="light" />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
