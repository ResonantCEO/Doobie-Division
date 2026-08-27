---
name: Order list request fan-out
description: Avoid duplicate per-row detail requests when rendering order-management actions.
---

Order-list actions must derive their initial state from compact fields returned by the order-list endpoint. Full order-item details should load only when a user expands or opens an order.

**Why:** Responsive mobile and desktop trees can both remain mounted even when one is hidden by CSS. A per-row detail query inside a shared action component therefore creates duplicate request fan-out during initial page rendering and can destabilize the screen.

**How to apply:** When adding list-level order actions, extend the aggregated order-list item summary with only the required state. Keep detailed item queries behind explicit expansion or modal-open state.