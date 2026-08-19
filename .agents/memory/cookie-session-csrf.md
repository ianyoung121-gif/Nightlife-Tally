---
name: Cookie-session CSRF boundary
description: Why browser cookie writes need Origin validation alongside CORS, while mobile Bearer requests do not.
---

Cookie-authenticated unsafe API requests must require an Origin from the configured Weekender web origins. Mobile requests using an Authorization Bearer session remain exempt from this browser-specific check.

**Why:** Credentialed CORS controls response access, not whether a browser can submit a state-changing request. A same-site sibling application can otherwise cause actions under a victim's `SameSite=Lax` session cookie.

**How to apply:** Preserve the server-side Origin check whenever adding a POST, PUT, PATCH, or DELETE route that accepts the browser session cookie. Keep the allowed-origin list aligned with the web artifact's public origins, and retain the Bearer exemption only for the secure mobile session transport.