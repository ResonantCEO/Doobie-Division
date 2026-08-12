import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/theme-context";
import { CartProvider } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import WireframePage from "@/pages/wireframe";
import StorefrontPage from "@/pages/storefront";
import StorefrontWithGate from "@/components/StorefrontWithGate";
import InventoryPage from "@/pages/inventory";
import OrdersPage from "@/pages/orders";
import AnalyticsPage from "@/pages/analytics";
import UsersPage from "@/pages/users";
import ProfilePage from "@/pages/profile";
import ScannerPage from "./pages/scanner";
import CustomerOrdersWrapper from "@/pages/customer-orders-wrapper";
import SupportPage from "@/pages/support";
import AccessGate from "@/components/AccessGate";
import InactivityWarning from "@/components/InactivityWarning";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { useCallback, useEffect, useState } from "react";


function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const qc = useQueryClient();

  const handleInactivityLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (_) {}
    qc.clear();
    window.location.href = "/";
  }, [qc]);

  const isCustomer = isAuthenticated && user?.role === "customer";

  const { showWarning, secondsLeft, stayLoggedIn } = useInactivityTimer({
    enabled: isCustomer,
    onLogout: handleInactivityLogout,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <InactivityWarning
        open={showWarning}
        secondsLeft={secondsLeft}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={handleInactivityLogout}
      />
      <Switch>
        <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
        <Route path="/storefront" component={StorefrontWithGate} />
        <Route path="/dashboard/:tab?" component={Dashboard} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/scanner" component={ScannerPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/wireframe" component={WireframePage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/customer-orders" component={CustomerOrdersWrapper} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    const preventScrollOnNumberInputs = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "number") {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", preventScrollOnNumberInputs, { passive: false });
    return () => document.removeEventListener("wheel", preventScrollOnNumberInputs);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <Router />
          <Toaster />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
