import { CATALOG_PRODUCTS, getCatalogProduct } from "@/lib/catalog";

function parseError(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null) {
      const flat = err as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[]>;
      };
      const fieldMsg = Object.values(flat.fieldErrors ?? {})
        .flat()
        .find(Boolean);
      if (fieldMsg) return fieldMsg;
      if (flat.formErrors?.[0]) return flat.formErrors[0];
    }
  }
  return "Request failed";
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(
      "Server not running. Please start with: npm run dev",
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseError(data));
  }

  return data as T;
}

export type User = { id: number; name: string; email: string; phone?: string | null; role?: string };

export type Product = {
  id: number;
  slug: string;
  name: string;
  notes: string;
  description: string | null;
  price: number;
  mrp: number;
  image: string | null;
  featured: number;
  collection_type?: "primary" | "secondary";
  bestseller?: number;
  key_features?: string | null;
  how_to_apply?: string | null;
  legal_information?: string | null;
  head_notes?: string | null;
  heart_notes?: string | null;
  base_notes?: string | null;
  review?: string | null;
};

export type HeroBanner = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  mobileImageUrl?: string;
  productName: string;
  productUrl: string;
  badge: string;
  buttonText: string;
  buttonLink: string;
  showButton: number;
  darkOverlay: number;
  imageFit: string;
  imagePosition: string;
  mobileImagePosition: string;
  showText: number;
  isActive: number;
  displayOrder: number;
};

export type FooterLink = {
  id: number;
  column_id: number;
  label: string;
  url: string;
  sort_order: number;
};

export type FooterColumn = {
  id: number;
  title: string;
  sort_order: number;
  links: FooterLink[];
};

export type Order = {
  id: number;
  status: string;
  total_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
  tracking_number?: string | null;
  items?: {
    quantity: number;
    price_at_time: number;
    name: string;
    slug: string;
    image: string | null;
  }[];
};

export type Address = {
  id: number;
  user_id: number;
  full_name: string;
  mobile: string;
  email: string;
  house_number: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  alternate_mobile: string | null;
  company_name: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
};

export const api = {
  health: () => request<{ ok: boolean; payments: string }>("/health"),

  publicConfig: () => request<{ googleClientId: string }>("/config/public"),

  getHeroBanners: () => request<{ banners: HeroBanner[] }>("/hero"),

  getAboutBanner: () => request<{ banner: any }>("/about-banner"),

  getFooter: () => request<{ columns: FooterColumn[] }>("/footer"),

  me: () => request<{ user: User }>("/me"),

  login: (body: { identifier: string; password: string }) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  requestOtp: (body: { identifier: string }) =>
    request<{ ok: boolean; channel: "email" | "mobile"; message: string; demoOtp?: string }>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyOtp: (body: { identifier: string; otp: string }) =>
    request<{ user: User }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  loginWithGoogle: (body: { credential: string }) =>
    request<{ user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: (body: { name: string; email: string; password: string }) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  products: async () => {
    try {
      return await request<{ products: Product[] }>("/products");
    } catch {
      return { products: CATALOG_PRODUCTS };
    }
  },

  getContent: async () => {
    try {
      return await request<{ content: Record<string, string>; sections: Record<string, boolean> }>("/content");
    } catch {
      return { content: {}, sections: {} };
    }
  },

  product: async (slug: string) => {
    try {
      return await request<{ product: Product; images?: { url: string }[] }>(`/products/${slug}`);
    } catch {
      const product = getCatalogProduct(slug);
      if (product) return { product };
      throw new Error("Product not found");
    }
  },

  orders: () => request<{ orders: Order[] }>("/orders/mine"),

  addresses: () => request<{ addresses: Address[] }>("/me/addresses"),

  createAddress: (body: Omit<Address, "id" | "user_id" | "created_at" | "updated_at" | "is_default"> & { is_default?: boolean }) =>
    request<{ id: number }>("/me/addresses", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAddress: (id: number, body: Omit<Address, "id" | "user_id" | "created_at" | "updated_at" | "is_default"> & { is_default?: boolean }) =>
    request<{ ok: boolean }>(`/me/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteAddress: (id: number) =>
    request<{ ok: boolean }>(`/me/addresses/${id}`, { method: "DELETE" }),

  setDefaultAddress: (id: number) =>
    request<{ ok: boolean }>(`/me/addresses/${id}/default`, { method: "POST" }),

  guestCheckout: (body: {
    items: { slug: string; quantity: number }[];
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
      landmark?: string;
      alternatePhone?: string;
      companyName?: string;
      addressId?: number;
      saveAddress?: boolean;
      setDefault?: boolean;
      updateAddress?: boolean;
    };
  }) =>
    request<{
      mode: "demo" | "razorpay";
      orderId: number;
      user: User;
      message?: string;
      razorpayOrderId?: string;
      amount?: number;
      currency?: string;
      keyId?: string;
    }>("/orders/guest-checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  markPaid: (body: { orderId: number; razorpay_payment_id: string; razorpay_order_id: string }) =>
    request<{ ok: boolean; orderId: number }>("/orders/mark-paid", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyPayment: (body: {
    orderId: number;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    request<{ ok: boolean; orderId: number }>("/orders/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const adminApi = {
  dashboard: () => request<any>("/admin/dashboard"),
  orders: () => request<{ orders: any[] }>("/admin/orders"),
  order: (id: string) => request<{ order: any; items: any[] }>(`/admin/orders/${id}`),
  users: () => request<{ users: any[] }>("/admin/users"),
  products: () => request<{ products: Product[] }>("/admin/products"),
  createProduct: (body: Omit<Product, "id">) => 
    request<{ id: number }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  updateProduct: (id: number, body: Omit<Product, "id">) => 
    request<{ ok: boolean }>(`/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body)
    }),
  deleteProduct: (id: number) => 
    request<{ ok: boolean }>(`/admin/products/${id}`, {
      method: "DELETE"
    }),

  getCoupons: () => request<{ coupons: any[] }>("/admin/coupons"),
  createCoupon: (body: any) => request<{ ok: boolean, id: number }>("/admin/coupons", { method: "POST", body: JSON.stringify(body) }),
  deleteCoupon: (id: number) => request<{ ok: boolean }>(`/admin/coupons/${id}`, { method: "DELETE" }),

  getOrder: (id: number) => request<{ order: Order; items: any[] }>(`/admin/orders/${id}`),
  updateOrderStatus: (id: number, status: string) => request<{ ok: boolean }>(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  bulkUpdateOrderStatus: (ids: number[], status: string) => request<{ ok: boolean; count: number }>("/admin/orders/bulk/status", { method: "PATCH", body: JSON.stringify({ ids, status }) }),
  updateOrderTracking: (id: number, tracking_number: string) => request<{ ok: boolean }>(`/admin/orders/${id}/tracking`, { method: "PATCH", body: JSON.stringify({ tracking_number }) }),
  updateOrderShipping: (id: number, data: any) => request<{ ok: boolean }>(`/admin/orders/${id}/shipping`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteOrder: (id: number) => request<{ ok: boolean }>(`/admin/orders/${id}`, { method: "DELETE" }),
  bulkDeleteOrders: (ids: number[]) => request<{ ok: boolean; count: number }>("/admin/orders/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),

  getCustomers: (page = 1, limit = 20, search = "") => request<{ customers: any[]; pagination: any }>(`/admin/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

  getReviews: () => request<{ reviews: any[] }>("/admin/reviews"),
  createReview: (body: any) => request<{ ok: boolean, id: number }>("/admin/reviews", { method: "POST", body: JSON.stringify(body) }),
  updateReview: (id: number, body: any) => request<{ ok: boolean }>(`/admin/reviews/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  updateReviewStatus: (id: number, status: string) => request<{ ok: boolean }>(`/admin/reviews/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateReviewFlags: (id: number, flags: { is_pinned?: boolean, is_featured?: boolean, is_hidden?: boolean }) => request<{ ok: boolean }>(`/admin/reviews/${id}/status`, { method: "PATCH", body: JSON.stringify(flags) }),
  replyToReview: (id: number, reply: string) => request<{ ok: boolean }>(`/admin/reviews/${id}/reply`, { method: "PATCH", body: JSON.stringify({ reply }) }),
  deleteReview: (id: number) => request<{ ok: boolean }>(`/admin/reviews/${id}`, { method: "DELETE" }),

  getSubscribers: () => request<{ subscribers: any[] }>("/admin/subscribers"),
  deleteSubscriber: (id: number) => request<{ ok: boolean }>(`/admin/subscribers/${id}`, { method: "DELETE" }),

  getMessages: () => request<{ messages: any[] }>("/admin/messages"),
  updateMessageStatus: (id: number, status: string) => request<{ ok: boolean }>(`/admin/messages/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getContent: () => request<{ content: Record<string, string> }>("/admin/content"),
  updateContent: (key: string, value: string) => request<{ ok: boolean }>("/admin/content", { method: "POST", body: JSON.stringify({ key, value }) }),
  deleteContent: (key: string) => request<{ ok: boolean }>(`/admin/content/${encodeURIComponent(key)}`, { method: "DELETE" }),
  uploadContentFile: (body: { name: string; data: string }) => request<{ url: string }>("/admin/content/upload", { method: "POST", body: JSON.stringify(body) }),

  getSections: () => request<{ sections: { key: string; hidden: number }[] }>("/admin/sections"),
  updateSection: (key: string, hidden: boolean) => request<{ ok: boolean }>(`/admin/sections/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ hidden }) }),

  getSecurityLogins: () => request<{ attempts: any[] }>("/admin/security/logins"),
  getSecurityActions: () => request<{ logs: any[] }>("/admin/security/actions"),

  getHeroBanners: () => request<{ banners: HeroBanner[] }>("/admin/hero"),
  uploadHeroBannerImage: (body: { name: string; data: string }) => request<{ url: string }>("/admin/hero/upload", { method: "POST", body: JSON.stringify(body) }),
  createHeroBanner: (body: Partial<HeroBanner>) => request<{ id: number }>("/admin/hero", { method: "POST", body: JSON.stringify(body) }),
  updateHeroBanner: (id: number, body: Partial<HeroBanner>) => request<{ ok: boolean }>(`/admin/hero/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteHeroBanner: (id: number) => request<{ ok: boolean }>(`/admin/hero/${id}`, { method: "DELETE" }),
  reorderHeroBanners: (orders: { id: number; displayOrder: number }[]) => request<{ ok: boolean }>("/admin/hero/reorder", { method: "PATCH", body: JSON.stringify({ orders }) }),

  getAboutBannerAdmin: () => request<{ banner: any }>("/admin/about"),
  updateAboutBanner: (body: any) => request<{ ok: boolean }>("/admin/about", { method: "PUT", body: JSON.stringify(body) }),
  uploadAboutBannerImage: (body: { name: string; data: string }) => request<{ url: string }>("/admin/about/upload", { method: "POST", body: JSON.stringify(body) }),

  // Footer admin
  getFooterAdmin: () => request<{ columns: FooterColumn[] }>("/admin/footer"),
  createFooterColumn: (title: string) => request<{ column: FooterColumn }>("/admin/footer/columns", { method: "POST", body: JSON.stringify({ title }) }),
  updateFooterColumn: (id: number, body: Partial<FooterColumn>) => request<{ ok: boolean }>(`/admin/footer/columns/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFooterColumn: (id: number) => request<{ ok: boolean }>(`/admin/footer/columns/${id}`, { method: "DELETE" }),
  createFooterLink: (body: { column_id: number; label: string; url: string }) => request<{ link: FooterLink }>("/admin/footer/links", { method: "POST", body: JSON.stringify(body) }),
  updateFooterLink: (id: number, body: Partial<FooterLink>) => request<{ ok: boolean }>(`/admin/footer/links/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFooterLink: (id: number) => request<{ ok: boolean }>(`/admin/footer/links/${id}`, { method: "DELETE" }),

  // Analytics
  analyticsSummary: () => request<any>("/admin/analytics/summary"),
  analyticsChart: (range: "7d" | "30d" | "12m" | "all") => request<any>(`/admin/analytics/chart?range=${range}`),
  analyticsPages: () => request<any>("/admin/analytics/pages"),
  analyticsDevices: () => request<any>("/admin/analytics/devices"),
  analyticsGeo: () => request<any>("/admin/analytics/geo"),
  analyticsReferrers: () => request<any>("/admin/analytics/referrers"),
  analyticsLive: () => request<{ live: number }>("/admin/analytics/live"),
};
