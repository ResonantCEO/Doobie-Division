---
name: Product discount expiration
description: Shared expiration behavior for product-level percentage, amount, and BOGO offers.
---

Product-level percentage, fixed-amount, temporary unit/weight prices, temporary quantity tiers, and BOGO settings use one shared expiration. When it is reached, clear every temporary discount field together while leaving standard prices, standard quantity tiers, stock, and physical inventory untouched.

Temporary price or quantity-tier overrides take precedence over percentage and fixed-amount discounts while active; they are replacement pricing and must not stack with those discounts.

**Why:** The Inventory Management Discounts section represents one temporary promotion configuration; allowing one part to remain active after the configured duration would make storefront and cart pricing inconsistent. Stacking replacement prices with another discount makes the saved override differ from the advertised price.

**How to apply:** Any new product discount type placed in that Discounts section should honor the same expiration. Product reads must use active temporary price/tier overrides, suppress percentage/amount discounts while replacement pricing is active, and must not expose expired values even if scheduled cleanup has not run yet.