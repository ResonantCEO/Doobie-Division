
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Package, MapPin, User, Calendar, DollarSign, Phone, Mail, CheckCircle, Clock, X } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [fullOrder, setFullOrder] = useState<Order | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Shipped</Badge>;
      case "delivered":
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "processing":
        return <Package className="h-4 w-4 text-blue-500" />;
      case "shipped":
        return <Package className="h-4 w-4 text-green-500" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "cancelled":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Package className="h-5 w-5" />
            Order Details - {displayOrder.orderNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
              <div className="h-20 bg-gray-700 rounded"></div>
              <div className="h-20 bg-gray-700 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Status and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-300">Order Date</span>
                  </div>
                  <p className="text-white">
                    {displayOrder.createdAt 
                      ? format(new Date(displayOrder.createdAt), "MMM dd, yyyy 'at' h:mm a")
                      : "N/A"
                    }
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(displayOrder.status)}
                    <span className="text-sm font-medium text-gray-300">Status</span>
                  </div>
                  <div>{getStatusBadge(displayOrder.status)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Customer Information */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Customer Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white font-medium">{displayOrder.customerName}</p>
                    <div className="flex items-center gap-2 mt-1 text-gray-300">
                      <Mail className="h-3 w-3" />
                      <span>{displayOrder.customerEmail}</span>
                    </div>
                    {displayOrder.customerPhone && (
                      <div className="flex items-center gap-2 mt-1 text-gray-300">
                        <Phone className="h-3 w-3" />
                        <span>{displayOrder.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Shipping Address</span>
                </div>
                <p className="text-white">{displayOrder.shippingAddress}</p>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Order Items</h3>
              </div>
              
              <div className="space-y-3">
                {displayOrder.items?.map((item: any) => (
                  <Card key={item.id} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{item.productName}</h4>
                          <p className="text-sm text-gray-400">SKU: {item.productSku}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-gray-300">
                              Quantity: {item.quantity}
                            </span>
                            <span className="text-sm text-gray-300">
                              Price: ${Number(item.productPrice).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            ${(Number(item.productPrice) * item.quantity).toFixed(2)}
                          </p>
                          <div className="mt-2">
                            {item.fulfilled ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Fulfilled
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) || (
                  <p className="text-gray-400 text-center py-4">No items found for this order.</p>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <Separator />
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Order Summary</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-300">Total Amount:</span>
                  <span className="text-xl font-bold text-white">
                    ${Number(displayOrder.total).toFixed(2)}
                  </span>
                </div>
                {displayOrder.paymentMethod && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-400">Payment Method:</span>
                    <span className="text-sm text-white">{displayOrder.paymentMethod}</span>
                  </div>
                )}
                {displayOrder.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <span className="text-sm font-medium text-gray-300">Notes:</span>
                    <p className="text-sm text-gray-400 mt-1">{displayOrder.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
