---
name: Custom item fulfillment
description: The identity and inventory boundary for fulfilling one-off order items.
---

One-off custom order items must be fulfilled and reversed by their order-item ID. A null product ID is valid only for a genuine custom row; catalog rows must provide the matching product ID.

**Why:** Custom rows have no catalog identity. Treating a missing product ID as a general fallback can either make custom rows unactionable or let catalog fulfillment alter the wrong inventory.

**How to apply:** Keep custom fulfillment as a checkmark-only operation. Validate the resolved order item before branching, and never perform product, variant, or inventory-log writes for a custom row.