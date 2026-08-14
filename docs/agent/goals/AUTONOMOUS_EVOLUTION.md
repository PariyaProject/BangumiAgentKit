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
resume that exact PR. Otherwise perform bounded opportunity discovery, select
the largest coherent and reviewable high-value safe Epoch, record it in the Run
Issue, and follow `HARNESS.md` until a governed stop.

After a successful PASS, merge and clean up by default, update the Run Issue,
then continue discovery while budget and safety permit. A protected human-only
direction may be parked while independent safe work continues; unresolved
engineering P0/P1 at the review limit triggers the quality circuit breaker and
stops the outer run.

Normal invocation:

```text
/goal Read docs/agent/goals/AUTONOMOUS_EVOLUTION.md and execute it from the
current synchronized master until a governed stop condition is reached.
```
