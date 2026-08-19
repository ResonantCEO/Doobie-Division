---
name: Telegram contact rollout
description: The account-contact policy and its grace-period rationale.
---

New accounts must provide a valid Telegram username at registration. Existing accounts without one may continue using the site only through the single, persisted two-week grace period; after it expires, the Telegram prompt cannot be dismissed until the account provides a valid username.

**Why:** The user wants Telegram to become the reliable channel for easier communication and sending access codes, without abruptly blocking the current user base.

**How to apply:** Preserve the persisted global rollout deadline rather than deriving a new deadline from server startup or a browser session. Do not make account-profile edits reintroduce invalid or blank handles after a valid one has been saved.