import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Package, Plus, Minus, RotateCcw, Scan, AlertCircle, CheckCircle, ShoppingCart, Truck, Clock } from "lucide-react";
import type { Product, Category, Order } from "@shared/schema";

interface ScannedProduct extends Product {
  category: Category | null;
}

interface RecentAction {
  id: number;
  productName: string;
  sku: string;
  adjustment: number;
  reason: string;
  timestamp: string;
}

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  fulfilled: boolean;
}

interface OrderForFulfillment extends Order {
  items: OrderItem[];
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanningError, setScanningError] = useState<string>("");
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanningStatus, setScanningStatus] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [activeTab, setActiveTab] = useState("fulfillment");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<OrderForFulfillment | null>(null);
  const [fulfillmentActions, setFulfillmentActions] = useState<Array<{
    id: number;
    orderNumber: string;
    productName: string;
    sku: string;
    quantityFulfilled: number;
    timestamp: string;
  }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch orders for fulfillment (pending and processing orders)
  const { data: allOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", "fulfillment"],
    queryFn: async () => {
      const response = await fetch("/api/orders?status=pending,processing", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  const pendingOrders = allOrders.filter(order => 
    (order.status === "pending" || order.status === "processing") && 
    (!order.items || order.items.length === 0 || order.items.some(item => !item.fulfilled))
  );

  // Fetch selected order details
  const { data: orderDetails } = useQuery<OrderForFulfillment>({
    queryKey: ["/api/orders", selectedOrderId],
    enabled: !!selectedOrderId && selectedOrderId !== "",
    staleTime: 30000,
  });

  // Start camera for QR scanning
  const startScanning = async () => {
    try {
      setScanningError("");
      setScanningStatus("scanning");

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
    } catch (error) {
      setScanningError("Unable to access camera. Please allow camera permissions.");
      setScanningStatus("error");
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please allow camera permissions.",
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
    setScanningStatus("idle");
    setScanningError("");
  }, []);

  // QR code detection using canvas and jsQR
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

      // Import jsQR dynamically to avoid build issues
      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          const now = Date.now();
          // Prevent duplicate scans within 2 seconds
          if (now - lastScanTime > 2000) {
            setLastScanTime(now);
            setScanningStatus("found");
            handleQRCodeDetected(code.data);
          }
        }
      }).catch((error) => {
        console.warn('jsQR not available, falling back to manual input:', error);
      });
    }

    if (isScanning) {
      animationFrameRef.current = requestAnimationFrame(detectQRCode);
    }
  }, [isScanning, lastScanTime]);

  // Handle QR code detection
  const handleQRCodeDetected = (qrData: string) => {
    console.log('QR Code detected:', qrData);

    // Try to extract SKU from QR data
    // QR codes generated by the system should contain just the SKU
    const sku = qrData.trim();

    if (sku) {
      lookupProductMutation.mutate(sku);
    } else {
      toast({
        title: "Invalid QR Code",
        description: "QR code does not contain valid product information",
        variant: "destructive",
      });
      setScanningStatus("error");
    }
  };

  // Manual product lookup by SKU
  const lookupProductMutation = useMutation({
    mutationFn: async (sku: string) => {
      const response = await fetch(`/api/products?search=${encodeURIComponent(sku)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch product');
      const products = await response.json();
      const product = products.find((p: Product) => p.sku.toLowerCase() === sku.toLowerCase());
      if (!product) throw new Error('Product not found');
      return product;
    },
    onSuccess: (product) => {
      setScannedProduct(product);
      setManualSku("");
      setScanningStatus("found");
      stopScanning();
      toast({
        title: "Product Found",
        description: `Loaded ${product.name}`,
        icon: <CheckCircle className="h-4 w-4" />
      });
    },
    onError: (error: any) => {
      setScanningStatus("error");
      toast({
        title: "Product Not Found",
        description: error.message || "Unable to find product with that SKU",
        variant: "destructive",
      });
    },
  });

  // Stock adjustment mutation
  const adjustStockMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: number; reason: string }) => {
      await apiRequest("POST", `/api/products/${data.productId}/adjust-stock`, {
        quantity: data.quantity,
        reason: data.reason
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      // Add to recent actions
      const action: RecentAction = {
        id: Date.now(),
        productName: scannedProduct?.name || "Unknown",
        sku: scannedProduct?.sku || "Unknown",
        adjustment: variables.quantity,
        reason: variables.reason,
        timestamp: new Date().toLocaleTimeString()
      };
      setRecentActions(prev => [action, ...prev.slice(0, 9)]); // Keep last 10 actions

      // Update current product stock
      if (scannedProduct) {
        setScannedProduct({
          ...scannedProduct,
          stock: scannedProduct.stock + variables.quantity
        });
      }

      setAdjustment("");
      setReason("");

      toast({
        title: "Stock Updated",
        description: `${variables.quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(variables.quantity)} units`,
        icon: <CheckCircle className="h-4 w-4" />
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
        description: "Failed to adjust stock",
        variant: "destructive",
      });
    },
  });

  // Order fulfillment mutation
  const fulfillOrderItemMutation = useMutation({
    mutationFn: async (data: { orderId: number; productId: number; quantity: number }) => {
      await apiRequest("POST", `/api/orders/${data.orderId}/fulfill-item`, {
        productId: data.productId,
        quantity: data.quantity
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      // Add to fulfillment actions
      const action = {
        id: Date.now(),
        orderNumber: selectedOrder?.orderNumber || "Unknown",
        productName: scannedProduct?.name || "Unknown",
        sku: scannedProduct?.sku || "Unknown",
        quantityFulfilled: variables.quantity,
        timestamp: new Date().toLocaleTimeString()
      };
      setFulfillmentActions(prev => [action, ...prev.slice(0, 9)]);

      // Update current product stock
      if (scannedProduct) {
        setScannedProduct({
          ...scannedProduct,
          stock: scannedProduct.stock - variables.quantity
        });
      }

      toast({
        title: "Item Fulfilled",
        description: `Fulfilled ${variables.quantity} units for order ${selectedOrder?.orderNumber}`,
        icon: <CheckCircle className="h-4 w-4" />
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
        description: "Failed to fulfill order item",
        variant: "destructive",
      });
    },
  });

  const handleAdjustment = (adjustmentValue: number) => {
    if (!scannedProduct || !reason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a product and provide a reason",
        variant: "destructive",
      });
      return;
    }

    adjustStockMutation.mutate({
      productId: scannedProduct.id,
      quantity: adjustmentValue,
      reason: reason.trim()
    });
  };

  const handleManualLookup = () => {
    if (!manualSku.trim()) {
      toast({
        title: "Missing SKU",
        description: "Please enter a SKU to search",
        variant: "destructive",
      });
      return;
    }
    setScanningStatus("scanning");
    lookupProductMutation.mutate(manualSku.trim());
  };

  const handleOrderSelection = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (orderId && orderDetails) {
      setSelectedOrder(orderDetails);
    }
  };

  const handleFulfillOrderItem = (quantity: number) => {
    if (!selectedOrder || !scannedProduct) {
      toast({
        title: "Missing Information",
        description: "Please select an order and scan a product",
        variant: "destructive",
      });
      return;
    }

    // Check if this product is in the order
    const orderItem = selectedOrder.items?.find(item => item.productId === scannedProduct.id);
    if (!orderItem) {
      toast({
        title: "Product Not in Order",
        description: "This product is not part of the selected order",
        variant: "destructive",
      });
      return;
    }

    if (orderItem.fulfilled) {
      toast({
        title: "Already Fulfilled",
        description: "This item has already been fulfilled",
        variant: "destructive",
      });
      return;
    }

    if (quantity > orderItem.quantity) {
      toast({
        title: "Invalid Quantity",
        description: `Order only requires ${orderItem.quantity} units`,
        variant: "destructive",
      });
      return;
    }

    if (quantity > scannedProduct.stock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${scannedProduct.stock} units available`,
        variant: "destructive",
      });
      return;
    }

    fulfillOrderItemMutation.mutate({
      orderId: selectedOrder.id,
      productId: scannedProduct.id,
      quantity
    });
  };

  const resetSession = () => {
    setScannedProduct(null);
    setAdjustment("");
    setReason("");
    setManualSku("");
    setScanningStatus("idle");
    stopScanning();
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const getStockStatus = (stock: number, minThreshold: number = 10) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock <= minThreshold) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const getScanningStatusColor = () => {
    switch (scanningStatus) {
      case "scanning": return "border-blue-500";
      case "found": return "border-green-500";
      case "error": return "border-red-500";
      default: return "border-gray-300";
    }
  };

  // Update selected order when orderDetails changes
  useEffect(() => {
    if (orderDetails) {
      setSelectedOrder(orderDetails);
    }
  }, [orderDetails]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Warehouse Scanner</h1>
        <p className="text-muted-foreground">Scan QR codes or enter SKUs to manage inventory and fulfill orders</p>
      </div>

      {/* Mode Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fulfillment" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Order Fulfillment
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">

      {/* Scanner Section */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Product Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Section */}
          <div className="text-center">
            {!isScanning ? (
              <div className="space-y-4">
                <Button onClick={startScanning} size="lg" className="w-full sm:w-auto">
                  <Camera className="h-5 w-5 mr-2" />
                  Start Camera Scanner
                </Button>
                <p className="text-sm text-muted-foreground">
                  Or use manual SKU lookup below
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full max-w-md mx-auto rounded-lg border-2 ${getScanningStatusColor()}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scanning overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white border-dashed w-48 h-48 rounded-lg animate-pulse">
                      <div className="w-full h-full flex items-center justify-center">
                        <Scan className="h-8 w-8 text-white animate-spin" />
                      </div>
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div className="absolute top-2 left-2 right-2">
                    {scanningStatus === "scanning" && (
                      <Badge variant="default" className="bg-blue-500">
                        Scanning for QR codes...
                      </Badge>
                    )}
                    {scanningStatus === "found" && (
                      <Badge variant="default" className="bg-green-500">
                        QR Code Found!
                      </Badge>
                    )}
                    {scanningStatus === "error" && (
                      <Badge variant="destructive">
                        Scan Error
                      </Badge>
                    )}
                  </div>
                </div>

                <Button onClick={stopScanning} variant="outline">
                  Stop Scanner
                </Button>
                <p className="text-sm text-muted-foreground">
                  Position QR code in the camera view within the dashed box
                </p>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {scanningError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{scanningError}</AlertDescription>
            </Alert>
          )}

          {/* Manual SKU Lookup */}
          <div className="border-t pt-4">
            <Label htmlFor="manual-sku">Manual SKU Lookup</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="manual-sku"
                placeholder="Enter SKU (e.g., 0001, 0002)"
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualLookup()}
                disabled={lookupProductMutation.isPending}
              />
              <Button 
                onClick={handleManualLookup} 
                disabled={lookupProductMutation.isPending}
              >
                {lookupProductMutation.isPending ? "Searching..." : "Lookup"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tip: You can also scan the QR codes printed from the inventory management page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Product Information */}
      {scannedProduct && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={scannedProduct.imageUrl || ""} alt={scannedProduct.name} />
                <AvatarFallback>{scannedProduct.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{scannedProduct.name}</h3>
                <p className="text-muted-foreground mb-2">{scannedProduct.description}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">SKU: {scannedProduct.sku}</Badge>
                  <Badge variant="outline">Price: ${scannedProduct.price}</Badge>
                  <Badge variant="outline">
                    Category: {scannedProduct.category?.name || 'Uncategorized'}
                  </Badge>
                  <Badge {...getStockStatus(scannedProduct.stock, scannedProduct.minStockThreshold)}>
                    Stock: {scannedProduct.stock} units
                  </Badge>
                  {scannedProduct.minStockThreshold && (
                    <Badge variant="outline">
                      Min Threshold: {scannedProduct.minStockThreshold}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Adjustment */}
      {scannedProduct && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason for Adjustment *</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Order fulfillment, Damage, Restock, Inventory count correction, Customer return"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label>Quick Adjustments</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={() => handleAdjustment(-1)}
                  disabled={!reason.trim() || adjustStockMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Minus className="h-4 w-4" />
                  -1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAdjustment(-5)}
                  disabled={!reason.trim() || adjustStockMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Minus className="h-4 w-4" />
                  -5
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAdjustment(1)}
                  disabled={!reason.trim() || adjustStockMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  +1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAdjustment(5)}
                  disabled={!reason.trim() || adjustStockMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  +5
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="custom-adjustment">Custom Adjustment</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="custom-adjustment"
                  type="number"
                  placeholder="Enter amount (+ or -)"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                />
                <Button
                  onClick={() => {
                    const qty = parseInt(adjustment);
                    if (!isNaN(qty)) {
                      handleAdjustment(qty);
                    } else {
                      toast({
                        title: "Invalid Amount",
                        description: "Please enter a valid number",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={!reason.trim() || !adjustment || adjustStockMutation.isPending}
                >
                  {adjustStockMutation.isPending ? "Applying..." : "Apply"}
                </Button>
              </div>
            </div>

            <Button
              onClick={resetSession}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Scan Another Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Actions */}
      {recentActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Actions ({recentActions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentActions.map((action) => (
                <div key={action.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{action.productName}</p>
                    <p className="text-sm text-muted-foreground">SKU: {action.sku}</p>
                    <p className="text-xs text-muted-foreground">{action.reason}</p>
                  </div>
                  <div className="text-right ml-4">
                    <Badge variant={action.adjustment > 0 ? "default" : "secondary"}>
                      {action.adjustment > 0 ? "+" : ""}{action.adjustment}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{action.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Management Help</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Camera Scanner:</strong> Click "Start Camera Scanner" and position QR codes within the dashed box</p>
              <p>• <strong>Manual Lookup:</strong> Enter a product SKU directly if you don't have a QR code</p>
              <p>• <strong>Stock Adjustments:</strong> Always provide a reason for inventory changes for audit purposes</p>
              <p>• <strong>QR Codes:</strong> Generate QR codes from the Inventory Management page for easy scanning</p>
            </div>
          </CardContent>
        </Card>

        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-6">
          {/* Order Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Order Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="order-select">Select Order to Fulfill</Label>
                <Select value={selectedOrderId} onValueChange={handleOrderSelection}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose an order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{order.customerName} - #{order.orderNumber}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="outline">${order.total}</Badge>
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(order.createdAt).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pendingOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No orders pending fulfillment
                  </p>
                )}
              </div>

              {/* Selected Order Details */}
              {selectedOrder && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">Order #{selectedOrder.orderNumber}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
                      <p><strong>Total:</strong> ${selectedOrder.total}</p>
                    </div>
                    <div>
                      <p><strong>Status:</strong> <Badge variant="secondary">{selectedOrder.status}</Badge></p>
                      <p><strong>Items:</strong> {selectedOrder.items?.length || 0}</p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Items to Fulfill:</h5>
                    <div className="space-y-2">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {item.productSku || item.product?.sku || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">Qty: {item.quantity}</p>
                            <Badge variant={item.fulfilled ? "default" : "secondary"}>
                              {item.fulfilled ? "Fulfilled" : "Pending"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanner Section for Fulfillment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Product Scanner - Order Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Camera Section */}
              <div className="text-center">
                {!isScanning ? (
                  <div className="space-y-4">
                    <Button onClick={startScanning} size="lg" className="w-full sm:w-auto">
                      <Camera className="h-5 w-5 mr-2" />
                      Start Camera Scanner
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Or use manual SKU lookup below
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full max-w-md mx-auto rounded-lg border-2 ${getScanningStatusColor()}`}
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Scanning overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="border-2 border-white border-dashed w-48 h-48 rounded-lg animate-pulse">
                          <div className="w-full h-full flex items-center justify-center">
                            <Scan className="h-8 w-8 text-white animate-spin" />
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="absolute top-2 left-2 right-2">
                        {scanningStatus === "scanning" && (
                          <Badge variant="default" className="bg-blue-500">
                            Scanning for QR codes...
                          </Badge>
                        )}
                        {scanningStatus === "found" && (
                          <Badge variant="default" className="bg-green-500">
                            QR Code Found!
                          </Badge>                        )}
                        {scanningStatus === "error" && (
                          <Badge variant="destructive">
                            Scan Error
                          </Badge>
                        )}</div>
                    </div>

                    <Button onClick={stopScanning} variant="outline">
                      Stop Scanner
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Scan products to fulfill the selected order
                    </p>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {scanningError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{scanningError}</AlertDescription>
                </Alert>
              )}

              {/* Manual SKU Lookup */}
              <div className="border-t pt-4">
                <Label htmlFor="manual-sku-fulfillment">Manual SKU Lookup</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="manual-sku-fulfillment"
                    placeholder="Enter SKU (e.g., 0001, 0002)"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualLookup()}
                    disabled={lookupProductMutation.isPending}
                  />
                  <Button 
                    onClick={handleManualLookup} 
                    disabled={lookupProductMutation.isPending}
                  >
                    {lookupProductMutation.isPending ? "Searching..." : "Lookup"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Information for Fulfillment */}
          {scannedProduct && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Scanned Product
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={scannedProduct.imageUrl || ""} alt={scannedProduct.name} />
                    <AvatarFallback>{scannedProduct.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{scannedProduct.name}</h3>
                    <p className="text-muted-foreground mb-2">{scannedProduct.description}</p>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">SKU: {scannedProduct.sku}</Badge>
                      <Badge variant="outline">Price: ${scannedProduct.price}</Badge>
                      <Badge {...getStockStatus(scannedProduct.stock, scannedProduct.minStockThreshold)}>
                        Stock: {scannedProduct.stock} units
                      </Badge>
                    </div>

                    {/* Order Item Match Info */}
                    {selectedOrder && (() => {
                      const orderItem = selectedOrder.items?.find(item => item.productId === scannedProduct.id);
                      if (orderItem) {
                        return (
                          <div className="mt-3 p-3 border rounded-lg bg-green-50 border-green-200">
                            <p className="text-sm font-medium text-green-800">
                              ✓ This product is in the selected order
                            </p>
                            <p className="text-sm text-green-600">
                              Required: {orderItem.quantity} units | 
                              Status: {orderItem.fulfilled ? "Fulfilled" : "Pending"}
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-3 p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                            <p className="text-sm font-medium text-yellow-800">
                              ⚠ This product is not in the selected order
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Fulfillment Actions */}
          {scannedProduct && selectedOrder && (() => {
            const orderItem = selectedOrder.items?.find(item => item.productId === scannedProduct.id);
            return orderItem && !orderItem.fulfilled ? (
              <Card>
                <CardHeader>
                  <CardTitle>Fulfill Order Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Button
                      onClick={() => handleFulfillOrderItem(1)}
                      disabled={fulfillOrderItemMutation.isPending || orderItem.quantity < 1}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Fulfill 1
                    </Button>
                    <Button
                      onClick={() => handleFulfillOrderItem(Math.min(5, orderItem.quantity))}
                      disabled={fulfillOrderItemMutation.isPending || orderItem.quantity < 5}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Fulfill 5
                    </Button>
                    <Button
                      onClick={() => handleFulfillOrderItem(orderItem.quantity)}
                      disabled={fulfillOrderItemMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Fulfill All ({orderItem.quantity})
                    </Button>
                    <Button
                      onClick={resetSession}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="custom-fulfill-quantity">Custom Quantity</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="custom-fulfill-quantity"
                        type="number"
                        placeholder={`Enter quantity (max: ${orderItem.quantity})`}
                        value={adjustment}
                        onChange={(e) => setAdjustment(e.target.value)}
                        max={orderItem.quantity}
                        min={1}
                      />
                      <Button
                        onClick={() => {
                          const qty = parseInt(adjustment);
                          if (!isNaN(qty) && qty > 0 && qty <= orderItem.quantity) {
                            handleFulfillOrderItem(qty);
                          } else {
                            toast({
                              title: "Invalid Quantity",
                              description: `Please enter a number between 1 and ${orderItem.quantity}`,
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={!adjustment || fulfillOrderItemMutation.isPending}
                      >
                        {fulfillOrderItemMutation.isPending ? "Fulfilling..." : "Fulfill"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Recent Fulfillment Actions */}
          {fulfillmentActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Fulfillment Actions ({fulfillmentActions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fulfillmentActions.map((action) => (
                    <div key={action.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{action.productName}</p>
                        <p className="text-sm text-muted-foreground">Order #{action.orderNumber} | SKU: {action.sku}</p>
                      </div>
                      <div className="text-right ml-4">
                        <Badge variant="default">
                          Fulfilled: {action.quantityFulfilled}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{action.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fulfillment Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Order Fulfillment Help</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• <strong>Order Selection:</strong> Choose a processing order from the dropdown to begin fulfillment</p>
                <p>• <strong>Product Scanning:</strong> Scan QR codes or enter SKUs to match products with order items</p>
                <p>• <strong>Fulfillment:</strong> The system will automatically reduce stock and mark items as fulfilled</p>
                <p>• <strong>Validation:</strong> Only products in the selected order can be fulfilled</p>
                <p>• <strong>Stock Check:</strong> Fulfillment is prevented if insufficient stock is available</p>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}