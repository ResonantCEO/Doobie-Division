---
name: Combo quantity expansion
description: Quantity rules when a combo or generated bag is expanded into saved order-item rows.
---

Every component row and its balancing discount row must inherit the purchased combo quantity, with each subtotal multiplied by that quantity.

**Why:** The cart and order total can correctly charge for multiple combos while hardcoded single-quantity expansion saves only one set of components, under-reserves inventory, and shows fulfillment as x1.

**How to apply:** Whenever a container product is replaced by component order rows, propagate the container quantity consistently through component quantities, discount quantities, subtotals, stock reservation, and fulfillment.