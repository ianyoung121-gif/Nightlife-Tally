---
name: Hybrid U.S. venue discovery
description: Curated Weekender profiles remain primary while transient Google Places results expand nearby U.S. coverage.
---

The Weekender uses a hybrid nearby model for the United States: curated Weekender venues appear first, and live Google Places results can fill gaps when a person explicitly enables location. Public venue information must not depend on an owner claiming or verifying a bar.

**Why:** The user wants useful nearby coverage beyond manually curated launch cities, while preserving trust in Weekender-owned profiles and avoiding persistent personal-location or provider-data stores. Privacy is a primary product promise: minimizing retained location data reduces user concern and potential exposure, but must not be described as legal immunity.

**How to apply:** Send location only for an explicit nearby request and keep it ephemeral. Bound provider calls with radius, result, timeout, cache, and rate limits. Do not persist GPS, search history, raw provider venue data, reviews, photos, ratings, or API keys. Clearly label live results. Separate public venue visibility from ownership checks needed to edit a venue; do not imply that an unclaimed bar cannot display public information. Tally support for provider-only venues is a separate product decision.