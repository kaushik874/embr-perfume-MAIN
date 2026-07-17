export type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: RazorpayResponse) => void) => void;
    };
  }
}

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
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
