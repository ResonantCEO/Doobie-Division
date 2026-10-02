import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    // Pick up suspension, approval, or reinstatement without requiring another login.
    refetchInterval: (query) => query.state.data ? 15000 : false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
