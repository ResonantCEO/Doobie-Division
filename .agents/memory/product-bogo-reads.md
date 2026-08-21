---
name: Product BOGO reads
description: Reliable retrieval of BOGO discount settings in product-list responses.
---

Product-list responses must explicitly retrieve `bogo_enabled`, `bogo_discount_type`, and `bogo_discount_value` using Drizzle's `db.execute` with an `IN (...)` parameter list.

**Why:** The Neon Pool's dynamic-import/tagged-template path and array interpolation can fail inside a caught fallback query, leaving BOGO fields absent. The edit modal then treats a missing discount type as the legacy `free` default.

**How to apply:** When changing product-list retrieval or adding BOGO fields, use the explicit Drizzle query and ensure its result is overlaid on every product before returning the API response.