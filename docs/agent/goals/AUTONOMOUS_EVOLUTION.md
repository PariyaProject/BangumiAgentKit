# Autonomous Evolution Goal Profile

Read [`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and
[`../HARNESS.md`](../HARNESS.md), then execute this profile.

- Mode: `AUTONOMOUS_EVOLUTION`
- Primary: GPT-5.6 Luna `max` (`xhigh` availability fallback only)
- Generic subagents: `0`
- Expected Sol per reviewed Epoch: `1`
- Automatic Sol maximum per Epoch: `2`
- Outer Product-review maximum: `3`
- Independent frontier-closure Sol maximum: `1`
- Total Outer Sol maximum: `4`
- Shared exceptional reviewer-runtime recovery maximum: `1`

Run `pnpm harness discovery:check` before `run:start` or broad validation.

- `RESUME_ACTIVE_RUN`: resume the exact marked Run/PR.
- `DISCOVERY_REQUIRED_MASTER_CHANGED`, `FRONTIER_RESEARCH_REQUIRED`, or
  `DISCOVERY_REFRESH_DUE`: create/resume one Run and perform canonical discovery.
- `FRONTIER_LEDGER_REQUIRED`: repair the canonical ledger before selecting work.
- `FRONTIER_REVIEW_REQUIRED`: resume/create the Run and perform the single
  independent exact-hash frontier-closure review.
- `UNCHANGED_EXHAUSTION`: report the cheap unchanged stop only when the exact
  master, policy, ledger hash, evidence hash, and closure PASS still match; do
  not create an Issue, rerun the full suite, or launch Sol.

When work is required, create or resume one Outer Run GitHub Issue. If it names
an active Epoch PR, resume that exact PR. Otherwise perform the canonical
multi-lane opportunity discovery in `HARNESS.md`, including scope salvage and
source-contract research, select the largest coherent and reviewable high-value
safe Epoch, record it in the Run Issue, and follow `HARNESS.md` until a governed
stop. Do not equate a completed named feature inventory with an exhausted
product: inspect capability maturity, complete journeys, Agent UX, Renderer and
Standalone quality, truthfulness/resource bounds, product-enabling architecture,
and both pre-authorized read-only source frontiers. Discovery and source
research launch no Sol.

Do not create work merely to avoid stopping. Conversely, do not use
`STOPPED_TRUSTED_FRONTIER_EXHAUSTED` as an unverified shortcut: it requires a
complete valid frontier ledger, current-master evidence, concrete scope
salvage, cross-source consistency, and one Sol High closure `PASS` bound to the
exact master/ledger/evidence hashes. A governed stop closes the Run Issue; a
later invocation creates a fresh Run only when no nonterminal Run remains.
Every rejected candidate must first attempt a bounded partial/positive-only
variant. `RESEARCH_READY` remains actionable work, not a stopping disposition.
So do `UNASSESSED`, `PARTIAL`, and `IMPLEMENTATION_READY`. Update advanced
ledger records only together with durable implementation/test evidence; never
create a ledger-only status commit.

After a successful PASS, merge and clean up by default, update the Run Issue,
then continue discovery while budget and safety permit. If Sol #2 returns
corrective findings, keep the same Epoch active while Luna Max performs the
governed final corrective, obtains exact-SHA CI, integrates, and then continues
discovery; never launch Sol #3 or wait for a human on routine engineering
findings. A genuinely protected human-only direction may be parked while
independent safe work continues.

If the active Epoch is `INTEGRATION_BLOCKED`, inspect the current PR and run
`pnpm harness epoch:resume-integration --run <issue> --pr <number>`. This is a
nonterminal recovery path: do not repeatedly audit the unchanged blocker, mark
the Goal complete, or merge directly. The command revalidates all original
authority, Candidate, CI, base-freshness, PR-state, and ancestry gates; it also
reconciles a merge already accepted by GitHub when only the response was lost.

After Product work and Luna discovery have closed every ledger record, run
`pnpm harness frontier:check`, persist complete closure evidence, then spend the
reserved one Sol High frontier review. `DISCOVERY_REQUIRED` returns to Luna but
first records `FRONTIER_REVIEW_REJECTED` and runs
`frontier:resume-discovery`; it never launches a second ordinary closure verdict
round in the same Run. If the closure slot is unavailable, stop
`STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE`, not exhausted.

For any Product or frontier reviewer, inspect the real task runtime before
waiting. Use the Harness runtime command to record `ACTIVE`, `INTERRUPTED`, or
confirmed `UNAVAILABLE`; never infer activity from durable `*_REVIEW_RUNNING`
state alone. Resume an interrupted reviewer by the same id without another
reservation. Use the shared runtime-recovery context only after confirmed
unavailability and never as a new verdict round. A capacity limit is a
resumable pause, not Goal completion.

Immediately before reporting the Goal complete, run `pnpm harness goal:check`
with the authoritative Run and active Epoch arguments when applicable. Continue
unless it returns `GOAL_STOP_ALLOWED`.

Normal invocation:

```text
/goal Read docs/agent/goals/AUTONOMOUS_EVOLUTION.md and execute it from the
current synchronized master until a governed stop condition is reached.
```
