---
name: Promo option targeting
description: Compatibility rules for item-specific promo codes that can target entire products or selected sizes.
---

Item-specific promos store their eligible targets in the existing JSON field. Legacy records use a numeric product-ID array and mean “all sizes/options.” New records use product target objects with an optional list of size names; a listed size must exactly match the cart item’s size.

**Why:** Existing promo codes must retain product-wide behavior, while new codes need an enforceable way to narrow a deal to selected variants without a database migration.

**How to apply:** When reading promo targets, normalize both formats. Apply the same normalized target matching during promo validation and final order creation, rather than trusting any allocation sent by the browser.