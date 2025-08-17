
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import CustomerOrdersPage from "./customer-orders";

export default function CustomerOrdersWrapper() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} currentTab="customer-orders" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CustomerOrdersPage />
      </main>
    </div>
  );
}
