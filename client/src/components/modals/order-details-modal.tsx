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
import { Package, User, Calendar, CreditCard, MapPin, Loader2, Hash, CheckCircle, Clock, Scan, Camera, X, AlertCircle, SwitchCamera, Archive } from "lucide-react";
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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [pendingFulfillment, setPendingFulfillment] = useState<{ item: any } | null>(null);
  const [confirmQuantity, setConfirmQuantity] = useState<string>("");

  const isFulfillingRef = useRef(false);
  const isScanningRef = useRef(false);                        // mirrors isScanning synchronously
  const lastScanTimeRef = useRef(0);                          // mirrors lastScanTime without closure capture
  const handleQRCodeDetectedRef = useRef<(data: string) => void>(() => {}); // always-current handler
  const jsQRRef = useRef<any>(null);                          // pre-loaded jsQR module
  const firstDetectedAtRef = useRef<number>(0);               // when current code was first seen
  const lastDetectedCodeRef = useRef<string>('');             // code value being held
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

  // Fulfill order item mutation (reduces physical inventory)
  const fulfillItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity, orderItemId }: { orderId: number; productId: number; quantity: number; orderItemId?: number }) => {
      const response = await fetch(`/api/orders/${orderId}/fulfill-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity, orderItemId })
      });
      if (!response.ok) throw new Error('Failed to fulfill item');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Fulfilled",
        description: "Order item fulfilled and inventory updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      isFulfillingRef.current = false;
      setPendingFulfillment(null);
      setConfirmQuantity("");
      setScanningMode(false);
      setSelectedItemId(null);
      stopScanning();
    },
    onError: (error: any) => {
      // Reset the lock so the user can try again
      isFulfillingRef.current = false;
      setPendingFulfillment(null);
      setConfirmQuantity("");
      toast({
        title: "Fulfillment Failed",
        description: error.message || "Failed to fulfill item",
        variant: "destructive",
      });
    }
  });

  // Mark order as packed
  const packOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'packed' })
      });
      if (!response.ok) throw new Error('Failed to update order status');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Order Packed", description: "Order has been marked as packed." });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark order as packed.", variant: "destructive" });
    }
  });

  // Start camera for QR scanning
  const startScanning = async (requestedFacingMode?: "environment" | "user") => {
    try {
      setScanningError("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device. Please use manual SKU input instead.");
      }

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Check for permissions first
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissionStatus.state === 'denied') {
          throw new Error("Camera permission denied. Please enable camera access in your browser settings and reload the page.");
        }
      } catch (permError) {
        console.warn('Permission check failed:', permError);
      }

      const currentFacing = requestedFacingMode ?? facingMode;

      // Try with the requested facing mode first, then fall back to any camera
      const constraints = [
        { video: { facingMode: currentFacing, width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: true }
      ];

      let stream = null;
      let lastError = null;

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (err: any) {
          lastError = err;
          if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
            throw new Error("Camera permission denied. Please click 'Allow' when prompted or enable camera access in your browser settings.");
          }
        }
      }

      if (!stream) {
        throw lastError || new Error("Unable to access camera. Please try manual SKU input instead.");
      }

      streamRef.current = stream;
      isScanningRef.current = true;
      lastScanTimeRef.current = 0;
      setIsScanning(true);

      // Wait for React to render the video element into the DOM, then kick off scanning.
      // We do NOT rely on video.play().then() — on Android Chrome the promise can hang
      // silently on the first camera open, which was the root cause of "first click broken".
      setTimeout(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        video.srcObject = streamRef.current;

        // Fire-and-forget play(); the detection loop handles waiting for HAVE_ENOUGH_DATA
        video.play().catch(e => console.warn('video.play():', e));

        // Cancel any stale loop before starting a fresh one
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }

        // Start the detection loop immediately — it polls readyState each frame
        detectQRCode();
      }, 150);

    } catch (error: any) {
      console.error('Camera access error:', error);
      let errorMessage = "Unable to access camera.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and refresh the page.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is being used by another application.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Camera constraints not supported.";
      } else {
        errorMessage = error.message || errorMessage;
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

  // Switch between front and rear camera
  const switchCamera = useCallback(async () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    await startScanning(newFacing);
  }, [facingMode]);

  // Stop camera
  const stopScanning = useCallback(() => {
    isScanningRef.current = false;
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

  // QR code detection — only scans the center region matching the scan indicator
  const detectQRCode = useCallback(() => {
    if (!isScanningRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (isFulfillingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && context && jsQRRef.current) {
      // Crop to the center 60% of the frame (both axes) — matches the on-screen indicator.
      // QR codes outside this region are intentionally ignored.
      const cropFraction = 0.60;
      const sw = Math.floor(video.videoWidth * cropFraction);
      const sh = Math.floor(video.videoHeight * cropFraction);
      const sx = Math.floor((video.videoWidth - sw) / 2);
      const sy = Math.floor((video.videoHeight - sh) / 2);

      canvas.width = sw;
      canvas.height = sh;
      // Draw only the cropped region onto the canvas
      context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = context.getImageData(0, 0, sw, sh);

      const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code && isScanningRef.current && !isFulfillingRef.current) {
        const now = Date.now();
        if (lastDetectedCodeRef.current === code.data) {
          // Same code still visible — check if held for at least 250 ms
          if (firstDetectedAtRef.current && now - firstDetectedAtRef.current >= 250) {
            if (now - lastScanTimeRef.current > 2000) {
              lastScanTimeRef.current = now;
              firstDetectedAtRef.current = 0;
              lastDetectedCodeRef.current = '';
              handleQRCodeDetectedRef.current(code.data);
            }
          }
        } else {
          // New code in view — start the hold timer fresh
          lastDetectedCodeRef.current = code.data;
          firstDetectedAtRef.current = now;
        }
      } else {
        // Nothing detected — reset hold timer so a flash doesn't accumulate
        lastDetectedCodeRef.current = '';
        firstDetectedAtRef.current = 0;
      }
    }

    if (isScanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectQRCode);
    }
  }, []);

  // Handle QR code detection — stop scanning immediately and show confirmation
  // NOTE: keep this as a regular function so handleQRCodeDetectedRef always points to the latest version
  const handleQRCodeDetected = (qrData: string) => {
    if (!selectedItemId || !fullOrder) return;
    if (isFulfillingRef.current) return;

    const selectedItem = fullOrder.items?.find((item: any) => item.id === selectedItemId);
    if (!selectedItem) return;

    const scannedSku = qrData.trim();

    if (selectedItem.productSku === scannedSku) {
      // Lock immediately to prevent the scan loop from firing again
      isFulfillingRef.current = true;
      // Stop camera — we have a match
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      isScanningRef.current = false;
      setIsScanning(false);
      // Show confirmation step — leave quantity blank so it must be typed manually
      setConfirmQuantity("");
      setPendingFulfillment({ item: selectedItem });
    } else {
      toast({
        title: "Wrong Item",
        description: `Scanned ${scannedSku} but expected ${selectedItem.productSku}`,
        variant: "destructive",
      });
    }
  };
  // Keep the ref pointing to the latest version so detectQRCode (empty-dep useCallback) always calls current logic
  handleQRCodeDetectedRef.current = handleQRCodeDetected;

  // Confirm and execute the fulfillment
  const confirmFulfillment = () => {
    if (!pendingFulfillment || !fullOrder) return;
    const { item } = pendingFulfillment;
    const qty = parseInt(confirmQuantity);
    if (isNaN(qty) || qty < 1 || qty > item.quantity) {
      toast({
        title: "Invalid Quantity",
        description: `Please enter a number between 1 and ${item.quantity}`,
        variant: "destructive",
      });
      return;
    }
    fulfillItemMutation.mutate({
      orderId: fullOrder.id,
      productId: item.productId,
      quantity: qty,
      orderItemId: item.id,
    });
  };

  // Cancel pending fulfillment and return to scanning
  const cancelPendingFulfillment = () => {
    isFulfillingRef.current = false;
    setPendingFulfillment(null);
    setConfirmQuantity("");
    startScanning();
  };

  const handleItemClick = async (itemId: number, item: any) => {
    if (item.fulfilled) return; // Don't allow scanning already fulfilled items

    setSelectedItemId(itemId);
    setScanningMode(true);
    setScanningError("");

    // Add a small delay to ensure DOM is updated before starting camera
    setTimeout(async () => {
      await startScanning();
    }, 100);
  };

  const cancelScanning = () => {
    isFulfillingRef.current = false;
    setPendingFulfillment(null);
    setConfirmQuantity("");
    setScanningMode(false);
    setSelectedItemId(null);
    stopScanning();
  };

  // Pre-load jsQR so first scan is instant (dynamic import is slow on first call)
  useEffect(() => {
    import('jsqr').then(({ default: jsQR }) => {
      jsQRRef.current = jsQR;
    }).catch(() => {});
  }, []);

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
      case "packed":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200"><Archive className="h-3 w-3 mr-1" />Packed</Badge>;
      case "shipped":
        return <Badge variant="default" className="status-completed">Shipped</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="status-cancelled">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canScan = userRole === 'staff' || userRole === 'manager' || userRole === 'admin';

  const allItemsFulfilled =
    displayOrder.items &&
    displayOrder.items.length > 0 &&
    displayOrder.items.every((item: any) => item.fulfilled);

  const isAlreadyPacked = displayOrder.status === 'packed';

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
            </div>

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
                </div>
              </>
            )}

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Items</h3>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scan className="h-5 w-5 text-blue-500" />
                          <h4 className="font-medium">Scan Item to Fulfill Order</h4>
                        </div>
                        {!isScanning && !scanningError && (
                          <Button onClick={startScanning} size="sm" variant="outline">
                            <Camera className="h-4 w-4 mr-1" />
                            Start Camera
                          </Button>
                        )}
                      </div>

                      {scanningError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {scanningError}
                            <Button 
                              onClick={startScanning} 
                              size="sm" 
                              variant="outline" 
                              className="ml-2"
                            >
                              Try Again
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {pendingFulfillment ? (
                        /* ── Confirmation step ── */
                        (() => {
                          const { item } = pendingFulfillment;
                          const isWeightBased = item.product?.sellingMethod === "weight";
                          const weightUnit = item.product?.weightUnit || "grams";
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <span className="font-medium">QR Code Matched!</span>
                              </div>

                              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4 flex items-center justify-between">
                                <div className="space-y-2 flex-1">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.productName}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {item.productSku}</p>

                                {isWeightBased && (
                                  <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                      ⚖️ Weight-based product — measured in {weightUnit}
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                      Confirm the correct weight is ready before fulfilling.
                                    </p>
                                  </div>
                                )}
                                </div>
                                <span className="text-lg font-bold text-green-700 dark:text-green-400 ml-4">x{item.quantity}</span>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Units fulfilled
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={item.quantity}
                                    value={confirmQuantity}
                                    onChange={(e) => setConfirmQuantity(e.target.value)}
                                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-sm text-gray-500">
                                    {isWeightBased ? `${weightUnit} unit(s)` : "unit(s)"}
                                  </span>
                                </div>
                                {item.quantity > 1 && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    ⚠ This order requires {item.quantity} {isWeightBased ? `${weightUnit} unit(s)` : "unit(s)"}. Verify the amount before confirming.
                                  </p>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={confirmFulfillment}
                                  disabled={fulfillItemMutation.isPending}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  {fulfillItemMutation.isPending ? "Fulfilling…" : "Confirm Fulfillment"}
                                </Button>
                                <Button
                                  onClick={cancelPendingFulfillment}
                                  variant="outline"
                                  disabled={fulfillItemMutation.isPending}
                                >
                                  Rescan
                                </Button>
                              </div>
                            </div>
                          );
                        })()
                      ) : isScanning ? (
                        /* ── Live camera feed ── */
                        <div className="relative">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full max-w-sm mx-auto rounded-lg border-2 border-blue-500"
                          />
                          <canvas ref={canvasRef} className="hidden" />
                          {/*
                            Scan region overlay — the detection crop is exactly 60% of the video
                            frame centered on both axes. The overlay mirrors this with a CSS grid
                            that creates four dark panels (20% each side) leaving a precise 60×60%
                            rectangular window. QR codes outside this window are not processed.
                          */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '20% 60% 20%',
                              gridTemplateRows: '20% 60% 20%',
                            }}
                          >
                            {/* Left column — all 3 rows */}
                            <div className="bg-black/55" style={{ gridColumn: 1, gridRow: '1 / 4' }} />
                            {/* Right column — all 3 rows */}
                            <div className="bg-black/55" style={{ gridColumn: 3, gridRow: '1 / 4' }} />
                            {/* Top centre */}
                            <div className="bg-black/55" style={{ gridColumn: 2, gridRow: 1 }} />
                            {/* Bottom centre */}
                            <div className="bg-black/55" style={{ gridColumn: 2, gridRow: 3 }} />
                            {/* Centre cell = scan zone (transparent) — corner brackets sit here */}
                            <div className="relative" style={{ gridColumn: 2, gridRow: 2 }}>
                              <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-md" />
                              <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-md" />
                              <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-md" />
                              <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-md" />
                              {/* Animated scan line inside the zone */}
                              <div
                                className="absolute inset-x-3 h-0.5 bg-blue-400 opacity-90 animate-bounce"
                                style={{ animationDuration: '1.5s', top: '50%' }}
                              />
                            </div>
                          </div>
                          {/* Switch camera button */}
                          <button
                            onClick={switchCamera}
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                            title={facingMode === "environment" ? "Switch to front camera" : "Switch to rear camera"}
                          >
                            <SwitchCamera className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        /* ── Idle / not started ── */
                        <div className="text-center py-8 text-gray-500">
                          <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Camera not active. Click "Start Camera" to begin scanning.</p>
                        </div>
                      )}

                      {/* Manual SKU input — only show when not confirming */}
                      {!pendingFulfillment && (
                        <div className="border-t pt-4">
                          <p className="text-sm text-gray-600 mb-2">Or manually confirm SKU:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter SKU manually"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  if (input.value.trim()) {
                                    handleQRCodeDetected(input.value.trim());
                                    input.value = '';
                                  }
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={(e) => {
                                const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                                if (input?.value.trim()) {
                                  handleQRCodeDetected(input.value.trim());
                                  input.value = '';
                                }
                              }}
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      )}
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
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to scan and fulfill item</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">${item.subtotal ? parseFloat(item.subtotal.toString()).toFixed(2) : "0.00"}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {item.fulfilled ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Fulfilled
                            </Badge>
                          ) : canScan ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              <Scan className="h-3 w-3 mr-1" />
                              Click to scan and fulfill
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
                </div>
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
            </div>

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
                </div>
              </>
            )}

            {/* Pack button — only visible to staff/managers/admins, not shown if already packed/shipped */}
            {canScan && !isAlreadyPacked && displayOrder.status !== 'shipped' && displayOrder.status !== 'cancelled' && (
              <>
                <Separator />
                <div className="pt-2 pb-1">
                  {!allItemsFulfilled && (
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                      Fulfill all items above to enable packing.
                    </p>
                  )}
                  <Button
                    onClick={() => packOrderMutation.mutate(displayOrder.id)}
                    disabled={!allItemsFulfilled || packOrderMutation.isPending}
                    className="w-full h-12 text-base font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40"
                    size="lg"
                  >
                    <Archive className="h-5 w-5 mr-2" />
                    {packOrderMutation.isPending ? "Packing…" : "Pack Order"}
                  </Button>
                </div>
              </>
            )}

            {isAlreadyPacked && (
              <>
                <Separator />
                <div className="flex items-center justify-center gap-2 py-3 text-purple-600 dark:text-purple-400">
                  <Archive className="h-5 w-5" />
                  <span className="font-medium">This order has been packed</span>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}