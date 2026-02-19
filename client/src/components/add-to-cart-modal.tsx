import React, { useState, useEffect } from "react";
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
import type { Product, Category, ProductSize, ProductFlavor } from "@shared/schema";

interface AddToCartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category: Category | null; sizes?: ProductSize[]; flavors?: ProductFlavor[] }) | null;
}

// Helper function to format price, assuming it exists in your project
const formatPrice = (price: number | string): string => {
  const numericPrice = Number(price || 0);
  return numericPrice.toFixed(2);
};

export default function AddToCartModal({ open, onOpenChange, product }: AddToCartModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState(1);
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [flavorQuantities, setFlavorQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { addItem } = useCart();

  if (!product) return null;

  const isWeightBased = product.sellingMethod === "weight";
  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasFlavors = product.flavors && product.flavors.length > 0;
  const allSizesOutOfStock = hasSizes && product.sizes!.every(s => s.quantity <= 0);
  const allFlavorsOutOfStock = hasFlavors && product.flavors!.every(f => f.quantity <= 0);
  const maxStock = product.stock;

  useEffect(() => {
    if (hasSizes && product.sizes) {
      const initial: Record<string, number> = {};
      product.sizes.forEach(size => {
        initial[size.size] = 0;
      });
      setSizeQuantities(initial);
    }
  }, [product?.id, hasSizes]);

  useEffect(() => {
    if (hasFlavors && product.flavors) {
      const initial: Record<string, number> = {};
      product.flavors.forEach(flavor => {
        initial[flavor.flavor] = 0;
      });
      setFlavorQuantities(initial);
    }
  }, [product?.id, hasFlavors]);

  const handleAddToCart = () => {
    if (!product) return;

    if (hasFlavors) {
      const totalFlavorQuantity = Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0);
      
      if (totalFlavorQuantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: "Please select at least one item to add to cart.",
          variant: "destructive",
        });
        return;
      }

      if (product.flavors) {
        for (const flavor of product.flavors) {
          const requestedQty = flavorQuantities[flavor.flavor] || 0;
          if (requestedQty > flavor.quantity) {
            toast({
              title: "Insufficient Stock",
              description: `Only ${flavor.quantity} units available in flavor ${flavor.flavor}.`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      if (product.flavors) {
        for (const flavor of product.flavors) {
          const qty = flavorQuantities[flavor.flavor] || 0;
          for (let i = 0; i < qty; i++) {
            addItem(product, undefined, flavor.flavor);
          }
        }
      }

      toast({
        title: "Added to Cart",
        description: `${totalFlavorQuantity} ${totalFlavorQuantity === 1 ? 'item' : 'items'} of ${product.name} added to your cart.`,
      });
    } else if (hasSizes) {
      const totalSizeQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
      
      if (totalSizeQuantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: "Please select at least one item to add to cart.",
          variant: "destructive",
        });
        return;
      }

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

    setQuantity(1);
    setWeight(1);
    if (hasSizes && product.sizes) {
      const reset: Record<string, number> = {};
      product.sizes.forEach(size => { reset[size.size] = 0; });
      setSizeQuantities(reset);
    }
    if (hasFlavors && product.flavors) {
      const reset: Record<string, number> = {};
      product.flavors.forEach(flavor => { reset[flavor.flavor] = 0; });
      setFlavorQuantities(reset);
    }
    onOpenChange(false);
  };

  const getPrice = () => {
    let totalQuantity = 0;
    
    if (hasFlavors) {
      totalQuantity = Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0);
    } else if (hasSizes) {
      totalQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
    } else if (isWeightBased) {
      totalQuantity = weight;
    } else {
      totalQuantity = quantity;
    }

    if (isWeightBased) {
      const basePrice = Number(product.pricePerGram) || 0;
      const totalPrice = basePrice * totalQuantity;

      if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
        const discountedPrice = totalPrice * (1 - parseFloat(product.discountPercentage) / 100);
        return discountedPrice.toFixed(2);
      }
      return totalPrice.toFixed(2);
    } else {
      const basePrice = Number(product.price) || 0;
      const totalPrice = basePrice * totalQuantity;

      if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
        const discountedPrice = totalPrice * (1 - parseFloat(product.discountPercentage) / 100);
        return discountedPrice.toFixed(2);
      }
      return totalPrice.toFixed(2);
    }
  };

  const getOriginalPrice = () => {
    let totalQuantity = 0;
    
    if (hasFlavors) {
      totalQuantity = Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0);
    } else if (hasSizes) {
      totalQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
    } else if (isWeightBased) {
      totalQuantity = weight;
    } else {
      totalQuantity = quantity;
    }

    if (isWeightBased) {
      const basePrice = Number(product.pricePerGram) || 0;
      return (basePrice * totalQuantity).toFixed(2);
    } else {
      const basePrice = Number(product.price) || 0;
      return (basePrice * totalQuantity).toFixed(2);
    }
  };

  const hasDiscount = product.discountPercentage && parseFloat(product.discountPercentage) > 0;

  useEffect(() => {
    if (!open) {
      setQuantity(1);
      setWeight(1);
      if (product?.sizes && product.sizes.length > 0) {
        const reset: Record<string, number> = {};
        product.sizes.forEach(size => { reset[size.size] = 0; });
        setSizeQuantities(reset);
      }
      if (product?.flavors && product.flavors.length > 0) {
        const reset: Record<string, number> = {};
        product.flavors.forEach(flavor => { reset[flavor.flavor] = 0; });
        setFlavorQuantities(reset);
      }
    }
  }, [open, product?.id]);

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

          {/* Flavor Selection */}
          {hasFlavors ? (
            <div className="space-y-3">
              <Label>Select Flavors</Label>
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                {product.flavors!.map((flavor) => {
                  const isOutOfStock = flavor.quantity <= 0;
                  return (
                  <div key={flavor.id} className={`flex items-center justify-between ${isOutOfStock ? 'opacity-50' : ''}`}>
                    <div className="flex-1 flex items-center gap-2">
                      <Label className="text-sm font-medium">{flavor.flavor}</Label>
                      {isOutOfStock ? (
                        <span className="text-xs font-semibold text-red-500">Out of Stock</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">({flavor.quantity} available)</span>
                      )}
                    </div>
                    {!isOutOfStock && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const current = flavorQuantities[flavor.flavor] || 0;
                          setFlavorQuantities({
                            ...flavorQuantities,
                            [flavor.flavor]: Math.max(0, current - 1)
                          });
                        }}
                        disabled={(flavorQuantities[flavor.flavor] || 0) <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold w-8 text-center">
                        {flavorQuantities[flavor.flavor] || 0}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const current = flavorQuantities[flavor.flavor] || 0;
                          setFlavorQuantities({
                            ...flavorQuantities,
                            [flavor.flavor]: Math.min(flavor.quantity, current + 1)
                          });
                        }}
                        disabled={(flavorQuantities[flavor.flavor] || 0) >= flavor.quantity}
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
                Total: {Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0)} items
              </p>
            </div>
          ) : hasSizes ? (
            <div className="space-y-3">
              <Label>Select Sizes</Label>
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                {product.sizes!.map((size) => {
                  const isOutOfStock = size.quantity <= 0;
                  return (
                  <div key={size.id} className={`flex items-center justify-between ${isOutOfStock ? 'opacity-50' : ''}`}>
                    <div className="flex-1 flex items-center gap-2">
                      <Label className="text-sm font-medium">{size.size}</Label>
                      {isOutOfStock ? (
                        <span className="text-xs font-semibold text-red-500">Out of Stock</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">({size.quantity} available)</span>
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
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Available: {maxStock > 0 ? `${maxStock} ${product.weightUnit || 'units'}` : "Out of stock"}
                </p>
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
                {(quantity >= maxStock || maxStock === 0) && (
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Available: {maxStock > 0 ? `${maxStock} units` : "Out of stock"}
                  </p>
                )}
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
              allFlavorsOutOfStock ||
              allSizesOutOfStock ||
              (hasFlavors
                ? Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                : hasSizes 
                  ? Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                  : ((isWeightBased ? weight : quantity) <= 0 || 
                     (isWeightBased ? weight : quantity) > maxStock ||
                     maxStock === 0))
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {(maxStock === 0 || allSizesOutOfStock || allFlavorsOutOfStock)
              ? "Out of Stock" 
              : hasFlavors
                ? Object.values(flavorQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                  ? "Select Items"
                  : "Add to Cart"
                : hasSizes
                  ? Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
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