import { useState, useMemo, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import OrderDetailsModal from "@/components/modals/order-details-modal";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, Edit, MessageSquare, MoreHorizontal, Package2, ChevronDown, ChevronRight, ChevronUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Order, User, OrderItem, Product } from "@shared/schema";

interface OrderTableProps {
  orders: Order[];
  user: User | null | undefined; // Assuming user object contains role information
  staffUsers: User[]; // Array of staff users to populate the dropdown
}

type OrderWithItems = Order & { items: (OrderItem & { product: Product | null })[] };

function OrderItemsRow({ orderId, colSpan }: { orderId: number; colSpan: number }) {
  const { toast } = useToast();
  const [fulfillingItems, setFulfillingItems] = useState<Set<number>>(new Set());
  
  const { data: orderWithItems, isLoading } = useQuery<OrderWithItems>({
    queryKey: ['/api/orders', orderId],
  });

  const fulfillItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: number; productId: number; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/fulfill-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fulfill item');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Fulfilled",
        description: "Physical inventory has been adjusted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fulfill item",
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      setFulfillingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.productId);
        return newSet;
      });
    }
  });

  const unfulfillItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: number; productId: number; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/unfulfill-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unfulfill item');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Unfulfilled",
        description: "Inventory has been restored",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfulfill item",
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      setFulfillingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.productId);
        return newSet;
      });
    }
  });

  const handleFulfillItem = (productId: number, quantity: number) => {
    setFulfillingItems(prev => new Set(prev).add(productId));
    fulfillItemMutation.mutate({ orderId, productId, quantity });
  };

  const handleUnfulfillItem = (productId: number, quantity: number) => {
    setFulfillingItems(prev => new Set(prev).add(productId));
    unfulfillItemMutation.mutate({ orderId, productId, quantity });
  };

  if (isLoading) {
    return (
      <TableRow className="bg-gray-50 dark:bg-gray-900">
        <TableCell colSpan={colSpan} className="py-3 px-6">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
            Loading order items...
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!orderWithItems?.items || orderWithItems.items.length === 0) {
    return (
      <TableRow className="bg-gray-50 dark:bg-gray-900">
        <TableCell colSpan={colSpan} className="py-3 px-6 text-gray-500 dark:text-gray-400">
          No items found for this order.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-gray-50 dark:bg-gray-900">
      <TableCell colSpan={colSpan} className="py-3 px-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Items:</div>
          <div className="grid gap-2">
            {orderWithItems.items.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between bg-white dark:bg-gray-800 rounded-md px-4 py-2 border ${item.fulfilled ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="flex items-center gap-3">
                  {fulfillingItems.has(item.productId!) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <Checkbox
                      checked={item.fulfilled || false}
                      onCheckedChange={(checked) => {
                        if (item.productId) {
                          if (checked) {
                            handleFulfillItem(item.productId, item.quantity);
                          } else {
                            handleUnfulfillItem(item.productId, item.quantity);
                          }
                        }
                      }}
                      className="h-5 w-5"
                      title={item.fulfilled ? "Click to unfulfill and restore inventory" : "Click to fulfill and adjust inventory"}
                    />
                  )}
                  <div>
                    <span className={`font-medium ${item.fulfilled ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{item.productName}</span>
                    {item.productSku && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">SKU: {item.productSku}</span>
                    )}
                    {item.fulfilled && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">(Fulfilled)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Qty: <span className="font-semibold text-gray-900 dark:text-white">{item.quantity}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    ${Number(item.productPrice).toFixed(2)} each
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    ${Number(item.subtotal).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileOrderItems({ orderId }: { orderId: number }) {
  const { toast } = useToast();
  const [fulfillingItems, setFulfillingItems] = useState<Set<number>>(new Set());
  
  const { data: orderWithItems, isLoading } = useQuery<OrderWithItems>({
    queryKey: ['/api/orders', orderId],
  });

  const fulfillItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: number; productId: number; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/fulfill-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fulfill item');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Fulfilled",
        description: "Physical inventory has been adjusted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fulfill item",
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      setFulfillingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.productId);
        return newSet;
      });
    }
  });

  const unfulfillItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: number; productId: number; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/unfulfill-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unfulfill item');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Unfulfilled",
        description: "Inventory has been restored",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfulfill item",
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      setFulfillingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.productId);
        return newSet;
      });
    }
  });

  const handleFulfillItem = (productId: number, quantity: number) => {
    setFulfillingItems(prev => new Set(prev).add(productId));
    fulfillItemMutation.mutate({ orderId, productId, quantity });
  };

  const handleUnfulfillItem = (productId: number, quantity: number) => {
    setFulfillingItems(prev => new Set(prev).add(productId));
    unfulfillItemMutation.mutate({ orderId, productId, quantity });
  };

  if (isLoading) {
    return (
      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          Loading order items...
        </div>
      </div>
    );
  }

  if (!orderWithItems?.items || orderWithItems.items.length === 0) {
    return (
      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-500 dark:text-gray-400">
        No items found for this order.
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Order Items:</div>
      {orderWithItems.items.map((item) => (
        <div 
          key={item.id} 
          className={`flex items-center gap-3 bg-white dark:bg-gray-800 rounded-md px-3 py-2 border ${item.fulfilled ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}
        >
          {fulfillingItems.has(item.productId!) ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 flex-shrink-0" />
          ) : (
            <Checkbox
              checked={item.fulfilled || false}
              onCheckedChange={(checked) => {
                if (item.productId) {
                  if (checked) {
                    handleFulfillItem(item.productId, item.quantity);
                  } else {
                    handleUnfulfillItem(item.productId, item.quantity);
                  }
                }
              }}
              className="h-5 w-5 flex-shrink-0"
              title={item.fulfilled ? "Click to unfulfill and restore inventory" : "Click to fulfill and adjust inventory"}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-sm ${item.fulfilled ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {item.productName}
              {item.fulfilled && <span className="ml-1 text-xs">(Fulfilled)</span>}
            </div>
            {item.productSku && (
              <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.productSku}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-semibold text-gray-900 dark:text-white">x{item.quantity}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">${Number(item.subtotal).toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

type OrderTab = "new" | "packed" | "delivered" | "cancelled";

export default function OrderTable({ orders, user, staffUsers }: OrderTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<OrderTab>("new");

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case "new":
        return orders.filter(order => order.status === "pending" || order.status === "processing");
      case "packed":
        return orders.filter(order => order.status === "packed");
      case "delivered":
        return orders.filter(order => order.status === "delivered");
      case "cancelled":
        return orders.filter(order => order.status === "cancelled");
      default:
        return orders;
    }
  }, [orders, activeTab]);

  const tabCounts = useMemo(() => ({
    new: orders.filter(o => o.status === "pending" || o.status === "processing").length,
    packed: orders.filter(o => o.status === "packed").length,
    delivered: orders.filter(o => o.status === "delivered").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  }), [orders]);

  const allExpanded = useMemo(() => {
    return filteredOrders.length > 0 && filteredOrders.every(order => expandedOrders.has(order.id));
  }, [filteredOrders, expandedOrders]);

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedOrders(new Set());
    } else {
      setExpandedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const isOrderExpanded = (orderId: number) => expandedOrders.has(orderId);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      await apiRequest("PUT", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/order-status-breakdown"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const assignOrderMutation = useMutation({
    mutationFn: async ({ orderId, assignedUserId }: { orderId: number; assignedUserId: string }) => {
      await apiRequest("PUT", `/api/orders/${orderId}/assign`, { assignedUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order assigned successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to assign order",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Pending</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "packed":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">Packed</Badge>;
      case "delivered":
        return <Badge variant="default" className="status-completed">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="status-cancelled">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleStatusUpdate = (orderId: number, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  const handleAssignOrder = (orderId: number, assignedUserId: string) => {
    assignOrderMutation.mutate({ orderId, assignedUserId });
  };

  const handleViewOrder = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);

    if (order) {
      setSelectedOrder(order);
      setIsOrderDetailsOpen(true);
    }
  };

  const handleContactCustomer = (order: Order) => {
    toast({
      title: "Contact Customer",
      description: `Contacting ${order.customerName} at ${order.customerEmail}`,
    });
  };

  const handleOrderClick = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);

    if (order) {
      setSelectedOrder(order);
      setIsOrderDetailsOpen(true);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No orders found</p>
        <p className="text-gray-400">Orders will appear here when customers place them.</p>
      </div>
    );
  }

  const renderOrderList = (ordersToRender: Order[]) => {
    if (ordersToRender.length === 0) {
      return (
        <div className="text-center py-12">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No orders in this category</p>
        </div>
      );
    }

    return (
      <>
        {/* Mobile Card View */}
        <div className="md:hidden">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              onClick={toggleAllExpanded}
            >
              {allExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {allExpanded ? "Collapse All" : "Expand All"}
            </Button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {ordersToRender.map((order) => (
              <div key={order.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={() => toggleOrderExpanded(order.id)}
                        >
                          {isOrderExpanded(order.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </Button>
                        <button
                          onClick={() => handleOrderClick(order.id)}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                        >
                          {order.orderNumber}
                        </button>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(order.createdAt!), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        ${Number(order.total).toFixed(2)}
                      </div>
                      <div className="mt-1">
                        {getStatusBadge(order.status)}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{order.customerName}</div>
                    <div className="text-gray-600 dark:text-gray-400">{order.customerEmail}</div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Select
                      value={order.status}
                      onValueChange={(status) => handleStatusUpdate(order.id, status)}
                    >
                      <SelectTrigger className="flex-1 h-8 bg-gray-700 dark:bg-gray-700 text-white dark:text-gray-100 border-gray-600 dark:border-gray-600 hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="packed">Packed</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewOrder(order.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleContactCustomer(order)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Contact Customer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isOrderExpanded(order.id) && (
                    <MobileOrderItems orderId={order.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-gray-700"
                      onClick={toggleAllExpanded}
                      title={allExpanded ? "Collapse all orders" : "Expand all orders"}
                    >
                      {allExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-300" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-300" />
                      )}
                    </Button>
                    <span>Order #</span>
                  </div>
                </TableHead>
                <TableHead className="text-gray-300">Customer</TableHead>
                <TableHead className="text-gray-300">Total</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Date</TableHead>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <TableHead className="text-gray-300">Assigned To</TableHead>
                )}
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersToRender.map((order) => (
                <Fragment key={order.id}>
                  <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={() => toggleOrderExpanded(order.id)}
                          title={isOrderExpanded(order.id) ? "Collapse order items" : "Expand order items"}
                        >
                          {isOrderExpanded(order.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </Button>
                        <button
                          onClick={() => handleOrderClick(order.id)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                        >
                          {order.orderNumber}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">{order.customerName}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{order.customerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      ${Number(order.total).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-gray-900 dark:text-white">
                      {order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy") : "N/A"}
                    </TableCell>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <TableCell>
                        <div className="space-y-1">
                          <Select
                            value={order.assignedUserId || "unassigned"}
                            onValueChange={(assignedUserId) => handleAssignOrder(order.id, assignedUserId === "unassigned" ? "" : assignedUserId)}
                          >
                            <SelectTrigger className="w-full min-w-40 h-8 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder="Assign to staff..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {staffUsers.map((staffUser) => (
                                <SelectItem key={staffUser.id} value={staffUser.id}>
                                  {staffUser.firstName && staffUser.lastName
                                    ? `${staffUser.firstName} ${staffUser.lastName}`
                                    : staffUser.email || staffUser.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {order.assignedUser && (
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                              Assigned to: {order.assignedUser.firstName && order.assignedUser.lastName
                                ? `${order.assignedUser.firstName} ${order.assignedUser.lastName}`
                                : order.assignedUser.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center justify-end space-x-2">
                        <Select
                          value={order.status}
                          onValueChange={(status) => handleStatusUpdate(order.id, status)}
                        >
                          <SelectTrigger className="w-32 h-8 bg-gray-700 text-white border-gray-600 hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="packed">Packed</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4 text-gray-900 dark:text-white" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewOrder(order.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleContactCustomer(order)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Contact Customer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOrderExpanded(order.id) && (
                    <OrderItemsRow 
                      orderId={order.id} 
                      colSpan={(user?.role === 'admin' || user?.role === 'manager') ? 7 : 6}
                    />
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <>
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isOrderDetailsOpen}
        onClose={() => {
          setIsOrderDetailsOpen(false);
          setSelectedOrder(null);
        }}
        userRole={user?.role}
      />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Orders</h3>
      </div>
      
      <div className="w-full">
        <div className="px-4 sm:px-6 pt-4">
          <div className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-md">
            <button
              onClick={() => setActiveTab("new")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === "new"
                  ? "bg-white dark:bg-gray-600 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              New Orders {tabCounts.new > 0 && <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tabCounts.new}</span>}
            </button>
            <button
              onClick={() => setActiveTab("packed")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === "packed"
                  ? "bg-white dark:bg-gray-600 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Packed {tabCounts.packed > 0 && <span className="ml-1.5 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tabCounts.packed}</span>}
            </button>
            <button
              onClick={() => setActiveTab("delivered")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === "delivered"
                  ? "bg-white dark:bg-gray-600 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Delivered {tabCounts.delivered > 0 && <span className="ml-1.5 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tabCounts.delivered}</span>}
            </button>
            <button
              onClick={() => setActiveTab("cancelled")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === "cancelled"
                  ? "bg-white dark:bg-gray-600 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Cancelled {tabCounts.cancelled > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tabCounts.cancelled}</span>}
            </button>
          </div>
        </div>
        
        <div className="mt-2">
          {renderOrderList(filteredOrders)}
        </div>
      </div>
    </div>
    </>
  );
}