---
name: Stacked promo codes
description: Rules for combining multiple promo codes on one order.
---

Allow distinct promo codes to stack in the order entered. Recalculate every code on the server, cap each code's savings at the remaining order value, and never allow the combined result to make the total negative. Treat codes case-insensitively when preventing duplicates.

**Why:** Cart previews, checkout enforcement, usage limits, and historical receipts must agree even when percentage, fixed, targeted, and item-specific promotions are combined.

**How to apply:** Validate every submitted code at checkout, record usage for each accepted code, and save one checkout-time discount-breakdown entry per code. The legacy single promo fields may summarize the list, but must not be the source of historical detail.

Revalidate the full remaining sequence whenever a code is added or removed, and round each individual code's savings to cents before subtracting it. This keeps the browser preview identical to the server's final checkout calculation.