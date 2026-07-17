export type CheckoutShippingData = {
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

export function saveCheckoutShipping(data: CheckoutShippingData) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCheckoutShipping(): CheckoutShippingData | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutShippingData;
    return {
      ...parsed,
      updateAddress: parsed.updateAddress ?? false,
    };
  } catch {
    return null;
  }
}

export function clearCheckoutShipping() {
  sessionStorage.removeItem(STORAGE_KEY);
}
