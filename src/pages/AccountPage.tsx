import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MapPin, PackageCheck, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Order } from "@/lib/api";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { useQuery } from "@tanstack/react-query";

export function AccountPage() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
  });

  const allProducts = productsData?.products ?? [];
  const wishlistedProducts = allProducts.filter((p: any) => isWishlisted(p.id));

  useEffect(() => {
    if (!loading && !user) setLocation("/");
  }, [loading, user, setLocation]);

  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    api.orders()
      .then((r) => {
        setOrders(r.orders);
        setOrdersError(null);
      })
      .catch((err) => setOrdersError(err.message || "Failed to load orders."))
      .finally(() => setOrdersLoading(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <ShopLayout promo="Your orders and account profile">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="flex flex-col gap-5 border-b border-border-light pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-xs tracking-[0.4em] text-gold-deep">- ACCOUNT</p>
            <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl md:text-5xl">Hello, {user.name}</h1>
            <p className="mt-2 text-sm text-ink-muted">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
          </div>
          <Button
            onClick={async () => {
              await logout();
              setLocation("/");
            }}
            className="rounded-full border-2 border-ink bg-transparent px-8 text-ink hover:bg-ink hover:text-white"
          >
            Logout
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-lg border border-border-light bg-white p-5">
            <nav className="space-y-3 text-sm text-ink-muted">
              <a href="#profile" className="block hover:text-gold-deep">Profile Information</a>
              <a href="#orders" className="block hover:text-gold-deep">Order History</a>
              <a href="#wishlist" className="block hover:text-gold-deep">Wishlist</a>
            </nav>
          </aside>

          <main className="space-y-8">
            <section id="profile" className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">PROFILE INFORMATION</h2>
              <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
                <div><p className="text-ink-muted">Name</p><p className="font-medium text-ink">{user.name}</p></div>
                <div><p className="text-ink-muted">Email</p><p className="font-medium text-ink">{user.email}</p></div>
                <div><p className="text-ink-muted">Mobile</p><p className="font-medium text-ink">{user.phone ?? "Add during checkout"}</p></div>
              </div>
            </section>

            <section id="orders" className="scroll-mt-32">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep mb-5">ORDER HISTORY</h2>
              {ordersLoading ? (
                <div className="rounded-lg border border-border-light bg-white p-10 text-center animate-pulse">
                  <p className="text-ink-muted">Loading your orders...</p>
                </div>
              ) : ordersError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-600">
                  <p>{ordersError}</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-lg border border-border-light bg-white p-10 text-center">
                  <p className="text-sm text-ink-muted">No orders yet.</p>
                </div>
              ) : (
                <ul className="mt-5 space-y-4">
                  {orders.map((order) => (
                    <li key={order.id} className="rounded-lg border border-border-light p-4 bg-white">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium text-ink">Order #{order.id}</p>
                          <p className="text-xs text-ink-muted">{new Date(order.created_at).toLocaleString("en-IN")}</p>
                          
                          {/* Order Items */}
                          {order.items && order.items.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-cream-light p-2 rounded border border-border-light">
                                  {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover" />}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-ink">
                                      {item.name}
                                      {item.variant_name && (
                                        <span className="ml-1 text-xs text-ink-muted">({item.variant_name})</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-ink-muted">Qty: {item.quantity}</p>
                                  </div>
                                  {(order.status === "paid" || order.status === "delivered") && (
                                    <Link href={`/product/${item.slug}#reviews`}>
                                      <Button variant="outline" size="sm" className="text-xs py-1 h-8">
                                        Write Review
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-muted">
                            <PackageCheck className="h-4 w-4 text-gold-deep" />
                            Status: <span className="uppercase tracking-widest text-ink">{order.status}</span>
                          </p>
                          <p className="mt-2 inline-flex items-start gap-2 text-sm text-ink-muted">
                            <MapPin className="mt-0.5 h-4 w-4 text-gold-deep" />
                            <span className="break-words">{order.shipping_address ?? "Shipping address unavailable"}</span>
                          </p>
                          {order.tracking_number && <p className="mt-2 text-sm text-ink-muted">Tracking: {order.tracking_number}</p>}
                        </div>
                        <div className="text-left md:text-right">
                          <p className="font-display text-2xl text-gold-deep">Rs {order.total_paise / 100}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="wishlist" className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">WISHLIST</h2>
              
              {wishlistedProducts.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {wishlistedProducts.map((p: any) => (
                    <div key={p.id} className="relative group flex flex-col items-center text-center bg-cream/20 p-3 rounded-lg border border-border-light/50 hover:border-gold-deep/50 transition-colors">
                      <button 
                        onClick={(e) => { e.preventDefault(); toggleWishlist(p.id); }}
                        className="absolute top-1.5 right-1.5 p-1 z-10 text-red-500 hover:scale-110 transition-transform"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <Link href={`/product/${p.slug}`} className="flex flex-col items-center w-full">
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border border-gold-light/30">
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        </div>
                        <p className="text-xs font-medium text-ink line-clamp-1 w-full">{p.name}</p>
                        <p className="text-[10px] text-ink-muted mt-0.5">₹{p.price}</p>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 text-center p-8 bg-cream/30 rounded border border-border-light/50">
                  <p className="mt-2 text-sm text-ink-muted">Save your favorite fragrances for later.</p>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </ShopLayout>
  );
}
