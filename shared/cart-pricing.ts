import { offerProduct, standardProduct } from "./product-discounts";

export interface PricingItem {
  product: any;
  quantity: number;
  size?: string;
  isFree?: boolean;
  customPrice?: number;
}
export type WeightTier = "oz" | "half" | "quarter" | "eighth" | "gram";
export function sizeToGrams(size?: string): number {
  const value = (size ?? "").toLowerCase().trim();
  if (value.includes("1 oz") || value === "ounce") return 28;
  if (value.includes("1/2") || value.includes("½")) return 14;
  if (value.includes("1/4") || value.includes("¼")) return 7;
  if (value.includes("1/8") || value.includes("⅛")) return 3.5;
  return 1;
}
export function getWeightTier(grams: number): WeightTier {
  return grams >= 28 ? "oz" : grams >= 14 ? "half" : grams >= 7 ? "quarter" : grams >= 3.5 ? "eighth" : "gram";
}
export function getWeightItemEffectivePrice(product: any, size: string | undefined, tier: WeightTier): number {
  const fields = { oz: "pricePerOunce", half: "pricePerHalf", quarter: "pricePerQuarter", eighth: "pricePerEighth", gram: "pricePerGram" };
  const grams = { oz: 28, half: 14, quarter: 7, eighth: 3.5, gram: 1 };
  const tierPrice = Number(product[fields[tier]]) || 0;
  const ownTier = getWeightTier(sizeToGrams(size));
  return tierPrice > 0 ? tierPrice / grams[tier] * sizeToGrams(size) : Number(product[fields[ownTier]]) || 0;
}
function discounted(product: any, price: number): number {
  const percentage = Number(product.discountPercentage) || 0;
  return percentage > 0 ? Math.max(0, price * (1 - percentage / 100)) : Math.max(0, price - (Number(product.discountAmount) || 0));
}
function usesQuantityPricing(product: any): boolean {
  return !product.bogoEnabled && Array.isArray(product.quantityPricing) && product.quantityPricing.length > 0;
}

/** Exact named weight buckets; partial buckets keep their own tier pricing. */
export function greedyOzBucketPricing(items: PricingItem[], makeKey: (id: number, size?: string) => string): Map<string, number> {
  const weightItems = items.filter(i => !i.isFree && i.customPrice === undefined && i.product.sellingMethod === "weight" && !usesQuantityPricing(i.product));
  type Unit = { product: any; size?: string; key: string; grams: number };
  let remaining: Unit[] = [];
  for (const item of weightItems) {
    for (let q = 0; q < item.quantity; q++) remaining.push({ product: item.product, size: item.size, key: makeKey(item.product.id, item.size), grams: sizeToGrams(item.size) });
  }
  remaining.sort((a, b) => b.grams - a.grams || getWeightItemEffectivePrice(a.product, a.size, getWeightTier(a.grams)) - getWeightItemEffectivePrice(b.product, b.size, getWeightTier(b.grams)));
  const buckets: Unit[][] = [];
  for (const grams of [28, 14, 7, 3.5]) {
    while (remaining.length) {
      const target = Math.round(grams * 2);
      const paths: Array<number[] | null> = Array.from({ length: target + 1 }, () => null);
      paths[0] = [];
      remaining.forEach((unit, index) => {
        const value = Math.round(unit.grams * 2);
        if (value <= 0 || value > target) return;
        for (let sum = target - value; sum >= 0; sum--) {
          if (paths[sum] && !paths[sum + value]) paths[sum + value] = [...paths[sum]!, index];
        }
      });
      if (!paths[target]?.length) break;
      const selected = new Set(paths[target]!);
      buckets.push(remaining.filter((_, index) => selected.has(index)));
      remaining = remaining.filter((_, index) => !selected.has(index));
    }
  }
  buckets.push(...remaining.map(unit => [unit]));
  const totals = new Map<string, number>();
  for (const bucket of buckets) {
    const tier = getWeightTier(bucket.reduce((sum, unit) => sum + unit.grams, 0));
    for (const unit of bucket) totals.set(unit.key, (totals.get(unit.key) || 0) + discounted(unit.product, getWeightItemEffectivePrice(unit.product, unit.size, tier)));
  }
  return totals;
}

function lineSubtotals(items: PricingItem[], globalWeightPricing: boolean): number[] {
  const quantities = new Map<number, number>();
  const weightQuantities = new Map<string, number>();
  const key = (id: number, size?: string) => `${id}:${size ?? ""}`;
  for (const item of items) {
    if (!item.isFree && item.customPrice === undefined) {
      quantities.set(item.product.id, (quantities.get(item.product.id) || 0) + item.quantity);
      weightQuantities.set(key(item.product.id, item.size), (weightQuantities.get(key(item.product.id, item.size)) || 0) + item.quantity);
    }
  }
  const weightTotals = globalWeightPricing ? greedyOzBucketPricing(items, key) : null;
  return items.map(item => {
    if (item.isFree) return 0;
    if (item.customPrice !== undefined) return item.customPrice * item.quantity;
    const product = item.product;
    if (product.sellingMethod === "weight" && !usesQuantityPricing(product)) {
      return weightTotals
        ? (weightTotals.get(key(product.id, item.size)) || 0) * item.quantity / (weightQuantities.get(key(product.id, item.size)) || item.quantity)
        : discounted(product, getWeightItemEffectivePrice(product, item.size, getWeightTier(sizeToGrams(item.size)))) * item.quantity;
    }
    const base = discounted(product, product.sellingMethod === "weight"
      ? getWeightItemEffectivePrice(product, item.size, getWeightTier(sizeToGrams(item.size)))
      : Number(product.price) || 0);
    const totalQuantity = quantities.get(product.id) || item.quantity;
    const tier = !product.bogoEnabled && (product.quantityPricing ?? []).slice().sort((a: any, b: any) => b.minQuantity - a.minQuantity).find((t: any) => totalQuantity >= t.minQuantity);
    const unitPrice = tier ? (Number(tier.pricePerItem) * tier.minQuantity + (totalQuantity - tier.minQuantity) * base) / totalQuantity : base;
    return unitPrice * item.quantity;
  });
}

export interface ItemPricing {
  subtotal: number;
  unitPrice: number;
  normalSubtotal: number;
  offerSubtotal: number;
  discountedQuantity: number;
}

/** One shared cap across all of a product's sizes/flavors; BOGO counts benefit items. */
export function priceCartItems(items: PricingItem[], globalWeightPricing: boolean, now = Date.now()): ItemPricing[] {
  // Uncapped products preserve their existing effective read prices, including
  // legacy offers without a campaign identifier.
  const offerItems = items.map(item => {
    const capped = item.product.discountItemLimit != null;
    const product = capped ? offerProduct(item.product, now) : item.product;
    const benefit = capped && product.bogoEnabled && (item.isFree || item.customPrice !== undefined);
    let customPrice = item.customPrice;
    let isFree = item.isFree;
    if (capped) {
      customPrice = undefined;
      isFree = false;
      if (benefit) {
        const base = product.sellingMethod === "weight"
          ? getWeightItemEffectivePrice(product, item.size, getWeightTier(sizeToGrams(item.size))) : Number(product.price) || 0;
        const value = Math.max(0, Number(product.bogoDiscountValue) || 0);
        customPrice = product.bogoDiscountType === "percentage" ? Math.max(0, base * (1 - value / 100))
          : product.bogoDiscountType === "amount" ? Math.max(0, base - value) : 0;
      }
    }
    return { ...item, product, isFree, customPrice };
  });
  const standardItems = items.map(item => ({
    ...item, product: standardProduct(item.product),
    isFree: item.product.discountItemLimit != null ? false : item.isFree,
    customPrice: item.product.discountItemLimit != null ? undefined : item.customPrice,
  }));
  const normal = lineSubtotals(standardItems, globalWeightPricing);
  const offers = lineSubtotals(offerItems, globalWeightPricing);
  const remaining = new Map<number, number>();
  return items.map((item, index) => {
    const capped = item.product.discountItemLimit != null;
    const saves = offers[index] < normal[index] - 0.000001;
    let discountedQuantity = saves ? item.quantity : 0;
    if (capped && saves) {
      const allowance = remaining.get(item.product.id) ?? Math.max(0, Number(item.product.discountRemainingItems ?? item.product.discountItemLimit));
      discountedQuantity = Math.min(item.quantity, allowance);
      remaining.set(item.product.id, allowance - discountedQuantity);
    }
    const subtotal = !capped ? offers[index]
      : saves ? offers[index] * discountedQuantity / item.quantity + normal[index] * (item.quantity - discountedQuantity) / item.quantity
      : normal[index];
    return { subtotal, unitPrice: item.quantity > 0 ? subtotal / item.quantity : 0, normalSubtotal: normal[index], offerSubtotal: offers[index], discountedQuantity };
  });
}