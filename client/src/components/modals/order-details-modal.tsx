import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Package, User, Calendar, CreditCard, MapPin, Loader2, Hash, CheckCircle, Clock } from "lucide-react";
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
      const response = await fetch(`/api/orders/${order.id}`, { 
        credentials: "include" 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch order details: ${response.statusText}`);
      }
      return response.json() as Order;
    },
    enabled: isOpen && !!order?.id,
  });

  useEffect(() => {
    if (orderDetails) {
      console.log('Setting full order from orderDetails:', orderDetails);
      setFullOrder(orderDetails);
    } else if (order) {
      console.log('Setting full order from order prop:', order);
      setFullOrder(order);
    }
  }, [orderDetails, order]);

  // Debug logging
  console.log('Order prop:', order);
  console.log('Order details from API:', orderDetails);
  console.log('Full order state:', fullOrder);
  console.log('Modal open:', isOpen);

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
            Order Details - {displayOrder.orderNumber || displayOrder.order_number || 'N/A'}
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
                  <Calendar className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Order Date</span>
                </div>
                <p className="text-sm">
                  {(displayOrder.createdAt || displayOrder.created_at)
                    ? format(new Date(displayOrder.createdAt || displayOrder.created_at), "MMM d, yyyy 'at' h:mm a")
                    : "Date not available"
                  }
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">Status</span>
                </div>
                {getStatusBadge(displayOrder.status)}
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-white" />
                <h3 className="text-lg font-semibold text-white">Customer Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-white">{displayOrder.customerName || displayOrder.customer_name || "Not provided"}</p>
                  <p className="text-white">{displayOrder.customerEmail || displayOrder.customer_email || "Not provided"}</p>
                  {(displayOrder.customerPhone || displayOrder.customer_phone) && (
                    <p className="text-white">{displayOrder.customerPhone || displayOrder.customer_phone}</p>
                  )}
                </div>
                <div className="text-sm">
                  <pre className="whitespace-pre-wrap text-white">{displayOrder.shippingAddress || displayOrder.shipping_address || "Not provided"}</pre>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {(displayOrder.shippingAddress || displayOrder.shipping_address) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-white" />
                    <h3 className="text-lg font-semibold text-white">Shipping Address</h3>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap text-white">{displayOrder.shippingAddress || displayOrder.shipping_address}</pre>
                  </div>
                </div>
              </>
            )}

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Order Items</h3>
              {displayOrder.items && displayOrder.items.length > 0 ? (
                <div className="space-y-3">
                  {displayOrder.items.map((item: any, index: number) => (
                    <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-white">{item.productName || item.product_name || "Unknown Product"}</h4>
                        <p className="text-xs text-white">
                          SKU: {item.productSku || item.product_sku || "N/A"}
                        </p>
                        <p className="text-xs text-white">
                          ${(item.productPrice || item.product_price) ? parseFloat((item.productPrice || item.product_price).toString()).toFixed(2) : "0.00"} × {item.quantity || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-white">${item.subtotal ? parseFloat(item.subtotal.toString()).toFixed(2) : "0.00"}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {item.fulfilled ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Fulfilled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white">No items found for this order</p>
                  <p className="text-xs text-white mt-1">Items data: {JSON.stringify(displayOrder.items)}</p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-white" />
                <h3 className="text-lg font-semibold text-white">Order Summary</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-lg font-semibold text-white">
                  <span>Total Amount:</span>
                  <span>${displayOrder.total ? parseFloat(displayOrder.total.toString()).toFixed(2) : "0.00"}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {displayOrder.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Notes</h3>
                  <p className="text-sm text-white bg-gray-50 p-3 rounded-lg">
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