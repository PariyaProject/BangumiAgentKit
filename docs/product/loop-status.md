# BangumiAgentKit Product Execution Status

## North Star

Build BangumiAgentKit into the most complete, trustworthy, intelligent,
agent-friendly and visually excellent Bangumi Product Intelligence Layer.

Primary governance:

- `AGENTS.md`
- `docs/agent/BUDGET_FIRST_EXECUTION.md`
- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`

---

## Governance Mode

`BUDGET_FIRST_SINGLE_THREAD + AI_REVIEW_AT_MILESTONE + HUMAN_ON_EXCEPTION`

Standing execution defaults:

- one GPT-5.6 Luna primary thread at `max` reasoning;
- Luna `xhigh` only as the minimum availability fallback;
- generic implementation and research subagents disabled by default;
- sequential milestone review only; never parallel;
- Review Tier selected in the Cycle Plan before implementation;
- no automatic continuation into another Product Cycle.

---

## Persistent Goal Ledger

Goal scope:

None. No Product Cycle or Codex Goal is currently authorized on `master`.

Explicit non-scope:

- autonomous opportunity selection or implementation;
- any change to frozen PR-7C production code;
- authentication, authorization, write, source-activation, migration, release,
  package, or tag changes;
- starting a follow-on Product Cycle without a fresh user-authorized Goal.

Stopping condition:

Remain idle until the user authorizes one substantial vertical milestone with a
verifiable end state and a Cycle Plan that records its Review Tier.

Current milestone state:

`IDLE_AWAITING_GOAL_AUTHORIZATION`

Primary model / reasoning:

- model: GPT-5.6 Luna
- reasoning: `max`
- availability fallback: `xhigh`; no lower Luna effort is permitted

Generic subagent budget:

- authorized: 0
- consumed: 0

Review Tier:

`NOT_SELECTED`

Total Sol review budget:

- authorized: 0 launches
- consumed: 0 launches
- remaining: 0 launches
- reasoning default: `high`
- reviews must be sequential

Candidate SHA:

None.

Exact-SHA CI:

Not applicable; no Candidate is active.

Next action:

Wait for the user to authorize one substantial vertical milestone. Before
implementation, create or update its Cycle Plan with explicit scope, non-scope,
stopping condition, validation, Review Tier, total Sol budget, and any `TIER_2`
reviewer order. Do not start implementation or launch Sol before that record
exists.

Human authorization state:

- required to start the next Product Cycle: yes
- required to spend Sol budget: yes, through the recorded Cycle Review Tier
- protected-decision items open: 0

---

## Review Tier Reference

- `TIER_0`: 0 Sol launches; documentation, tests, non-behavioral maintenance,
  and trivial internal work only.
- `TIER_1`: 1 comprehensive `sol_milestone_reviewer` launch; default for normal
  product milestones.
- `TIER_2`: at most 2 sequential Sol High launches total; unusual high-risk or
  high-value milestones only.

Every launch counts even when it fails, times out, or returns no verdict. Sol
#3 is never automatic.

---

## Last Frozen Product Cycle

Cycle:

PR-7C Advanced Discovery & Query Planner

Status:

`FROZEN`

Implementation Frozen SHA:

`9ae07d5a8ad5517da5dc9c33a999e174e71a86c9`

Freeze Review:

`PASSED`

Historical review evidence predates the Review Tier harness and must not be
reinterpreted as current launch authorization.

---

## Human Review Queue

Open protected-decision items: 0

Human-gated opportunities must be parked under:

`docs/product/human-review-queue/`

Parking an item does not authorize another Cycle inside the same Goal.
