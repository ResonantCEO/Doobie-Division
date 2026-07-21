import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { ShoppingCart, Minus, Plus, Gift } from "lucide-react";
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

const formatPrice = (price: number | string): string => {
  const numericPrice = Number(price || 0);
  return numericPrice.toFixed(2);
};

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

  const [step, setStep] = useState<'paid' | 'free'>('paid');
  const [freeQuantities, setFreeQuantities] = useState<Record<string, number>>({});
  const [paidQtyForBogo, setPaidQtyForBogo] = useState(0);

  const { toast } = useToast();
  const { addItem, addFreeItem, addDiscountedItem, state: cartState } = useCart();

  if (!product) return null;

  const isWeightBased = product.sellingMethod === "weight";
  const hasSizes = product.sizes && product.sizes.length > 0;
  const isBogoProduct = (product as any).bogoEnabled === true;

  // How many of this product (non-free) are already in the cart?
  const cartQtyForProduct = cartState.items
    .filter(i => i.product.id === product.id && !i.isFree)
    .reduce((sum, i) => sum + i.quantity, 0);

  // Per-size cart quantities
  const cartQtyPerSize: Record<string, number> = {};
  cartState.items
    .filter(i => i.product.id === product.id && !i.isFree && i.size)
    .forEach(i => {
      cartQtyPerSize[i.size!] = (cartQtyPerSize[i.size!] || 0) + i.quantity;
    });

  // Remaining available stock (accounting for what's already in cart)
  const maxStock = Math.max(0, product.stock - cartQtyForProduct);
  const allSizesOutOfStock = hasSizes && product.sizes!.every(s => Math.max(0, s.quantity - (cartQtyPerSize[s.size] || 0)) <= 0);

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

  useEffect(() => {
    if (hasSizes && product.sizes) {
      const initial: Record<string, number> = {};
      product.sizes.forEach(size => { initial[size.size] = 0; });
      setSizeQuantities(initial);
    }
  }, [product?.id, hasSizes]);

  useEffect(() => {
    if (hasWeightOptions) {
      const initial: Record<string, number> = {};
      weightOptions.forEach(opt => { initial[opt.key] = 0; });
      setWeightOptionQuantities(initial);
    }
  }, [product?.id, hasWeightOptions, weightOptions]);

  useEffect(() => {
    if (!open) {
      setQuantity(1);
      setWeight(1);
      setStep('paid');
      setFreeQuantities({});
      setPaidQtyForBogo(0);
      if (product?.sizes && product.sizes.length > 0) {
        const reset: Record<string, number> = {};
        product.sizes.forEach(size => { reset[size.size] = 0; });
        setSizeQuantities(reset);
      }
      if (hasWeightOptions) {
        const reset: Record<string, number> = {};
        weightOptions.forEach(opt => { reset[opt.key] = 0; });
        setWeightOptionQuantities(reset);
      }
    }
  }, [open, product?.id]);

  const getPaidQuantity = () => {
    if (hasSizes) return Object.values(sizeQuantities).reduce((s, q) => s + q, 0);
    if (hasWeightOptions) return Object.values(weightOptionQuantities).reduce((s, q) => s + q, 0);
    return isWeightBased ? weight : quantity;
  };

  const getFreeQuantityTotal = () => Object.values(freeQuantities).reduce((s, q) => s + q, 0);

  const resetAndClose = () => {
    setQuantity(1);
    setWeight(1);
    setStep('paid');
    setFreeQuantities({});
    setPaidQtyForBogo(0);
    if (hasSizes && product.sizes) {
      const reset: Record<string, number> = {};
      product.sizes.forEach(size => { reset[size.size] = 0; });
      setSizeQuantities(reset);
    }
    if (hasWeightOptions) {
      const reset: Record<string, number> = {};
      weightOptions.forEach(opt => { reset[opt.key] = 0; });
      setWeightOptionQuantities(reset);
    }
    onOpenChange(false);
  };

  const handleDialogOpenChange = (v: boolean) => {
    if (!v) resetAndClose();
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (hasSizes) {
      const totalSizeQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
      if (totalSizeQuantity <= 0) {
        toast({ title: "Invalid Quantity", description: "Please select at least one item to add to cart.", variant: "destructive" });
        return;
      }
      if (product.sizes) {
        for (const size of product.sizes) {
          const requestedQty = sizeQuantities[size.size] || 0;
          const remainingForSize = size.quantity - (cartQtyPerSize[size.size] || 0);
          if (requestedQty > remainingForSize) {
            const alreadyInCart = cartQtyPerSize[size.size] || 0;
            const availMsg = remainingForSize <= 0
              ? `${size.size} is out of stock${alreadyInCart > 0 ? ` (you already have ${alreadyInCart} in your cart)` : ''}.`
              : `Only ${remainingForSize} more available for size ${size.size}${alreadyInCart > 0 ? ` (${alreadyInCart} already in cart)` : ''}.`;
            toast({ title: "Insufficient Stock", description: availMsg, variant: "destructive" });
            return;
          }
        }
      }
      if (product.sizes) {
        for (const size of product.sizes) {
          const qty = sizeQuantities[size.size] || 0;
          for (let i = 0; i < qty; i++) addItem(product, size.size);
        }
      }

      if (isBogoProduct && totalSizeQuantity >= 1) {
        const bogoDesc = bogoType === "free" ? `Now choose your ${totalSizeQuantity} free BOGO ${totalSizeQuantity === 1 ? 'item' : 'items'}!` : `Now choose your ${totalSizeQuantity} discounted BOGO ${totalSizeQuantity === 1 ? 'item' : 'items'}!`;
        toast({ title: "Added to Cart 🎁", description: `${totalSizeQuantity} ${totalSizeQuantity === 1 ? 'item' : 'items'} of ${product.name} added. ${bogoDesc}` });
        const initFree: Record<string, number> = {};
        product.sizes!.forEach(s => { initFree[s.size] = 0; });
        setFreeQuantities(initFree);
        setPaidQtyForBogo(totalSizeQuantity);
        setStep('free');
        return;
      }
      toast({ title: "Added to Cart", description: `${totalSizeQuantity} ${totalSizeQuantity === 1 ? 'item' : 'items'} of ${product.name} added to your cart.` });
    } else if (hasWeightOptions) {
      const totalWeightQuantity = Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0);
      if (totalWeightQuantity <= 0) {
        toast({ title: "Invalid Quantity", description: "Please select at least one weight option to add to cart.", variant: "destructive" });
        return;
      }
      weightOptions.forEach(opt => {
        const qty = weightOptionQuantities[opt.key] || 0;
        for (let i = 0; i < qty; i++) addItem(product, opt.label);
      });

      if (isBogoProduct && totalWeightQuantity >= 1) {
        const bogoDesc = bogoType === "free" ? `Now choose your ${totalWeightQuantity} free BOGO ${totalWeightQuantity === 1 ? 'item' : 'items'}!` : `Now choose your ${totalWeightQuantity} discounted BOGO ${totalWeightQuantity === 1 ? 'item' : 'items'}!`;
        toast({ title: "Added to Cart 🎁", description: `${totalWeightQuantity} ${totalWeightQuantity === 1 ? 'item' : 'items'} of ${product.name} added. ${bogoDesc}` });
        const initFree: Record<string, number> = {};
        weightOptions.forEach(o => { initFree[o.key] = 0; });
        setFreeQuantities(initFree);
        setPaidQtyForBogo(totalWeightQuantity);
        setStep('free');
        return;
      }
      toast({ title: "Added to Cart", description: `${totalWeightQuantity} ${totalWeightQuantity === 1 ? 'item' : 'items'} of ${product.name} added to your cart.` });
    } else {
      const finalQuantity = isWeightBased ? weight : quantity;
      if (finalQuantity <= 0) {
        toast({ title: "Invalid Quantity", description: "Please enter a valid quantity greater than 0.", variant: "destructive" });
        return;
      }
      if (finalQuantity > maxStock) {
        toast({ title: "Insufficient Stock", description: `Only ${maxStock} ${isWeightBased ? product.weightUnit || 'units' : 'units'} available.`, variant: "destructive" });
        return;
      }
      for (let i = 0; i < finalQuantity; i++) addItem(product);

      if (isBogoProduct && finalQuantity >= 1) {
        const bogoDesc = bogoType === "free" ? `Now claim your ${finalQuantity} free BOGO ${finalQuantity === 1 ? 'item' : 'items'}!` : `Now claim your ${finalQuantity} discounted BOGO ${finalQuantity === 1 ? 'item' : 'items'}!`;
        toast({ title: "Added to Cart 🎁", description: `${finalQuantity} ${isWeightBased ? product.weightUnit || 'units' : 'units'} of ${product.name} added. ${bogoDesc}` });
        setPaidQtyForBogo(finalQuantity);
        setStep('free');
        return;
      }
      toast({ title: "Added to Cart", description: `${finalQuantity} ${isWeightBased ? product.weightUnit || 'units' : 'units'} of ${product.name} added to your cart.` });
    }

    resetAndClose();
  };

  const bogoType = (product as any).bogoDiscountType || "free";
  const bogoValue = parseFloat((product as any).bogoDiscountValue || "0");

  const getBogoDiscountedPrice = (basePrice: number) => {
    if (bogoType === "percentage" && bogoValue > 0) return Math.max(0, basePrice * (1 - bogoValue / 100));
    if (bogoType === "amount" && bogoValue > 0) return Math.max(0, basePrice - bogoValue);
    return 0;
  };

  const handleAddFreeItems = () => {
    if (!product) return;
    const totalFree = getFreeQuantityTotal();
    const isFreeType = bogoType === "free";

    if ((hasSizes || hasWeightOptions) && totalFree === 0) {
      toast({ title: isFreeType ? "No Free Items Selected" : "No Items Selected", description: `Please select at least 1 item above, or click "Skip" to continue without them.`, variant: "destructive" });
      return;
    }

    if (hasSizes) {
      product.sizes!.forEach(size => {
        const qty = freeQuantities[size.size] || 0;
        if (isFreeType) {
          for (let i = 0; i < qty; i++) addFreeItem(product, size.size);
        } else {
          const basePrice = Number(product.price) || 0;
          const discPrice = getBogoDiscountedPrice(basePrice);
          for (let i = 0; i < qty; i++) addDiscountedItem(product, size.size, discPrice);
        }
      });
    } else if (hasWeightOptions) {
      weightOptions.forEach(opt => {
        const qty = freeQuantities[opt.key] || 0;
        if (isFreeType) {
          for (let i = 0; i < qty; i++) addFreeItem(product, opt.label);
        } else {
          const basePrice = Number(opt.price) || 0;
          const discPrice = getBogoDiscountedPrice(basePrice);
          for (let i = 0; i < qty; i++) addDiscountedItem(product, opt.label, discPrice);
        }
      });
    } else {
      if (isFreeType) {
        for (let i = 0; i < paidQtyForBogo; i++) addFreeItem(product);
      } else {
        const basePrice = Number(product.price) || 0;
        const discPrice = getBogoDiscountedPrice(basePrice);
        for (let i = 0; i < paidQtyForBogo; i++) addDiscountedItem(product, undefined, discPrice);
      }
    }

    const addedCount = hasSizes || hasWeightOptions ? totalFree : paidQtyForBogo;
    const dealLabel = isFreeType ? "free" : bogoType === "percentage" ? `${bogoValue}% off` : `$${bogoValue.toFixed(2)} off`;
    toast({ title: "Items Added!", description: `${addedCount} ${dealLabel} ${addedCount === 1 ? 'item' : 'items'} added to your cart.` });

    resetAndClose();
  };

  const handleSkipFreeItems = () => {
    resetAndClose();
  };

  const getOriginalPrice = () => {
    let totalPrice = 0;
    const tiers = isBogoProduct ? undefined : product.quantityPricing;
    if (hasSizes) {
      const totalQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
      const basePrice = isWeightBased ? (Number(product.pricePerGram) || Number(product.price) || 0) : (Number(product.price) || 0);
      const unitPrice = getTieredUnitPrice(basePrice, tiers, totalQuantity);
      totalPrice = unitPrice * totalQuantity;
    } else if (hasWeightOptions) {
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

  const isGrabBag = (product as any).sku?.startsWith("GRAB-BAG-");

  const parseGrabBagItems = (desc: string): { name: string; price: string }[] =>
    desc.split('\n')
      .filter(l => l.trim().startsWith('•'))
      .map(l => { const m = l.match(/•\s+(.+?)\s+\(\$([0-9.]+)\)/); return m ? { name: m[1], price: m[2] } : null; })
      .filter(Boolean) as { name: string; price: string }[];

  const getPrice = () => {
    if (isGrabBag) return getOriginalPrice(); // price is already the final sell price
    const totalPrice = parseFloat(getOriginalPrice());
    if (product.discountPercentage && parseFloat(product.discountPercentage) > 0) {
      return (totalPrice * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2);
    }
    if ((product as any).discountAmount && parseFloat((product as any).discountAmount) > 0) {
      const discAmt = parseFloat((product as any).discountAmount);
      const totalQty = hasSizes
        ? Object.values(sizeQuantities).reduce((sum: number, qty: number) => sum + qty, 0)
        : hasWeightOptions
        ? Object.values(weightOptionQuantities).reduce((sum: number, qty: number) => sum + qty, 0)
        : isWeightBased ? weight : quantity;
      return Math.max(0, totalPrice - discAmt * totalQty).toFixed(2);
    }
    return totalPrice.toFixed(2);
  };

  const hasDiscount = !isGrabBag && (
    (product.discountPercentage && parseFloat(product.discountPercentage) > 0) ||
    ((product as any).discountAmount && parseFloat((product as any).discountAmount) > 0)
  );

  // ── Free/Discounted Step Content ─────────────────────────────────────────
  const freeTotal = getFreeQuantityTotal();
  const remaining = paidQtyForBogo - freeTotal;
  const isFreeType = bogoType === "free";

  const bogoBadgeLabel = isFreeType
    ? "BOGO Free"
    : bogoType === "percentage"
      ? `BOGO ${bogoValue.toFixed(0)}% Off`
      : `BOGO $${bogoValue.toFixed(2)} Off`;

  const bogoStepTitle = isFreeType ? "Select Your Free Items" : "Select Your Discounted Items";
  const bogoStepDesc = isFreeType
    ? <span>You get <span className="font-semibold text-green-600 dark:text-green-400">{paidQtyForBogo} free {paidQtyForBogo === 1 ? 'item' : 'items'}</span> with your purchase!</span>
    : bogoType === "percentage"
      ? <span>You get <span className="font-semibold text-blue-600 dark:text-blue-400">{bogoValue.toFixed(0)}% off</span> on {paidQtyForBogo} additional {paidQtyForBogo === 1 ? 'item' : 'items'}!</span>
      : <span>You get <span className="font-semibold text-orange-600 dark:text-orange-400">${bogoValue.toFixed(2)} off</span> on {paidQtyForBogo} additional {paidQtyForBogo === 1 ? 'item' : 'items'}!</span>;

  const itemDiscountLabel = (qty: number) => {
    if (!isFreeType && qty > 0) {
      return bogoType === "percentage"
        ? <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{bogoValue.toFixed(0)}% OFF</span>
        : <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">${bogoValue.toFixed(2)} OFF</span>;
    }
    if (isFreeType && qty > 0) return <span className="text-xs font-semibold text-green-600 dark:text-green-400">FREE</span>;
    return null;
  };

  const getSavingsAmount = () => {
    const basePrice = Number(product.price || 0);
    if (isFreeType) return (basePrice * paidQtyForBogo).toFixed(2);
    if (bogoType === "percentage") return (basePrice * (bogoValue / 100) * paidQtyForBogo).toFixed(2);
    if (bogoType === "amount") return (Math.min(basePrice, bogoValue) * paidQtyForBogo).toFixed(2);
    return "0.00";
  };

  const freeStepContent = (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-green-500" />
          {bogoStepTitle}
        </DialogTitle>
        <DialogDescription>
          {bogoStepDesc} Choose which {paidQtyForBogo === 1 ? 'one' : 'ones'} you'd like.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
        <div className="flex gap-3 p-3 border rounded-lg bg-muted/50">
          <img
            src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop"}
            alt={product.name}
            className="w-16 h-16 object-cover rounded-md"
          />
          <div className="flex-1">
            <h4 className="font-medium text-sm">{product.name}</h4>
            {product.category && <p className="text-xs text-muted-foreground">{product.category.name}</p>}
            <div className="mt-1.5">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${isFreeType ? "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" : bogoType === "percentage" ? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" : "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700"}`}>
                <Gift className="h-3 w-3" /> {bogoBadgeLabel}
              </span>
            </div>
          </div>
        </div>

        {hasSizes ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{isFreeType ? "Choose Your Free Options" : "Choose Your Discounted Options"}</Label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${remaining === 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                {freeTotal}/{paidQtyForBogo} selected
              </span>
            </div>
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              {product.sizes!.map((size) => {
                const isOutOfStock = size.quantity <= 0;
                const currentFree = freeQuantities[size.size] || 0;
                return (
                  <div key={size.id} className={`flex items-center justify-between ${isOutOfStock ? 'opacity-40' : ''}`}>
                    <div className="flex-1 flex items-center gap-2">
                      <Label className="text-sm font-medium">{size.size}</Label>
                      {isOutOfStock && <span className="text-xs font-semibold text-red-500">Out of Stock</span>}
                      {itemDiscountLabel(currentFree)}
                    </div>
                    {!isOutOfStock && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setFreeQuantities({ ...freeQuantities, [size.size]: Math.max(0, currentFree - 1) })}
                          disabled={currentFree <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-8 text-center">{currentFree}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (freeTotal >= paidQtyForBogo) return;
                            setFreeQuantities({ ...freeQuantities, [size.size]: currentFree + 1 });
                          }}
                          disabled={freeTotal >= paidQtyForBogo}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={`text-xs font-medium ${remaining === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {remaining === 0 ? `✓ All ${isFreeType ? 'free' : 'discounted'} items selected!` : `${remaining} more ${isFreeType ? 'free' : 'discounted'} ${remaining === 1 ? 'item' : 'items'} to select`}
            </p>
          </div>
        ) : hasWeightOptions ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{isFreeType ? "Choose Your Free Options" : "Choose Your Discounted Options"}</Label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${remaining === 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                {freeTotal}/{paidQtyForBogo} selected
              </span>
            </div>
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              {weightOptions.map((opt) => {
                const currentFree = freeQuantities[opt.key] || 0;
                const discountedOptPrice = isFreeType ? 0 : getBogoDiscountedPrice(Number(opt.price) || 0);
                return (
                  <div key={opt.key} className="flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-2">
                      <Label className="text-sm font-medium">{opt.label}</Label>
                      <span className="text-xs text-muted-foreground line-through">${Number(opt.price || 0).toFixed(2)}</span>
                      {!isFreeType && currentFree > 0 && <span className="text-xs text-green-600 font-medium">${discountedOptPrice.toFixed(2)}</span>}
                      {itemDiscountLabel(currentFree)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setFreeQuantities({ ...freeQuantities, [opt.key]: Math.max(0, currentFree - 1) })}
                        disabled={currentFree <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold w-8 text-center">{currentFree}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (freeTotal >= paidQtyForBogo) return;
                          setFreeQuantities({ ...freeQuantities, [opt.key]: currentFree + 1 });
                        }}
                        disabled={freeTotal >= paidQtyForBogo}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className={`text-xs font-medium ${remaining === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {remaining === 0 ? `✓ All ${isFreeType ? 'free' : 'discounted'} items selected!` : `${remaining} more ${isFreeType ? 'free' : 'discounted'} ${remaining === 1 ? 'item' : 'items'} to select`}
            </p>
          </div>
        ) : (
          <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-center space-y-1">
            <Gift className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              {isFreeType
                ? `${paidQtyForBogo} free ${paidQtyForBogo === 1 ? 'item' : 'items'} of ${product.name} will be added!`
                : `${paidQtyForBogo} discounted ${paidQtyForBogo === 1 ? 'item' : 'items'} of ${product.name} will be added at ${bogoType === "percentage" ? `${bogoValue.toFixed(0)}% off` : `$${bogoValue.toFixed(2)} off`}!`}
            </p>
            <p className="text-xs text-muted-foreground">Click "{isFreeType ? "Add Free Items" : "Add Discounted Items"}" to claim them.</p>
          </div>
        )}

        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex justify-between text-sm font-medium text-green-700 dark:text-green-300">
            <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> You save:</span>
            <span>${getSavingsAmount()}</span>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={handleSkipFreeItems} className="text-xs">
          Skip
        </Button>
        <Button
          onClick={handleAddFreeItems}
          className="bg-green-600 hover:bg-green-700 text-white flex-1"
        >
          <Gift className="h-4 w-4 mr-2" />
          {hasSizes || hasWeightOptions
            ? freeTotal > 0
              ? `Add ${freeTotal} ${isFreeType ? 'Free' : 'Discounted'} ${freeTotal === 1 ? 'Item' : 'Items'}`
              : 'Select Items Above'
            : `Add ${paidQtyForBogo} ${isFreeType ? 'Free' : 'Discounted'} ${paidQtyForBogo === 1 ? 'Item' : 'Items'}`
          }
        </Button>
      </DialogFooter>
    </>
  );

  // ── Paid Step Content ────────────────────────────────────────────────────
  const paidStepContent = (
    <>
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
            {isGrabBag && (product as any).description && (() => {
              const bagItems = parseGrabBagItems((product as any).description);
              return bagItems.length > 0 ? (
                <div className="mt-1.5 space-y-0.5 border-t border-dashed border-muted-foreground/20 pt-1.5">
                  {bagItems.map((gi, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {gi.name} <span className="text-muted-foreground/60">(${gi.price})</span></p>
                  ))}
                </div>
              ) : null;
            })()}
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
                <>
                  {hasDiscount ? (
                    <span className="text-sm font-medium">
                      <span className="line-through text-muted-foreground mr-1">${Number(product.price || 0).toFixed(2)}</span>
                      <span className="text-green-600 dark:text-green-400">${getPrice()}</span>
                    </span>
                  ) : (
                    <span className="text-sm font-medium">${Number(product.price || 0).toFixed(2)}</span>
                  )}
                </>
              )}
              {!isBogoProduct && product.quantityPricing && product.quantityPricing.length > 0 && (
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
              {isBogoProduct && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 px-1.5 py-0.5 rounded-full">
                    <Gift className="h-2.5 w-2.5" /> Buy 1 Get 1 FREE
                  </span>
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
                      {isOutOfStock && <span className="text-xs font-semibold text-red-500">Out of Stock</span>}
                    </div>
                    {!isOutOfStock && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSizeQuantities({ ...sizeQuantities, [size.size]: Math.max(0, (sizeQuantities[size.size] || 0) - 1) })}
                          disabled={(sizeQuantities[size.size] || 0) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-8 text-center">{sizeQuantities[size.size] || 0}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { const remaining = size.quantity - (cartQtyPerSize[size.size] || 0); setSizeQuantities({ ...sizeQuantities, [size.size]: Math.min(remaining, (sizeQuantities[size.size] || 0) + 1) }); }}
                          disabled={(sizeQuantities[size.size] || 0) >= Math.max(0, size.quantity - (cartQtyPerSize[size.size] || 0))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(() => {
              const paidQty = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
              const totalQty = isBogoProduct ? paidQty * 2 : paidQty;
              return (
                <p className="text-xs text-muted-foreground">
                  Total: {totalQty} items
                  {isBogoProduct && paidQty >= 1 && (
                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                      → {paidQty} free!
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
        ) : hasWeightOptions ? (
          <div className="space-y-3">
            <Label>Weight Options</Label>
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              {(() => {
                const gramMap: Record<string, number> = { grams: 1, eighth: 3.5, quarter: 7, half: 14, ounce: 28 };
                const totalGramsSelected = Object.entries(weightOptionQuantities).reduce(
                  (sum, [key, qty]) => sum + qty * (gramMap[key] ?? 1), 0
                );
                return weightOptions.map((opt) => {
                  const gramsPerUnit = gramMap[opt.key] ?? 1;
                  const canAddMore = totalGramsSelected + gramsPerUnit <= maxStock;
                  const availableUnits = Math.floor((maxStock - totalGramsSelected + (weightOptionQuantities[opt.key] || 0) * gramsPerUnit) / gramsPerUnit);
                  return (
                    <div key={opt.key} className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-2">
                        <Label className="text-sm font-medium">{opt.label}</Label>
                        <span className="text-xs text-muted-foreground">${Number(opt.price || 0).toFixed(2)}</span>
                        {availableUnits === 0 && (weightOptionQuantities[opt.key] || 0) === 0 && (
                          <span className="text-xs text-red-500 font-medium">Not enough stock</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setWeightOptionQuantities({ ...weightOptionQuantities, [opt.key]: Math.max(0, (weightOptionQuantities[opt.key] || 0) - 1) })}
                          disabled={(weightOptionQuantities[opt.key] || 0) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-8 text-center">{weightOptionQuantities[opt.key] || 0}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setWeightOptionQuantities({ ...weightOptionQuantities, [opt.key]: (weightOptionQuantities[opt.key] || 0) + 1 })}
                          disabled={!canAddMore || (weightOptionQuantities[opt.key] || 0) >= availableUnits}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {(() => {
              const paidQty = Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0);
              const totalQty = isBogoProduct ? paidQty * 2 : paidQty;
              return (
                <p className="text-xs text-muted-foreground">
                  Total: {totalQty} items
                  {isBogoProduct && paidQty >= 1 && (
                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                      → {paidQty} free!
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="amount">
              {isWeightBased ? `Weight (${product.weightUnit || 'grams'})` : 'Quantity (units)'}
            </Label>
            {isWeightBased ? (
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={weight}
                onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center"
                disabled={maxStock === 0}
              />
            ) : (
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
                  onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}
                  disabled={quantity >= maxStock || maxStock === 0}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isBogoProduct && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <Gift className="h-3 w-3" />
                You'll get {isWeightBased ? weight : quantity} free {(isWeightBased ? weight : quantity) === 1 ? 'item' : 'items'} after adding to cart!
              </p>
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
                  {product.discountPercentage && parseFloat(product.discountPercentage) > 0
                    ? `${product.discountPercentage}% OFF`
                    : `$${parseFloat((product as any).discountAmount || "0").toFixed(2)} OFF`}
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
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
                : isBogoProduct ? "Add to Cart & Pick Free Items" : "Add to Cart"
              : hasWeightOptions
                ? Object.values(weightOptionQuantities).reduce((sum, qty) => sum + qty, 0) <= 0
                  ? "Select Items"
                  : isBogoProduct ? "Add to Cart & Pick Free Items" : "Add to Cart"
                : (isWeightBased ? weight : quantity) > maxStock
                  ? "Insufficient Stock"
                  : isBogoProduct ? "Add to Cart & Pick Free Items" : "Add to Cart"
          }
        </Button>
      </DialogFooter>
    </>
  );

  // ── Single Dialog wrapping both steps ────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] flex flex-col">
        {step === 'free' ? freeStepContent : paidStepContent}
      </DialogContent>
    </Dialog>
  );
}
