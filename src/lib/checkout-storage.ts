export type CheckoutShippingData = {
  checkoutSessionId: string;
  shipping: {
    name: string;
    email: string;
    phone: string;
    houseNumber: string;
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    alternatePhone: string;
    companyName: string;
  };
  selectedAddressId: number | null;
  saveAddress: boolean;
  setDefault: boolean;
  updateAddress: boolean;
};

const STORAGE_KEY = "embr_checkout_shipping";

function createCheckoutSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
}

function isValidCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,80}$/.test(value);
}

export function saveCheckoutShipping(data: Omit<CheckoutShippingData, "checkoutSessionId"> & { checkoutSessionId?: string }) {
  const existing = loadCheckoutShipping();
  const checkoutSessionId = isValidCheckoutSessionId(data.checkoutSessionId)
    ? data.checkoutSessionId
    : existing?.checkoutSessionId ?? createCheckoutSessionId();

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, checkoutSessionId }));
}

export function loadCheckoutShipping(): CheckoutShippingData | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutShippingData;
    const data = {
      ...parsed,
      checkoutSessionId: isValidCheckoutSessionId(parsed.checkoutSessionId)
        ? parsed.checkoutSessionId
        : createCheckoutSessionId(),
      updateAddress: parsed.updateAddress ?? false,
    };

    if (data.checkoutSessionId !== parsed.checkoutSessionId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    return data;
  } catch {
    return null;
  }
}

export function clearCheckoutShipping() {
  sessionStorage.removeItem(STORAGE_KEY);
}
