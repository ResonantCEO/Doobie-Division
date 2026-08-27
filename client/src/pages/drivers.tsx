import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Truck, MapPin, Calendar, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import OrderDetailsModal from "@/components/modals/order-details-modal";

type DriverOrder = Order & {
  orderItems?: Array<{
    id: number;
    productName: string;
    productSku: string | null;
    quantity: number;
    size: string | null;
    subtotal: string;
    fulfilled: boolean;
    removed: boolean;
  }>;
};

function formatDate(value: unknown) {
  if (!value) return "Date unavailable";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "MMM d, yyyy 'at' h:mm a");
}

export default function DriversPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const canViewDrivers = user?.role === "admin" || user?.role === "manager" || user?.role === "driver";

  const {
    data: orders = [],
    isLoading: ordersLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DriverOrder[]>({
    queryKey: ["/api/orders", "drivers", "shipped"],
    enabled: canViewDrivers,
    queryFn: async () => {
      const response = await fetch("/api/orders?status=shipped", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to fetch assigned orders: ${response.statusText}`);
      }
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    },
    staleTime: 0,
    gcTime: 0,
  });

  if (authLoading || (canViewDrivers && ordersLoading)) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canViewDrivers) {
    return (
      <Alert variant="destructive">
        <AlertDescription>You do not have permission to view the Drivers page.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Drivers</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.role === "driver" ? "Orders assigned to you" : "Assigned delivery orders"}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>Assigned orders could not be loaded. Please try again.</AlertDescription>
        </Alert>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
            <Truck className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No assigned orders</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders assigned to you will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => {
            const items = (order.orderItems ?? []).filter((item) => !item.removed);
            return (
              <Card
                key={order.id}
                className="cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-primary"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {order.customerName}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">Order {order.orderNumber}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={order.paymentMethod === "prepay"
                        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                        : "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"}
                    >
                      {order.paymentMethod === "prepay" ? "Pre-Pay" : "PUA"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{order.shippingAddress || "Address unavailable"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span>{order.paymentMethod === "prepay" ? "Pre-paid" : "Pay upon arrival"}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="text-sm text-muted-foreground">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                    <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-4 w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedOrder(order);
                    }}
                  >
                    View order details
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          userRole={user?.role}
        />
      )}
    </div>
  );
}