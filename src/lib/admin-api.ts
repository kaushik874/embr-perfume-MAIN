function parseError(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null) {
      const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const fieldMsg = Object.values(flat.fieldErrors ?? {}).flat().find(Boolean);
      if (fieldMsg) return fieldMsg!;
      if (flat.formErrors?.[0]) return flat.formErrors[0];
    }
  }
  return "Request failed";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      ...options,
      credentials: "include",
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });
  } catch {
    throw new Error("Server not running. Please start with: npm run dev");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data as T;
}

export type ProductFull = {
  id: number;
  slug: string;
  name: string;
  notes: string;
  description: string | null;
  price: number;
  mrp: number;
  discount_price: number | null;
  stock: number;
  sku: string | null;
  category: string | null;
  status: string;
  tags: string | null;
  image: string | null;
  featured: number;
  collection_type: "primary" | "secondary";
  bestseller: number;
  key_features: string | null;
  how_to_apply: string | null;
  legal_information: string | null;
  head_notes: string | null;
  heart_notes: string | null;
  base_notes: string | null;
  review: string | null;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const adminApi = {
  dashboard: () => request<any>("/dashboard"),
  products: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ products: ProductFull[]; pagination: Pagination }>(`/products${qs}`);
  },
  product: (id: number) => request<{ product: ProductFull; images: any[] }>(`/products/${id}`),
  createProduct: (body: any) => request<{ id: number }>("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: number, body: any) => request<{ ok: boolean }>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (id: number) => request<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),
  updateStock: (id: number, stock: number) => request<{ ok: boolean }>(`/products/${id}/stock`, { method: "PATCH", body: JSON.stringify({ stock }) }),
  uploadImages: (id: number, images: { name: string; type: string; data: string }[]) => request<{ images: string[] }>(`/products/${id}/images`, { method: "POST", body: JSON.stringify({ images }) }),
  deleteImage: (productId: number, imageId: number) => request<{ ok: boolean }>(`/products/${productId}/images/${imageId}`, { method: "DELETE" }),
  reorderImages: (id: number, imageIds: number[]) =>
    request<{ ok: boolean }>(`/products/${id}/images/order`, {
      method: "PATCH",
      body: JSON.stringify({ imageIds }),
    }),
  categories: () => request<{ categories: string[] }>("/products/categories"),
  lowStock: () => request<{ products: any[] }>("/products/low-stock"),
  orders: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ orders: any[]; pagination: Pagination }>(`/orders${qs}`);
  },
  order: (id: string) => request<{ order: any; items: any[] }>(`/orders/${id}`),
  deleteOrder: (id: string) => request<{ ok: boolean }>(`/orders/${id}`, { method: "DELETE" }),
  updateOrderStatus: (id: string, status: string) => request<{ ok: boolean }>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  bulkUpdateOrderStatus: (ids: number[], status: string) => request<{ ok: boolean; count: number }>("/orders/bulk/status", { method: "PATCH", body: JSON.stringify({ ids, status }) }),
  bulkDeleteOrders: (ids: number[]) => request<{ ok: boolean; count: number }>("/orders/bulk", { method: "DELETE", body: JSON.stringify({ ids }) }),
  updateTracking: (id: string, tracking_number: string) => request<{ ok: boolean }>(`/orders/${id}/tracking`, { method: "PATCH", body: JSON.stringify({ tracking_number }) }),
  updateShipping: (id: string, data: any) => request<{ ok: boolean }>(`/orders/${id}/shipping`, { method: "PATCH", body: JSON.stringify(data) }),
  orderStats: () => request<any>("/orders/stats"),
  customers: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ customers: any[]; pagination: Pagination }>(`/customers${qs}`);
  },
  customer: (id: number) => request<{ customer: any; orders: any[]; addresses: any[] }>(`/customers/${id}`),
  backups: () => request<{ backups: any[] }>("/backups"),
  createBackup: () => request<{ backup: any }>("/backups", { method: "POST" }),
  uploadContentFile: (body: { name: string; data: string }) => request<{ url: string }>("/content/upload", { method: "POST", body: JSON.stringify(body) }),
};
