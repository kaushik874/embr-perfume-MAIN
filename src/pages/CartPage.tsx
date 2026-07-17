import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

export function CartPage() {
  const { items, total, setQuantity, remove, syncProducts } = useCart();
  const [, setLocation] = useLocation();

  useEffect(() => {
    void syncProducts();
  }, [syncProducts]);

  if (items.length === 0) {
    return (
      <ShopLayout promo="Your bag is waiting — explore the collection">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="font-display text-xs tracking-[0.4em] text-gold-deep">— YOUR BAG</p>
          <h1 className="mt-3 font-serif text-4xl text-ink">Empty for now</h1>
          <p className="mt-4 text-ink-muted">Discover Milky Way and the full Embr edit.</p>
          <Link href="/product/milky-way">
            <Button className="mt-8 rounded-full border-2 border-ink bg-transparent px-10 tracking-widest text-ink hover:bg-ink hover:text-white">
              SHOP MILKY WAY
            </Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout promo="Free shipping on orders above ₹999">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">— YOUR BAG</p>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl md:text-5xl">
          {items.length} item{items.length > 1 ? "s" : ""}
        </h1>

        <ul className="mt-10 divide-y divide-border-light">
          {items.map(({ product, quantity }) => (
            <li key={product.slug} className="flex gap-4 py-6 sm:gap-5">
              <Link href={`/product/${product.slug}`} className="shrink-0">
                <img
                  src={product.image ?? "/images/bottle-mini.svg"}
                  alt={product.name}
                  className="h-24 w-16 object-contain transition-opacity hover:opacity-80 sm:h-28 sm:w-20"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/images/bottle-mini.svg";
                  }}
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="min-w-0">
                  <Link href={`/product/${product.slug}`}>
                    <h2 className="font-serif text-lg text-ink hover:text-gold-deep sm:text-xl">
                      {product.name}
                    </h2>
                  </Link>
                  <p className="text-xs tracking-widest text-ink-muted uppercase">
                    {product.notes}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 justify-between sm:mt-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(product.slug, quantity - 1)}
                      className="rounded-full border border-border-light p-1.5 hover:border-gold-deep"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(product.slug, quantity + 1)}
                      className="rounded-full border border-border-light p-1.5 hover:border-gold-deep"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display text-xl text-gold-deep">
                      ₹{product.price * quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => remove(product.slug)}
                      className="text-ink-muted hover:text-rose-deep"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-center justify-between border-t border-border-light pt-8">
          <span className="font-display text-sm tracking-widest text-ink-muted">TOTAL</span>
          <span className="font-display text-3xl text-gold-deep">₹{total}</span>
        </div>

        <Button
          className="mt-8 w-full rounded-full border-2 border-ink bg-ink py-6 text-lg tracking-[0.15em] text-white hover:bg-ink/90"
          onClick={() => setLocation("/checkout")}
        >
          PROCEED TO CHECKOUT
        </Button>
      </div>
    </ShopLayout>
  );
}
