# Autonomous Evolution Goal Profile

Read [`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and
[`../HARNESS.md`](../HARNESS.md), then execute this profile.

- Mode: `AUTONOMOUS_EVOLUTION`
- Primary: GPT-5.6 Luna `max` (`xhigh` availability fallback only)
- Generic subagents: `0`
- Expected Sol per reviewed Epoch: `1`
- Automatic Sol maximum per Epoch: `2`
- Outer Sol maximum: `4`

Create or resume one Outer Run GitHub Issue. If it names an active Epoch PR,
resume that exact PR. Otherwise perform the canonical multi-lane opportunity
discovery in `HARNESS.md`, select the largest coherent and reviewable high-value
safe Epoch, record it in the Run Issue, and follow `HARNESS.md` until a governed
stop. Do not equate a completed named feature inventory with an exhausted
product: inspect capability maturity, complete journeys, Agent UX, Renderer and
Standalone quality, truthfulness/resource bounds, and product-enabling
architecture. Discovery launches no Sol.

Do not create work merely to avoid stopping. Conversely, do not use
`STOPPED_NO_VALUABLE_INDEPENDENT_SAFE_OPPORTUNITY` as an unverified shortcut:
it requires the current-master evidence and concrete candidate assessments
enforced by `pnpm harness run:stop`. A governed stop closes the Run Issue; a
later invocation creates a fresh Run only when no nonterminal Run remains.

After a successful PASS, merge and clean up by default, update the Run Issue,
then continue discovery while budget and safety permit. If Sol #2 returns
corrective findings, keep the same Epoch active while Luna Max performs the
governed final corrective, obtains exact-SHA CI, integrates, and then continues
discovery; never launch Sol #3 or wait for a human on routine engineering
findings. A genuinely protected human-only direction may be parked while
independent safe work continues.

Normal invocation:

```text
/goal Read docs/agent/goals/AUTONOMOUS_EVOLUTION.md and execute it from the
current synchronized master until a governed stop condition is reached.
```
