import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import logoImage from '@assets/Remove_White_Background_(1)_1782586580039.png';
import StorefrontPage from "./storefront";
import InventoryPage from "./inventory";
import OrdersPage from "./orders";
import AnalyticsPage from "./analytics";
import UsersPage from "./users";
import AdminPage from "./admin";

import CustomerOrdersPage from "@/pages/customer-orders";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  const tab = location.split("/")[2] || "storefront";

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
      default:
        return <StorefrontPage />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Render logo directly into document.body via portal so no ancestor
          CSS can interfere with position:fixed on iOS Safari */}
      {tab === "storefront" && createPortal(
        <img
          src={logoImage}
          alt=""
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0.2,
            zIndex: 0,
            top: '50%',
            left: '50%',
            transform: 'translate3d(-50%, -40%, 0)',
            width: '120vmin',
            height: '120vmin',
            objectFit: 'contain',
          }}
        />,
        document.body
      )}
      <Navigation user={user} currentTab={tab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
}
