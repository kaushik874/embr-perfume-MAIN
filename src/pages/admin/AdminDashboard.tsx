import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Package, ShoppingBag, CreditCard, Users, AlertTriangle, TrendingUp, Calendar } from "lucide-react";

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <AdminLayout><p className="text-red-500">Error: {error}</p></AdminLayout>;
  if (!data) return <AdminLayout><div className="animate-pulse text-gray-400 py-10 text-center">Loading dashboard...</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold font-serif mb-8 text-gray-900 dark:text-white">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Revenue" value={`₹${data.totalRevenue.toLocaleString()}`} icon={TrendingUp} />
        <StatCard title="Monthly Revenue" value={`₹${(data.monthlyRevenue || 0).toLocaleString()}`} icon={CreditCard} subtitle="This month" />
        <StatCard title="Total Orders" value={data.totalOrders} icon={ShoppingBag} />
        <StatCard title="Today's Orders" value={data.todayOrders || 0} icon={Calendar} subtitle="Today" />
        <StatCard title="Products" value={`${data.publishedProducts} / ${data.totalProducts}`} icon={Package} subtitle="Published / Total" />
        <StatCard title="Customers" value={data.totalCustomers} icon={Users} />
      </div>

      {/* Order Status Breakdown */}
      <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Order Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatusBlock label="Pending" value={data.pendingOrders} color="text-yellow-600" />
          <StatusBlock label="Paid" value={data.paidOrders} color="text-green-600" />
          <StatusBlock label="Shipped" value={data.shippedOrders} color="text-blue-600" />
          <StatusBlock label="Delivered" value={data.deliveredOrders} color="text-purple-600" />
          <StatusBlock label="Cancelled" value={data.cancelledOrders} color="text-red-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order: any) => (
                <div key={order.id} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-md transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Order #{order.id}</p>
                    <p className="text-xs text-gray-500">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">₹{(order.total_paise / 100).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === "paid" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                      order.status === "delivered" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" :
                      order.status === "cancelled" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Low Stock Alerts</h2>
          </div>
          {data.lowStockProducts.length === 0 && data.outOfStockCount === 0 ? (
            <p className="text-sm text-gray-500">All products are well-stocked.</p>
          ) : (
            <>
              {data.outOfStockCount > 0 && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {data.outOfStockCount} product(s) out of stock
                  </p>
                </div>
              )}
              {data.lowStockProducts.length > 0 && (
                <div className="space-y-3">
                  {data.lowStockProducts.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.sku || p.slug}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-600">{p.stock} left</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top Selling Products */}
      {data.topProducts && data.topProducts.length > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Top Selling Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="py-2 pr-4 font-medium text-gray-500">Product</th>
                  <th className="py-2 pr-4 font-medium text-gray-500">Units Sold</th>
                  <th className="py-2 font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.topProducts.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{p.total_sold}</td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">₹{(p.total_revenue_paise / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: any; subtitle?: string }) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatusBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
