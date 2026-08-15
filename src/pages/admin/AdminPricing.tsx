import { useEffect, useState, useCallback } from "react";
import { adminApi, type ProductFull, type Pagination } from "@/lib/admin-api";
import { AdminLayout } from "./AdminLayout";
import { toast } from "sonner";
import { Save, Truck } from "lucide-react";

export function AdminPricing() {
  const [products, setProducts] = useState<ProductFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingEdits, setShippingEdits] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.products({ limit: "200", sort: "name" });
      setProducts(res.products);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleShippingChange = (id: number, value: string) => {
    setShippingEdits((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async (product: ProductFull) => {
    const raw = shippingEdits[product.id];
    if (raw === undefined) return;
    const value = parseInt(raw, 10);
    if (isNaN(value) || value < 0) {
      toast.error("Shipping charge must be a non-negative whole number");
      return;
    }
    setSavingId(product.id);
    try {
      await adminApi.updateProductShipping(product.id, value);
      toast.success(`Shipping charge updated for ${product.name}`);
      setShippingEdits((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, shipping_charge: value } : p
        )
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">
            Product Pricing
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage shipping charges per product. Shipping is charged once per unique product in the order.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                Product
              </th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                Price (₹)
              </th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                MRP (₹)
              </th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  Shipping (₹)
                </div>
              </th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                Status
              </th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const editValue = shippingEdits[p.id];
                const currentShipping = p.shipping_charge ?? 0;
                const hasChange =
                  editValue !== undefined &&
                  parseInt(editValue, 10) !== currentShipping;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.image && (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-10 w-8 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-500">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">₹{p.price}</td>
                    <td className="px-6 py-4 text-gray-500">₹{p.mrp}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            editValue !== undefined
                              ? editValue
                              : String(currentShipping)
                          }
                          onChange={(e) =>
                            handleShippingChange(p.id, e.target.value)
                          }
                          className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          p.status === "published"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleSave(p)}
                        disabled={!hasChange || savingId === p.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          hasChange
                            ? "bg-black dark:bg-white text-white dark:text-black hover:opacity-90"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingId === p.id ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
