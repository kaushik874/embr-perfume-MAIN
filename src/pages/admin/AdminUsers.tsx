import { useEffect, useState, useCallback } from "react";
import { adminApi, type Pagination } from "@/lib/admin-api";
import { AdminLayout } from "./AdminLayout";
import { toast } from "sonner";

export function AdminUsers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (search) params.search = search;
      const res = await adminApi.customers(params);
      setCustomers(res.customers);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const viewCustomer = async (id: number) => {
    try {
      const res = await adminApi.customer(id);
      setSelectedCustomer(res.customer);
      setCustomerOrders(res.orders);
      setCustomerAddresses(res.addresses || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const totalPages = pagination?.totalPages || 1;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      delivered: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`;
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Customers</h1>
      </div>

      <div className="flex gap-3 mb-6">
        <input type="text" placeholder="Search by name, email or phone..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white flex-1 min-w-[200px]" />
      </div>

      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Total Spent</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No customers found.</td></tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.phone || "—"}</td>
                  <td className="px-4 py-3 font-medium">{c.order_count}</td>
                  <td className="px-4 py-3 font-medium">₹{(c.total_spent / 100).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => viewCustomer(c.id)}
                      className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white font-medium text-xs">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-4xl mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-serif mb-6 text-gray-900 dark:text-white">Customer Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500">Name:</p><p className="text-gray-900 dark:text-white font-medium">{selectedCustomer.name}</p>
              <p className="text-gray-500">Email:</p><p className="text-gray-900 dark:text-white">{selectedCustomer.email}</p>
              <p className="text-gray-500">Phone:</p><p className="text-gray-900 dark:text-white">{selectedCustomer.phone || "—"}</p>
              <p className="text-gray-500">Joined:</p><p className="text-gray-900 dark:text-white">{new Date(selectedCustomer.created_at).toLocaleDateString()}</p>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Saved Addresses ({customerAddresses.length})</h3>
            {customerAddresses.length === 0 ? (
              <p className="text-sm text-gray-500 mb-6">No saved addresses.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {customerAddresses.map((a: any) => (
                  <div key={a.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{a.full_name}</p>
                        <p className="text-xs text-gray-500">{a.mobile} - {a.email}</p>
                      </div>
                      {a.is_default ? <span className="text-[10px] uppercase tracking-widest text-green-700 dark:text-green-400">Default</span> : null}
                    </div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      {[a.company_name, a.house_number, a.street, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                    </p>
                    {a.alternate_mobile ? <p className="mt-1 text-xs text-gray-500">Alternate: {a.alternate_mobile}</p> : null}
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Order History ({customerOrders.length})</h3>
            {customerOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 text-left font-medium">Order</th>
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Shipping</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.map((o: any) => (
                    <tr key={o.id} className="border-b border-gray-100 dark:border-gray-800/50">
                      <td className="py-2 font-medium">#{o.id}</td>
                      <td className="py-2 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="py-2 text-right">₹{(o.total_paise / 100).toFixed(2)}</td>
                      <td className="py-2 text-right"><span className={statusBadge(o.status)}>{o.status}</span></td>
                      <td className="py-2 text-right text-xs text-gray-500">{o.tracking_number || o.shipping_pincode || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-6 text-right">
              <button onClick={() => setSelectedCustomer(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
