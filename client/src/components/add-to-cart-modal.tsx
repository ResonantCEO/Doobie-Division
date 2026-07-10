import React, { useState, useEffect, useMemo } from "react";
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
import { ShoppingCart, Minus, Plus } from "lucide-react";
import type { Product, Category, ProductSize } from "@shared/schema";

interface QuantityTier {
  minQuantity: number;
  pricePerItem: string;
}

interface AddToCartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category: Category | null; sizes?: ProductSize[]; quantityPricing?: QuantityTier[] }) | null;
}

// Helper function to format price, assuming it exists in your project
const formatPrice = (price: number | string): string => {
  const numericPrice = Number(price || 0);
  return numericPrice.toFixed(2);
};

// Returns the per-item price after applying quantity pricing tiers based on total quantity of this product
function getTieredUnitPrice(basePrice: number, tiers: QuantityTier[] | undefined, totalQty: number): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const sorted = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
  const applicable = sorted.find(t => totalQty >= t.minQuantity);
  return applicable ? Number(applicable.pricePerItem) : basePrice;
}

export default function AddToCartModal({ open, onOpenChange, product }: AddToCartModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState(1);
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [weightOptionQuantities, setWeightOptionQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { addItem } = useCart();

  if (!product) return null;

  const isWeightBased = product.sellingMethod === "weight";
  const hasSizes = product.sizes && product.sizes.length > 0;
  const allSizesOutOfStock = hasSizes && product.sizes!.every(s => s.quantity <= 0);
  const maxStock = product.stock;

  // Weight options for weight-based products
  const weightOptions = useMemo(() => {
    if (!isWeightBased) return [];
    return [
      { key: "grams", label: "Grams", price: product.pricePerGram },
      { key: "eighth", label: "1/8 oz", price: (product as any).pricePerEighth },
      { key: "quarter", label: "1/4 oz", price: (product as any).pricePerQuarter },
      { key: "half", label: "1/2 oz", price: (product as any).pricePerHalf },
      { key: "ounce", label: "1 oz", price: product.pricePerOunce },
    ].filter(opt => Number(opt.price) > 0);
  }, [isWeightBased, product.pricePerGram, product.pricePerOunce, (product as any).pricePerEighth, (product as any).pricePerQuarter, (product as any).pricePerHalf]);

  const hasWeightOptions = isWeightBased && weightOptions.length > 0;

  // Initialize size quantities when product changes
  useEffect(() => {
    if (hasSizes && product.sizes) {
      const initial: Record<string, number> = {};
      product.sizes.forEach(size => {
        initial[size.size] = 0;
      });
      setSizeQuantities(initial);
    }
  }, [product?.id, hasSizes]);

  // Initialize weight option quantities when product changes
  useEffect(() => {
    if (hasWeightOptions) {
      const initial: Record<string, number> = {};
      weightOptions.forEach(opt => {
        initial[opt.key] = 0;
      });
      setWeightOptionQuantities(initial);
    }
  }, [product?.id, hasWeightOptions, weightOptions]);

  const handleAddToCart = () => {
    if (!product) return;

    if (hasSizes) {
      // Validate size quantities
      const totalSizeQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
      
      if (totalSizeQuantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: "Please select at least one item to add to cart.",
          variant: "destructive",
        });
        return;
      }

      // Check stock availability for each size
      if (product.sizes) {
        for (const size of product.sizes) {
          const requestedQty = sizeQuantities[size.size] || 0;
          if (requestedQty > size.quantity) {
            toast({
              title: "Insufficient Stock",
              description: `Only ${size.quantity} units available in size ${size.size}.`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      // Add items with size information
      if (product.sizes) {
        for (const size of product.sizes) {
          const qty = sizeQuantities[size.size] || 0;
          for (let i = 0; i < qty; i++) {
            addItem(product, size.size);
          }
        }
      }

      toast({
        title: "Added to Cart",
        description: `${totalSizeQuantity} ${totalSizeQuantity === 1 ? 'item' : 'items'} of ${product.name} added to your cart.`,
      });
    } else if (hasWeightOptions) {
      // Handle weight options similar to sizes
      const totalWeightQuantity = Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0);
      
      if (totalWeightQuantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: "Please select at least one weight option to add to cart.",
          variant: "destructive",
        });
        return;
      }

      // Add items with weight option information
      weightOptions.forEach(opt => {
        const qty = weightOptionQuantities[opt.key] || 0;
        for (let i = 0; i < qty; i++) {
          addItem(product, opt.label);
        }
      });

      toast({
        title: "Added to Cart",
        description: `${totalWeightQuantity} ${totalWeightQuantity === 1 ? 'item' : 'items'} of ${product.name} added to your cart.`,
      });
    } else {
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
    }

    // Reset and close modal
    setQuantity(1);
    setWeight(1);
    if (hasSizes && product.sizes) {
      const reset: Record<string, number> = {};
      product.sizes.forEach(size => {
        reset[size.size] = 0;
      });
      setSizeQuantities(reset);
    }
    if (hasWeightOptions) {
      const reset: Record<string, number> = {};
      weightOptions.forEach(opt => {
        reset[opt.key] = 0;
      });
      setWeightOptionQuantities(reset);
    }
    onOpenChange(false);
  };

  const getOriginalPrice = () => {
    let totalPrice = 0;
    const tiers = product.quantityPricing;

    if (hasSizes) {
      const totalQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
      const basePrice = isWeightBased
        ? (Number(product.pricePerGram) || Number(product.price) || 0)
        : (Number(product.price) || 0);
      const unitPrice = getTieredUnitPrice(basePrice, tiers, totalQuantity);
      totalPrice = unitPrice * totalQuantity;
    } else if (hasWeightOptions) {
      // Calculate price based on selected weight options
      const totalQuantity = Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0);
      weightOptions.forEach(opt => {
        const qty = weightOptionQuantities[opt.key] || 0;
        const basePrice = Number(opt.price) || 0;
        const unitPrice = getTieredUnitPrice(basePrice, tiers, totalQuantity);
        totalPrice += unitPrice * qty;
      });
    } else if (isWeightBased) {
      const basePrice = Number(product.pricePerGram) || 0;
      const unitPrice = getTieredUnitPrice(basePrice, tiers, weight);
      totalPrice = unitPrice * weight;
    } else {
      const basePrice = Number(product.price) || 0;
      const unitPrice = getTieredUnitPrice(basePrice, tiers, quantity);
      totalPrice = unitPrice * quantity;
    }

    return totalPrice.toFixed(2);
  };

  const getPrice = () => {
    const totalPrice = parseFloat(getOriginalPrice());

    if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
      const discountedPrice = totalPrice * (1 - parseFloat(product.discountPercentage) / 100);
      return discountedPrice.toFixed(2);
    }
    return totalPrice.toFixed(2);
  };

  const hasDiscount = product.discountPercentage && parseFloat(product.discountPercentage) > 0;

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setQuantity(1);
      setWeight(1);
      if (product?.sizes && product.sizes.length > 0) {
        const reset: Record<string, number> = {};
        product.sizes.forEach(size => {
          reset[size.size] = 0;
        });
        setSizeQuantities(reset);
      }
      if (hasWeightOptions) {
        const reset: Record<string, number> = {};
        weightOptions.forEach(opt => {
          reset[opt.key] = 0;
        });
        setWeightOptionQuantities(reset);
      }
    }
  }, [open, product?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Add to Cart
          </DialogTitle>
          <DialogDescription>
            Select the {isWeightBased ? 'weight' : 'quantity'} you want to add to your cart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
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
                    {product.pricePerGram && Number(product.pricePerGram) > 0 && (
                      <span className="font-medium">${Number(product.pricePerGram).toFixed(2)}/g</span>
                    )}
                    {product.pricePerOunce && Number(product.pricePerOunce) > 0 && (
                      <span className="text-muted-foreground ml-2">${Number(product.pricePerOunce).toFixed(2)}/oz</span>
                    )}
                    {(product as any).pricePerEighth && (
                      <span className="text-muted-foreground ml-2">${Number((product as any).pricePerEighth).toFixed(2)}/⅛ oz</span>
                    )}
                    {(product as any).pricePerQuarter && (
                      <span className="text-muted-foreground ml-2">${Number((product as any).pricePerQuarter).toFixed(2)}/¼ oz</span>
                    )}
                    {(product as any).pricePerHalf && (
                      <span className="text-muted-foreground ml-2">${Number((product as any).pricePerHalf).toFixed(2)}/½ oz</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm font-medium">${Number(product.price || 0).toFixed(2)}</span>
                )}
                {product.quantityPricing && product.quantityPricing.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[...product.quantityPricing]
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((tier) => {
                        const total = Number(tier.pricePerItem) * tier.minQuantity;
                        return (
                          <span
                            key={tier.minQuantity}
                            className="text-[10px] font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          >
                            {tier.minQuantity}+ for ${total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Size Selection or Quantity/Weight Input */}
          {hasSizes ? (
            <div className="space-y-3">
              <Label>Options</Label>
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                {product.sizes!.map((size) => {
                  const isOutOfStock = size.quantity <= 0;
                  return (
                  <div key={size.id} className={`flex items-center justify-between ${isOutOfStock ? 'opacity-50' : ''}`}>
                    <div className="flex-1 flex items-center gap-2">
                      <Label className="text-sm font-medium">{size.size}</Label>
                      {isOutOfStock && (
                        <span className="text-xs font-semibold text-red-500">Out of Stock</span>
                      )}
                    </div>
                    {!isOutOfStock && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const current = sizeQuantities[size.size] || 0;
                          setSizeQuantities({
                            ...sizeQuantities,
                            [size.size]: Math.max(0, current - 1)
                          });
                        }}
                        disabled={(sizeQuantities[size.size] || 0) <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold w-8 text-center">
                        {sizeQuantities[size.size] || 0}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const current = sizeQuantities[size.size] || 0;
                          setSizeQuantities({
                            ...sizeQuantities,
                            [size.size]: Math.min(size.quantity, current + 1)
                          });
                        }}
                        disabled={(sizeQuantities[size.size] || 0) >= size.quantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0)} items
              </p>
            </div>
          ) : hasWeightOptions ? (
            <div className="space-y-3">
              <Label>Weight Options</Label>
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                {weightOptions.map((opt) => {
                  return (
                    <div key={opt.key} className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-2">
                        <Label className="text-sm font-medium">{opt.label}</Label>
                        <span className="text-xs text-muted-foreground">${Number(opt.price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const current = weightOptionQuantities[opt.key] || 0;
                            setWeightOptionQuantities({
                              ...weightOptionQuantities,
                              [opt.key]: Math.max(0, current - 1)
                            });
                          }}
                          disabled={(weightOptionQuantities[opt.key] || 0) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-8 text-center">
                          {weightOptionQuantities[opt.key] || 0}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const current = weightOptionQuantities[opt.key] || 0;
                            setWeightOptionQuantities({
                              ...weightOptionQuantities,
                              [opt.key]: current + 1
                            });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0)} items
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amount">
                {isWeightBased ? `Weight (${product.weightUnit || 'grams'})` : 'Quantity (units)'}
              </Label>

              {isWeightBased ? (
              <>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  value={weight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setWeight(Math.max(1, value));
                  }}
                  className="text-center"
                  disabled={maxStock === 0}
                />
              </>
            ) : (
              <>
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || maxStock === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock || maxStock === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            </div>
          )}

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
              allSizesOutOfStock ||
              (hasSizes 
                ? Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                : hasWeightOptions
                  ? Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                  : ((isWeightBased ? weight : quantity) <= 0 || 
                     (isWeightBased ? weight : quantity) > maxStock ||
                     maxStock === 0))
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {(maxStock === 0 || allSizesOutOfStock)
              ? "Out of Stock" 
              : hasSizes
                ? Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                  ? "Select Items"
                  : "Add to Cart"
                : hasWeightOptions
                  ? Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                    ? "Select Items"
                    : "Add to Cart"
                  : (isWeightBased ? weight : quantity) > maxStock 
                    ? "Insufficient Stock"
                    : `Add to Cart`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}