import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Plus, Trash2, Ticket, X, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CouponForm = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_order_value: string;
  max_discount: string;
  per_customer_limit: string;
  usage_limit: string;
  starts_at: string;
  expiry_date: string;
  status: "active" | "inactive";
};

const emptyForm: CouponForm = {
  code: "",
  discount_type: "percent",
  discount_value: "",
  min_order_value: "",
  max_discount: "",
  per_customer_limit: "",
  usage_limit: "",
  starts_at: "",
  expiry_date: "",
  status: "active",
};

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code || "",
      discount_type: coupon.discount_type || "percent",
      discount_value: String(coupon.discount_value ?? ""),
      min_order_value: coupon.min_order_value != null ? String(coupon.min_order_value) : "",
      max_discount: coupon.max_discount != null ? String(coupon.max_discount) : "",
      per_customer_limit: coupon.per_customer_limit != null ? String(coupon.per_customer_limit) : "",
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
      starts_at: formatDateForInput(coupon.starts_at),
      expiry_date: formatDateForInput(coupon.expiry_date),
      status: coupon.status || "active",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteCoupon(id);
      toast.success("Coupon deleted");
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleStatus = async (coupon: any) => {
    const newStatus = coupon.status === "active" ? "inactive" : "active";
    try {
      await adminApi.toggleCouponStatus(coupon.id, newStatus);
      toast.success(`Coupon ${newStatus === "active" ? "activated" : "deactivated"}`);
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
      const body = {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        starts_at: form.starts_at || null,
        expiry_date: form.expiry_date || null,
        status: form.status,
      };
      if (editingId) {
        await adminApi.updateCoupon(editingId, body);
        toast.success(`Coupon "${body.code}" updated`);
      } else {
        await adminApi.createCoupon(body);
        toast.success(`Coupon "${body.code}" created`);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    key: keyof CouponForm,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: key === "code" ? e.target.value.toUpperCase() : e.target.value }))}
        className="bg-white dark:bg-gray-900"
        {...props}
      />
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Coupons</h1>
        <Button onClick={() => (showForm ? (setShowForm(false), setEditingId(null)) : openCreate())}>
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? "Cancel" : "Add Coupon"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? "Edit Coupon" : "New Coupon"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {field("code", "Coupon Code *", { placeholder: "e.g. EMBR4", required: true })}
            <div className="space-y-1">
              <Label>Discount Type *</Label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            {field("discount_value", `Discount Value * ${form.discount_type === "percent" ? "(%)" : "(₹)"}`, {
              type: "number", min: "1", placeholder: form.discount_type === "percent" ? "4" : "100", required: true,
            })}
            {field("min_order_value", "Min Order Value (₹)", { type: "number", min: "0", placeholder: "No minimum" })}
            {field("max_discount", "Max Discount (₹)", { type: "number", min: "1", placeholder: "No cap" })}
            {field("usage_limit", "Total Usage Limit", { type: "number", min: "1", placeholder: "Unlimited" })}
            {field("per_customer_limit", "Per Customer Limit", { type: "number", min: "1", placeholder: "Unlimited" })}
            <div className="space-y-1">
              <Label>Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="bg-white dark:bg-gray-900"
              />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                className="bg-white dark:bg-gray-900"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Code</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Discount</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Limits</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Uses</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Validity</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Status</th>
              <th className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No coupons yet. Click "Add Coupon" to create one.</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4 font-medium">
                    <Ticket className="w-4 h-4 inline mr-2 text-amber-500" />
                    <span className="font-mono text-sm">{c.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold">
                      {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                    </span>
                    <span className="text-gray-500 text-xs ml-1">off</span>
                    {c.max_discount && (
                      <span className="text-gray-400 text-xs ml-1">(max ₹{c.max_discount})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {c.min_order_value ? <div>Min order: ₹{c.min_order_value}</div> : null}
                    {c.per_customer_limit ? <div>Per user: {c.per_customer_limit}x</div> : null}
                  </td>
                  <td className="px-6 py-4">
                    <span className={c.usage_limit && c.times_used >= c.usage_limit ? "text-red-600" : ""}>
                      {c.times_used} / {c.usage_limit || "∞"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {c.starts_at ? <div>From: {new Date(c.starts_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div> : null}
                    {c.expiry_date ? <div>Until: {new Date(c.expiry_date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div> : <div>No expiry</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-blue-600 hover:opacity-80 p-1 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className={`p-1 rounded ${c.status === "active" ? "text-amber-600" : "text-green-600"} hover:opacity-80`}
                        title={c.status === "active" ? "Deactivate" : "Activate"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-red-600 hover:opacity-80 p-1 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
