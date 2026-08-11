# BangumiAgentKit Product Execution Status

## North Star

Build BangumiAgentKit into the most complete, trustworthy, intelligent,
agent-friendly and visually excellent Bangumi Product Intelligence Layer.

Primary governance:

- `AGENTS.md`
- `docs/agent/BUDGET_FIRST_EXECUTION.md`
- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`
- `docs/agent/goals/AUTONOMOUS_MILESTONE.md`
- `docs/agent/goals/UNATTENDED_TIER2.md`

---

## Governance Mode

`BUDGET_FIRST_SINGLE_THREAD + AI_REVIEW_AT_MILESTONE + HUMAN_ON_EXCEPTION`

Standing execution defaults:

- one GPT-5.6 Luna primary thread at `max` reasoning;
- Luna `xhigh` only as the minimum availability fallback;
- generic implementation and research subagents disabled;
- sequential milestone review only; never parallel;
- no automatic continuation into another Product Cycle.

---

## Persistent Goal Ledger

Goal Scope:

Complete PR-7F Revision / Change History Intelligence as one substantial
vertical milestone. Resume its persisted post-Candidate corrective work; do not
select another Cycle.

Explicit Non-Scope:

- PR-7G or any later Product Cycle;
- snapshots, scheduled ingestion, or unsupported historical trend claims;
- authentication, authorization, credentials, or write expansion;
- HTML or Structured Web activation;
- destructive migration, release, package, or tag publication;
- unrelated opportunity-log work.

Stopping Condition:

- PR-7F reaches `FROZEN_GOAL_COMPLETE` under its recorded `TIER_2` contract; or
- the two-launch Sol budget is exhausted without a valid Freeze; or
- a protected human-only decision, infrastructure blocker, or another
  documented profile stop condition is reached.

Current Milestone State:

`IMPLEMENTING`

Current Phase:

`POST_CANDIDATE_CORRECTIVE_READY_TO_RESUME`

Execution Runtime:

No Codex Goal is running during this governance synchronization. The portable
unattended profile is authorized for the next explicit `/goal` invocation.

Primary Model:

GPT-5.6 Luna

Reasoning:

- preferred: `max`
- minimum fallback: `xhigh`
- lower Luna reasoning is prohibited

Generic Subagents Authorized:

0

Generic Subagents Consumed:

0

Review Tier:

`TIER_2`

Sol Launches Authorized:

2 total

Sol Launches Consumed:

0 under the current portable `UNATTENDED_TIER2` authorization

Sol Launches Remaining:

2

Review Execution:

`SEQUENTIAL_ONLY`

Automatic Sol #3:

`PROHIBITED`

Standing Reviewer:

`sol_milestone_reviewer` at `high` reasoning

Candidate SHA:

`NONE`

The last committed implementation Candidate was
`e8fbf1e6012c2bbdf59d9b170d0a898d096c2922`, but later corrective work exists
and no current clean Candidate has been created.

Exact-SHA CI:

- last Candidate `e8fbf1e6012c2bbdf59d9b170d0a898d096c2922`:
  GitHub Actions run `31356297264`, SUCCESS across all six jobs;
- current Candidate: none, therefore current exact-SHA CI is not yet available.

Human Authorization State:

`UNATTENDED_TIER2_AUTHORIZED`

This authorizes only the recorded PR-7F milestone and two sequential
`sol_milestone_reviewer` launches under the portable profile. It does not
authorize a different Cycle or Sol #3.

Next Action:

Resume and complete the active PR-7F milestone under
`docs/agent/goals/UNATTENDED_TIER2.md`. Reconstruct state from this ledger and
the active Cycle Plan, restore and inspect only the recorded PR-7F corrective
work, finish implementation and validation with Luna Max, and spend Sol only
after the complete milestone reaches the Review Readiness Gate.

---

## Active Product Cycle

Cycle:

PR-7F Revision / Change History Intelligence

Active Cycle Plan:

`docs/product/cycles/PR-7F-revision-change-intelligence.md`

Current objective:

Provide bounded official revision/change-history intelligence with truthful
timestamps, summaries, evidence, coverage, partial/unavailable states, Agent UX,
and Renderer output without unsupported historical claims.

Existing unfinished implementation:

The user preserved six post-Candidate PR-7F files in Git stash commit
`8df0121`. Their stable binary patch fingerprint is:

`ac421b1afb521d85ef9c3162f2ca192ccd07379ad9f3607b6386ea743abf57f7`

The governance synchronization must not modify or consume that stash.

---

## Historical Review Attempts

Before the portable Review Tier migration, one `sol_code_reviewer` launch and
one `sol_product_reviewer` launch both failed at the platform usage limit and
returned no verdict. They consumed the retired policy's budget and remain
historical evidence; they are not PASS and are not counted as calls under the
new user-authorized `UNATTENDED_TIER2` profile.

---

## Last Frozen Product Cycle

Cycle:

PR-7E Calendar / Schedule Intelligence

Status:

`FROZEN`

Implementation Frozen SHA:

`d53d800c5497cacd156792b1139ab7f2a696cdbe`

Freeze Review:

PASSED — exact-head CI `31354128241`; both historical independent reviewers
returned PASS.

Governance Record SHA:

`7e67a2d5a1ab841a980ec35700732060b64142ca`

---

## Human Review Queue

Open protected-decision items: 0

Human-gated opportunities must be parked under:

`docs/product/human-review-queue/`

Parking an item stops this Goal and does not authorize another Cycle.

---

## Exact Next Goal Command

```text
/goal Read docs/agent/goals/UNATTENDED_TIER2.md and execute the current
active milestone exactly as defined there. Continue until
FROZEN_GOAL_COMPLETE or a documented stop condition.
```
