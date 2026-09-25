---
name: Manual product badges
description: How editor-selected product labels relate to actual promotions
---

Manual product badges are visual storefront labels only. Even labels such as Daily Deals and Clearance must not activate pricing changes, schedule discounts, or enroll the product in a daily-deal promotion. Each checked badge can have its own editor-chosen expiry or remain active until unchecked; existing badge selections without an expiry remain indefinite.

**Why:** The user requested checkboxes for labels similar in appearance to automatic BOGO and stock indicators, but explicitly wanted them manually triggered, with an optional automatic disengage duration.

**How to apply:** Keep these selections independent of discount calculation and discount expiration paths. Auto-disengagement removes the badge selection itself when its editor-chosen duration ends, while indefinite selections stay until manually unchecked.