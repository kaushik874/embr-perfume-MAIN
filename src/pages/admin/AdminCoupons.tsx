import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Plus, Trash2, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    expiry_date: "",
    usage_limit: "",
  });

  const loadCoupons = () => {
    setLoading(true);
    adminApi.getCoupons()
      .then((res) => setCoupons(res.coupons))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleDelete = async (id: number, code: string) => {

    try {
      await adminApi.deleteCoupon(id);
      toast.success("Coupon deleted");
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.discount_value) {
      toast.error("Code and discount value are required");
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createCoupon({
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        expiry_date: form.expiry_date || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      });
      toast.success(`Coupon "${form.code.toUpperCase()}" created`);
      setForm({ code: "", discount_type: "percent", discount_value: "", expiry_date: "", usage_limit: "" });
      setShowForm(false);
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Coupons</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? "Cancel" : "Add Coupon"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Coupon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. EMBR10"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Discount Type *</Label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm(f => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Discount Value * {form.discount_type === "percent" ? "(%)" : "(₹)"}</Label>
              <Input
                type="number"
                min="1"
                value={form.discount_value}
                onChange={(e) => setForm(f => ({ ...f, discount_value: e.target.value }))}
                placeholder={form.discount_type === "percent" ? "10" : "100"}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Usage Limit (optional)</Label>
              <Input
                type="number"
                min="1"
                value={form.usage_limit}
                onChange={(e) => setForm(f => ({ ...f, usage_limit: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date (optional)</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Coupon"}</Button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Code</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Discount</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Uses</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Expiry</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Status</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No coupons yet. Click "Add Coupon" to create one.</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4 font-medium">
                    <Ticket className="w-4 h-4 inline mr-2 text-amber-500"/>
                    <span className="font-mono text-sm">{c.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold">{c.discount_value}{c.discount_type === "percent" ? "%" : " ₹"}</span>
                    <span className="text-gray-500 text-xs ml-1">off</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={c.usage_limit && c.times_used >= c.usage_limit ? "text-red-600" : ""}>
                      {c.times_used} / {c.usage_limit || "∞"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(c.id, c.code)}
                      className="text-red-600 hover:opacity-80 p-1 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
