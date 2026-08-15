import { useEffect, useMemo, useRef, useState } from "react";
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
  Tag,
  Loader2,
  X as XIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { clearCheckoutShipping, loadCheckoutShipping } from "@/lib/checkout-storage";
import {
  loadRazorpayScript,
  preloadRazorpayScript,
  type RazorpayFailureResponse,
  type RazorpayResponse,
} from "@/lib/razorpay";

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

function paymentMethodConfig(paymentMethod: string) {
  const method =
    paymentMethod === "credit" || paymentMethod === "debit"
      ? "card"
      : paymentMethod === "wallet"
        ? "wallet"
        : paymentMethod === "netbanking"
          ? "netbanking"
          : "upi";

  return {
    display: {
      blocks: {
        preferred: {
          name: "Preferred payment",
          instruments: [{ method }],
        },
      },
      sequence: ["block.preferred"],
      preferences: {
        show_default_blocks: true,
      },
    },
  };
}

function buildPaymentUrl(
  path: "order-success" | "payment-failed",
  orderId: number,
  checkoutSessionId?: string,
  razorpayOrderId?: string,
) {
  const params = new URLSearchParams();
  if (checkoutSessionId) params.set("checkoutSessionId", checkoutSessionId);
  if (razorpayOrderId) params.set("razorpayOrderId", razorpayOrderId);
  const query = params.toString();
  return `/${path}/${orderId}${query ? `?${query}` : ""}`;
}

async function waitForPaidStatus(orderId: number, checkoutSessionId?: string, razorpayOrderId?: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await api.paymentStatus(orderId, { checkoutSessionId, razorpayOrderId });
    if (status.paid) return status;
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }

  return api.paymentStatus(orderId, { checkoutSessionId, razorpayOrderId });
}

function failureInfo(response: RazorpayFailureResponse) {
  const error = response.error;
  return {
    code: error?.code ?? null,
    description: error?.description ?? null,
    reason: error?.reason ?? null,
    source: error?.source ?? null,
    step: error?.step ?? null,
    paymentId: error?.metadata?.payment_id ?? null,
    razorpayOrderId: error?.metadata?.order_id ?? null,
  };
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
  const openingRef = useRef(false);
  const paymentResolvedRef = useRef(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<{
    subtotalPaise: number;
    shippingPaise: number;
    couponDiscountPaise: number;
    totalPaise: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const orderItems = useMemo(
    () => items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })),
    [items],
  );

  const applyCoupon = async () => {
    if (!couponCode.trim() || couponApplying) return;
    setCouponApplying(true);
    setCouponError(null);
    try {
      const result = await api.validateCoupon({
        code: couponCode.trim(),
        items: orderItems,
      });
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setPricingBreakdown({
          subtotalPaise: result.subtotalPaise,
          shippingPaise: result.shippingPaise,
          couponDiscountPaise: result.couponDiscountPaise,
          totalPaise: result.totalPaise,
        });
        setCouponError(null);
      } else {
        setCouponError(result.error || "Invalid coupon code");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Could not validate coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setPricingBreakdown(null);
    setCouponCode("");
    setCouponError(null);
  };

  useEffect(() => {
    void syncProducts();
  }, [syncProducts]);

  useEffect(() => {
    preloadRazorpayScript();
  }, []);

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
    if (!checkoutData || items.length === 0 || openingRef.current) return;

    const { checkoutSessionId, shipping, selectedAddressId, saveAddress, setDefault, updateAddress } = checkoutData;

    openingRef.current = true;
    paymentResolvedRef.current = false;
    setBusy(true);
    setPaymentMessage("Opening secure payment...");

    try {
      const razorpayReady = loadRazorpayScript();
      const result = await api.guestCheckout({
        items: orderItems,
        checkoutSessionId,
        couponCode: appliedCoupon?.code,
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

      void refresh();

      if (result.mode === "demo" || result.mode === "paid") {
        setPaymentSuccess(true);
        clear();
        clearCheckoutShipping();
        setLocation(buildPaymentUrl("order-success", result.orderId, result.checkoutSessionId ?? checkoutSessionId, result.razorpayOrderId));
        openingRef.current = false;
        setBusy(false);
        return;
      }

      await razorpayReady;

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor || !result.keyId || !result.razorpayOrderId) {
        setPaymentMessage("Payment could not be opened. Please retry.");
        openingRef.current = false;
        setBusy(false);
        return;
      }

      const orderId = result.orderId;
      const razorpayOrderId = result.razorpayOrderId;
      const paymentUrlParams = {
        checkoutSessionId: result.checkoutSessionId ?? checkoutSessionId,
        razorpayOrderId,
      };
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
        retry: { enabled: true },
        config: paymentMethodConfig(paymentMethod),
        modal: {
          ondismiss: async function () {
            if (paymentResolvedRef.current) return;
            await api.paymentFailed({
              orderId,
              razorpay_order_id: razorpayOrderId,
              checkoutSessionId: paymentUrlParams.checkoutSessionId,
              code: "checkout_dismissed",
              description: "Customer closed Razorpay Checkout before completion.",
            }).catch(() => {});
            setLocation(buildPaymentUrl("payment-failed", orderId, paymentUrlParams.checkoutSessionId, razorpayOrderId));
            openingRef.current = false;
            setBusy(false);
          },
        },
        handler: async function (response: RazorpayResponse) {
          paymentResolvedRef.current = true;
          setPaymentMessage("Verifying payment...");
          try {
            const verified = await api.verifyPayment({
              orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            const finalStatus = verified.paid
              ? { paid: true }
              : await waitForPaidStatus(orderId, paymentUrlParams.checkoutSessionId, response.razorpay_order_id);

            if (finalStatus.paid) {
              setPaymentSuccess(true);
              clear();
              clearCheckoutShipping();
              setLocation(buildPaymentUrl("order-success", orderId, paymentUrlParams.checkoutSessionId, response.razorpay_order_id));
              return;
            }

            setPaymentMessage("Payment is being confirmed by Razorpay. Please check your orders in a moment.");
          } catch {
            try {
              const status = await waitForPaidStatus(orderId, paymentUrlParams.checkoutSessionId, response.razorpay_order_id);
              if (status.paid) {
                setPaymentSuccess(true);
                clear();
                clearCheckoutShipping();
                setLocation(buildPaymentUrl("order-success", orderId, paymentUrlParams.checkoutSessionId, response.razorpay_order_id));
                return;
              }
            } catch {}
            setPaymentMessage("Payment received by Razorpay. We are verifying it securely. Please check your orders shortly.");
          } finally {
            openingRef.current = false;
            setBusy(false);
          }
        },
      };

      const rzp = new RazorpayCtor(options);
      rzp.on("payment.failed", async function (response) {
        paymentResolvedRef.current = true;
        const info = failureInfo(response as RazorpayFailureResponse);
        await api.paymentFailed({
          orderId,
          razorpay_order_id: info.razorpayOrderId ?? razorpayOrderId,
          checkoutSessionId: paymentUrlParams.checkoutSessionId,
          code: info.code,
          description: info.description,
          reason: info.reason,
          source: info.source,
          step: info.step,
          paymentId: info.paymentId,
        }).catch(() => {});
        setLocation(buildPaymentUrl("payment-failed", orderId, paymentUrlParams.checkoutSessionId, info.razorpayOrderId ?? razorpayOrderId));
        openingRef.current = false;
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setPaymentMessage(err instanceof Error ? err.message : "Checkout failed. Try again.");
      openingRef.current = false;
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
                  <span className="font-display text-gold-deep">₹{i.product.price * i.quantity}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border-light pt-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-emerald-700" />
                    <div>
                      <span className="text-sm font-medium text-emerald-800">{appliedCoupon.code}</span>
                      <span className="ml-1 text-xs text-emerald-600">
                        ({appliedCoupon.discount_type === "percent" ? `${appliedCoupon.discount_value}% off` : `₹${appliedCoupon.discount_value} off`})
                      </span>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="rounded p-1 text-emerald-700 hover:bg-emerald-100">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:border-gold-deep focus:outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={!couponCode.trim() || couponApplying}
                      className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {couponApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                  {couponError && <p className="mt-2 text-xs text-rose-600">{couponError}</p>}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-border-light pt-4 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>₹{pricingBreakdown ? (pricingBreakdown.subtotalPaise / 100).toFixed(0) : total}</span>
              </div>
              {pricingBreakdown && pricingBreakdown.couponDiscountPaise > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span>-₹{(pricingBreakdown.couponDiscountPaise / 100).toFixed(0)}</span>
                </div>
              )}
              {pricingBreakdown && pricingBreakdown.shippingPaise > 0 ? (
                <div className="flex justify-between text-ink-muted">
                  <span>Shipping</span>
                  <span>₹{(pricingBreakdown.shippingPaise / 100).toFixed(0)}</span>
                </div>
              ) : pricingBreakdown ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex justify-between border-t border-border-light pt-4">
              <span className="font-display tracking-widest text-ink-muted">TOTAL</span>
              <span className="font-display text-2xl text-gold-deep">
                ₹{pricingBreakdown ? (pricingBreakdown.totalPaise / 100).toFixed(0) : total}
              </span>
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
