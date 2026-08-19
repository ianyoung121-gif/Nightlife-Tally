---
name: Hybrid U.S. venue discovery
description: Curated Weekender profiles remain primary while transient Google Places results expand nearby U.S. coverage.
---

The Weekender uses a hybrid nearby model for the United States: verified Weekender venues appear first, and live Google Places results can fill gaps when a person explicitly enables location.

**Why:** The user wants useful nearby coverage beyond manually curated launch cities, while preserving trust in Weekender-owned profiles and avoiding persistent personal-location or provider-data stores.

**How to apply:** Send location only for an explicit nearby request and keep it ephemeral. Bound provider calls with radius, result, timeout, cache, and rate limits. Do not persist GPS, search history, raw provider venue data, reviews, photos, ratings, or API keys. Clearly label live results, provide navigation only, and never let them masquerade as tallyable or owner-managed profiles until a separate verification flow creates a real Weekender venue.