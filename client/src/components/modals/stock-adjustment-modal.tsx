import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Package } from "lucide-react";
import type { Product } from "@shared/schema";

interface StockAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export default function StockAdjustmentModal({ open, onOpenChange, product }: StockAdjustmentModalProps) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const adjustStockMutation = useMutation({
    mutationFn: async (data: { quantity: number; reason: string }) => {
      if (!product) throw new Error("No product selected");
      await apiRequest("POST", `/api/products/${product.id}/adjust-stock`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      toast({
        title: "Success",
        description: "Stock adjusted successfully",
      });
      onOpenChange(false);
      setQuantity("");
      setReason("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || !reason.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please provide a valid quantity and reason",
        variant: "destructive",
      });
      return;
    }

    adjustStockMutation.mutate({ quantity: qty, reason: reason.trim() });
  };

  if (!product) return null;

  const newStock = product.stock + parseInt(quantity || "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Adjust Stock
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">{product.name}</h4>
            <p className="text-sm text-gray-600 mb-1">SKU: {product.sku}</p>
            <p className="text-sm text-gray-600">Current Stock: <span className="font-medium">{product.stock}</span></p>
          </div>

          <div>
            <Label htmlFor="quantity">Adjustment Quantity</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="Enter positive or negative number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use positive numbers to add stock, negative to remove
            </p>
            {quantity && !isNaN(parseInt(quantity)) && (
              <p className="text-sm mt-2">
                New stock will be: <span className="font-medium">{newStock}</span>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason for Adjustment</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Received shipment, Damaged items, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
