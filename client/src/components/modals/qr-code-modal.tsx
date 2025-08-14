import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer } from "lucide-react";
import type { Product } from "@shared/schema";

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  qrCodeData?: string;
}

export default function QRCodeModal({
  open,
  onOpenChange,
  product,
  qrCodeData: initialQrCodeData
}: QRCodeModalProps) {
  const { toast } = useToast();
  const [qrCodeData, setQrCodeData] = useState<string | null>(initialQrCodeData || null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate QR code when modal opens and product is available
  useEffect(() => {
    if (open && product && !qrCodeData) {
      generateQRCode();
    }
  }, [open, product, qrCodeData]);

  const generateQRCode = async () => {
    if (!product) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/${product.id}/qr-code`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      setQrCodeData(data.qrCode);
    } catch (error: any) {
      console.error('QR code generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!qrCodeData || !product) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${product.sku}.png`;
    link.href = qrCodeData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR Code Downloaded",
      description: `QR code for ${product.name} has been downloaded.`,
    });
  };

  const handlePrint = () => {
    if (!qrCodeData || !product) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${product.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px; 
              }
              .qr-container { 
                max-width: 400px; 
                margin: 0 auto; 
              }
              img { 
                max-width: 100%; 
                height: auto; 
              }
              .product-info { 
                margin-top: 20px; 
                font-size: 14px; 
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h2>${product.name}</h2>
              <img src="${qrCodeData}" alt="QR Code for ${product.name}" />
              <div class="product-info">
                <p><strong>SKU:</strong> ${product.sku}</p>
                <p><strong>Name:</strong> ${product.name}</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    
    toast({
      title: "QR Code Print",
      description: `Print dialog opened for ${product.name} QR code.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            QR Code - {product?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Generating QR code...</p>
            </div>
          )}

          {!isLoading && qrCodeData && product && (
            <>
              <div className="flex justify-center">
                <img 
                  src={qrCodeData} 
                  alt={`QR Code for ${product.name}`}
                  className="max-w-full h-auto"
                />
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>SKU:</strong> {product.sku}</p>
                <p><strong>Name:</strong> {product.name}</p>
                {product.price && (
                  <p><strong>Price:</strong> ${product.price}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrint}
                  disabled={!qrCodeData}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownload}
                  disabled={!qrCodeData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </>
          )}
          
          {!isLoading && !qrCodeData && product && (
            <div className="text-center py-8 space-y-4">
              <p className="text-gray-500">Failed to load QR code</p>
              <Button onClick={generateQRCode} size="sm">
                Try Again
              </Button>
            </div>
          )}

          {!product && (
            <div className="text-center py-8">
              <p className="text-gray-500">No product selected</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}