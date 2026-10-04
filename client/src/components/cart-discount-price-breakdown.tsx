import React from "react";
import type { ItemPricing } from "../../../shared/cart-pricing";

interface CartDiscountPriceBreakdownProps {
  quantity: number;
  pricing: ItemPricing;
}

export function CartDiscountPriceBreakdown({
  quantity,
  pricing,
}: CartDiscountPriceBreakdownProps) {
  const discountedQuantity = pricing.discountedQuantity;
  const normalQuantity = quantity - discountedQuantity;

  if (discountedQuantity <= 0 || discountedQuantity >= quantity) {
    return null;
  }

  const discountedUnitPrice = pricing.offerSubtotal / quantity;
  const normalUnitPrice = pricing.normalSubtotal / quantity;
  const discountedSubtotal = discountedUnitPrice * discountedQuantity;
  const normalSubtotal = normalUnitPrice * normalQuantity;

  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p className="flex flex-wrap items-baseline gap-x-1">
        <span>{discountedQuantity} discounted</span>
        <span>× ${discountedUnitPrice.toFixed(2)}</span>
        <span className="text-muted-foreground/70">= ${discountedSubtotal.toFixed(2)}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-x-1">
        <span>{normalQuantity} at normal price</span>
        <span>× ${normalUnitPrice.toFixed(2)}</span>
        <span className="text-muted-foreground/70">= ${normalSubtotal.toFixed(2)}</span>
      </p>
    </div>
  );
}