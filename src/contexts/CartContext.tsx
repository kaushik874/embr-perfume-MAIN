import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Product, type ProductVariant } from "@/lib/api";

export type CartItem = {
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: Product, qty?: number, variant?: ProductVariant | null) => void;
  remove: (productSlug: string, variantId?: number | null) => void;
  setQuantity: (productSlug: string, quantity: number, variantId?: number | null) => void;
  clear: () => void;
  syncProducts: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "embr-cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback(
    (product: Product, qty = 1, variant?: ProductVariant | null) => {
      setItems((prev) => {
        const vId = variant?.id ?? null;
        const existing = prev.find(
          (i) => i.product.slug === product.slug && (i.variant?.id ?? null) === vId,
        );
        let next: CartItem[];
        if (existing) {
          next = prev.map((i) =>
            i.product.slug === product.slug && (i.variant?.id ?? null) === vId
              ? { ...i, quantity: Math.min(10, i.quantity + qty) }
              : i,
          );
        } else {
          next = [...prev, { product, variant: variant ?? null, quantity: qty }];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const remove = useCallback((productSlug: string, variantId?: number | null) => {
    setItems((prev) => {
      const vId = variantId ?? null;
      const next = prev.filter(
        (i) => !(i.product.slug === productSlug && (i.variant?.id ?? null) === vId),
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setQuantity = useCallback(
    (productSlug: string, quantity: number, variantId?: number | null) => {
      if (quantity < 1) {
        remove(productSlug, variantId);
        return;
      }
      setItems((prev) => {
        const vId = variantId ?? null;
        const next = prev.map((i) =>
          i.product.slug === productSlug && (i.variant?.id ?? null) === vId
            ? { ...i, quantity: Math.min(10, quantity) }
            : i,
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [remove],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const syncProducts = useCallback(async () => {
    try {
      const { products } = await api.products();
      setItems((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map((item) => {
          const fresh = products.find((p) => p.slug === item.product.slug);
          if (!fresh) return item;
          let freshVariant = item.variant;
          if (item.variant && fresh.variants) {
            const matchedVariant = fresh.variants.find((v) => v.id === item.variant?.id);
            if (matchedVariant) {
              freshVariant = matchedVariant;
            }
          }
          return { ...item, product: fresh, variant: freshVariant };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      /* keep cached cart */
    }
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      void syncProducts();
    }
  }, [items.length, syncProducts]);

  const count = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items],
  );

  const total = useMemo(
    () =>
      items.reduce((s, i) => {
        const price = i.variant ? i.variant.price : i.product.price;
        return s + price * i.quantity;
      }, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{ items, count, total, add, remove, setQuantity, clear, syncProducts }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
