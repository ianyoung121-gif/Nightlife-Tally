---
name: Expo Metro image-size compatibility
description: Why the security-fixed image-size v2 release needs a package patch for this Expo SDK’s Metro asset pipeline.
---

Keep the `image-size` v2 security override together with the committed pnpm package patch that accepts Metro’s legacy file-path input.

**Why:** Expo SDK 54’s Metro 0.83 asset pipeline calls `image-size` synchronously with a file path, while `image-size` v2 expects image bytes. Without the patch, native production bundles fail with an HTTP 500 transform error even though web and API builds succeed.

**How to apply:** When updating Expo, Metro, or `image-size`, retain and test the patch until Metro no longer sends file paths. Verify minified iOS and Android bundles, not only the web preview or TypeScript build. Do not remove the v2 override as a shortcut, since it is the security remediation.