import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the actual front-card label without mounting authenticated cart hooks.
const source = readFileSync(new URL("../client/src/components/product-card.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("product-card.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let label: ts.BinaryExpression | undefined;
function visit(node: ts.Node) {
  if (ts.isBinaryExpression(node) && node.left.getText(ast) === "hasDiscountItemLimit"
    && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) label = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(label, "Discount limit label must exist on the product card");
const start = source.indexOf("  const discountItemLimit =");
const end = source.indexOf("\n\n  return (", start);
assert.ok(start >= 0 && end > start, "Card allowance presentation logic must exist");
const compiled = ts.transpileModule(
  `function renderLabel(product) { ${source.slice(start, end)} return (${label.getText(ast)}); }`,
  { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } },
).outputText;
function markup(product: Record<string, unknown>) {
  const element = runInNewContext(`${compiled}\nrenderLabel(product)`, { product, React });
  return renderToStaticMarkup(element);
}

test("front card advertises configured per-person cap and remaining allowance", () => {
  const html = markup({ discountItemLimit: 2, discountWindowActive: true, discountRemainingItems: 1 });
  assert.match(html, /Discount limit: 2 items per person/);
  assert.match(html, /1 discounted item left/);
  assert.match(markup({ discountItemLimit: 3, discountWindowActive: true, discountRemainingItems: 2 }),
    /2 discounted items left/);
});

test("discount limit sits immediately between the price and Add to Cart", () => {
  const expression = label!.parent;
  const container = expression.parent;
  assert.ok(ts.isJsxElement(container));
  const children = container.children.filter((child) => !ts.isJsxText(child));
  const index = children.indexOf(expression as ts.JsxChild);
  assert.ok(index > 0);
  assert.match(children[index - 1].getText(ast), /product\.sellingMethod === "weight"/);
  assert.match(children[index + 1].getText(ast), /^<Button\s+onClick=\{handleAddToCart\}/);
});

test("cap remains advertised outside an active window without claiming eligibility", () => {
  const html = markup({ discountItemLimit: 1, discountWindowActive: false, discountRemainingItems: 0 });
  assert.match(html, /Discount limit: 1 item per person/);
  assert.doesNotMatch(html, /left|limit reached|Sign in/);
});

test("front card explains sign-in and exhausted allowances", () => {
  assert.match(markup({ discountItemLimit: 2, discountWindowActive: true, discountRequiresLogin: true, discountRemainingItems: 0 }),
    /Sign in for item discounts/);
  assert.match(markup({ discountItemLimit: 2, discountWindowActive: true, discountRemainingItems: 0 }),
    /Discount limit reached/);
});

test("unlimited products have no cap label and missing allowance data is not invented", () => {
  for (const limit of [null, undefined, 0]) assert.equal(markup({ discountItemLimit: limit }), "");
  for (const remaining of [null, undefined, "", "invalid"]) {
    const html = markup({ discountItemLimit: 2, discountWindowActive: true, discountRemainingItems: remaining });
    assert.match(html, /Discount limit: 2 items per person/);
    assert.doesNotMatch(html, /left|limit reached/);
  }
});