---
name: Assignees and notification boundaries
description: Prevent assignment candidates from automatically receiving order notifications they are not authorized to act on.
---

Assignment eligibility and general new-order notification eligibility are separate policies, even when both currently use the same staff lookup.

**Why:** Drivers must appear as order assignees, but notifying every driver about every unassigned order exposes customer and order information outside their assigned-order boundary.

**How to apply:** When adding a role to assignment candidates, audit every caller of that lookup. Exclude restricted roles from broad notifications and send targeted notifications only after assignment.