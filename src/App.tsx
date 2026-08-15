import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { PaymentPage } from "@/pages/PaymentPage";
import { OrderSuccessPage, PaymentFailedPage } from "@/pages/PaymentResultPages";
import { AccountPage } from "@/pages/AccountPage";
import { ProductPage } from "@/pages/ProductPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { AboutPage } from "@/pages/AboutPage";
import { PolicyPage } from "@/pages/PolicyPage";
import { ReturnsPage } from "@/pages/ReturnsPage";
import { ShippingPage } from "@/pages/ShippingPage";
import { FaqPage } from "@/pages/FaqPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import NotFound from "@/pages/not-found";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminCoupons } from "@/pages/admin/AdminCoupons";
import { AdminReviews } from "@/pages/admin/AdminReviews";
import { AdminMarketing } from "@/pages/admin/AdminMarketing";
import { AdminContent } from "@/pages/admin/AdminContent";
import { AdminSecurity } from "@/pages/admin/AdminSecurity";
import { AdminHero } from "@/pages/admin/AdminHero";
import { AdminAbout } from "@/pages/admin/AdminAbout";
import { AdminPricing } from "@/pages/admin/AdminPricing";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

function AnalyticsTracker() {
  useAnalytics();
  return null;
}

/** Mounts once at the app root; resets scroll to top on every new page navigation. */
function ScrollRestoration() {
  useScrollRestoration();
  return null;
}

const AdminAnalyticsRoute = AdminAnalytics;
const AdminOrdersRoute = AdminOrders;
const AdminProductsRoute = AdminProducts;
const AdminUsersRoute = AdminUsers;
const AdminCouponsRoute = AdminCoupons;
const AdminReviewsRoute = AdminReviews;
const AdminMarketingRoute = AdminMarketing;
const AdminContentRoute = AdminContent;
const AdminHeroRoute = AdminHero;
const AdminAboutRoute = AdminAbout;
const AdminPricingRoute = AdminPricing;
const AdminSecurityRoute = AdminSecurity;
const AdminDashboardRoute = AdminDashboard;

function App() {
  return (
    <>
      <AnalyticsTracker />
      <ScrollRestoration />
      <ErrorBoundary>
        <Switch>
          <Route path="/admin/analytics" component={AdminAnalyticsRoute} />
          <Route path="/admin/orders" component={AdminOrdersRoute} />
          <Route path="/admin/products" component={AdminProductsRoute} />
          <Route path="/admin/pricing" component={AdminPricingRoute} />
          <Route path="/admin/customers" component={AdminUsersRoute} />
          <Route path="/admin/users" component={AdminUsersRoute} />
          <Route path="/admin/coupons" component={AdminCouponsRoute} />
          <Route path="/admin/reviews" component={AdminReviewsRoute} />
          <Route path="/admin/marketing" component={AdminMarketingRoute} />
          <Route path="/admin/content" component={AdminContentRoute} />
          <Route path="/admin/hero" component={AdminHeroRoute} />
          <Route path="/admin/about" component={AdminAboutRoute} />
          <Route path="/admin/security" component={AdminSecurityRoute} />
          <Route path="/admin" component={AdminDashboardRoute} />

          <Route path="/" component={HomePage} />
          <Route path="/collections" component={CollectionsPage} />
          <Route path="/product/:slug" component={ProductPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/policy" component={PolicyPage} />
          <Route path="/returns" component={ReturnsPage} />
          <Route path="/shipping" component={ShippingPage} />
          <Route path="/faq" component={FaqPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout/payment" component={PaymentPage} />
          <Route path="/order-success/:orderId" component={OrderSuccessPage} />
          <Route path="/payment-failed/:orderId" component={PaymentFailedPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/account" component={AccountPage} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
      <Toaster position="top-center" richColors />
    </>
  );
}

export default App;
