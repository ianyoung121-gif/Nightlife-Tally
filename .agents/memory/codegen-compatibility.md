---
name: API generator compatibility
description: Orval autodetection and barrel generation can conflict with catalog dependencies and validator names.
---

Choose the validator generation version explicitly and keep model types separate from operation validators.

**Why:** Orval's automatic detection selected Zod 4 against the workspace's Zod 3 catalog. Its generated model barrel also collided with operation-validator names; manually changing the barrel was overwritten during the next generation.

**How to apply:** Fix generator configuration, not generated files. Keep a hand-owned validator entry point outside automatic barrel writes, and obtain model types from the client package. Revisit the target version when changing Zod.

Metro can retain a missing-module error when code generation temporarily cleans an imported output file.

**Why:** A clean/regenerate cycle removed the generated client briefly while Metro was running; the resolver still reported it missing after the file returned.

**How to apply:** Finish code generation before restarting the mobile preview, then confirm it bundles from the final outputs.
