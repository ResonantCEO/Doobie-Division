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
import { Package, User, Calendar, CreditCard, MapPin, Loader2, Hash, CheckCircle, Clock, Scan, Camera, X, AlertCircle, SwitchCamera, Archive, ImageIcon, ShoppingBag, Pencil, ArrowLeftRight, Search, Trash2, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import type { Order, Product } from "@shared/schema";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
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
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalOverride, setTotalOverride] = useState<string>("");

  // Substitution state
  const [substituteItemId, setSubstituteItemId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [substituteQuantity, setSubstituteQuantity] = useState("1");

  // Add item state
  const [addingItem, setAddingItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemQuantity, setAddItemQuantity] = useState("1");
  const [selectedAddProduct, setSelectedAddProduct] = useState<Product | null>(null);
  const [selectedAddUnit, setSelectedAddUnit] = useState<string>("units");

  const isFulfillingRef = useRef(false);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const handleQRCodeDetectedRef = useRef<(data: string) => void>(() => {});
  const jsQRRef = useRef<any>(null);
  const firstDetectedAtRef = useRef<number>(0);
  const lastDetectedCodeRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orderDetails, isLoading } = useQuery({
    queryKey: ["/api/orders", order?.id],
    queryFn: async () => {
      if (!order?.id) return null;
      const response = await fetch(`/api/orders/${order.id}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch order details: ${response.statusText}`);
      return response.json() as unknown as Order;
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

  // Products query for substitution picker
  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isOpen && userRole === 'admin',
  });

  // Fulfill order item mutation
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
      toast({ title: "Item Fulfilled", description: "Order item fulfilled and inventory updated" });
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
      isFulfillingRef.current = false;
      setPendingFulfillment(null);
      setConfirmQuantity("");
      toast({ title: "Fulfillment Failed", description: error.message || "Failed to fulfill item", variant: "destructive" });
    }
  });

  // Override order total
  const overrideTotalMutation = useMutation({
    mutationFn: async ({ orderId, total }: { orderId: number; total: number }) => {
      const response = await fetch(`/api/orders/${orderId}/total`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ total })
      });
      if (!response.ok) throw new Error('Failed to update order total');
      return response.json();
    },
    onSuccess: (updatedOrder) => {
      toast({ title: "Total Updated", description: "Order total has been overridden." });
      setFullOrder(updatedOrder);
      setEditingTotal(false);
      setTotalOverride("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update order total.", variant: "destructive" });
    }
  });

  // Pack order
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
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark order as packed.", variant: "destructive" });
    }
  });

  // Remove order item mutation
  const removeItemMutation = useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: number; itemId: number }) => {
      const response = await fetch(`/api/orders/${orderId}/remove-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to remove item');
      }
      return response.json();
    },
    onSuccess: (updatedOrder) => {
      toast({ title: "Item Removed", description: "Item removed and stock restored." });
      setFullOrder(updatedOrder);
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Remove", description: error.message, variant: "destructive" });
    }
  });

  // Add order item mutation
  const addItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity, unitPrice, unitLabel }: { orderId: number; productId: number; quantity: number; unitPrice?: number; unitLabel?: string }) => {
      const response = await fetch(`/api/orders/${orderId}/add-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity, unitPrice, unitLabel })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to add item');
      }
      return response.json();
    },
    onSuccess: (updatedOrder) => {
      toast({ title: "Item Added", description: "Item added to order." });
      setFullOrder(updatedOrder);
      setAddingItem(false);
      setAddItemSearch("");
      setAddItemQuantity("1");
      setSelectedAddProduct(null);
      setSelectedAddUnit("units");
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Add Item", description: error.message, variant: "destructive" });
    }
  });

  // Substitute item mutation
  const substituteMutation = useMutation({
    mutationFn: async ({ orderId, oldItemId, newProductId, quantity }: { orderId: number; oldItemId: number; newProductId: number; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/substitute-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldItemId, newProductId, quantity })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to substitute item');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Item Substituted", description: "The item has been swapped successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSubstituteItemId(null);
      setProductSearch("");
      setSubstituteQuantity("1");
    },
    onError: (error: any) => {
      toast({ title: "Substitution Failed", description: error.message, variant: "destructive" });
    }
  });

  // Camera / QR scanning
  const startScanning = async (requestedFacingMode?: "environment" | "user") => {
    try {
      setScanningError("");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device. Please use manual SKU input instead.");
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissionStatus.state === 'denied') throw new Error("Camera permission denied.");
      } catch (permError) { console.warn('Permission check failed:', permError); }

      const currentFacing = requestedFacingMode ?? facingMode;
      const constraints = [
        { video: { facingMode: currentFacing, width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: true }
      ];
      let stream = null;
      let lastError = null;
      for (const constraint of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraint); break; }
        catch (err: any) {
          lastError = err;
          if (err.name === 'NotAllowedError' || err.message.includes('Permission denied'))
            throw new Error("Camera permission denied.");
        }
      }
      if (!stream) throw lastError || new Error("Unable to access camera.");
      streamRef.current = stream;
      isScanningRef.current = true;
      lastScanTimeRef.current = 0;
      setIsScanning(true);
      setTimeout(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        video.srcObject = streamRef.current;
        video.play().catch(e => console.warn('video.play():', e));
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = undefined; }
        detectQRCode();
      }, 150);
    } catch (error: any) {
      let errorMessage = error.message || "Unable to access camera.";
      if (error.name === 'NotAllowedError') errorMessage = "Camera permission denied.";
      else if (error.name === 'NotFoundError') errorMessage = "No camera found on this device.";
      else if (error.name === 'NotReadableError') errorMessage = "Camera is being used by another application.";
      setScanningError(errorMessage);
      setIsScanning(false);
      toast({ title: "Camera Error", description: errorMessage, variant: "destructive" });
    }
  };

  const switchCamera = useCallback(async () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    await startScanning(newFacing);
  }, [facingMode]);

  const stopScanning = useCallback(() => {
    isScanningRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsScanning(false);
    setScanningError("");
  }, []);

  const detectQRCode = useCallback(() => {
    if (!isScanningRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (isFulfillingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (video.readyState === video.HAVE_ENOUGH_DATA && context && jsQRRef.current) {
      const cropFraction = 0.60;
      const sw = Math.floor(video.videoWidth * cropFraction);
      const sh = Math.floor(video.videoHeight * cropFraction);
      const sx = Math.floor((video.videoWidth - sw) / 2);
      const sy = Math.floor((video.videoHeight - sh) / 2);
      canvas.width = sw; canvas.height = sh;
      context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const imageData = context.getImageData(0, 0, sw, sh);
      const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
      if (code && isScanningRef.current && !isFulfillingRef.current) {
        const now = Date.now();
        if (lastDetectedCodeRef.current === code.data) {
          if (firstDetectedAtRef.current && now - firstDetectedAtRef.current >= 250) {
            if (now - lastScanTimeRef.current > 2000) {
              lastScanTimeRef.current = now;
              firstDetectedAtRef.current = 0;
              lastDetectedCodeRef.current = '';
              handleQRCodeDetectedRef.current(code.data);
            }
          }
        } else {
          lastDetectedCodeRef.current = code.data;
          firstDetectedAtRef.current = now;
        }
      } else {
        lastDetectedCodeRef.current = '';
        firstDetectedAtRef.current = 0;
      }
    }
    if (isScanningRef.current) animationFrameRef.current = requestAnimationFrame(detectQRCode);
  }, []);

  const handleQRCodeDetected = (qrData: string) => {
    if (!selectedItemId || !fullOrder) return;
    if (isFulfillingRef.current) return;
    const selectedItem = (fullOrder as any).items?.find((item: any) => item.id === selectedItemId);
    if (!selectedItem) return;
    const scannedSku = qrData.trim();
    if (selectedItem.productSku === scannedSku) {
      isFulfillingRef.current = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      isScanningRef.current = false;
      setIsScanning(false);
      setConfirmQuantity("");
      setPendingFulfillment({ item: selectedItem });
    } else {
      toast({ title: "Wrong Item", description: `Scanned ${scannedSku} but expected ${selectedItem.productSku}`, variant: "destructive" });
    }
  };
  handleQRCodeDetectedRef.current = handleQRCodeDetected;

  const confirmFulfillment = () => {
    if (!pendingFulfillment || !fullOrder) return;
    const { item } = pendingFulfillment;
    const qty = parseInt(confirmQuantity);
    if (isNaN(qty) || qty < 1 || qty > item.quantity) {
      toast({ title: "Invalid Quantity", description: `Please enter a number between 1 and ${item.quantity}`, variant: "destructive" });
      return;
    }
    fulfillItemMutation.mutate({ orderId: fullOrder.id, productId: item.productId, quantity: qty, orderItemId: item.id });
  };

  const cancelPendingFulfillment = () => {
    isFulfillingRef.current = false;
    setPendingFulfillment(null);
    setConfirmQuantity("");
    startScanning();
  };

  const handleItemClick = async (itemId: number, item: any) => {
    if (item.fulfilled) return;
    setSelectedItemId(itemId);
    setScanningMode(true);
    setScanningError("");
    setTimeout(async () => { await startScanning(); }, 100);
  };

  const cancelScanning = () => {
    isFulfillingRef.current = false;
    setPendingFulfillment(null);
    setConfirmQuantity("");
    setScanningMode(false);
    setSelectedItemId(null);
    stopScanning();
  };

  useEffect(() => {
    import('jsqr').then(({ default: jsQR }) => { jsQRRef.current = jsQR; }).catch(() => {});
  }, []);

  useEffect(() => { return () => { stopScanning(); }; }, [stopScanning]);

  if (!order) return null;

  const displayOrder = fullOrder || order;
  const isAdmin = userRole === 'admin';
  const canScan = userRole === 'staff' || userRole === 'manager' || userRole === 'admin';

  const displayOrderAny = displayOrder as any;
  const allItemsFulfilled =
    displayOrderAny.items &&
    displayOrderAny.items.length > 0 &&
    displayOrderAny.items.filter((item: any) => !item.removed).every((item: any) => item.fulfilled);

  const isAlreadyPacked = displayOrder.status === 'packed';

  // Product search filter for substitution
  const filteredProducts = (allProducts || []).filter((p: Product) =>
    p.isActive &&
    (productSearch === "" ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 20);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Pending</Badge>;
      case "processing": return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "packed": return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200"><Archive className="h-3 w-3 mr-1" />Packed</Badge>;
      case "shipped": return <Badge variant="default" className="status-completed">Shipped</Badge>;
      case "cancelled": return <Badge variant="destructive" className="status-cancelled">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details - {displayOrder.orderNumber || (displayOrder as any).order_number || 'N/A'}
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
                  {(displayOrder.createdAt || (displayOrder as any).created_at)
                    ? format(new Date(displayOrder.createdAt || (displayOrder as any).created_at), "MMM d, yyyy 'at' h:mm a")
                    : "Date not available"}
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
                  <p className="font-medium text-gray-900 dark:text-gray-100">{displayOrder.customerName || (displayOrder as any).customer_name || "Not provided"}</p>
                  <p className="text-gray-700 dark:text-gray-300">{displayOrder.customerEmail || (displayOrder as any).customer_email || "Not provided"}</p>
                  {(displayOrder.customerPhone || (displayOrder as any).customer_phone) && (
                    <p className="text-gray-700 dark:text-gray-300">{displayOrder.customerPhone || (displayOrder as any).customer_phone}</p>
                  )}
                </div>
                <div className="text-sm">
                  <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{displayOrder.shippingAddress || (displayOrder as any).shipping_address || "Not provided"}</pre>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {(displayOrder.shippingAddress || (displayOrder as any).shipping_address) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shipping Address</h3>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{displayOrder.shippingAddress || (displayOrder as any).shipping_address}</pre>
                  </div>
                </div>
              </>
            )}

            {/* Payment Info */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment</h3>
              </div>
              <div className="flex items-center gap-3">
                {(displayOrder.paymentMethod === "prepay" || (displayOrder as any).payment_method === "prepay") ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    <CreditCard className="h-3 w-3" /> Pre-Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    <ShoppingBag className="h-3 w-3" /> Pay Upon Arrival
                  </span>
                )}
              </div>
              {(displayOrder as any).paymentPhotoUrl || (displayOrder as any).payment_photo_url ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Photo</p>
                  <a href={(displayOrder as any).paymentPhotoUrl || (displayOrder as any).payment_photo_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <img src={(displayOrder as any).paymentPhotoUrl || (displayOrder as any).payment_photo_url} alt="Payment photo" className="max-h-48 rounded-lg border object-contain cursor-pointer hover:opacity-90 transition-opacity" />
                  </a>
                  <p className="text-xs text-muted-foreground">Click to open full size</p>
                </div>
              ) : null}
            </div>

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Items</h3>
                <div className="flex items-center gap-2">
                  {isAdmin && !['shipped', 'cancelled'].includes(displayOrder.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                      onClick={() => { setAddingItem(!addingItem); cancelScanning(); setSubstituteItemId(null); }}
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" />Add Item
                    </Button>
                  )}
                  {scanningMode && (
                    <Button onClick={cancelScanning} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* QR Scanning panel */}
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
                          <Button onClick={() => startScanning()} size="sm" variant="outline">
                            <Camera className="h-4 w-4 mr-1" />Start Camera
                          </Button>
                        )}
                      </div>
                      {scanningError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {scanningError}
                            <Button onClick={() => startScanning()} size="sm" variant="outline" className="ml-2">Try Again</Button>
                          </AlertDescription>
                        </Alert>
                      )}
                      {pendingFulfillment ? (
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
                                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⚖️ Weight-based product — measured in {weightUnit}</p>
                                    </div>
                                  )}
                                </div>
                                <span className="text-lg font-bold text-green-700 dark:text-green-400 ml-4">x{item.quantity}</span>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Units fulfilled</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" min={1} max={item.quantity} value={confirmQuantity} onChange={(e) => setConfirmQuantity(e.target.value)} className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                  <span className="text-sm text-gray-500">{isWeightBased ? `${weightUnit} unit(s)` : "unit(s)"}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={confirmFulfillment} disabled={fulfillItemMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="h-4 w-4 mr-2" />{fulfillItemMutation.isPending ? "Fulfilling…" : "Confirm Fulfillment"}
                                </Button>
                                <Button onClick={cancelPendingFulfillment} variant="outline" disabled={fulfillItemMutation.isPending}>Rescan</Button>
                              </div>
                            </div>
                          );
                        })()
                      ) : isScanning ? (
                        <div className="relative">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm mx-auto rounded-lg border-2 border-blue-500" />
                          <canvas ref={canvasRef} className="hidden" />
                          <div className="absolute inset-0 pointer-events-none" style={{ display: 'grid', gridTemplateColumns: '20% 60% 20%', gridTemplateRows: '20% 60% 20%' }}>
                            <div className="bg-black/55" style={{ gridColumn: 1, gridRow: '1 / 4' }} />
                            <div className="bg-black/55" style={{ gridColumn: 3, gridRow: '1 / 4' }} />
                            <div className="bg-black/55" style={{ gridColumn: 2, gridRow: 1 }} />
                            <div className="bg-black/55" style={{ gridColumn: 2, gridRow: 3 }} />
                            <div className="relative" style={{ gridColumn: 2, gridRow: 2 }}>
                              <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-md" />
                              <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-md" />
                              <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-md" />
                              <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-md" />
                              <div className="absolute inset-x-3 h-0.5 bg-blue-400 opacity-90 animate-bounce" style={{ animationDuration: '1.5s', top: '50%' }} />
                            </div>
                          </div>
                          <button onClick={switchCamera} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors" title="Switch camera">
                            <SwitchCamera className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Camera not active. Click "Start Camera" to begin scanning.</p>
                        </div>
                      )}
                      {!pendingFulfillment && (
                        <div className="border-t pt-4">
                          <p className="text-sm text-gray-600 mb-2">Or manually confirm SKU:</p>
                          <div className="flex gap-2">
                            <input type="text" placeholder="Enter SKU manually" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim()) { handleQRCodeDetected(input.value.trim()); input.value = ''; } }
                              }}
                            />
                            <Button size="sm" onClick={(e) => { const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement; if (input?.value.trim()) { handleQRCodeDetected(input.value.trim()); input.value = ''; } }}>Confirm</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Substitution panel */}
              {substituteItemId && isAdmin && (
                <Card className="border-amber-500">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="h-5 w-5 text-amber-500" />
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Select Replacement Product</h4>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setSubstituteItemId(null); setProductSearch(""); setSubstituteQuantity("1"); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {(() => {
                        const oldItem = displayOrder.items?.find((i: any) => i.id === substituteItemId);
                        return oldItem ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded p-2">
                            Replacing: <span className="font-medium text-gray-900 dark:text-gray-100">{oldItem.productName}</span> (qty: {oldItem.quantity})
                          </div>
                        ) : null;
                      })()}
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-gray-400 shrink-0" />
                        <Input
                          placeholder="Search by product name or SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y dark:divide-gray-700">
                        {filteredProducts.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No products found</p>
                        ) : filteredProducts.map((p: Product) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            onClick={() => {
                              const oldItem = displayOrder.items?.find((i: any) => i.id === substituteItemId);
                              const qty = parseInt(substituteQuantity) || oldItem?.quantity || 1;
                              substituteMutation.mutate({ orderId: displayOrder.id, oldItemId: substituteItemId!, newProductId: p.id, quantity: qty });
                            }}
                            disabled={substituteMutation.isPending}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                                <p className="text-xs text-gray-500">SKU: {p.sku} · Stock: {p.stock}</p>
                              </div>
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">${p.price ? parseFloat(p.price).toFixed(2) : "—"}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400 shrink-0">Quantity:</label>
                        <Input
                          type="number"
                          min={1}
                          value={substituteQuantity}
                          onChange={(e) => setSubstituteQuantity(e.target.value)}
                          className="w-20"
                        />
                      </div>
                      {substituteMutation.isPending && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Loader2 className="h-4 w-4 animate-spin" />Substituting item…
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Add Item panel */}
              {addingItem && isAdmin && (() => {
                const closeAddPanel = () => {
                  setAddingItem(false);
                  setAddItemSearch("");
                  setAddItemQuantity("1");
                  setSelectedAddProduct(null);
                  setSelectedAddUnit("units");
                };

                const ap = selectedAddProduct as any;
                const isWeightBased = ap?.sellingMethod === "weight";
                const weightOptions = !ap ? [] : [
                  { key: "grams", label: "Grams", price: Number(ap.pricePerGram) || 0 },
                  { key: "eighth", label: "1/8 oz", price: Number(ap.pricePerEighth) || 0 },
                  { key: "quarter", label: "1/4 oz", price: Number(ap.pricePerQuarter) || 0 },
                  { key: "half", label: "1/2 oz", price: Number(ap.pricePerHalf) || 0 },
                  { key: "ounce", label: "1 oz", price: Number(ap.pricePerOunce) || 0 },
                ].filter(o => o.price > 0);
                const hasWeightOptions = isWeightBased && weightOptions.length > 0;

                const resolvedUnitPrice = (() => {
                  if (!ap) return 0;
                  if (hasWeightOptions) {
                    const opt = weightOptions.find(o => o.key === selectedAddUnit);
                    return opt ? opt.price : weightOptions[0]?.price || 0;
                  }
                  return Number(ap.price) || 0;
                })();

                const unitLabel = hasWeightOptions
                  ? weightOptions.find(o => o.key === selectedAddUnit)?.label || weightOptions[0]?.label
                  : undefined;

                const qty = Math.max(1, parseInt(addItemQuantity) || 1);
                const lineTotal = resolvedUnitPrice * qty;

                const searchResults = (allProducts || []).filter((p: Product) =>
                  p.isActive && p.stock > 0 && (
                    addItemSearch.trim() === "" ? false :
                    p.name.toLowerCase().includes(addItemSearch.toLowerCase()) ||
                    p.sku.toLowerCase().includes(addItemSearch.toLowerCase())
                  )
                ).slice(0, 20);

                return (
                  <Card className="border-green-500">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PlusCircle className="h-5 w-5 text-green-500" />
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {selectedAddProduct ? "Configure Item" : "Add Product to Order"}
                            </h4>
                          </div>
                          <Button variant="ghost" size="sm" onClick={closeAddPanel}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Step 1: search */}
                        {!selectedAddProduct && (
                          <>
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-gray-400 shrink-0" />
                              <Input
                                placeholder="Search by product name or SKU..."
                                value={addItemSearch}
                                onChange={(e) => setAddItemSearch(e.target.value)}
                                className="flex-1"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y dark:divide-gray-700">
                              {addItemSearch.trim() === "" ? (
                                <p className="text-sm text-gray-500 text-center py-4">Type to search products</p>
                              ) : searchResults.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No products found</p>
                              ) : searchResults.map((p: Product) => {
                                const pa = p as any;
                                const isWB = pa.sellingMethod === "weight";
                                const displayPrice = isWB
                                  ? (pa.pricePerGram ? `$${Number(pa.pricePerGram).toFixed(2)}/g` : pa.pricePerOunce ? `$${Number(pa.pricePerOunce).toFixed(2)}/oz` : "—")
                                  : (p.price ? `$${parseFloat(p.price).toFixed(2)}` : "—");
                                return (
                                  <button
                                    key={p.id}
                                    className="w-full text-left px-3 py-2 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                    onClick={() => {
                                      setSelectedAddProduct(p);
                                      const opts = [
                                        { key: "grams", price: Number(pa.pricePerGram) || 0 },
                                        { key: "eighth", price: Number(pa.pricePerEighth) || 0 },
                                        { key: "quarter", price: Number(pa.pricePerQuarter) || 0 },
                                        { key: "half", price: Number(pa.pricePerHalf) || 0 },
                                        { key: "ounce", price: Number(pa.pricePerOunce) || 0 },
                                      ].filter(o => o.price > 0);
                                      setSelectedAddUnit(pa.sellingMethod === "weight" && opts.length > 0 ? opts[0].key : "units");
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                                        <p className="text-xs text-gray-500">SKU: {p.sku} · Stock: {p.stock}</p>
                                      </div>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{displayPrice}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* Step 2: configure unit + quantity */}
                        {selectedAddProduct && (
                          <>
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selectedAddProduct.name}</p>
                                <p className="text-xs text-gray-500">Stock: {selectedAddProduct.stock}</p>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedAddProduct(null); setSelectedAddUnit("units"); }}>
                                Change
                              </Button>
                            </div>

                            {/* Weight options */}
                            {hasWeightOptions && (
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Unit / Size</p>
                                <div className="flex flex-wrap gap-2">
                                  {weightOptions.map(opt => (
                                    <button
                                      key={opt.key}
                                      onClick={() => setSelectedAddUnit(opt.key)}
                                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                        selectedAddUnit === opt.key
                                          ? "bg-green-600 text-white border-green-600"
                                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400"
                                      }`}
                                    >
                                      {opt.label} — ${opt.price.toFixed(2)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Quantity */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 shrink-0">Quantity:</label>
                              <Input
                                type="number"
                                min={1}
                                max={selectedAddProduct.stock}
                                value={addItemQuantity}
                                onChange={(e) => setAddItemQuantity(e.target.value)}
                                className="w-24"
                                autoFocus
                              />
                              {resolvedUnitPrice > 0 && (
                                <span className="text-sm text-gray-500">
                                  ${resolvedUnitPrice.toFixed(2)} × {qty} = <strong className="text-gray-800 dark:text-gray-200">${lineTotal.toFixed(2)}</strong>
                                </span>
                              )}
                              {resolvedUnitPrice === 0 && (
                                <span className="text-xs text-amber-600">No price available for this unit</span>
                              )}
                            </div>

                            {/* Confirm */}
                            <Button
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                              disabled={addItemMutation.isPending || resolvedUnitPrice === 0 || qty < 1}
                              onClick={() => {
                                addItemMutation.mutate({
                                  orderId: displayOrder.id,
                                  productId: selectedAddProduct.id,
                                  quantity: qty,
                                  unitPrice: resolvedUnitPrice,
                                  unitLabel,
                                });
                              }}
                            >
                              {addItemMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding…</> : `Add to Order — $${lineTotal.toFixed(2)}`}
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Items list */}
              {displayOrder.items && displayOrder.items.length > 0 ? (
                <div className="space-y-3">
                  {displayOrder.items.map((item: any, index: number) => {
                    const isRemoved = item.removed === true;
                    const isSubstitute = !!item.substitutedForItemId;
                    return (
                      <div
                        key={item.id || index}
                        className={`flex items-start justify-between p-3 rounded-lg transition-colors ${
                          isRemoved
                            ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 opacity-70"
                            : isSubstitute
                            ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700"
                            : item.fulfilled
                            ? "bg-gray-50 dark:bg-gray-700/50"
                            : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50"
                        } ${!isRemoved && !item.fulfilled && canScan && selectedItemId !== item.id ? "cursor-pointer" : ""} ${selectedItemId === item.id ? "ring-2 ring-blue-500" : ""}`}
                        onClick={() => !isRemoved && !item.fulfilled && canScan && !substituteItemId && handleItemClick(item.id, item)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-medium text-sm ${isRemoved ? "line-through text-red-500 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                              {item.productName || item.product_name || "Unknown Product"}
                            </h4>
                            {isRemoved && (
                              <Badge variant="destructive" className="text-xs py-0">
                                <Trash2 className="h-2.5 w-2.5 mr-1" />Removed
                              </Badge>
                            )}
                            {isSubstitute && !isRemoved && (
                              <Badge className="text-xs py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300">
                                <ArrowLeftRight className="h-2.5 w-2.5 mr-1" />Substituted In
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">SKU: {item.productSku || item.product_sku || "N/A"}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            ${(item.productPrice || item.product_price) ? parseFloat((item.productPrice || item.product_price).toString()).toFixed(2) : "0.00"} × {item.quantity || 0}
                          </p>
                          {!isRemoved && !item.fulfilled && canScan && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to scan and fulfill item</p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 ml-2">
                          <p className={`font-medium text-sm ${isRemoved ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                            ${item.subtotal ? parseFloat(item.subtotal.toString()).toFixed(2) : "0.00"}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {isRemoved ? (
                              <Badge variant="destructive" className="text-xs">Removed</Badge>
                            ) : item.fulfilled ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />Fulfilled
                              </Badge>
                            ) : canScan ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                <Scan className="h-3 w-3 mr-1" />Click to scan
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                <Clock className="h-3 w-3 mr-1" />Pending
                              </Badge>
                            )}
                            {/* Remove button — admin only, non-removed items */}
                            {isAdmin && !isRemoved && !['shipped', 'cancelled'].includes(displayOrder.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                                disabled={removeItemMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Remove "${item.productName || item.product_name}" from this order?`)) {
                                    removeItemMutation.mutate({ orderId: displayOrder.id, itemId: item.id });
                                  }
                                }}
                              >
                                {removeItemMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                                {removeItemMutation.isPending ? "" : "Remove"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-700 dark:text-gray-300">No items found for this order</p>
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
                {editingTotal && userRole === 'admin' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Override Total Amount</label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">$</span>
                      <Input type="number" min="0" step="0.01" value={totalOverride} onChange={(e) => setTotalOverride(e.target.value)} placeholder={displayOrder.total ? parseFloat(displayOrder.total.toString()).toFixed(2) : "0.00"} className="w-40 text-lg font-semibold" autoFocus />
                      <Button size="sm" onClick={() => { const val = parseFloat(totalOverride); if (isNaN(val) || val < 0) { toast({ title: "Invalid amount", description: "Please enter a valid positive number.", variant: "destructive" }); return; } overrideTotalMutation.mutate({ orderId: displayOrder.id, total: val }); }} disabled={overrideTotalMutation.isPending} className="bg-green-600 hover:bg-green-700">
                        {overrideTotalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingTotal(false); setTotalOverride(""); }} disabled={overrideTotalMutation.isPending}>
                        <X className="h-4 w-4" />Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <span>Total Amount:</span>
                    <div className="flex items-center gap-2">
                      <span>${displayOrder.total ? parseFloat(displayOrder.total.toString()).toFixed(2) : "0.00"}</span>
                      {userRole === 'admin' && (
                        <Button size="sm" variant="outline" onClick={() => { setTotalOverride(displayOrder.total ? parseFloat(displayOrder.total.toString()).toFixed(2) : "0.00"); setEditingTotal(true); }} className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900" title="Override total">
                          <Pencil className="h-3 w-3 mr-1" />Edit
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {displayOrder.notes && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
                  <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-300 dark:border-gray-600">
                    <p className="whitespace-pre-wrap">{displayOrder.notes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Pack button */}
            {canScan && !isAlreadyPacked && displayOrder.status !== 'shipped' && displayOrder.status !== 'cancelled' && (
              <>
                <Separator />
                <div className="pt-2 pb-1">
                  {!allItemsFulfilled && (
                    <p className="text-sm text-muted-foreground mb-3 text-center">Fulfill all items above to enable packing.</p>
                  )}
                  <Button onClick={() => packOrderMutation.mutate(displayOrder.id)} disabled={!allItemsFulfilled || packOrderMutation.isPending} className="w-full h-12 text-base font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40" size="lg">
                    <Archive className="h-5 w-5 mr-2" />{packOrderMutation.isPending ? "Packing…" : "Pack Order"}
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
