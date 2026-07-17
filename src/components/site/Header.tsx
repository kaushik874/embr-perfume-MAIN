import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { SiteMenu } from "@/components/site/SiteMenu";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/hooks/use-site-content";
import { SITE_LOGO, SITE_NAME } from "@/lib/site-brand";

type HeaderProps = {
  variant?: "dark" | "light";
  className?: string;
};

export function Header({ variant = "dark", className }: HeaderProps) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { getVal } = useSiteContent();
  const isLight = variant === "light";
  const text = isLight ? "text-ink" : "text-cream";
  const muted = isLight ? "text-ink-muted" : "text-cream/70";
  const brand = isLight ? "text-ink" : "text-gold";
  const siteName = getVal("site_name", SITE_NAME);

  const [location] = useLocation();
  const isCheckout = location.startsWith("/checkout");

  return (
    <header
      className={cn(
        "relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:gap-4 sm:px-6 md:px-10",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SiteMenu variant={variant} />
        <Link href="/" className={cn("flex items-center", brand)}>
          <img
            src={getVal("site_logo", SITE_LOGO)}
            alt={siteName}
            className="h-8 w-auto object-contain"
          />
        </Link>
      </div>

      {!isCheckout && (
        <div className={cn("flex items-center gap-4 text-sm", text)}>
          {user && (
            <>
              <span className={cn("hidden sm:inline", muted)}>{user.name}</span>
              {user.role === "admin" && (
                <Link href="/admin" className={cn("hidden sm:inline hover:text-gold transition-colors font-medium")}>
                  Admin
                </Link>
              )}
              <Link href="/account" className={cn("hidden sm:inline hover:opacity-80 transition-opacity", muted)}>
                Orders
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className={cn("hidden sm:inline hover:opacity-80 transition-opacity", muted)}
              >
                Logout
              </button>
            </>
          )}
          <Link
            href="/cart"
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors sm:px-4 sm:py-1.5 sm:text-sm",
              isLight
                ? "border-ink/20 hover:border-gold hover:text-gold"
                : "border-cream/25 hover:border-gold hover:text-gold",
            )}
          >
            Bag ({count})
          </Link>
        </div>
      )}
    </header>
  );
}
