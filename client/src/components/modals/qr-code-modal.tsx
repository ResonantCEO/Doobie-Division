import { useState } from "react";
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
  qrCodeData
}: QRCodeModalProps) {
  const { toast } = useToast();

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
          {qrCodeData && product && (
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
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </>
          )}
          
          {!qrCodeData && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading QR code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}