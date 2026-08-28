---
name: Archived order purges
description: Inventory behavior when permanently clearing archived order history.
---

Permanently clearing archived orders is a history-retention operation, not an order cancellation or return. It must leave product stock, variant quantities, physical inventory, and inventory logs unchanged.

**Why:** Archived orders have already completed their inventory lifecycle. Restoring their item quantities during deletion inflates current inventory and can undo months of legitimate deductions.

**How to apply:** Keep inventory restoration for explicit item removal, cancellation, or return flows where reversal is intended. Archive-purge paths may snapshot analytics and delete records, but must never call inventory-restoration logic.