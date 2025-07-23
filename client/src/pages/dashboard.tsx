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
        return user.role === 'admin' || user.role === 'manager' ? <OrdersPage /> : <StorefrontPage />;
      case "analytics":
        return user.role === 'admin' || user.role === 'manager' ? <AnalyticsPage /> : <StorefrontPage />;
      case "users":
        return user.role === 'admin' ? <UsersPage /> : <StorefrontPage />;
      default:
        return <StorefrontPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} currentTab={tab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
}
