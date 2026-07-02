import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
import InventoryPage from "@/pages/inventory";
import OrdersPage from "@/pages/orders";
import AnalyticsPage from "@/pages/analytics";
import UsersPage from "@/pages/users";
import ProfilePage from "@/pages/profile";
import ScannerPage from "./pages/scanner";
import CustomerOrdersWrapper from "@/pages/customer-orders-wrapper";
import SupportPage from "@/pages/support";
import AccessGate from "@/components/AccessGate";
import { useState } from "react";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [accessGrantedLocally, setAccessGrantedLocally] = useState(false);

  const { data: accessStatus, isLoading: isLoadingAccess } = useQuery<{ granted: boolean }>({
    queryKey: ["/api/access/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && user?.role === "customer",
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show access gate for customers who haven't been granted access yet
  if (isAuthenticated && user?.role === "customer") {
    const accessGranted = accessGrantedLocally || accessStatus?.granted;
    if (!accessGranted && !isLoadingAccess) {
      return (
        <AccessGate onGranted={() => setAccessGrantedLocally(true)} />
      );
    }
    if (isLoadingAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }
  }

  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      <Route path="/storefront" component={StorefrontPage} />
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
  );
}

function App() {
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
