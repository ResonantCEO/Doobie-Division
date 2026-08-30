import { useEffect, useState } from "react";
import { formatWeight } from "@/lib/weightUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Product, ProductSize } from "@shared/schema";

interface StockAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { sizes?: ProductSize[] }) | null;
}

export default function StockAdjustmentModal({ open, onOpenChange, product }: StockAdjustmentModalProps) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [ledger, setLedger] = useState<"sellable" | "physical">("sellable");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasSizes = !!(product?.sizes && product.sizes.length > 0);

  useEffect(() => {
    if (open && product?.sizes?.length) setSelectedSize(product.sizes[0].size);
    if (!product?.sizes?.length) setSelectedSize("all");
  }, [open, product]);

  const adjustStockMutation = useMutation({
    mutationFn: async (data: { quantity: number; reason: string; sizeName?: string }) => {
      if (!product || !product.id) throw new Error("No product selected");
      if (ledger === "physical") {
        await apiRequest("POST", `/api/products/${product.id}/physical-count`, {
          count: data.quantity,
          reason: data.reason,
          sizeName: data.sizeName,
        });
      } else {
        await apiRequest("POST", `/api/products/${product.id}/adjust-stock`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      toast({
        title: "Success",
        description: ledger === "physical" ? "Verified physical count recorded" : "Sellable stock adjusted",
      });
      onOpenChange(false);
      setQuantity("");
      setReason("");
      setSelectedSize("all");
    },
    onError: (error: any) => {
      console.error('Stock adjustment error:', error);
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
      
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to adjust stock";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !product.id) {
      toast({
        title: "Error",
        description: "No product selected for stock adjustment",
        variant: "destructive",
      });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || (ledger === "sellable" && qty === 0) || qty < (ledger === "physical" ? 0 : -1000000) || !reason.trim()) {
      toast({
        title: "Invalid Input",
        description: ledger === "physical"
          ? "Enter the verified non-negative physical count and a reason"
          : "Please provide a valid non-zero quantity and reason",
        variant: "destructive",
      });
      return;
    }

    const payload: { quantity: number; reason: string; sizeName?: string } = {
      quantity: qty,
      reason: reason.trim(),
    };

    if (hasSizes && selectedSize !== "all") {
      payload.sizeName = selectedSize;
    }

    adjustStockMutation.mutate(payload);
  };

  if (!product) return null;

  const getCurrentStock = () => {
    if (hasSizes && selectedSize !== "all") {
      const size = product.sizes!.find(s => s.size === selectedSize);
      return size ? (ledger === "physical" ? (size.physicalQuantity ?? 0) : size.quantity) : 0;
    }
    return ledger === "physical" ? (product.physicalInventory ?? 0) : product.stock;
  };

  const currentStock = getCurrentStock();
  const newStock = ledger === "physical" ? parseInt(quantity || "0") : currentStock + parseInt(quantity || "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Inventory Update - {product?.name}</DialogTitle>
          <DialogDescription>
            Adjust sellable availability or record a verified warehouse count.
          </DialogDescription>
            <p className="text-xs text-muted-foreground mt-1">
              Product edits can intentionally sync physical counts to the entered stock. Use this screen for independent verified counts or adjustments.
            </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium mb-2">{product.name}</h4>
            <p className="text-sm text-muted-foreground mb-1">SKU: {product.sku}</p>
            {hasSizes ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Total Stock: {product.sellingMethod === "weight" ? formatWeight(product.stock) : `${product.stock} units`}</p>
                {[...product.sizes!].sort((a, b) => a.size.localeCompare(b.size)).map(s => (
                  <p key={s.id} className="ml-2">{s.size}: {s.quantity}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Current Stock: <span className="font-medium">{product.sellingMethod === "weight" ? formatWeight(product.stock) : `${product.stock} units`}</span></p>
            )}
          </div>

          <div>
            <Label>Inventory ledger</Label>
            <Select value={ledger} onValueChange={(value) => setLedger(value as "sellable" | "physical")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sellable">Sellable stock adjustment</SelectItem>
                <SelectItem value="physical">Verified physical count</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasSizes && (
            <div>
              <Label>Adjust For</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  {[...product.sizes!].sort((a, b) => a.size.localeCompare(b.size)).map(s => (
                    <SelectItem key={s.id} value={s.size}>
                      {s.size} (Current: {s.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="quantity">{ledger === "physical" ? "Verified Physical Count" : "Adjustment Quantity"}</Label>
            <Input
              id="quantity"
              type="number"
              min={ledger === "physical" ? 0 : undefined}
              placeholder={ledger === "physical" ? "Enter counted quantity" : "Enter positive or negative number"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {ledger === "physical"
                ? "Enter the quantity physically counted in the warehouse."
                : "Use positive numbers to add sellable stock, negative to remove."}
            </p>
            {quantity && !isNaN(parseInt(quantity)) && (
              <p className="text-sm mt-2">
                New {ledger} value{hasSizes && selectedSize !== "all" ? ` for ${selectedSize}` : ""}: <span className="font-medium">{newStock}</span>
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
              {adjustStockMutation.isPending ? "Saving..." : ledger === "physical" ? "Record Verified Count" : "Adjust Sellable Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}