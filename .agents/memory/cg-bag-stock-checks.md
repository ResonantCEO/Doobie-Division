---
name: CG bag stock check bypass
description: createOrder has two stock check points; both must skip CG bag items via metadata.fromCgBag
---

## Rule
Any item with `metadata.fromCgBag === true` must skip BOTH stock check points in `storage.createOrder`:
1. **Pre-check loop** (~line 1859): validates stock before the order INSERT — add `if ((item as any).metadata?.fromCgBag) continue;`
2. **Deduction loop** (~line 1962): deducts stock after INSERT — already has the skip

**Why:** CG bag stock is validated by the picker (physicalInventory > 0 OR stock > 0 check), and deducted separately in routes.ts after the order is confirmed. The createOrder pre-check uses only `product.stock` and will reject products where `stock=0` (size-variant products store stock at the size level, so `stock` may be 0 even when `physicalInventory > 0`).

**How to apply:** Whenever createOrder's stock check logic is modified, ensure both loops have the `fromCgBag` skip.

## Picker eligibility
The CG bag picker uses `(p.stock ?? 0) > 0 || (p.physicalInventory ?? 0) > 0` to match the storefront's `categoriesWithStock` logic. Do NOT restrict to `stock > 0` only — size-variant products have `stock=0` at the product level.

## metadata field chain
`metadata` must be present in all of:
- `insertOrderItemSchema` (shared/schema.ts) — `.extend({ metadata: z.record(z.unknown()).nullable().optional() })`
- `orderItems` pgTable (shared/schema.ts) — `metadata: jsonb("metadata")`
- DB column (startup migration: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS metadata JSONB`)
- `getOrder` SELECT (storage.ts) — explicitly list `metadata: orderItems.metadata`
- raw SQL fallback in `createOrder` — include metadata in INSERT column list
