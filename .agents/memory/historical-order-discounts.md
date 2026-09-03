---
name: Historical order discounts
description: How promo codes and other savings must be preserved for accurate order receipts.
---

Persist the original total and each named discount on the order when checkout completes. Order Details must render this stored snapshot instead of looking up the current promo or discount configuration.

**Why:** Promo codes and automatic discount rules can later be edited, expired, or deleted. Reconstructing an old order from current settings would produce an inaccurate receipt or lose the promo code entirely.

**How to apply:** Any new checkout discount type must add a stable label and amount to the order's discount breakdown. Keep the final total, original total, and summed discount amount mathematically consistent.