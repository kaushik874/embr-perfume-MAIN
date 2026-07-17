import { useState } from "react";
import { Link } from "wouter";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { siteNavItems } from "@/lib/site-nav";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/hooks/use-site-content";
import { SITE_LOGO, SITE_NAME } from "@/lib/site-brand";

type SiteMenuProps = {
  variant?: "dark" | "light";
};

export function SiteMenu({ variant = "light" }: SiteMenuProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { getVal } = useSiteContent();
  const isLight = variant === "light";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className={cn(
            "rounded-md p-2 transition-colors hover:opacity-80",
            isLight ? "text-ink" : "text-cream",
          )}
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(100vw,320px)] border-border-light bg-page">
        <SheetHeader className="border-b border-border-light pb-6 text-left">
          <SheetTitle className="font-display text-2xl tracking-widest text-ink">
            <img
              src={getVal("site_logo", SITE_LOGO)}
              alt={getVal("site_name", SITE_NAME)}
              className="h-8 object-contain"
            />
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {siteNavItems.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 font-display text-sm tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/10 hover:text-gold-deep"
            >
              {item.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 font-display text-sm tracking-[0.2em] text-gold-deep bg-gold-deep/5 transition-colors hover:bg-gold-deep/10"
            >
              ADMIN PANEL
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
