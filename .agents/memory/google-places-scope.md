---
name: Curated venue catalog over paid place lookup
description: The Weekender should use its own venue records and ephemeral GPS rather than paid Google Places or Yelp enrichment.
---

The Weekender's location experience is intentionally based on the curated venue catalog plus device GPS. Do not add Google Places, Yelp, embedded maps, or paid venue discovery unless the user explicitly changes this decision.

**Why:** The existing system meets the product need without new API billing or storing personal location/search history.

**How to apply:** Nearby and Date Night can rank venues with verified coordinates; venues missing from the catalog must be added through the existing venue-management flow rather than discovered automatically.