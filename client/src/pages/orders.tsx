import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderTable from "@/components/order-table";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ShoppingBag, Clock, Truck, CheckCircle, Download, RefreshCw, UserCheck, MapPin } from "lucide-react";
import type { Order } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api";
import OrderDetailsModal from "@/components/modals/order-details-modal";

function extractCity(shippingAddress: string): string {
  const parts = shippingAddress.split(",").map(p => p.trim());
  return parts.length >= 2 ? parts[1] : "Unknown";
}

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [citySort, setCitySort] = useState<string>("none");
  const queryClient = useQueryClient();

  // State for the modal
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Set up real-time WebSocket connection for order updates
  useWebSocket();

  // Set up order notifications
  useOrderNotifications();

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders", statusFilter || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const url = `/api/orders${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch order status breakdown
  const { data: statusBreakdown = [] } = useQuery<{ status: string; count: number }[]>({
    queryKey: ["/api/analytics/order-status-breakdown"],
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch staff users if the current user is an admin or manager
  const { data: staffUsers = [], isLoading: staffLoading } = useQuery({
    queryKey: ["/api/users/staff"],
    queryFn: () => apiRequest("GET", "/api/users/staff"),
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });


  const getStatusStats = () => {
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      shipped: 0,
      cancelled: 0,
    };

    statusBreakdown.forEach((item) => {
      stats.total += item.count;
      if (item.status === "pending") stats.pending = item.count;
      else if (item.status === "processing") stats.processing = item.count;
      else if (item.status === "shipped" || item.status === "delivered") stats.shipped += item.count;
      else if (item.status === "cancelled") stats.cancelled = item.count;
    });

    return stats;
  };

  const stats = getStatusStats();

  // Derive unique cities from all orders
  const uniqueCities = useMemo(() => {
    const cities = new Set(orders.map(o => extractCity(o.shippingAddress)));
    return Array.from(cities).sort();
  }, [orders]);

  // Filter and sort orders by city
  const processedOrders = useMemo(() => {
    let result = [...orders];
    if (cityFilter !== "all") {
      result = result.filter(o => extractCity(o.shippingAddress) === cityFilter);
    }
    if (citySort === "asc") {
      result.sort((a, b) => extractCity(a.shippingAddress).localeCompare(extractCity(b.shippingAddress)));
    } else if (citySort === "desc") {
      result.sort((a, b) => extractCity(b.shippingAddress).localeCompare(extractCity(a.shippingAddress)));
    }
    return result;
  }, [orders, cityFilter, citySort]);

  const handleExportOrders = () => {
    const packedOrders = processedOrders.filter(o => o.status === "packed");

    if (packedOrders.length === 0) {
      alert("No packed orders to export.");
      return;
    }

    const escape = (val: string | null | undefined) => {
      const s = String(val ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    // Split "street, city, state, zip" into separate fields for Spoke.com
    const parseAddress = (addr: string) => {
      const parts = addr.split(",").map(p => p.trim());
      return {
        line1: parts[0] ?? "",
        city: parts[1] ?? "",
        state: parts[2] ?? "",
        zip: parts[3] ?? "",
      };
    };

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Address Line 1",
      "City",
      "State",
      "Zip",
      "Package Size",
      "Order Number",
      "Order Total",
      "Date",
      "Notes",
    ];

    const rows = packedOrders.map(o => {
      const addr = parseAddress(o.shippingAddress);
      return [
        escape(o.customerName),
        escape(o.customerPhone),
        escape(o.customerEmail),
        escape(addr.line1),
        escape(addr.city),
        escape(addr.state),
        escape(addr.zip),
        escape(Number(o.total).toFixed(2)),
        escape(o.orderNumber),
        escape(Number(o.total).toFixed(2)),
        escape(o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""),
        escape(o.notes),
      ];
    });

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `packed-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/order-status-breakdown"] });
    if (user?.role === 'admin' || user?.role === 'manager') {
      queryClient.invalidateQueries({ queryKey: ["/api/users/staff"] });
    }
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
  };


  if (authLoading || ordersLoading || (user?.role === 'admin' || user?.role === 'manager' ? staffLoading : false)) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Order Management</h2>

        {/* Mobile-first filters and actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 sm:items-center flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <MapPin className="h-3.5 w-3.5 mr-1 text-gray-400 flex-shrink-0" />
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {uniqueCities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={citySort} onValueChange={setCitySort}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Sort by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default order</SelectItem>
              <SelectItem value="asc">City A → Z</SelectItem>
              <SelectItem value="desc">City Z → A</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-3 sm:ml-auto">
            <Button onClick={handleRefresh} variant="outline" className="flex-1 sm:flex-initial">
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
            <Button onClick={handleExportOrders} variant="outline" className="flex-1 sm:flex-initial">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export Orders</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-primary">
                <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Orders</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Shipped</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{stats.shipped}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <OrderTable orders={processedOrders} user={user} staffUsers={staffUsers} />

      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isOrderDetailsOpen}
        onClose={() => {
          setIsOrderDetailsOpen(false);
          setSelectedOrder(null);
        }}
        userRole={user?.role}
      />
    </div>
  );
}