import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { PaymentPage } from "@/pages/PaymentPage";
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
import React, { Suspense } from "react";
const AdminDashboard = React.lazy(() => import("@/pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminOrders = React.lazy(() => import("@/pages/admin/AdminOrders").then(m => ({ default: m.AdminOrders })));
const AdminProducts = React.lazy(() => import("@/pages/admin/AdminProducts").then(m => ({ default: m.AdminProducts })));
const AdminUsers = React.lazy(() => import("@/pages/admin/AdminUsers").then(m => ({ default: m.AdminUsers })));
const AdminCoupons = React.lazy(() => import("@/pages/admin/AdminCoupons").then(m => ({ default: m.AdminCoupons })));
const AdminReviews = React.lazy(() => import("@/pages/admin/AdminReviews").then(m => ({ default: m.AdminReviews })));
const AdminMarketing = React.lazy(() => import("@/pages/admin/AdminMarketing").then(m => ({ default: m.AdminMarketing })));
const AdminContent = React.lazy(() => import("@/pages/admin/AdminContent").then(m => ({ default: m.AdminContent })));
const AdminSecurity = React.lazy(() => import("@/pages/admin/AdminSecurity").then(m => ({ default: m.AdminSecurity })));
const AdminHero = React.lazy(() => import("@/pages/admin/AdminHero").then(m => ({ default: m.AdminHero })));
const AdminAbout = React.lazy(() => import("@/pages/admin/AdminAbout").then(m => ({ default: m.AdminAbout })));
const AdminAnalytics = React.lazy(() => import("@/pages/admin/AdminAnalytics").then(m => ({ default: m.AdminAnalytics })));
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

function withSuspense(Component: React.ComponentType) {
  return function SuspenseWrapper(props: any) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-brand-gold">Loading...</div>}>
        <Component {...props} />
      </Suspense>
    );
  };
}

const AdminAnalyticsRoute = withSuspense(AdminAnalytics);
const AdminOrdersRoute = withSuspense(AdminOrders);
const AdminProductsRoute = withSuspense(AdminProducts);
const AdminUsersRoute = withSuspense(AdminUsers);
const AdminCouponsRoute = withSuspense(AdminCoupons);
const AdminReviewsRoute = withSuspense(AdminReviews);
const AdminMarketingRoute = withSuspense(AdminMarketing);
const AdminContentRoute = withSuspense(AdminContent);
const AdminHeroRoute = withSuspense(AdminHero);
const AdminAboutRoute = withSuspense(AdminAbout);
const AdminSecurityRoute = withSuspense(AdminSecurity);
const AdminDashboardRoute = withSuspense(AdminDashboard);

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
