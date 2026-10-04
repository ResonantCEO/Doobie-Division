import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

// Exercise the actual storefront visibility callback without bypassing auth
// or mounting its unrelated catalog/cart queries.
const source = readFileSync(new URL("../client/src/pages/storefront.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("storefront.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "visibleBoardPosts"
    && node.initializer && ts.isCallExpression(node.initializer)) {
    callback = node.initializer.arguments[0];
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(callback, "Storefront board-post visibility callback must exist");
const visibilityExpression = `(${callback.getText(ast)})()`;
const posts = [
  { id: 1, categoryId: 10 },
  { id: 2, categoryId: 20 },
  { id: 3, categoryId: null },
];
function visibleIds(overrides: Record<string, unknown> = {}) {
  const result = runInNewContext(visibilityExpression, {
    boardPosts: posts,
    isStorefrontLayoutMode: false,
    searchQuery: "",
    debouncedSearchQuery: "",
    activeAdSelection: null,
    selectedCategory: null,
    currentParentCategory: null,
    categories: [{ id: 10, parentId: null }, { id: 20, parentId: 10 }],
    ...overrides,
  });
  return Array.from(result, (post: any) => post.id);
}

test("product search hides all category ads in every browsing path", () => {
  assert.deepEqual(visibleIds({ searchQuery: "clou" }), [3]);
  for (const state of [
    { selectedCategory: 10 },
    { currentParentCategory: 10 },
    { activeAdSelection: { postId: 1 } },
  ]) {
    assert.deepEqual(visibleIds({ ...state, searchQuery: "clou" }), []);
  }
});

test("category ads stay hidden until debounced search results clear", () => {
  assert.deepEqual(visibleIds({ debouncedSearchQuery: "clou" }), [3]);
  assert.deepEqual(visibleIds(), [1, 2, 3]);
  assert.deepEqual(visibleIds({ searchQuery: "  ", debouncedSearchQuery: " " }), [1, 2, 3]);
});

test("normal category browsing and administrative layout editing are unchanged", () => {
  assert.deepEqual(visibleIds({ selectedCategory: 10 }), [1]);
  assert.deepEqual(visibleIds({ currentParentCategory: 10 }), [1, 2]);
  assert.deepEqual(visibleIds({ isStorefrontLayoutMode: true, searchQuery: "clou" }), [1, 2, 3]);
});