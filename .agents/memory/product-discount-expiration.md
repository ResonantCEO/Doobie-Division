---
name: Product discount expiration
description: Shared expiration behavior for product-level percentage, amount, and BOGO offers.
---

Product-level percentage, fixed-amount, and BOGO settings use one shared expiration. When it is reached, clear every discount field together while leaving product prices, stock, and physical inventory untouched.

**Why:** The Inventory Management Discounts section represents one temporary promotion configuration; allowing one part to remain active after the configured duration would make storefront and cart pricing inconsistent.

**How to apply:** Any new product discount type placed in that Discounts section should honor the same expiration, and product reads must not expose expired values even if scheduled cleanup has not run yet.