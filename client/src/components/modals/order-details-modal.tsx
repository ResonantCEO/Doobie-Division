import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Package, User, Calendar, CreditCard, MapPin, Loader2, Hash, CheckCircle, Clock, Scan, Camera, X, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string; // Added to receive user role
}

export default function OrderDetailsModal({ order, isOpen, onClose, userRole }: OrderDetailsModalProps) {
  const [fullOrder, setFullOrder] = useState<Order | null>(null);
  const [scanningMode, setScanningMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningError, setScanningError] = useState<string>("");
  const [lastScanTime, setLastScanTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

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

  // Update order item status mutation
  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ orderId, productId }: { orderId: number; productId: number }) => {
      const response = await fetch(`/api/orders/${orderId}/pack-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });
      if (!response.ok) throw new Error('Failed to update item status');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Packed",
        description: "Order item status updated to packed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      setScanningMode(false);
      setSelectedItemId(null);
      stopScanning();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update item status",
        variant: "destructive",
      });
    }
  });

  // Start camera for QR scanning
  const startScanning = async () => {
    try {
      setScanningError("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);

        videoRef.current.onloadedmetadata = () => {
          detectQRCode();
        };
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      let errorMessage = "Unable to access camera.";

      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access and try again.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      }

      setScanningError(errorMessage);
      setIsScanning(false);

      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Stop camera
  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
    setScanningError("");
  }, []);

  // QR code detection
  const detectQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          const now = Date.now();
          if (now - lastScanTime > 2000) {
            setLastScanTime(now);
            handleQRCodeDetected(code.data);
          }
        }
      }).catch((error) => {
        console.warn('jsQR not available:', error);
      });
    }

    if (isScanning) {
      animationFrameRef.current = requestAnimationFrame(detectQRCode);
    }
  }, [isScanning, lastScanTime]);

  // Handle QR code detection
  const handleQRCodeDetected = (qrData: string) => {
    if (!selectedItemId || !fullOrder) return;

    const selectedItem = fullOrder.items?.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    // Extract SKU from QR data (assuming QR contains just the SKU)
    const scannedSku = qrData.trim();

    // Check if scanned SKU matches the selected item's SKU
    if (selectedItem.productSku === scannedSku) {
      updateItemStatusMutation.mutate({
        orderId: fullOrder.id,
        productId: selectedItem.productId!
      });
    } else {
      toast({
        title: "Wrong Item",
        description: `Scanned ${scannedSku} but expected ${selectedItem.productSku}`,
        variant: "destructive",
      });
    }
  };

  const handleItemClick = async (itemId: number, item: any) => {
    if (item.fulfilled) return; // Don't allow scanning already fulfilled items

    setSelectedItemId(itemId);
    setScanningMode(true);

    // Immediately start the camera
    await startScanning();
  };

  const cancelScanning = () => {
    setScanningMode(false);
    setSelectedItemId(null);
    stopScanning();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  // Debug logging


  if (!order) return null;

  const displayOrder = fullOrder || order;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Pending</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "shipped":
        return <Badge variant="default" className="status-completed">Shipped</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="status-cancelled">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canScan = userRole === 'staff' || userRole === 'manager' || userRole === 'admin';

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
                  <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Order Date</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {(displayOrder.createdAt || displayOrder.created_at)
                    ? format(new Date(displayOrder.createdAt || displayOrder.created_at), "MMM d, yyyy 'at' h:mm a")
                    : "Date not available"
                  }
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Status</span>
                </div>
                {getStatusBadge(displayOrder.status)}
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{displayOrder.customerName || displayOrder.customer_name || "Not provided"}</p>
                  <p className="text-gray-700 dark:text-gray-300">{displayOrder.customerEmail || displayOrder.customer_email || "Not provided"}</p>
                  {(displayOrder.customerPhone || displayOrder.customer_phone) && (
                    <p className="text-gray-700 dark:text-gray-300">{displayOrder.customerPhone || displayOrder.customer_phone}</p>
                  )}
                </div>
                <div className="text-sm">
                  <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{displayOrder.shippingAddress || displayOrder.shipping_address || "Not provided"}</pre>
                </div>
              </div>
            </div></old_str>

            {/* Shipping Address */}
            {(displayOrder.shippingAddress || displayOrder.shipping_address) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shipping Address</h3>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{displayOrder.shippingAddress || displayOrder.shipping_address}</pre>
                  </div>
                </div></old_str>
              </>
            )}

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Items</h3></old_str>
                {scanningMode && (
                  <Button onClick={cancelScanning} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>

              {scanningMode && selectedItemId && (
                <Card className="border-blue-500">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Scan className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Scan Item to Mark as Packed</h4>
                      </div>

                      {scanningError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{scanningError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-w-sm mx-auto rounded-lg border-2 border-blue-500"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="border-2 border-white border-dashed w-32 h-32 rounded-lg animate-pulse">
                            <div className="w-full h-full flex items-center justify-center">
                              <Scan className="h-6 w-6 text-white animate-spin" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {displayOrder.items && displayOrder.items.length > 0 ? (
                <div className="space-y-3">
                  {displayOrder.items.map((item: any, index: number) => (
                    <div
                      key={item.id || index}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        item.fulfilled
                          ? "bg-gray-50 dark:bg-gray-700/50"
                          : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 cursor-pointer"
                      } ${selectedItemId === item.id ? "ring-2 ring-blue-500" : ""}`}
                      onClick={() => !item.fulfilled && canScan && handleItemClick(item.id, item)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.productName || item.product_name || "Unknown Product"}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          SKU: {item.productSku || item.product_sku || "N/A"}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          ${(item.productPrice || item.product_price) ? parseFloat((item.productPrice || item.product_price).toString()).toFixed(2) : "0.00"} × {item.quantity || 0}
                        </p>
                        {!item.fulfilled && canScan && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to scan and mark as packed</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">${item.subtotal ? parseFloat(item.subtotal.toString()).toFixed(2) : "0.00"}</p></old_str>
                        <div className="flex items-center space-x-2 mt-1">
                          {item.fulfilled ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Packed
                            </Badge>
                          ) : canScan ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              <Scan className="h-3 w-3 mr-1" />
                              Click to scan and mark as packed
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
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-700 dark:text-gray-300">No items found for this order</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Items data: {JSON.stringify(displayOrder.items)}</p>
                </div></old_str>
              )}
            </div>

            {/* Order Summary */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Summary</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <span>Total Amount:</span>
                  <span>${displayOrder.total ? parseFloat(displayOrder.total.toString()).toFixed(2) : "0.00"}</span>
                </div>
              </div>
            </div></old_str>

            {/* Notes */}
            {displayOrder.notes && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-300 dark:border-gray-600">
                    <p className="whitespace-pre-wrap">{displayOrder.notes}</p>
                  </div>
                </div></old_str>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}