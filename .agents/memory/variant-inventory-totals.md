---
name: Variant inventory totals
description: Source-of-truth rule for products that have size or flavor inventory rows.
---

For products with size or flavor rows, calculate the parent product's sellable and physical totals from those rows. Storefront availability must use the row-level quantities whenever rows exist. A full product edit intentionally synchronizes physical quantities to the entered sellable quantities.

**Why:** A stale cached parent sellable total can hide a product that still has an in-stock flavor, while product edits are used to establish both current sellable and physical inventory. Independent physical discrepancies can still be recorded through the stock-adjustment workflow.

**How to apply:** Reconcile parent sellable stock from row sellable quantities and parent physical inventory from row physical quantities. Product-edit payloads include an explicit physical count equal to the entered stock; stock adjustments, fulfillment, and unfulfillment may continue to move the ledgers independently.

An empty variant list must not be treated as an authoritative total of zero for a product that has no variant rows. Ordinary product edits should omit variant data entirely; intentionally disabling existing variants may delete their rows but must preserve the submitted parent stock and synchronized physical count.

**Why:** Recalculating parent inventory from an empty variant set can overwrite a valid stock count with zero during an unrelated product edit.

**How to apply:** Rebuild and total variant inventory only when a non-empty variant list is submitted. Use an explicit empty list solely to disable variants, and use the explicit parent values submitted by the product edit rather than deriving either ledger from that empty list.

New products and new variant rows initialize physical inventory from their entered sellable quantities unless an explicit physical count is supplied. Generated bag parents derive sellable and physical counts separately from the corresponding component ledgers.

**Why:** Defaulting new physical counts to zero creates false reconciliation variances, while copying a bag's sellable count into its physical count can hide genuine component variance.

**How to apply:** Preserve explicit physical counts during creation; otherwise initialize from entered stock. For generated bags, use the minimum component sellable availability for bag stock and the minimum component physical availability for bag physical inventory.