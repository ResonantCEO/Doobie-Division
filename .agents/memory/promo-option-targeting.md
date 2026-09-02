---
name: Promo option targeting
description: Compatibility rules for promo codes that can target entire products or selected sizes.
---

Targeted promos store eligible products, categories, and options in the existing JSON field. Legacy numeric product IDs mean “all options.” Product targets may list size/weight labels; category targets include every option in that category. Untargeted percentage and fixed discounts remain order-wide.

**Why:** Existing promo codes must retain product-wide behavior, while new codes need an enforceable way to narrow a deal to selected variants without a database migration.

**How to apply:** Normalize legacy IDs, product/category objects, and option-label whitespace/casing. Match category IDs and product options during validation and final order creation, and count overlapping targets only once.