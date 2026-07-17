export type SiteNavItem = {
  label: string;
  href: string;
};

export const siteNavItems: SiteNavItem[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/collections" },
  { label: "Your Bag", href: "/cart" },
  { label: "About", href: "/about" },
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Privacy Policy", href: "/policy" },
  { label: "FAQ", href: "/faq" },
  { label: "Orders", href: "/account" },
];
