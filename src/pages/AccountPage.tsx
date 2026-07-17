import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MapPin, PackageCheck, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Address, type Order } from "@/lib/api";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";

function invoiceHref(order: Order) {
  const body = [
    "Embr Parfums Invoice",
    `Order #${order.id}`,
    `Date: ${new Date(order.created_at).toLocaleString("en-IN")}`,
    `Status: ${order.status}`,
    `Total: Rs ${(order.total_paise / 100).toFixed(2)}`,
    "",
    "Ship To",
    order.shipping_name ?? "",
    order.shipping_phone ?? "",
    order.shipping_address ?? "",
    `${order.shipping_city ?? ""} ${order.shipping_state ?? ""} ${order.shipping_pincode ?? ""}`.trim(),
  ].join("\n");

  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

function formatAddress(address: Address) {
  return [
    address.company_name,
    address.house_number,
    address.street,
    address.area,
    address.landmark ? `Landmark: ${address.landmark}` : "",
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

export function AccountPage() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

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

    api.addresses().then((r) => setAddresses([...r.addresses].sort((a, b) => b.id - a.id))).catch(() => {});
  }, [user]);

  const deleteAddress = async (id: number) => {
    await api.deleteAddress(id);
    setAddresses((current) => current.filter((address) => address.id !== id));
  };

  const setDefaultAddress = async (id: number) => {
    await api.setDefaultAddress(id);
    setAddresses((current) => current.map((address) => ({ ...address, is_default: address.id === id ? 1 : 0 })));
  };

  if (loading || !user) return null;

  return (
    <ShopLayout promo="Your orders, saved addresses and account settings">
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
              <a href="#addresses" className="block hover:text-gold-deep">Saved Addresses</a>
              <a href="#orders" className="block hover:text-gold-deep">Order History</a>
              <a href="#wishlist" className="block hover:text-gold-deep">Wishlist</a>
              <a href="#settings" className="block hover:text-gold-deep">Account Settings</a>
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

            <section id="addresses" className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">SAVED ADDRESSES</h2>
                <Link href="/checkout" className="text-sm text-gold-deep hover:text-ink">Add New Address</Link>
              </div>
              {addresses.length === 0 ? (
                <p className="mt-5 text-sm text-ink-muted">No saved addresses yet. Your first checkout will save one.</p>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {addresses.map((address) => (
                    <div key={address.id} className="rounded-lg border border-border-light p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{address.full_name}</p>
                          <p className="text-xs text-ink-muted">{address.mobile}</p>
                        </div>
                        {address.is_default ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] uppercase tracking-widest text-emerald-700">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 break-words text-sm leading-relaxed text-ink-muted">{formatAddress(address)}</p>
                      <div className="mt-4 flex gap-3 text-xs">
                        {!address.is_default && (
                          <button type="button" onClick={() => setDefaultAddress(address.id)} className="text-gold-deep hover:text-ink">
                            Set Default
                          </button>
                        )}
                        <button type="button" onClick={() => deleteAddress(address.id)} className="inline-flex items-center gap-1 text-rose-700 hover:text-ink">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                                    <p className="text-sm font-medium text-ink">{item.name}</p>
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
                          <a
                            href={invoiceHref(order)}
                            download={`embr-invoice-${order.id}.txt`}
                            className="mt-3 inline-block text-sm text-gold-deep hover:text-ink"
                          >
                            Download Invoice
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="wishlist" className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">WISHLIST</h2>
              <div className="mt-5 text-center p-8 bg-cream/30 rounded border border-border-light/50">
                <p className="text-sm font-medium text-ink">Coming Soon</p>
                <p className="mt-2 text-xs text-ink-muted">Save your favorite fragrances for later. Wishlist functionality will be available in the next update.</p>
              </div>
            </section>

            <section id="settings" className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">ACCOUNT SETTINGS</h2>
              <div className="mt-5 space-y-4">
                <p className="text-sm text-ink-muted">
                  Your account is secured with OTP-based login. To change your registered email or phone number, please contact customer support.
                </p>
                <Button variant="outline" className="w-full sm:w-auto mt-4">
                  Contact Support
                </Button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </ShopLayout>
  );
}
