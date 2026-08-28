---
name: Archived order purges
description: Inventory behavior when permanently clearing archived order history.
---

Permanently clearing archived orders is a history-retention operation, not an order cancellation or return. It must leave product stock, variant quantities, physical inventory, and inventory logs unchanged. Analytics snapshots and source deletion must commit atomically from locked order and item rows.

**Why:** Archived orders have already completed their inventory lifecycle. Restoring their item quantities during deletion inflates current inventory and can undo months of legitimate deductions. Non-atomic snapshotting can permanently lose analytics history or preserve stale item data during concurrent changes.

**How to apply:** Keep inventory restoration for explicit item removal, cancellation, or return flows where reversal is intended. Archive-purge paths must lock the selected orders and items, rebuild complete snapshots, and delete source history in one transaction without calling inventory-restoration logic.