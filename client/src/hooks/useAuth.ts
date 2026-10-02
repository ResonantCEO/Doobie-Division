import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    // Pick up approval without requiring the pending user to sign out and back in.
    refetchInterval: (query) => query.state.data?.status === "pending" ? 15000 : false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
