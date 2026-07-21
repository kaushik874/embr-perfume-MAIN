import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Landmark,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { clearCheckoutShipping, loadCheckoutShipping } from "@/lib/checkout-storage";

const paymentOptions = [
  { id: "upi", label: "UPI", icon: Smartphone, hint: "Google Pay, PhonePe, Paytm" },
  { id: "credit", label: "Credit Card", icon: CreditCard, hint: "Visa, Mastercard, RuPay" },
  { id: "debit", label: "Debit Card", icon: CreditCard, hint: "All major bank cards" },
  { id: "netbanking", label: "Net Banking", icon: Landmark, hint: "50+ banks supported" },
  { id: "wallet", label: "Wallets", icon: Wallet, hint: "Paytm, Amazon Pay & more" },
];

function formatShippingAddress(shipping: NonNullable<ReturnType<typeof loadCheckoutShipping>>["shipping"]) {
  return [
    shipping.companyName,
    shipping.houseNumber,
    shipping.street,
    shipping.area,
    shipping.landmark ? `Landmark: ${shipping.landmark}` : "",
    `${shipping.city}, ${shipping.state} ${shipping.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function PaymentPage() {
  const { refresh } = useAuth();
  const { items, total, clear, syncProducts } = useCart();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [checkoutData, setCheckoutData] = useState(() => loadCheckoutShipping());

  const orderItems = useMemo(
    () => items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })),
    [items],
  );

  useEffect(() => {
    void syncProducts();
  }, [syncProducts]);

  useEffect(() => {
    if (paymentSuccess) return;
    if (items.length === 0) {
      setLocation("/cart");
      return;
    }
    const data = loadCheckoutShipping();
    if (!data) {
      setLocation("/checkout");
      return;
    }
    setCheckoutData(data);
  }, [items.length, setLocation, paymentSuccess]);

  const payNow = async () => {
    if (!checkoutData || items.length === 0) return;

    const { shipping, selectedAddressId, saveAddress, setDefault, updateAddress } = checkoutData;

    setBusy(true);
    setPaymentMessage(null);

    try {
      const result = await api.guestCheckout({
        items: orderItems,
        shipping: {
          name: shipping.name,
          email: shipping.email,
          phone: shipping.phone,
          houseNumber: shipping.houseNumber,
          street: shipping.street,
          area: shipping.area,
          city: shipping.city,
          state: shipping.state,
          pincode: shipping.pincode,
          landmark: shipping.landmark || undefined,
          alternatePhone: shipping.alternatePhone || undefined,
          companyName: shipping.companyName || undefined,
          addressId: selectedAddressId ?? undefined,
          saveAddress,
          setDefault,
          updateAddress,
        },
      });

      await refresh();

      if (result.mode === "demo") {
        setPaymentSuccess(true);
        clear();
        clearCheckoutShipping();
        setPaymentMessage("Order placed successfully in Demo Mode. Add Razorpay keys for live payments.");
        setBusy(false);
        return;
      }

      const RazorpayCtor = (window as Window & { Razorpay?: new (o: object) => { open: () => void; on: (e: string, h: () => void) => void } }).Razorpay;
      if (!RazorpayCtor) {
        setPaymentMessage("Payment failed because Razorpay did not load. Try again.");
        setBusy(false);
        return;
      }

      const orderId = result.orderId;
      const options = {
        key: result.keyId,
        amount: result.amount ?? total * 100,
        currency: "INR",
        name: "Embr Parfums",
        description: `${paymentOptions.find((p) => p.id === paymentMethod)?.label ?? "Payment"} for perfume order`,
        order_id: result.razorpayOrderId,
        prefill: {
          name: shipping.name,
          email: shipping.email,
          contact: shipping.phone,
        },
        theme: { color: "#b08a4a" },
        handler: async function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
          try {
            await api.verifyPayment({
              orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentSuccess(true);
            clear();
            clearCheckoutShipping();
            setPaymentMessage("Payment successful. Thank you for your order.");
          } catch {
            setPaymentSuccess(true);
            clearCheckoutShipping();
            setPaymentMessage("Payment received. Contact support if the order stays pending.");
          }
          setBusy(false);
        },
      };

      const rzp = new RazorpayCtor(options);
      rzp.on("payment.failed", function () {
        setPaymentMessage("Payment failed. Try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setPaymentMessage(err instanceof Error ? err.message : "Checkout failed. Try again.");
      setBusy(false);
    }
  };

  if (paymentSuccess) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <p className="font-display text-xs tracking-[0.4em] text-emerald-700">- ORDER COMPLETE</p>
          <h1 className="mt-3 font-serif text-4xl text-ink">Thank You</h1>
          <p className="mt-4 text-ink-muted">{paymentMessage}</p>
          <Link href="/account">
            <Button className="mt-8 rounded-full border-2 border-ink bg-transparent px-10 tracking-widest text-ink hover:bg-ink hover:text-white">
              VIEW MY ORDERS
            </Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  if (!checkoutData || items.length === 0) return null;

  const { shipping } = checkoutData;
  const selectedOption = paymentOptions.find((p) => p.id === paymentMethod);

  return (
    <ShopLayout promo="Secure payments via UPI, cards, net banking & wallets">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <Link href="/checkout" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-gold-deep">
            <ArrowLeft className="h-4 w-4" />
            Back to shipping
          </Link>
          <p className="mt-4 font-display text-xs tracking-[0.4em] text-gold-deep">- PAYMENT</p>
          <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl md:text-5xl">Choose Payment Method</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
                <div>
                  <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">DELIVERING TO</h2>
                  <p className="mt-2 font-medium text-ink">{shipping.name}</p>
                  <p className="text-sm text-ink-muted">{shipping.phone} · {shipping.email}</p>
                  <p className="mt-2 break-words text-sm leading-relaxed text-ink-muted">{formatShippingAddress(shipping)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border-light bg-white p-5 md:p-6">
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">SELECT PAYMENT METHOD</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {paymentOptions.map(({ id, label, icon: Icon, hint }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`flex items-start gap-3 rounded-lg border px-4 py-4 text-left transition-colors ${
                      paymentMethod === id
                        ? "border-gold-deep bg-gold-deep/10 text-ink shadow-sm"
                        : "border-border-light text-ink-muted hover:border-gold-deep/40"
                    }`}
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedOption && (
                <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    You selected <strong>{selectedOption.label}</strong>. Secure payment powered by Razorpay.
                  </span>
                </div>
              )}

              {paymentMessage && (
                <p className="mt-5 text-center text-sm text-rose-700">{paymentMessage}</p>
              )}

              <Button
                type="button"
                onClick={payNow}
                disabled={busy}
                className="mt-6 w-full rounded-full border-2 border-ink bg-gradient-gold py-5 text-sm font-medium tracking-[0.15em] text-charcoal shadow-gold hover:opacity-95 sm:py-6 sm:text-lg"
              >
                {busy ? (
                  "Processing..."
                ) : (
                  <>
                    <span className="sm:hidden">PAY NOW</span>
                    <span className="hidden sm:inline">
                      {`PAY WITH ${selectedOption?.label.toUpperCase() ?? "RAZORPAY"}`}
                    </span>
                  </>
                )}
              </Button>
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-border-light bg-white p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold-deep" />
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">ORDER SUMMARY</h2>
            </div>
            <ul className="mt-5 space-y-4 text-sm text-ink">
              {items.map((i) => (
                <li key={i.product.slug} className="flex gap-3">
                  <img
                    src={i.product.image ?? "/images/bottle-mini.svg"}
                    alt={i.product.name}
                    className="h-16 w-12 shrink-0 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/bottle-mini.svg";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.product.name}</p>
                    <p className="text-xs text-ink-muted">Qty {i.quantity}</p>
                  </div>
                  <span className="font-display text-gold-deep">Rs {i.product.price * i.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-between border-t border-border-light pt-4">
              <span className="font-display tracking-widest text-ink-muted">TOTAL</span>
              <span className="font-display text-2xl text-gold-deep">Rs {total}</span>
            </div>
            <Link href="/cart" className="mt-5 block text-center text-sm tracking-widest text-ink-muted hover:text-gold-deep">
              BACK TO BAG
            </Link>
          </aside>
        </div>
      </div>
    </ShopLayout>
  );
}
