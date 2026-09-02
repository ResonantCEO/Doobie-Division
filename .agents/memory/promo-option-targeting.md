---
name: Promo option targeting
description: Compatibility rules for promo codes that can target entire products or selected sizes.
---

Targeted promos store their eligible products and options in the existing JSON field. Legacy records use a numeric product-ID array and mean “all sizes/options.” New records use product target objects with an optional list of size names. Percentage and fixed discounts with no targets remain order-wide for backwards compatibility.

**Why:** Existing promo codes must retain product-wide behavior, while new codes need an enforceable way to narrow a deal to selected variants without a database migration.

**How to apply:** When reading promo targets, normalize both formats and option-label whitespace/casing. Apply the same matching during promo validation and final order creation rather than trusting browser-calculated savings.