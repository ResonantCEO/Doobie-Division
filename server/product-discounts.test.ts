import test from "node:test";
import assert from "node:assert/strict";
import { priceCartItems, greedyOzBucketPricing } from "../shared/cart-pricing";
import { getDiscountCycleKey, discountFingerprint, offerProduct, preserveDiscountWindowKeys } from "../shared/product-discounts";
import { insertProductSchema } from "../shared/schema";

const product = (extra: Record<string, any> = {}) => ({
  id: 1, price: "10.00", sellingMethod: "units",
  discountPercentage: "20", discountCampaignId: "test-campaign",
  discountItemLimit: 3, discountRemainingItems: 3, ...extra,
});
const now = new Date("2026-10-03T12:00:00Z").getTime();

test("cap 3, buy 5: three discounted items and two normal-price items", () => {
  const [price] = priceCartItems([{ product: product(), quantity: 5 }], false);
  assert.equal(price.subtotal, 44);
  assert.equal(price.discountedQuantity, 3);
  assert.equal(price.unitPrice, 8.8);
});

test("the remaining allowance is shared across flavors", () => {
  const p = product({ discountRemainingItems: 2 });
  const prices = priceCartItems([{ product: p, size: "Mint", quantity: 1 }, { product: p, size: "Berry", quantity: 3 }], false);
  assert.deepEqual(prices.map(price => price.discountedQuantity), [1, 1]);
  assert.equal(prices.reduce((total, price) => total + price.subtotal, 0), 36);
});

test("different products have independent allowances", () => {
  const prices = priceCartItems([{ product: product(), quantity: 5 }, { product: product({ id: 2 }), quantity: 5 }], false);
  assert.deepEqual(prices.map(price => price.discountedQuantity), [3, 3]);
});

test("exhausted allowance and anonymous allowance zero use normal prices", () => {
  const [price] = priceCartItems([{ product: product({ discountRemainingItems: 0 }), quantity: 5 }], false);
  assert.equal(price.subtotal, 50);
  assert.equal(price.discountedQuantity, 0);
});

test("fixed-amount discounts use partial caps", () => {
  const [price] = priceCartItems([{ product: product({ discountPercentage: "0", discountAmount: "3" }), quantity: 5 }], false);
  assert.equal(price.subtotal, 41);
});

test("temporary unit prices restore the original unit price past the cap", () => {
  const [price] = priceCartItems([{ product: product({ discountPriceOverride: "5" }), quantity: 5 }], false);
  assert.equal(price.subtotal, 35);
});

test("temporary quantity tiers blend with the original tier prices", () => {
  const [price] = priceCartItems([{
    product: product({ discountPercentage: "0", quantityPricing: [{ minQuantity: 5, pricePerItem: "9" }], discountQuantityPricing: [{ minQuantity: 5, pricePerItem: "6" }] }),
    quantity: 5,
  }], false);
  assert.equal(price.subtotal, 36);
  assert.equal(price.discountedQuantity, 3);
});

test("weight quantities count selected packages, not the grams in them", () => {
  const p = product({ sellingMethod: "weight", pricePerEighth: "35", pricePerQuarter: "60", discountPricePerEighth: "20", discountPricePerQuarter: "40", discountItemLimit: 2, discountRemainingItems: 2 });
  const prices = priceCartItems([{ product: p, size: "1/8 oz", quantity: 1 }, { product: p, size: "1/4 oz", quantity: 2 }], false);
  assert.deepEqual(prices.map(price => price.discountedQuantity), [1, 1]);
  assert.equal(prices.reduce((sum, price) => sum + price.subtotal, 0), 120);
});

test("BOGO counts free benefit items, not the qualifying paid items", () => {
  const p = product({ discountPercentage: "0", bogoEnabled: true, bogoDiscountType: "free" });
  const prices = priceCartItems([{ product: p, quantity: 5 }, { product: p, quantity: 5, isFree: true }], false);
  assert.deepEqual(prices.map(price => price.discountedQuantity), [0, 3]);
  assert.equal(prices[0].subtotal, 50);
  assert.equal(prices[1].subtotal, 20);
});

test("partial-price BOGO calculates the configured benefit on the server", () => {
  const p = product({ discountPercentage: "0", bogoEnabled: true, bogoDiscountType: "percentage", bogoDiscountValue: "50", discountRemainingItems: 1 });
  const prices = priceCartItems([{ product: p, quantity: 2 }, { product: p, quantity: 2, customPrice: -999 }], false);
  assert.equal(prices[1].subtotal, 15);
  assert.equal(prices[1].discountedQuantity, 1);
});

test("expired BOGO benefit rows become normal-priced items", () => {
  const p = product({ discountPercentage: "0", bogoEnabled: true, discountExpiresAt: "2026-10-02T12:00:00Z" });
  const prices = priceCartItems([{ product: p, quantity: 1 }, { product: p, quantity: 1, isFree: true }], false, now);
  assert.deepEqual(prices.map(price => price.subtotal), [10, 10]);
  assert.deepEqual(prices.map(price => price.discountedQuantity), [0, 0]);
});

test("uncapped products preserve unlimited discounts and free BOGO rows", () => {
  const p = product({ discountItemLimit: null, discountRemainingItems: undefined });
  assert.equal(priceCartItems([{ product: p, quantity: 5 }], false)[0].subtotal, 40);
  assert.equal(priceCartItems([{ product: p, quantity: 5, isFree: true }], false)[0].subtotal, 0);
});

test("scheduled windows reset the cycle; overlapping windows share one allowance", () => {
  const p = product({ discountSchedule: [
    { startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T13:00:00Z" },
    { startAt: "2026-10-03T12:00:00Z", endAt: "2026-10-03T14:00:00Z" },
    { startAt: "2026-10-04T10:00:00Z", endAt: "2026-10-04T14:00:00Z" },
  ] });
  assert.equal(getDiscountCycleKey(p, now), getDiscountCycleKey(p, new Date("2026-10-03T13:30:00Z").getTime()));
  assert.notEqual(getDiscountCycleKey(p, now), getDiscountCycleKey(p, new Date("2026-10-04T12:00:00Z").getTime()));
  assert.equal(getDiscountCycleKey(p, new Date("2026-10-03T15:00:00Z").getTime()), null);
});

test("adjacent, non-overlapping windows receive fresh allowances", () => {
  const p = product({ discountSchedule: [
    { startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T12:00:00Z" },
    { startAt: "2026-10-03T12:00:00Z", endAt: "2026-10-03T14:00:00Z" },
  ] });
  assert.notEqual(getDiscountCycleKey(p, now - 1), getDiscountCycleKey(p, now));
});

test("indefinite offers retain the same cycle until a new campaign is enabled", () => {
  const p = product();
  assert.equal(getDiscountCycleKey(p, now), getDiscountCycleKey(p, now + 86400000));
  assert.notEqual(getDiscountCycleKey(p, now), getDiscountCycleKey({ ...p, discountCampaignId: "new-campaign" }, now));
});

test("editing the product does not reset usage when the date picker rounds seconds", () => {
  const p = product({ discountSchedule: [{ startAt: "2026-10-03T10:00:45Z", endAt: "2026-10-03T14:00:45Z" }] });
  const schedule = preserveDiscountWindowKeys(p, [{ startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T14:00:00Z" }], now);
  assert.equal(getDiscountCycleKey(p, now), getDiscountCycleKey({ ...p, discountSchedule: schedule }, now));
});

test("converting the active indefinite offer to a schedule preserves the allowance", () => {
  const p = product();
  const schedule = preserveDiscountWindowKeys(p, [
    { startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T14:00:00Z" },
    { startAt: "2026-10-04T10:00:00Z", endAt: "2026-10-04T14:00:00Z" },
  ], now);
  assert.equal(getDiscountCycleKey(p, now), getDiscountCycleKey({ ...p, discountSchedule: schedule }, now));
  assert.notEqual(getDiscountCycleKey(p, now), getDiscountCycleKey({ ...p, discountSchedule: schedule }, now + 86400000));
});

test("splitting one window into disjoint windows gives the later window a new allowance", () => {
  const p = product({ discountSchedule: [{ startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T18:00:00Z" }] });
  const schedule = preserveDiscountWindowKeys(p, [
    { startAt: "2026-10-03T13:00:00Z", endAt: "2026-10-03T18:00:00Z" },
    { startAt: "2026-10-03T10:00:00Z", endAt: "2026-10-03T12:00:00Z" },
  ], now);
  assert.notEqual(getDiscountCycleKey({ ...p, discountSchedule: schedule }, now - 1), getDiscountCycleKey({ ...p, discountSchedule: schedule }, now + 3600000));
});

test("routine edits do not change the pricing fingerprint; actual pricing changes do", () => {
  const p = product();
  assert.equal(discountFingerprint(p), discountFingerprint({ ...p, name: "Renamed", stock: 999 }));
  assert.notEqual(discountFingerprint(p), discountFingerprint({ ...p, discountPercentage: "25" }));
});

test("read-time configured and standard snapshots match raw-row pricing", () => {
  const raw = product({ discountPriceOverride: "5" });
  const snapshot = { ...offerProduct(raw), standardPrice: raw.price, configuredDiscountPercentage: raw.discountPercentage, configuredDiscountPriceOverride: raw.discountPriceOverride };
  assert.equal(discountFingerprint(raw), discountFingerprint(snapshot));
});

test("exact weight buckets do not promote a quarter plus eighth to a half", () => {
  const p = product({ discountItemLimit: null, sellingMethod: "weight", discountPercentage: "0", pricePerEighth: "35", pricePerQuarter: "60", pricePerHalf: "100", pricePerOunce: "180" });
  const prices = greedyOzBucketPricing([{ product: p, size: "1/4 oz", quantity: 1 }, { product: p, size: "1/8 oz", quantity: 1 }], (id, size) => `${id}:${size}`);
  assert.equal(prices.get("1:1/4 oz"), 60);
  assert.equal(prices.get("1:1/8 oz"), 35);
  assert.equal(priceCartItems([{ product: p, size: "1/4 oz", quantity: 2 }], true)[0].subtotal, 100);
});

test("invalid caps are rejected, blank/unlimited and positive whole caps are accepted", () => {
  const schema = insertProductSchema.pick({ discountItemLimit: true });
  assert.equal(schema.safeParse({ discountItemLimit: 0 }).success, false);
  assert.equal(schema.safeParse({ discountItemLimit: -2 }).success, false);
  assert.equal(schema.safeParse({ discountItemLimit: 1.5 }).success, false);
  assert.equal(schema.safeParse({ discountItemLimit: null }).success, true);
  assert.equal(schema.safeParse({ discountItemLimit: 3 }).success, true);
});