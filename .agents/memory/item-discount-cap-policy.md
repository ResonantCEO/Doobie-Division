---
name: Per-user item discount cap policy
description: Counting, window resets, and historical usage rules for product item discounts.
---

The user chose “Each discounted item,” not each order. A cap of three with five items purchased means three discounted items and two at normal pricing.

The allowance is per user and product, shared across flavors and weight options. Weight-option quantities count selected packages, not the grams inside them. BOGO counts benefit items, not the normal-price qualifying purchases.

When a cap is set, clearly advertise the configured per-person limit on the front of the product card, directly under the price and above Add to Cart, not only the remaining allowance.

**Why:** The user explicitly wants customers to see the discount restriction without opening the card or guessing from a remaining count.

**How to apply:** Keep the configured limit visible and distinguish it from current-window eligibility and customer-specific remaining allowances.

**Why:** The user specifically wants future discount windows to be usable again after an earlier allowance is exhausted.

**How to apply:** Cover the product Discounts group: percentage, fixed amount, temporary unit/weight prices, temporary quantity tiers, and BOGO. Distinct non-overlapping windows receive fresh allowances. An uninterrupted overlapping promotion shares an allowance. Routine product edits must not reset it; indefinite offers retain usage until disabled and re-enabled.

Reserve benefits at order placement, not fulfillment. Failed orders must not consume them; cancellation releases the recorded usage once. Purging fulfilled order history must retain consumption.

**Why:** Order history housekeeping must not let customers claim a used allowance again, while customers should not lose allowance for orders that fail or are cancelled.

**How to apply:** Keep historical discount receipts immutable. Do not apply standalone product caps to expanded bag components: bag pricing is configured independently.