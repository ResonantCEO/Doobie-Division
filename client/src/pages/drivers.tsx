import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Truck, MapPin, FileText, CreditCard, Loader2 } from "lucide-react";
import type { Order } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import OrderDetailsModal from "@/components/modals/order-details-modal";

type DriverOrder = Order & {
  assignedUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
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
  customerTelegramUsername?: string | null;
};

type DriverOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export default function DriversPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const canViewDrivers = user?.role === "admin" || user?.role === "manager" || user?.role === "driver";
  const canAssignDrivers = user?.role === "admin" || user?.role === "manager";

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

  const { data: drivers = [], isLoading: driversLoading } = useQuery<DriverOption[]>({
    queryKey: ["/api/users/drivers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/drivers");
      return response.json();
    },
    enabled: canAssignDrivers,
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ orderId, assignedUserId }: { orderId: number; assignedUserId: string | null }) => {
      await apiRequest("PUT", `/api/orders/${orderId}/assign`, { assignedUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Driver updated", description: "The order's driver assignment has been saved." });
    },
    onError: () => {
      toast({ title: "Assignment failed", description: "The driver assignment could not be saved.", variant: "destructive" });
    },
  });

  const shippedOrders = orders.filter(
    (order) => order.status === "shipped" && !order.archived
  );

  if (authLoading || (canViewDrivers && ordersLoading) || (canAssignDrivers && driversLoading)) {
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
            {user?.role === "driver" ? "Shipped orders assigned to you" : "Assign drivers to shipped orders"}
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
      ) : shippedOrders.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
            <Truck className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No shipped orders</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.role === "driver" ? "Shipped orders assigned to you will appear here." : "Orders in the Shipped column will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shippedOrders.map((order) => {
            const items = (order.orderItems ?? []).filter((item) => !item.removed);
            const paymentPhotoUrl =
              order.paymentPhotoUrl || (order as any).payment_photo_url;
            return (
              <Card
                key={order.id}
                className="cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-primary"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(240px,1.35fr)_minmax(210px,1fr)_minmax(190px,0.9fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3 md:block">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {order.customerName}
                          </h3>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            Telegram: {order.customerTelegramUsername
                              ? `@${order.customerTelegramUsername.replace(/^@+/, "")}`
                              : "Unavailable"}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`shrink-0 md:hidden ${order.paymentMethod === "prepay"
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                            : "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"}`}
                        >
                          {order.paymentMethod === "prepay" ? "Pre-Pay" : "PUA"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="truncate">{order.shippingAddress || "Address unavailable"}</span>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{order.notes || "No order notes"}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`hidden shrink-0 md:inline-flex ${order.paymentMethod === "prepay"
                          ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                          : "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"}`}
                      >
                        {order.paymentMethod === "prepay" ? "Pre-Pay" : "PUA"}
                      </Badge>
                    </div>

                    {canAssignDrivers ? (
                      <div
                        className="space-y-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Assigned Driver
                        </label>
                        <Select
                          value={order.assignedUserId || "unassigned"}
                          onValueChange={(driverId) => assignDriverMutation.mutate({
                            orderId: order.id,
                            assignedUserId: driverId === "unassigned" ? null : driverId,
                          })}
                          disabled={assignDriverMutation.isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Choose a driver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.firstName || driver.lastName
                                  ? `${driver.firstName || ""} ${driver.lastName || ""}`.trim()
                                  : driver.email || driver.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-4 w-4 shrink-0" />
                        <span>Assigned to you</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 border-t pt-4 md:min-w-[150px] md:flex-col md:items-end md:border-t-0 md:pt-0">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {items.length} {items.length === 1 ? "item" : "items"}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          ${Number(order.total).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 md:w-full">
                        {order.paymentMethod === "prepay" && paymentPhotoUrl && (
                          <Button
                            asChild
                            variant="outline"
                            className="md:hidden"
                          >
                            <a
                              href={paymentPhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <CreditCard className="h-4 w-4" />
                              Payment photo
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          className="shrink-0 md:w-full"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        >
                          View details
                        </Button>
                      </div>
                    </div>
                  </div>
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