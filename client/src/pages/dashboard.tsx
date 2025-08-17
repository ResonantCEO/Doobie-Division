import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import StorefrontPage from "./storefront";
import InventoryPage from "./inventory";
import OrdersPage from "./orders";
import AnalyticsPage from "./analytics";
import UsersPage from "./users";
import AdminPage from "./admin";
import ScannerPage from "./scanner";
import CustomerOrdersPage from "@/pages/customer-orders";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  // Extract tab from URL
  const tab = location.split("/")[2] || "storefront";

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const renderTabContent = () => {
    switch (tab) {
      case "storefront":
        return <StorefrontPage />;
      case "inventory":
        return user.role === 'admin' || user.role === 'manager' ? <InventoryPage /> : <StorefrontPage />;
      case "orders":
        return user.role === 'admin' || user.role === 'manager' || user.role === 'staff' ? <OrdersPage /> : <StorefrontPage />;
      case "analytics":
        return user.role === 'admin' || user.role === 'manager' ? <AnalyticsPage /> : <StorefrontPage />;
      case "users":
        return user.role === 'admin' ? <UsersPage /> : <StorefrontPage />;
      case "admin":
        return user.role === 'admin' ? <AdminPage /> : <StorefrontPage />;
      case "scanner":
        return user.role === 'admin' || user.role === 'manager' ? <ScannerPage /> : <StorefrontPage />;
      default:
        return <StorefrontPage />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} currentTab={tab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Updated routing to include customer-orders page */}
        {location === "/dashboard/storefront" && <StorefrontPage />}
        {location === "/dashboard/inventory" && (user.role === 'admin' || user.role === 'manager' ? <InventoryPage /> : <StorefrontPage />)}
        {location === "/dashboard/orders" && (user.role === 'admin' || user.role === 'manager' || user.role === 'staff' ? <OrdersPage /> : <StorefrontPage />)}
        {location === "/dashboard/analytics" && (user.role === 'admin' || user.role === 'manager' ? <AnalyticsPage /> : <StorefrontPage />)}
        {location === "/dashboard/users" && (user.role === 'admin' ? <UsersPage /> : <StorefrontPage />)}
        {location === "/dashboard/admin" && (user.role === 'admin' ? <AdminPage /> : <StorefrontPage />)}
        {location === "/dashboard/scanner" && (user.role === 'admin' || user.role === 'manager' ? <ScannerPage /> : <StorefrontPage />)}
        {location === "/customer-orders" && <CustomerOrdersPage />}
        {location === "/dashboard" && <StorefrontPage />}
      </main>
    </div>
  );
}