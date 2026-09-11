import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import "./index.css";

// Purge obsolete legacy caches on app startup so users never see outdated content
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("embr_admin_products_v2");
    localStorage.removeItem("embr_hero_banners_v2");
    sessionStorage.removeItem("embr_about_banner");
  } catch {}

  // Unregister any legacy Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }

  // Clear any legacy CacheStorage
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always consider query data stale so fresh server responses are retrieved
      gcTime: 5 * 60 * 1000,
      retry: 1, // Retry at most once on failure before showing error state
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
