# Execute Epoch Goal Profile

Read [`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and
[`../HARNESS.md`](../HARNESS.md), then execute this profile.

- Mode: `EXECUTE_EPOCH`
- All configured model roles: GPT-6 Luna `max`
- Generic subagents: `0`
- Expected Luna Max reviews for a reviewed Epoch: `1`
- Default Epoch review maximum: `6`, extendable when findings remain actionable
- Shared Outer reviewer-runtime recovery maximum: `1`

Execute the one explicitly selected Epoch PR through engineering, Scope
Closure, adversarial preflight, Candidate/CI, review, and the default
PASS-to-merge cleanup path. If review round 2 returns corrective findings,
continue the same GPT-6 Luna reviewer and extend the Epoch/Run allowances while
those findings remain actionable. Use the same-PR final-corrective and
exact-SHA integration path only when another verdict round would not add useful
evidence.
Do not discover or select another Epoch.

If that PR is `INTEGRATION_BLOCKED`, run `pnpm harness
epoch:resume-integration --run <issue> --pr <number>`. Do not merge directly or
stop after repeating the same read-only audit; the recovery command revalidates
the original authority, live exact-SHA CI, base freshness, PR identity/state,
and ancestry before retrying or reconciling integration.

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
