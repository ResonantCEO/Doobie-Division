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
import TelegramUsernamePrompt from "@/components/TelegramUsernamePrompt";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { Component, useCallback, useEffect, type ErrorInfo, type ReactNode } from "react";


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
      <TelegramUsernamePrompt user={user} />
      <Switch>
        <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
        <Route path="/storefront" component={StorefrontWithGate} />
        <Route path="/dashboard/orders" component={Dashboard} />
        <Route path="/dashboard/drivers" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/:tab" component={Dashboard} />
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

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App] Unhandled render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background p-6 text-foreground">
          <div className="mx-auto mt-20 max-w-xl rounded-lg border border-destructive/50 bg-card p-6 shadow-lg">
            <h1 className="text-xl font-bold">The page could not be displayed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected display error occurred."}
            </p>
            <button
              className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
          <AppErrorBoundary>
            <Router />
          </AppErrorBoundary>
          <Toaster />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
