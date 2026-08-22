---
name: Grab bag flavor selection
description: Rules for pinned and automatic flavor choices in standard grab-bag templates.
---

A specific standard-bag item without a saved size is an automatic “any flavor” choice. At generation time, it must select randomly from flavors with both sellable and physical stock. An item with a saved size is a pinned flavor and must not silently change.

**Why:** Automatic bag templates should stay usable as individual flavors sell out, but a deliberate flavor selection must remain predictable.

**How to apply:** Resolve automatic flavors during each preview/generation, not when the template is edited. Keep stock checks and component metadata tied to the flavor actually selected for that generated bag.