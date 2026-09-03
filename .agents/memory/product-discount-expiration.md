---
name: Product discount expiration
description: Shared expiration behavior for product-level percentage, amount, and BOGO offers.
---

Product-level percentage, fixed-amount, temporary unit/weight prices, temporary quantity tiers, and BOGO settings can share multiple exact activation windows. Configured discounts remain inactive between windows. After the last window ends, clear every temporary discount field and the schedule together while leaving standard prices, standard quantity tiers, stock, and physical inventory untouched.

Temporary price or quantity-tier overrides take precedence over percentage and fixed-amount discounts while active; they are replacement pricing and must not stack with those discounts.

**Why:** The Inventory Management Discounts section represents one temporary promotion configuration; allowing one part to remain active after the configured duration would make storefront and cart pricing inconsistent. Stacking replacement prices with another discount makes the saved override differ from the advertised price.

**How to apply:** Any new product discount type placed in that Discounts section should honor every configured window. Product reads must preserve configured values for later admin edits while exposing discounts to customer pricing only when at least one window is active. Active temporary price/tier overrides suppress percentage/amount discounts, and expired values must not be exposed even if scheduled cleanup has not run yet.