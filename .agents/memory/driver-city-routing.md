---
name: Driver city routing
description: Rules for assigning delivery cities to drivers and routing shipped orders.
---

Delivery cities are canonical active entries from the City Purchase Limits list. Each city belongs to at most one active driver, and automatic routing only fills an unassigned shipped order; a manual driver assignment always wins.

**Why:** Orders must reach the correct delivery driver without silently overriding an explicit staff decision, and city spelling/casing varies across customer-entered addresses.

**How to apply:** Reuse normalized city matching and targeted driver notifications when extending assignment, reassignment, or delivery-run features.