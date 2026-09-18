import assert from "node:assert/strict";
import test from "node:test";
import { applyPromoSavingsInOrder, normalizeSubmittedPromoCodes } from "./promo-stack";

type Promo = { code: string; type: "percent" | "fixed"; value: number };

function stack(total: number, promos: Promo[]) {
  return applyPromoSavingsInOrder(total, promos, (promo, remaining) =>
    promo.type === "percent" ? remaining * promo.value / 100 : promo.value,
  );
}

test("applies percentage and fixed promos in entry order", () => {
  const percentThenFixed = stack(100, [
    { code: "TEN", type: "percent", value: 10 },
    { code: "FIVE", type: "fixed", value: 5 },
  ]);
  assert.deepEqual(percentThenFixed.results.map(({ promo, savings }) => [promo.code, savings]), [
    ["TEN", 10],
    ["FIVE", 5],
  ]);
  assert.equal(percentThenFixed.remainingTotal, 85);

  const fixedThenPercent = stack(100, [
    { code: "FIVE", type: "fixed", value: 5 },
    { code: "TEN", type: "percent", value: 10 },
  ]);
  assert.deepEqual(fixedThenPercent.results.map(({ promo, savings }) => [promo.code, savings]), [
    ["FIVE", 5],
    ["TEN", 9.5],
  ]);
  assert.equal(fixedThenPercent.remainingTotal, 85.5);
});

test("caps stacked promo savings at the remaining total", () => {
  const result = stack(20, [
    { code: "HALF", type: "percent", value: 50 },
    { code: "BIG", type: "fixed", value: 100 },
  ]);
  assert.equal(result.totalSavings, 20);
  assert.equal(result.remainingTotal, 0);
  assert.deepEqual(result.results.map(({ savings }) => savings), [10, 10]);
});

test("keeps one ordered result for every targeted or item-specific deal", () => {
  const promos = [
    { code: "TARGETED", requested: 6 },
    { code: "FREEITEM", requested: 12 },
    { code: "SPECIALPRICE", requested: 4 },
  ];
  const result = applyPromoSavingsInOrder(30, promos, promo => promo.requested);
  assert.deepEqual(result.results.map(({ promo, savings }) => ({ code: promo.code, amount: savings })), [
    { code: "TARGETED", amount: 6 },
    { code: "FREEITEM", amount: 12 },
    { code: "SPECIALPRICE", amount: 4 },
  ]);
});

test("rejects duplicate codes case-insensitively instead of silently dropping them", () => {
  assert.throws(
    () => normalizeSubmittedPromoCodes(["SAVE10", " save10 "]),
    /submitted more than once/,
  );
});

test("preserves submitted code order", () => {
  assert.deepEqual(normalizeSubmittedPromoCodes([" FIRST ", "second", "Third"]), [
    "FIRST",
    "second",
    "Third",
  ]);
});