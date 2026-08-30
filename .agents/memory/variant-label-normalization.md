---
name: Variant label normalization
description: Production product-size labels can contain accidental surrounding whitespace.
---

Variant and flavor comparisons must normalize surrounding whitespace and casing rather than requiring raw string equality. Preserve the database row as the authoritative variant and use its canonical trimmed label when storing order items.

**Why:** Production data contains variant names with trailing spaces, while the UI submits the visually identical trimmed label. Exact comparisons caused valid add, substitute, and removal operations to fail.

**How to apply:** Use the shared normalized comparison for every path that resolves a product-size row, including stock changes, order reservations, substitutions, and inventory restoration.