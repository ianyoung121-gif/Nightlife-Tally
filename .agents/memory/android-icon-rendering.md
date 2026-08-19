---
name: Android icon rendering
description: Why the mobile app uses SVG icons instead of the Expo icon-font package.
---

Use SVG-based icons for mobile interface controls and drink illustrations instead of relying on icon fonts.

**Why:** Expo Go on Android rendered the icon-font glyphs as missing-character boxes even after explicit font preloading; SVG paths do not depend on platform font loading and render consistently in the native client and web preview.

**How to apply:** Keep new mobile icons in the shared SVG icon component (or use another SVG-based renderer). Do not reintroduce icon-font components for primary mobile UI controls without validating on an Android device.