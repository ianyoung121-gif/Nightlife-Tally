---
name: Node integration-test child processes
description: Reliable startup and teardown of spawned API servers in Node integration tests.
---

Pass a filesystem path (not a file URL) as `cwd` when spawning an API server from a Node test, and handle the child's `error` event during readiness and teardown.

**Why:** In this environment a failed spawn can emit `error` without emitting `exit`; awaiting only `exit` then turns the original startup failure into a hanging test timeout.

**How to apply:** Convert module-relative URLs with `fileURLToPath`, surface any spawn error in the readiness check, and bound both graceful and forced shutdown waits.