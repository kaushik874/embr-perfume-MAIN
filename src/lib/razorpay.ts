export type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: RazorpayResponse | RazorpayFailureResponse) => void) => void;
    };
  }
}

const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(timeoutMs = 12000): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      if (error) {
        razorpayScriptPromise = null;
        reject(error);
      } else {
        resolve();
      }
    };

    const timeout = window.setTimeout(() => {
      finish(new Error("Razorpay is taking longer than expected to load. Please check your network and try again."));
    }, timeoutMs);

    const poll = window.setInterval(() => {
      if (window.Razorpay) finish();
    }, 50);

    let script = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", () => finish(), { once: true });
    script.addEventListener("error", () => finish(new Error("Failed to load Razorpay. Please check your network and try again.")), { once: true });
  });

  return razorpayScriptPromise;
}

export function preloadRazorpayScript() {
  void loadRazorpayScript().catch(() => {});
}

export async function openRazorpayCheckout(options: {
  keyId: string;
  amount: number;
  currency: string;
  orderId: string;
  name: string;
  email: string;
  description: string;
}): Promise<RazorpayResponse> {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: "Embr Parfums",
      description: options.description,
      order_id: options.orderId,
      prefill: { email: options.email, name: options.name },
      theme: { color: "#b08a4a" },
      handler: (response: RazorpayResponse) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });

    rzp.on("payment.failed", () => reject(new Error("Payment failed")));
    rzp.open();
  });
}
