import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Truck, MapPin, FileText, CreditCard, Loader2, Search, X, Save, Users } from "lucide-react";
import type { Order } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import OrderDetailsModal from "@/components/modals/order-details-modal";
import { Input } from "@/components/ui/input";

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
  assignedCities: string[];
};

type DeliveryCity = {
  id: number;
  cityName: string;
};

type CityOrderGroup = {
  city: string;
  orders: DriverOrder[];
};

const getCityFromAddress = (shippingAddress: string | null | undefined): string => {
  if (!shippingAddress) return "Unknown city";

  const addressParts = shippingAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Support the current street, city, state, ZIP format and older
  // street, city, state ZIP addresses.
  if (addressParts.length >= 4) {
    return addressParts[addressParts.length - 3] || "Unknown city";
  }
  if (addressParts.length >= 3) {
    return addressParts[addressParts.length - 2] || "Unknown city";
  }

  return "Unknown city";
};

const getAssignedDriverName = (order: DriverOrder): string => {
  const assignedUser = order.assignedUser;
  if (!assignedUser) return "Unassigned";

  const name = `${assignedUser.firstName || ""} ${assignedUser.lastName || ""}`.trim();
  return name || assignedUser.email || "Assigned driver";
};

export default function DriversPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityDrafts, setCityDrafts] = useState<Record<string, string[]>>({});

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

  const { data: deliveryCities = [], isLoading: citiesLoading } = useQuery<DeliveryCity[]>({
    queryKey: ["/api/driver-delivery-cities/cities"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/driver-delivery-cities/cities");
      return response.json();
    },
    enabled: canAssignDrivers,
  });

  useEffect(() => {
    setCityDrafts(Object.fromEntries(
      drivers.map((driver) => [driver.id, driver.assignedCities || []])
    ));
  }, [drivers]);

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

  const saveCitiesMutation = useMutation({
    mutationFn: async ({ driverId, cityNames }: { driverId: string; cityNames: string[] }) => {
      const response = await apiRequest("PUT", `/api/users/${driverId}/delivery-cities`, { cityNames });
      return response.json();
    },
    onSuccess: (result: { autoAssignedOrderCount?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Delivery cities saved",
        description: result.autoAssignedOrderCount
          ? `${result.autoAssignedOrderCount} matching shipped ${result.autoAssignedOrderCount === 1 ? "order was" : "orders were"} assigned automatically.`
          : "New shipped orders for these cities will be assigned automatically.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save delivery cities",
        description: error.message || "One or more cities may already belong to another driver.",
        variant: "destructive",
      });
    },
  });

  const shippedOrders = useMemo(
    () => orders.filter((order) => order.status === "shipped" && !order.archived),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return shippedOrders;

    return shippedOrders.filter((order) => [
      getCityFromAddress(order.shippingAddress),
      order.customerName || "",
      getAssignedDriverName(order),
    ].some((field) => field.toLocaleLowerCase().includes(normalizedQuery)));
  }, [searchQuery, shippedOrders]);

  const cityGroups = useMemo<CityOrderGroup[]>(() => {
    const groups = new Map<string, DriverOrder[]>();

    filteredOrders.forEach((order) => {
      const city = getCityFromAddress(order.shippingAddress);
      groups.set(city, [...(groups.get(city) || []), order]);
    });

    return Array.from(groups.entries())
      .sort(([firstCity], [secondCity]) =>
        firstCity.localeCompare(secondCity, undefined, { sensitivity: "base" })
      )
      .map(([city, ordersInCity]) => ({ city, orders: ordersInCity }));
  }, [filteredOrders]);

  if (authLoading || (canViewDrivers && ordersLoading) || (canAssignDrivers && (driversLoading || citiesLoading))) {
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

      {canAssignDrivers && (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Users className="mt-1 h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Driver accounts</CardTitle>
                <CardDescription>
                  Assign each active driver one or more delivery cities. A city can belong to only one driver.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active driver accounts found. Create or activate a driver account in User Management first.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {drivers.map((driver) => {
                  const driverName = `${driver.firstName || ""} ${driver.lastName || ""}`.trim()
                    || driver.email
                    || driver.id;
                  const selectedCities = cityDrafts[driver.id] || [];
                  return (
                    <div key={driver.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{driverName}</p>
                          {driver.email && <p className="truncate text-sm text-muted-foreground">{driver.email}</p>}
                        </div>
                        <Badge variant={selectedCities.length ? "default" : "secondary"}>
                          {selectedCities.length} {selectedCities.length === 1 ? "city" : "cities"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {deliveryCities.map((city) => {
                          const checked = selectedCities.includes(city.cityName);
                          const assignedToOtherDriver = drivers.some(
                            (otherDriver) =>
                              otherDriver.id !== driver.id
                              && (cityDrafts[otherDriver.id] || otherDriver.assignedCities || []).includes(city.cityName)
                          );
                          return (
                            <label
                              key={city.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                assignedToOtherDriver && !checked ? "cursor-not-allowed opacity-50" : ""
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={assignedToOtherDriver && !checked || saveCitiesMutation.isPending}
                                onCheckedChange={(value) => {
                                  setCityDrafts((current) => {
                                    const currentCities = current[driver.id] || [];
                                    return {
                                      ...current,
                                      [driver.id]: value
                                        ? [...currentCities, city.cityName]
                                        : currentCities.filter((name) => name !== city.cityName),
                                    };
                                  });
                                }}
                              />
                              <span>{city.cityName}</span>
                            </label>
                          );
                        })}
                      </div>
                      <Button
                        className="mt-4 w-full gap-2"
                        size="sm"
                        disabled={saveCitiesMutation.isPending}
                        onClick={() => saveCitiesMutation.mutate({
                          driverId: driver.id,
                          cityNames: selectedCities,
                        })}
                      >
                        <Save className="h-4 w-4" />
                        Save cities for {driverName}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
        <div className="space-y-5">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by city, customer, or assigned driver"
                  aria-label="Search driver orders"
                  className="pl-9 pr-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear order search"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? `Showing ${filteredOrders.length} of ${shippedOrders.length} shipped ${shippedOrders.length === 1 ? "order" : "orders"}`
                  : `${shippedOrders.length} shipped ${shippedOrders.length === 1 ? "order" : "orders"} organized by city`}
              </p>
            </CardContent>
          </Card>

          {cityGroups.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
                <Search className="mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No matching orders</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different city, customer name, or assigned driver.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {cityGroups.map(({ city, orders: cityOrders }) => (
                <section key={city} aria-labelledby={`city-heading-${city}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-5 w-5 shrink-0 text-primary" />
                      <h3
                        id={`city-heading-${city}`}
                        className="truncate text-lg font-semibold text-gray-900 dark:text-white"
                      >
                        {city}
                      </h3>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {cityOrders.length} {cityOrders.length === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {cityOrders.map((order) => {
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
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {order.customerName}
                          </h4>
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
                      <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-full">
                        <Button
                          variant="secondary"
                          className="shrink-0 w-full"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        >
                          View details
                        </Button>
                        {order.paymentMethod === "prepay" && paymentPhotoUrl && (
                          <Button
                            asChild
                            className="w-full bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
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
                        {order.paymentMethod === "prepay" && !paymentPhotoUrl && (
                          <Button
                            type="button"
                            disabled
                            className="w-full bg-green-600 text-white opacity-50 dark:bg-green-700"
                            title="No payment photo attached"
                          >
                            <CreditCard className="h-4 w-4" />
                            Payment photo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
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