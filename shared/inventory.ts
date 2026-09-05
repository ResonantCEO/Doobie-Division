export type InventoryVariant = {
  id?: number;
  size: string;
  quantity: number;
  physicalQuantity?: number | null;
};

export type InventoryProduct = {
  stock: number;
  physicalInventory?: number | null;
  minStockThreshold?: number | null;
  sellingMethod?: string | null;
  sizes?: InventoryVariant[] | null;
};

export const WEIGHT_OPTION_GRAMS: Record<string, number> = {
  "1 g": 1,
  "1g": 1,
  gram: 1,
  "1/8 oz": 3.5,
  "⅛ oz": 3.5,
  eighth: 3.5,
  "1/4 oz": 7,
  "¼ oz": 7,
  quarter: 7,
  "1/2 oz": 14,
  "½ oz": 14,
  half: 14,
  "1 oz": 28,
  ounce: 28,
};

export function normalizeInventoryOption(option?: string | null): string {
  return String(option ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function weightOptionToGrams(option?: string | null): number {
  if (!option) return 1;
  const normalized = normalizeInventoryOption(option);
  return WEIGHT_OPTION_GRAMS[normalized] ?? 1;
}

export function hasAuthoritativeVariants(product: InventoryProduct): boolean {
  return Array.isArray(product.sizes) && product.sizes.length > 0;
}

export function getSellableStock(product: InventoryProduct): number {
  return hasAuthoritativeVariants(product)
    ? product.sizes!.reduce((total, row) => total + Number(row.quantity || 0), 0)
    : Number(product.stock || 0);
}

export function getPhysicalStock(product: InventoryProduct): number {
  return hasAuthoritativeVariants(product)
    ? product.sizes!.reduce(
        (total, row) => total + Number(row.physicalQuantity ?? 0),
        0,
      )
    : Number(product.physicalInventory ?? 0);
}

export function getInventoryVariance(product: InventoryProduct): number {
  return getPhysicalStock(product) - getSellableStock(product);
}

export function getVariantSellableStock(
  product: InventoryProduct,
  size?: string | null,
): number {
  if (!hasAuthoritativeVariants(product)) return getSellableStock(product);
  if (!size) return 0;
  const normalizedSize = normalizeInventoryOption(size);
  return Number(
    product.sizes!.find((row) => normalizeInventoryOption(row.size) === normalizedSize)?.quantity ?? 0,
  );
}

export function getSellableUnitsForSelection(
  product: InventoryProduct,
  size?: string | null,
): number {
  const quantity = getVariantSellableStock(product, size);
  if (hasAuthoritativeVariants(product)) return quantity;
  if (product.sellingMethod === "weight") {
    return Math.floor(quantity / weightOptionToGrams(size));
  }
  return quantity;
}

export function isLowStock(product: InventoryProduct): boolean {
  const sellable = getSellableStock(product);
  return sellable > 0 && sellable <= Number(product.minStockThreshold ?? 5);
}

export function isOutOfStock(product: InventoryProduct): boolean {
  return getSellableStock(product) <= 0;
}