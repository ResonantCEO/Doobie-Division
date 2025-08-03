
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Package, Plus, Minus, RotateCcw, Scan } from "lucide-react";
import type { Product, Category } from "@shared/schema";

interface ScannedProduct extends Product {
  category: Category | null;
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Start camera for QR scanning
  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
        
        // Start QR detection
        detectQRCode();
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please allow camera permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop camera
  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Simple QR code detection using canvas
  const detectQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // For now, we'll rely on manual SKU input
      // In a real implementation, you'd use a QR code library like jsQR
    }

    if (isScanning) {
      requestAnimationFrame(detectQRCode);
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
      stopScanning();
      toast({
        title: "Product Found",
        description: `Loaded ${product.name}`,
      });
    },
    onError: (error: any) => {
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
      const action = {
        id: Date.now(),
        productName: scannedProduct?.name,
        sku: scannedProduct?.sku,
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
    lookupProductMutation.mutate(manualSku.trim());
  };

  const resetSession = () => {
    setScannedProduct(null);
    setAdjustment("");
    setReason("");
    setManualSku("");
    stopScanning();
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const getStockStatus = (stock: number, minThreshold: number = 10) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock <= minThreshold) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Warehouse Scanner</h1>
        <p className="text-muted-foreground">Scan QR codes or enter SKUs to manage inventory</p>
      </div>

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
                    className="w-full max-w-md mx-auto rounded-lg border"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <Button onClick={stopScanning} variant="outline">
                  Stop Scanner
                </Button>
                <p className="text-sm text-muted-foreground">
                  Position QR code in the camera view
                </p>
              </div>
            )}
          </div>

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
              <Label htmlFor="reason">Reason for Adjustment</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Order fulfillment, Damage, Restock, Inventory count correction"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2"
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
                    }
                  }}
                  disabled={!reason.trim() || !adjustment || adjustStockMutation.isPending}
                >
                  Apply
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
            <CardTitle>Recent Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActions.map((action) => (
                <div key={action.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <p className="font-medium">{action.productName}</p>
                    <p className="text-sm text-muted-foreground">SKU: {action.sku}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={action.adjustment > 0 ? "default" : "secondary"}>
                      {action.adjustment > 0 ? "+" : ""}{action.adjustment}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{action.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
