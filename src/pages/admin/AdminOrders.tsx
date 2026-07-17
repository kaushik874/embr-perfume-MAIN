import { useEffect, useState, useCallback } from "react";
import { adminApi, type Pagination } from "@/lib/admin-api";
import { AdminLayout } from "./AdminLayout";
import { toast } from "sonner";

export function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [trackingInput, setTrackingInput] = useState("");
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await adminApi.orders(params);
      setOrders(res.orders);
      setPagination(res.pagination);
      setSelectedOrderIds([]); // clear selection on page/filter change
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.orderStats();
      setStats(res);
    } catch {}
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const viewOrder = async (id: string) => {
    try {
      const res = await adminApi.order(id);
      setSelectedOrder(res.order);
      setSelectedItems(res.items);
      setTrackingInput(res.order.tracking_number || "");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await adminApi.updateOrderStatus(id, status);
      toast.success(`Order #${id} marked as ${status}`);
      fetchOrders();
      fetchStats();
      if (selectedOrder?.id == id) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrderIds.length === 0) return;
    setUpdating(true);
    try {
      const res = await adminApi.bulkUpdateOrderStatus(selectedOrderIds, status);
      toast.success(`Updated status to ${status} for ${res.count} orders`);
      if (selectedOrder && selectedOrderIds.includes(selectedOrder.id)) {
        setSelectedOrder({ ...selectedOrder, status });
      }
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedOrderIds.length} orders?`)) return;
    setUpdating(true);
    try {
      const res = await adminApi.bulkDeleteOrders(selectedOrderIds);
      toast.success(`Deleted ${res.count} orders`);
      if (selectedOrder && selectedOrderIds.includes(selectedOrder.id)) {
        setSelectedOrder(null);
        setSelectedItems([]);
      }
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm(`Delete order #${id}? This cannot be undone.`)) return;
    setUpdating(true);
    try {
      await adminApi.deleteOrder(id);
      toast.success(`Order #${id} deleted`);
      if (selectedOrder?.id == id) {
        setSelectedOrder(null);
        setSelectedItems([]);
      }
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleTrackingUpdate = async (id: string) => {
    if (!trackingInput.trim()) return;
    setUpdating(true);
    try {
      await adminApi.updateTracking(id, trackingInput.trim());
      toast.success("Tracking number updated");
      setSelectedOrder((current: any) =>
        current && String(current.id) === String(id)
          ? { ...current, tracking_number: trackingInput.trim() }
          : current,
      );
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
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

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Orders</h1>
          {stats && (
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>{stats.total} total</span>
              <span className="text-yellow-600">{stats.pending} pending</span>
              <span className="text-green-600">{stats.paid} paid</span>
              <span className="text-blue-600">{stats.shipped} shipped</span>
              <span className="text-purple-600">{stats.delivered} delivered</span>
              <span className="text-red-600">{stats.cancelled} cancelled</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Search by ID, name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white flex-1 min-w-[200px]" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {selectedOrderIds.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {selectedOrderIds.length} orders selected
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) handleBulkStatusChange(e.target.value);
                  e.target.value = ""; // reset select
                }}
                disabled={updating}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
              >
                <option value="">Change Status...</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={handleBulkDelete}
                disabled={updating}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrderIds(orders.map((o) => o.id));
                      else setSelectedOrderIds([]);
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No orders found.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedOrderIds([...selectedOrderIds, o.id]);
                        else setSelectedOrderIds(selectedOrderIds.filter((id) => id !== o.id));
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">#{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{o.shipping_name || "Guest"}</p>
                    <p className="text-xs text-gray-500">{o.account_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">₹{(o.total_paise / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      disabled={updating}
                      onChange={(e) => handleStatusChange(String(o.id), e.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                    >
                      <option value="pending">pending</option>
                      <option value="paid">paid</option>
                      <option value="shipped">shipped</option>
                      <option value="delivered">delivered</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{o.tracking_number || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => viewOrder(o.id)} className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white font-medium text-xs">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-white">Order #{selectedOrder.id}</h2>
                <p className="text-sm text-gray-500">{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
              <span className={statusBadge(selectedOrder.status)}>{selectedOrder.status}</span>
            </div>

            {/* Status Update */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Update Status</label>
              <div className="flex gap-2 flex-wrap">
                {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => (
                  <button key={s} onClick={() => handleStatusChange(selectedOrder.id, s)} disabled={updating || selectedOrder.status === s}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      selectedOrder.status === s
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                        : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tracking Number</label>
              <div className="flex gap-2">
                <input type="text" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Enter tracking number..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <button onClick={() => handleTrackingUpdate(selectedOrder.id)} disabled={updating || !trackingInput.trim()}
                  className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Customer Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-gray-500">Name:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_name || "—"}</p>
                <p className="text-gray-500">Email:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_email || selectedOrder.account_email || "—"}</p>
                <p className="text-gray-500">Phone:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_phone || "—"}</p>
                <p className="text-gray-500">Address:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_address || "—"}</p>
                <p className="text-gray-500">City:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_city || "—"}</p>
                <p className="text-gray-500">Pincode:</p><p className="text-gray-900 dark:text-white">{selectedOrder.shipping_pincode || "—"}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Order Items</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 text-left font-medium">Product</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Price</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">₹{(item.price_paise / 100).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium">₹{((item.price_paise * item.quantity) / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="py-2 text-right font-semibold">Total:</td>
                    <td className="py-2 text-right font-bold">₹{(selectedOrder.total_paise / 100).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteOrder(String(selectedOrder.id))}
                disabled={updating}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Delete Order
              </button>
              <button onClick={() => setSelectedOrder(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
