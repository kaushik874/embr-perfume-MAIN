import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { api } from "@/lib/api";

type PaymentStatus = Awaited<ReturnType<typeof api.paymentStatus>>;

function money(paise: number) {
  return `Rs ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function queryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    checkoutSessionId: params.get("checkoutSessionId") ?? undefined,
    razorpayOrderId: params.get("razorpayOrderId") ?? undefined,
  };
}

function usePaymentStatus() {
  const [, params] = useRoute("/:page/:orderId");
  const orderId = Number(params?.orderId);
  const query = useMemo(queryParams, []);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setError("Invalid order reference.");
      return;
    }

    let cancelled = false;
    api.paymentStatus(orderId, query)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load payment status.");
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, query]);

  return { orderId, query, status, error };
}

export function OrderSuccessPage() {
  const [, setLocation] = useLocation();
  const { orderId, status, error } = usePaymentStatus();

  useEffect(() => {
    if (status && !status.paid) {
      setLocation(`/payment-failed/${orderId}${window.location.search}`);
    }
  }, [orderId, setLocation, status]);

  return (
    <ShopLayout>
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" />
        <p className="mt-5 font-display text-xs tracking-[0.4em] text-emerald-700">- PAYMENT SUCCESSFUL</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Order Success</h1>

        {!status && !error && <p className="mt-4 text-ink-muted">Confirming your payment...</p>}
        {error && <p className="mt-4 text-rose-700">{error}</p>}
        {status?.paid && (
          <div className="mt-6 space-y-2 text-sm text-ink-muted">
            <p><span className="text-ink">Order ID:</span> #{status.orderId}</p>
            <p><span className="text-ink">Razorpay Payment ID:</span> {status.razorpayPaymentId ?? "Confirmed"}</p>
            <p><span className="text-ink">Amount:</span> {money(status.amount)}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/collections">
            <Button className="rounded-full border-2 border-ink bg-ink px-8 tracking-widest text-white hover:bg-ink/90">
              CONTINUE SHOPPING
            </Button>
          </Link>
          <Link href="/account">
            <Button className="rounded-full border-2 border-ink bg-transparent px-8 tracking-widest text-ink hover:bg-ink hover:text-white">
              VIEW ORDER
            </Button>
          </Link>
        </div>
      </div>
    </ShopLayout>
  );
}

export function PaymentFailedPage() {
  const [, setLocation] = useLocation();
  const { orderId, status, error } = usePaymentStatus();

  useEffect(() => {
    if (status?.paid) {
      setLocation(`/order-success/${orderId}${window.location.search}`);
    }
  }, [orderId, setLocation, status]);

  return (
    <ShopLayout>
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <XCircle className="mx-auto h-12 w-12 text-rose-700" />
        <p className="mt-5 font-display text-xs tracking-[0.4em] text-rose-700">- PAYMENT FAILED</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Payment Failed</h1>
        <p className="mt-4 text-ink-muted">
          {status?.failureReason ?? error ?? "Your order is still pending. You can retry the payment."}
        </p>

        <div className="mt-6 space-y-2 text-sm text-ink-muted">
          <p><span className="text-ink">Order ID:</span> #{Number.isFinite(orderId) ? orderId : ""}</p>
          {status?.failureCode && <p><span className="text-ink">Error Code:</span> {status.failureCode}</p>}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/checkout/payment">
            <Button className="rounded-full border-2 border-ink bg-ink px-8 tracking-widest text-white hover:bg-ink/90">
              RETRY PAYMENT
            </Button>
          </Link>
          <Link href="/cart">
            <Button className="rounded-full border-2 border-ink bg-transparent px-8 tracking-widest text-ink hover:bg-ink hover:text-white">
              BACK TO BAG
            </Button>
          </Link>
        </div>
      </div>
    </ShopLayout>
  );
}
