import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Product } from "@/lib/api";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: Product, qty?: number) => void;
  remove: (productSlug: string) => void;
  setQuantity: (productSlug: string, quantity: number) => void;
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
    (product: Product, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.product.slug === product.slug);
        let next: CartItem[];
        if (existing) {
          next = prev.map((i) =>
            i.product.slug === product.slug
              ? { ...i, quantity: Math.min(10, i.quantity + qty) }
              : i,
          );
        } else {
          next = [...prev, { product, quantity: qty }];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const remove = useCallback((productSlug: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.product.slug !== productSlug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setQuantity = useCallback(
    (productSlug: string, quantity: number) => {
      if (quantity < 1) {
        remove(productSlug);
        return;
      }
      setItems((prev) => {
        const next = prev.map((i) =>
          i.product.slug === productSlug
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
          return fresh ? { ...item, product: fresh } : item;
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
    () => items.reduce((s, i) => s + i.product.price * i.quantity, 0),
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
