
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/cart-context";
import { ShoppingCart } from "lucide-react";
import type { Product, Category } from "@shared/schema";

interface AddToCartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category: Category | null }) | null;
}

export default function AddToCartModal({ open, onOpenChange, product }: AddToCartModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState(1);
  const { toast } = useToast();
  const { addItem } = useCart();

  if (!product) return null;

  const isWeightBased = product.sellingMethod === "weight";
  const maxStock = product.stock;

  const handleAddToCart = () => {
    if (!product) return;

    const finalQuantity = isWeightBased ? weight : quantity;

    if (finalQuantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (finalQuantity > maxStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${maxStock} ${isWeightBased ? product.weightUnit || 'units' : 'units'} available.`,
        variant: "destructive",
      });
      return;
    }

    // Add the specified quantity to cart
    for (let i = 0; i < finalQuantity; i++) {
      addItem(product);
    }

    toast({
      title: "Added to Cart",
      description: `${finalQuantity} ${isWeightBased ? product.weightUnit || 'units' : 'units'} of ${product.name} added to your cart.`,
    });

    // Reset and close modal
    setQuantity(1);
    setWeight(1);
    onOpenChange(false);
  };

  const getPrice = () => {
    if (isWeightBased) {
      const basePrice = Number(product.pricePerGram) || 0;
      const totalPrice = basePrice * weight;
      
      if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
        const discountedPrice = totalPrice * (1 - parseFloat(product.discountPercentage) / 100);
        return discountedPrice.toFixed(2);
      }
      return totalPrice.toFixed(2);
    } else {
      const basePrice = Number(product.price) || 0;
      const totalPrice = basePrice * quantity;
      
      if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
        const discountedPrice = totalPrice * (1 - parseFloat(product.discountPercentage) / 100);
        return discountedPrice.toFixed(2);
      }
      return totalPrice.toFixed(2);
    }
  };

  const getOriginalPrice = () => {
    if (isWeightBased) {
      const basePrice = Number(product.pricePerGram) || 0;
      return (basePrice * weight).toFixed(2);
    } else {
      const basePrice = Number(product.price) || 0;
      return (basePrice * quantity).toFixed(2);
    }
  };

  const hasDiscount = product.discountPercentage && parseFloat(product.discountPercentage) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Add to Cart
          </DialogTitle>
          <DialogDescription>
            Select the {isWeightBased ? 'weight' : 'quantity'} you want to add to your cart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="flex gap-3 p-3 border rounded-lg bg-muted/50">
            <img
              src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop"}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-md"
            />
            <div className="flex-1">
              <h4 className="font-medium text-sm">{product.name}</h4>
              {product.category && (
                <p className="text-xs text-muted-foreground">{product.category.name}</p>
              )}
              <div className="mt-1">
                {isWeightBased ? (
                  <div className="text-sm">
                    <span className="font-medium">${product.pricePerGram}/g</span>
                    {product.pricePerOunce && (
                      <span className="text-muted-foreground ml-2">${product.pricePerOunce}/oz</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm font-medium">${Number(product.price || 0).toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Quantity/Weight Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              {isWeightBased ? `Weight (${product.weightUnit || 'grams'})` : 'Quantity (units)'}
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max={maxStock}
              step={isWeightBased ? "0.1" : "1"}
              value={isWeightBased ? weight : quantity}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 1;
                if (isWeightBased) {
                  setWeight(value);
                } else {
                  setQuantity(Math.floor(value));
                }
              }}
              className="text-center"
            />
            <p className="text-xs text-muted-foreground">
              Available: {maxStock} {isWeightBased ? product.weightUnit || 'units' : 'units'}
            </p>
          </div>

          {/* Price Calculation */}
          <div className="p-3 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              {hasDiscount ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Original Total:</span>
                    <span className="line-through text-muted-foreground">${getOriginalPrice()}</span>
                  </div>
                  <div className="flex justify-between font-medium text-green-600">
                    <span>Discounted Total:</span>
                    <span>${getPrice()}</span>
                  </div>
                  <div className="text-xs text-green-600 font-medium">
                    {product.discountPercentage}% OFF
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${getPrice()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToCart}
            disabled={
              (isWeightBased ? weight : quantity) <= 0 || 
              (isWeightBased ? weight : quantity) > maxStock
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
