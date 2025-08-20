import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
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
import DashboardPage from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import NotFoundPage from "@/pages/not-found";
import ScannerPage from "./pages/scanner";
import CustomerOrdersWrapper from "@/pages/customer-orders-wrapper";
import SupportPage from "@/pages/support";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard/:tab?" component={Dashboard} />
          <Route path="/customer-orders" component={CustomerOrdersWrapper} />
        </>
      )}
      <Route path="/dashboard/*" component={Dashboard} />
          <Route path="/storefront" component={StorefrontPage} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/orders" component={OrdersPage} />
          <Route path="/scanner" component={ScannerPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/users" component={UsersPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/wireframe" component={WireframePage} />
          <Route path="/support" component={SupportPage} />
        <Route path="/404" component={NotFound} />
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