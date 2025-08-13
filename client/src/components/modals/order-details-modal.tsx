
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Package, User, Calendar, CreditCard, MapPin, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [fullOrder, setFullOrder] = useState<Order | null>(null);

  // Fetch complete order details including items when modal opens
  const { data: orderDetails, isLoading } = useQuery({
    queryKey: ["/api/orders", order?.id],
    queryFn: async () => {
      if (!order?.id) return null;
      const response = await apiRequest("GET", `/api/orders/${order.id}`);
      return response as Order;
    },
    enabled: isOpen && !!order?.id,
  });

  useEffect(() => {
    if (orderDetails) {
      setFullOrder(orderDetails);
    } else if (order) {
      setFullOrder(order);
    }
  }, [orderDetails, order]);

  if (!order) return null;

  const displayOrder = fullOrder || order;

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details - {displayOrder.orderNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading order details...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Status and Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Order Date</span>
                </div>
                <p className="text-sm">
                  {displayOrder.createdAt 
                    ? format(new Date(displayOrder.createdAt), "MMM d, yyyy 'at' h:mm a")
                    : "Date not available"
                  }
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status</span>
                </div>
                {getStatusBadge(displayOrder.status)}
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold">Customer Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">{displayOrder.customerName}</p>
                  <p className="text-gray-600">{displayOrder.customerEmail}</p>
                  {displayOrder.customerPhone && (
                    <p className="text-gray-600">{displayOrder.customerPhone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {displayOrder.shippingAddress && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold">Shipping Address</h3>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap text-gray-700">{displayOrder.shippingAddress}</pre>
                  </div>
                </div>
              </>
            )}

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Order Items</h3>
              {displayOrder.items && displayOrder.items.length > 0 ? (
                <div className="space-y-3">
                  {displayOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        {item.productSku && (
                          <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Qty: {item.quantity}</p>
                        <p className="text-sm text-gray-500">
                          ${Number(item.price).toFixed(2)} each
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          ${(Number(item.price) * item.quantity).toFixed(2)}
                        </p>
                        {item.fulfilled !== undefined && (
                          <Badge variant={item.fulfilled ? "default" : "secondary"} className="mt-1">
                            {item.fulfilled ? "Fulfilled" : "Pending"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No items found for this order</p>
              )}
            </div>

            {/* Order Summary */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold">Order Summary</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span>${Number(displayOrder.total).toFixed(2)}</span>
                </div>
                {displayOrder.paymentMethod && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Payment Method:</span>
                    <span>{displayOrder.paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {displayOrder.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {displayOrder.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
