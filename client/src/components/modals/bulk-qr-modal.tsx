import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QRCodeData {
  productId: number;
  sku: string;
  name: string;
  qrCode: string;
}

interface BulkQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodes: QRCodeData[];
  isLoading: boolean;
}

export default function BulkQRModal({
  open,
  onOpenChange,
  qrCodes,
  isLoading
}: BulkQRModalProps) {
  const { toast } = useToast();

  const handleDownloadAll = () => {
    if (qrCodes.length === 0) return;
    
    qrCodes.forEach((qrData) => {
      const link = document.createElement('a');
      link.download = `qr-code-${qrData.sku}.png`;
      link.href = qrData.qrCode;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    
    toast({
      title: "QR Codes Downloaded",
      description: `${qrCodes.length} QR codes have been downloaded.`,
    });
  };

  const handlePrintAll = () => {
    if (qrCodes.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const qrCodeElements = qrCodes.map(qrData => `
        <div class="qr-item">
          <h3>${qrData.name}</h3>
          <img src="${qrData.qrCode}" alt="QR Code for ${qrData.name}" />
          <p><strong>SKU:</strong> ${qrData.sku}</p>
        </div>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>QR Codes</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 30px;
              }
              .qr-item { 
                text-align: center; 
                page-break-inside: avoid;
                border: 1px solid #ccc;
                padding: 20px;
                border-radius: 8px;
              }
              .qr-item h3 {
                margin: 0 0 15px 0;
                font-size: 18px;
              }
              .qr-item img { 
                max-width: 200px; 
                height: auto; 
                margin-bottom: 10px;
              }
              .qr-item p { 
                margin: 5px 0;
                font-size: 14px; 
              }
              @media print {
                .qr-grid {
                  grid-template-columns: repeat(2, 1fr);
                }
              }
            </style>
          </head>
          <body>
            <h1>Product QR Codes</h1>
            <div class="qr-grid">
              ${qrCodeElements}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    
    toast({
      title: "QR Codes Print",
      description: `Print dialog opened for ${qrCodes.length} QR codes.`,
    });
  };

  const handleDownloadSingle = (qrData: QRCodeData) => {
    const link = document.createElement('a');
    link.download = `qr-code-${qrData.sku}.png`;
    link.href = qrData.qrCode;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR Code Downloaded",
      description: `QR code for ${qrData.name} has been downloaded.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Generated QR Codes ({qrCodes.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Generating QR codes...</p>
            </div>
          )}

          {!isLoading && qrCodes.length > 0 && (
            <>
              <div className="flex gap-2 justify-end border-b pb-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrintAll}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadAll}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              </div>

              <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {qrCodes.map((qrData) => (
                    <div 
                      key={qrData.productId} 
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="text-center">
                        <h4 className="font-medium text-sm">{qrData.name}</h4>
                        <p className="text-xs text-gray-500">SKU: {qrData.sku}</p>
                      </div>
                      
                      <div className="flex justify-center">
                        <img 
                          src={qrData.qrCode} 
                          alt={`QR Code for ${qrData.name}`}
                          className="w-32 h-32"
                        />
                      </div>

                      <div className="flex justify-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadSingle(qrData)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {!isLoading && qrCodes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No QR codes generated.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}