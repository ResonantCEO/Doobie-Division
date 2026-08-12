import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn } from "@/lib/queryClient";
import AccessGate from "@/components/AccessGate";
import StorefrontPage from "@/pages/storefront";

export default function StorefrontWithGate() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [accessGrantedLocally, setAccessGrantedLocally] = useState(false);

  const isCustomer = isAuthenticated && user?.role === "customer";

  const { data: accessStatus, isLoading: isLoadingAccess } = useQuery<{ granted: boolean }>({
    queryKey: ["/api/access/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isCustomer,
    retry: false,
  });

  // Wait for auth to resolve before deciding anything
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isCustomer) {
    // Wait for access check to resolve
    if (isLoadingAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }
    const accessGranted = accessGrantedLocally || accessStatus?.granted;
    if (!accessGranted) {
      return (
        <AccessGate
          onGranted={() => setAccessGrantedLocally(true)}
          onBack={() => { window.location.href = "/"; }}
        />
      );
    }
  }

  return <StorefrontPage />;
}
