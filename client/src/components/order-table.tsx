import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest } from "@/lib/queryClient";
import { Eye, Edit, MessageSquare, MoreHorizontal, Package2 } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

interface OrderTableProps {
  orders: Order[];
}

export default function OrderTable({ orders }: OrderTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Pending</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "shipped":
        return <Badge variant="secondary" className="status-out-for-delivery">Shipped</Badge>;
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

  const handleViewOrder = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    console.log('handleViewOrder - orderId:', orderId);
    console.log('handleViewOrder - found order:', order);
    console.log('handleViewOrder - all orders:', orders);
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
    console.log('handleOrderClick - orderId:', orderId);
    console.log('handleOrderClick - found order:', order);
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

  return (
    <>
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isOrderDetailsOpen}
        onClose={() => {
          setIsOrderDetailsOpen(false);
          setSelectedOrder(null);
        }}
      />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Orders</h3>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => (
            <div key={order.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <button
                      onClick={() => handleOrderClick(order.id)}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                    >
                      {order.orderNumber}
                    </button>
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
                      <SelectItem value="shipped">Shipped</SelectItem>
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-gray-900 dark:text-white">Order Number</TableHead>
              <TableHead className="text-gray-900 dark:text-white">Customer</TableHead>
              <TableHead className="text-gray-900 dark:text-white">Total</TableHead>
              <TableHead className="text-gray-900 dark:text-white">Status</TableHead>
              <TableHead className="text-gray-900 dark:text-white">Date</TableHead>
              <TableHead className="text-right text-gray-900 dark:text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  <button
                    onClick={() => handleOrderClick(order.id)}
                    className="hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                  >
                    {order.orderNumber}
                  </button>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{order.customerName}</div>
                    <div className="text-sm text-gray-600 dark:text-white">{order.customerEmail}</div>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  ${Number(order.total).toFixed(2)}
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell className="text-gray-900 dark:text-white">
                  {format(new Date(order.createdAt!), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
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
                        <SelectItem value="shipped">Shipped</SelectItem>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    </>
  );
}
