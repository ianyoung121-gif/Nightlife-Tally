---
name: Venue membership and patron privacy
description: Public venue visibility, the $5 owner membership, and favorites-only patron profiles.
---

Bar owners do not need to verify a bar for it to show its information. Google supplies public venue details. Before an owner subscribes, use specials checked against the bar's official website, with a source and expiry; the user selected this ongoing-curation approach.

**Why:** The user explicitly clarified the pre-release product model.

**How to apply:** Do not gate public venue information behind ownership or subscription. Google Places has no structured specials feed; explain that limitation and settle a supported source rather than inventing offers. Ownership checks still protect editing rights.

The $5/month membership gives bar owners full access to setting specials and push notifications for people who favorite their spot.

**Why:** This is the user's stated paid offering, not just a coupon subscription.

**How to apply:** Make both the UI and server enforce the paid entitlement for owner promotion tools. Notifications require recipients' permission; favoriting is not device notification consent.

Users may create a profile, but it saves favorited spots, not drink information. Drink tallies must remain anonymous and separate from accounts.

**Why:** The user explicitly wants no personal drinking histories and emphasizes privacy.

**How to apply:** Keep account and favorite data distinct from tally data, remove personal drink-history exposure, and do not promise complete account anonymity or legal immunity.

Use Google Business Profile verification to connect owner-managed profiles to Google-listed venues, rather than requiring routine manual approval.

**Why:** The user chose Google verification because the app serves the whole United States and they cannot keep up with every ownership request.

**How to apply:** Verify Google-authorized management of the specific business before linking it to an owner account. Keep public venue visibility independent of this check. Google Business Profile API approval and OAuth access are separate from existing Google Maps API keys; do not represent Maps access as ownership proof.

Drink Spin has separate choices for a selected bar's specials and a curated list of 20 common bar drinks.

**Why:** The user wants to choose between the venue's specials and a random drink that is not necessarily on that venue's menu.

**How to apply:** Do not substitute generic suggestions when a venue has no current specials, claim suggested drinks are stocked, or present the curated list as a measured popularity ranking. Spin results do not create personal drink history.
