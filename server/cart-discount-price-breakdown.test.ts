import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CartDiscountPriceBreakdown } from "../client/src/components/cart-discount-price-breakdown";
import { priceCartItems } from "../shared/cart-pricing";

const product = {
  id: 1, price: "40.00", sellingMethod: "units", discountPercentage: "50",
  discountItemLimit: 2, discountRemainingItems: 2, discountCampaignId: "cart-split-test",
};
function render(items: Parameters<typeof priceCartItems>[0], index = 0) {
  const pricing = priceCartItems(items, false)[index];
  const html = renderToStaticMarkup(React.createElement(CartDiscountPriceBreakdown, {
    quantity: items[index].quantity, pricing,
  }));
  return { html, pricing };
}

test("four items show two at $20 and two at $40 instead of the blended $30", () => {
  const { html, pricing } = render([{ product, quantity: 4 }]);
  assert.equal(pricing.unitPrice, 30);
  assert.equal(pricing.subtotal, 120);
  assert.match(html, /2 discounted/);
  assert.match(html, /× \$20\.00/);
  assert.match(html, /= \$40\.00/);
  assert.match(html, /2 at normal price/);
  assert.match(html, /× \$40\.00/);
  assert.match(html, /= \$80\.00/);
  assert.doesNotMatch(html, /\$30\.00/);
});

test("split reflects the remaining allowance shared across flavors", () => {
  const { html, pricing } = render([
    { product, size: "Mint", quantity: 1 },
    { product, size: "Banana", quantity: 3 },
  ], 1);
  assert.equal(pricing.subtotal, 100);
  assert.match(html, /1 discounted/);
  assert.match(html, /2 at normal price/);
  assert.match(html, /= \$20\.00/);
  assert.match(html, /= \$80\.00/);
});

test("partly capped free BOGO benefits show zero discounted price and paid remainder", () => {
  const { html, pricing } = render([{
    product: { ...product, discountPercentage: "0", bogoEnabled: true, bogoDiscountType: "free" },
    quantity: 4, isFree: true,
  }]);
  assert.equal(pricing.subtotal, 80);
  assert.match(html, /2 discounted/);
  assert.match(html, /× \$0\.00/);
  assert.match(html, /= \$80\.00/);
});

test("non-mixed rows do not replace the existing single-price display", () => {
  for (const remaining of [0, 4]) {
    assert.equal(render([{ product: { ...product, discountRemainingItems: remaining }, quantity: 4 }]).html, "");
  }
});