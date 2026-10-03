---
name: Patch hunk ordering
description: A tooling constraint for reliable multipart V4A file patches.
---

List update hunks in source order, from the beginning toward the end of each file.

**Why:** Multiple valid-context patches failed when a later-file hunk preceded an earlier-file hunk; the same changes succeeded when reordered.

**How to apply:** Batch independent file changes normally, but order each file's hunks by their position in the source.