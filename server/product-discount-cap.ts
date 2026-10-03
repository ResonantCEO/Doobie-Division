import { inArray, asc, sql } from "drizzle-orm";
import { db, sql as pool } from "./db";
import { products, productQuantityPricing } from "@shared/schema";
import { discountFingerprint, getDiscountCycleKey, offerProduct, standardProduct } from "@shared/product-discounts";
import { priceCartItems } from "@shared/cart-pricing";

export class DiscountCapChangedError extends Error {
  readonly status = 409;
  readonly code = "ITEM_DISCOUNTS_CHANGED";
  constructor() { super("Item discounts or your remaining allowance have changed. Refresh your cart and review the updated prices before ordering."); }
}

export interface DiscountCapReservation {
  productId: number;
  cycleKey: string | null;
  quantity: number;
  fingerprint: string;
}

export async function ensureDiscountCapSchema() {
  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_item_limit integer;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_campaign_id varchar NOT NULL DEFAULT gen_random_uuid()::text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cap_usage jsonb NOT NULL DEFAULT '[]'::jsonb;
    CREATE TABLE IF NOT EXISTS product_discount_usage (
      product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cycle_key varchar NOT NULL,
      used_items integer NOT NULL DEFAULT 0 CHECK (used_items >= 0),
      updated_at timestamp NOT NULL DEFAULT NOW(),
      PRIMARY KEY (product_id, user_id, cycle_key)
    );
  `);
}

function snapshotProduct(product: any): any {
  const standard = standardProduct(product);
  const result: any = { ...product, ...offerProduct(product) };
  for (const field of ["price", "pricePerGram", "pricePerOunce", "pricePerEighth", "pricePerQuarter", "pricePerHalf"]) {
    result[`standard${field[0].toUpperCase()}${field.slice(1)}`] = standard[field];
  }
  for (const field of ["discountPercentage", "discountAmount", "discountPriceOverride", "discountPricePerGram", "discountPricePerOunce", "discountPricePerEighth", "discountPricePerQuarter", "discountPricePerHalf", "discountQuantityPricing", "bogoEnabled", "bogoFreeOptionIndex", "bogoDiscountType", "bogoDiscountValue"]) {
    const configured = `configured${field[0].toUpperCase()}${field.slice(1)}`;
    result[configured] = product[configured] !== undefined ? product[configured] : product[field];
  }
  result.standardQuantityPricing = standard.quantityPricing;
  return result;
}

export async function attachDiscountAllowances(list: any[], userId?: string | null): Promise<any[]> {
  const capped = list.filter(product => product.discountItemLimit != null);
  if (!capped.length) return list;
  const cycles = capped.map(product => getDiscountCycleKey(product)).filter((cycle): cycle is string => Boolean(cycle));
  const used = new Map<string, number>();
  if (userId && cycles.length) {
    const result = await pool.query(
      "SELECT product_id, cycle_key, used_items FROM product_discount_usage WHERE user_id = $1 AND product_id = ANY($2::int[]) AND cycle_key = ANY($3::varchar[])",
      [userId, capped.map(product => product.id), cycles],
    );
    for (const row of result.rows) used.set(`${row.product_id}:${row.cycle_key}`, Number(row.used_items));
  }
  return list.map(product => {
    if (product.discountItemLimit == null) return product;
    const cycle = getDiscountCycleKey(product);
    const remaining = userId && cycle ? Math.max(0, product.discountItemLimit - (used.get(`${product.id}:${cycle}`) || 0)) : 0;
    const snapshot = snapshotProduct(product);
    return {
      ...snapshot,
      ...(remaining === 0 ? standardProduct(snapshot) : {}),
      discountRemainingItems: remaining,
      discountWindowActive: Boolean(cycle),
      discountRequiresLogin: !userId && Boolean(cycle),
    };
  });
}

async function loadPricingProducts(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const tiers = await db.select().from(productQuantityPricing).where(inArray(productQuantityPricing.productId, ids));
  return rows.map(product => ({ ...product, quantityPricing: tiers.filter(tier => tier.productId === product.id), standardQuantityPricing: tiers.filter(tier => tier.productId === product.id) }));
}

export async function getCartPricingProducts(ids: number[], userId?: string | null) {
  const rows = await loadPricingProducts(ids);
  // Apply the existing window rules to uncapped products too.
  return attachDiscountAllowances(rows.map(snapshotProduct), userId);
}

/** Validate capped line prices before promo adjustments; reserve only inside the order transaction. */
export async function quoteDiscountCaps(items: any[], userId: string | null | undefined, globalWeightPricing: boolean): Promise<DiscountCapReservation[]> {
  const eligible = items.filter(item => item.productId && !item.metadata?.fromCgBag && !item.metadata?.fromStandardBag);
  const ids = Array.from(new Set<number>(eligible.map(item => Number(item.productId))));
  const raw = await loadPricingProducts(ids);
  if (!raw.some(product => product.discountItemLimit != null)) return [];
  const prepared = await attachDiscountAllowances(raw.map(snapshotProduct), userId);
  const byId = new Map(prepared.map(product => [product.id, product]));
  const cart = eligible.map(item => ({
    product: byId.get(Number(item.productId)),
    size: item.size || undefined,
    quantity: Number(item.quantity),
    isFree: Boolean(item.metadata?.isFree),
    customPrice: item.metadata?.bogoDiscounted ? 0 : undefined,
  }));
  if (cart.some(item => !item.product)) throw new DiscountCapChangedError();
  for (const product of prepared.filter(product => product.discountItemLimit != null)) {
    const lines = cart.filter(item => item.product.id === product.id);
    if (lines.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) throw new Error("Discount-capped products require a positive whole-item quantity.");
    const benefitQuantity = lines.filter(item => item.isFree || item.customPrice !== undefined).reduce((sum, item) => sum + item.quantity, 0);
    const paidQuantity = lines.filter(item => !item.isFree && item.customPrice === undefined).reduce((sum, item) => sum + item.quantity, 0);
    if (benefitQuantity > 0 && offerProduct(product).bogoEnabled && benefitQuantity > paidQuantity) throw new DiscountCapChangedError();
  }
  const pricing = priceCartItems(cart, globalWeightPricing);
  const reservations: DiscountCapReservation[] = [];
  for (const product of prepared.filter(product => product.discountItemLimit != null)) {
    let quantity = 0;
    eligible.forEach((item, index) => {
      if (Number(item.productId) !== product.id) return;
      const price = pricing[index];
      if (!Number.isFinite(Number(item.productPrice)) || !Number.isFinite(Number(item.subtotal))
        || Math.abs(Number(item.productPrice) - price.unitPrice) > 0.010001
        || Math.abs(Number(item.subtotal) - Math.round(price.subtotal * 100) / 100) > 0.010001) throw new DiscountCapChangedError();
      quantity += price.discountedQuantity;
    });
    reservations.push({ productId: product.id, cycleKey: getDiscountCycleKey(product), quantity, fingerprint: discountFingerprint(product) });
  }
  return reservations;
}

/** Product row locks serialize reservations, even when the usage row does not exist yet. */
export async function reserveDiscountCaps(tx: any, reservations: DiscountCapReservation[], items: any[], userId?: string | null) {
  const ids = Array.from(new Set<number>([
    ...items.filter(item => item.productId && !item.metadata?.fromCgBag && !item.metadata?.fromStandardBag).map(item => Number(item.productId)),
    ...reservations.map(entry => entry.productId),
  ])).sort((a, b) => a - b);
  if (!ids.length) return [];
  const rows = await tx.select().from(products).where(inArray(products.id, ids)).orderBy(asc(products.id)).for("update");
  if (reservations.some(entry => !rows.some((product: any) => product.id === entry.productId))) throw new DiscountCapChangedError();
  const capped = rows.filter((product: any) => product.discountItemLimit != null);
  if (!capped.length) {
    if (reservations.length) throw new DiscountCapChangedError();
    return [];
  }
  const tiers = await tx.select().from(productQuantityPricing).where(inArray(productQuantityPricing.productId, ids));
  const consumed: Array<{ productId: number; cycleKey: string; quantity: number }> = [];
  for (const product of capped) {
    const reservation = reservations.find(entry => entry.productId === product.id);
    if (reservation && (!Number.isSafeInteger(reservation.quantity) || reservation.quantity < 0)) throw new DiscountCapChangedError();
    const current = { ...product, quantityPricing: tiers.filter((tier: any) => tier.productId === product.id) };
    if (!reservation || reservation.fingerprint !== discountFingerprint(current)) throw new DiscountCapChangedError();
    if (reservation.quantity === 0) continue;
    if (!userId || !reservation.cycleKey || reservation.cycleKey !== getDiscountCycleKey(current)) throw new DiscountCapChangedError();
    const previous = await tx.execute(sql`SELECT used_items FROM product_discount_usage WHERE product_id = ${product.id} AND user_id = ${userId} AND cycle_key = ${reservation.cycleKey} FOR UPDATE`);
    if (Number(previous.rows[0]?.used_items || 0) + reservation.quantity > product.discountItemLimit) throw new DiscountCapChangedError();
    await tx.execute(sql`
      INSERT INTO product_discount_usage (product_id, user_id, cycle_key, used_items)
      VALUES (${product.id}, ${userId}, ${reservation.cycleKey}, ${reservation.quantity})
      ON CONFLICT (product_id, user_id, cycle_key) DO UPDATE
      SET used_items = product_discount_usage.used_items + EXCLUDED.used_items, updated_at = NOW()
    `);
    consumed.push({ productId: product.id, cycleKey: reservation.cycleKey, quantity: reservation.quantity });
  }
  return consumed;
}

export async function releaseDiscountCaps(tx: any, order: any) {
  if (!order.customerId) return;
  for (const usage of order.discountCapUsage ?? []) {
    await tx.execute(sql`UPDATE product_discount_usage SET used_items = GREATEST(0, used_items - ${usage.quantity}), updated_at = NOW() WHERE product_id = ${usage.productId} AND user_id = ${order.customerId} AND cycle_key = ${usage.cycleKey}`);
  }
}