import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation, Redirect } from "wouter";
import { LayoutDashboard, ShoppingBag, Users, Package, LogOut, Ticket, Star, FileText, Send, ShieldAlert, Image as ImageIcon, BookOpen, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { SITE_LOGO, SITE_NAME } from "@/lib/site-brand";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const validAdminRoles = ["admin", "superadmin", "manager", "staff"];
  if (!user || !validAdminRoles.includes(user.role || "")) {
    toast.error("Admin access required.");
    return <Redirect to="/login" />;
  }

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/hero", label: "Hero Banners", icon: ImageIcon },
    { href: "/admin/about", label: "Our Story Page", icon: BookOpen },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/coupons", label: "Coupons", icon: Ticket },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/marketing", label: "Marketing", icon: Send },
    { href: "/admin/content", label: "Content", icon: FileText },
    { href: "/admin/security", label: "Security", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-black border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex md:min-h-screen md:flex-col">
        <div className="p-4 md:p-6 shrink-0">
          <Link href="/">
            <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={SITE_LOGO} alt={SITE_NAME} className="h-8 object-contain" />
              <span className="text-sm font-sans font-normal text-muted-foreground">Admin</span>
            </a>
          </Link>
        </div>
        <nav className="flex flex-1 gap-1 overflow-x-auto px-2 py-3 md:block md:space-y-1 md:px-4 md:py-0">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href === "/admin/customers" && location === "/admin/users");
            return (
              <Link key={link.href} href={link.href}>
                <a
                  className={`flex shrink-0 items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-medium text-black dark:text-white">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 truncate">
              <p className="font-medium text-gray-900 dark:text-gray-50">{user.name}</p>
              <p className="text-xs truncate">{user.email}</p>
            </div>
          </div>
          {logout && (
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
