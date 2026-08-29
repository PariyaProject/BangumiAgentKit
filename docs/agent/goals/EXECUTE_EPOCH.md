# Execute Epoch Goal Profile

Read [`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and
[`../HARNESS.md`](../HARNESS.md), then execute this profile.

- Mode: `EXECUTE_EPOCH`
- Primary: GPT-5.6 Luna `max` (`xhigh` availability fallback only)
- Generic subagents: `0`
- Expected Sol for a reviewed Epoch: `1`
- Automatic Sol maximum: `2`
- Shared Outer reviewer-runtime recovery maximum: `1`

Execute the one explicitly selected Epoch PR through engineering, Scope
Closure, adversarial preflight, Candidate/CI, review, and the default
PASS-to-merge cleanup path. If Sol #2 returns corrective findings, complete the
same-PR Luna final-corrective and exact-SHA integration path without Sol #3.
Do not discover or select another Epoch.

Before waiting, inspect the real reviewer task and use `review:runtime` to
record `ACTIVE`, `INTERRUPTED`, or confirmed `UNAVAILABLE`. Resume an
interrupted reviewer by the same id without another reservation. The bounded
runtime replacement is available only after confirmed unavailability and is
not a new verdict round. Capacity exhaustion pauses the Goal in place.

Before reporting completion, run `pnpm harness goal:check --run <issue> --pr
<number>` and continue unless it returns `GOAL_STOP_ALLOWED`.

If no specific V3 Epoch PR is selected, or its GitHub control state cannot be
reconstructed, stop truthfully rather than inventing one or falling back to
legacy tracked runtime files.
