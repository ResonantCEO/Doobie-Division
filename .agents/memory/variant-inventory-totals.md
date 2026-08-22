---
name: Variant inventory totals
description: Source-of-truth rule for products that have size or flavor inventory rows.
---

For products with size or flavor rows, calculate the parent product's sellable and physical totals from those rows. Storefront availability must use the row-level quantities whenever rows exist.

**Why:** A stale cached parent sellable total can hide a product that still has an in-stock flavor, while parent physical inventory can likewise drift from the summed physical row quantities.

**How to apply:** Preserve the distinction between sellable and physical quantities. Reconcile parent sellable stock from row sellable quantities and parent physical inventory from row physical quantities; do not change physical inventory merely because sellable stock changes.