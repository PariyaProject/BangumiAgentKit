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

`REVIEW_AUTHORIZED`

Current Phase:

`PRE_SOL_1_REVIEW_READINESS_COMPLETE`

Execution Runtime:

The current `/goal` is running under the portable unattended profile. Luna has
completed the corrective implementation and Review Readiness Gate; Sol #1 is
authorized and not yet consumed.

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

`433e80cf1da7a5994513053c3391487d1c911a3e`

This is the clean implementation Candidate containing the bounded evidence
corrections and generated tool catalog update.

Exact-SHA CI:

- Candidate `433e80cf1da7a5994513053c3391487d1c911a3e`:
  GitHub Actions run `31463062377`, SUCCESS across all six mandatory jobs
  (`sqlite-default`, `host-integration`, `standalone-release-smoke`,
  `postgres-compat`, `provider-foundation`, and `discovery-foundation`).
  The run was manually dispatched against the exact Candidate ref after the
  push trigger did not create a run; the cancelled `master` run `31462981828`
  is unrelated and is not used as evidence.

Review Readiness Evidence:

- local validation: affected unit/render tests, typecheck, lint, contract,
  semantic, provider, discovery, SQLite integration, build, standalone, and
  OpenAPI verification all passed;
- User QA: bounded read-only official API list/detail checks answered recent
  revision and explicit changed-field questions without credentials or writes;
- Agent QA: Standalone tool discovery showed the bounded entity enum,
  limit/offset bounds, evidence semantics, and truthful no-trend limitation;
- Renderer QA: representative complete, partial, empty, long-CJK,
  nullable/missing, truncated-field, and unavailable fixtures were inspected at
  640px and 960px with no clipping or unsafe HTML;
- Luna consolidated preflight: scope and acceptance criteria are stable; the
  Candidate is clean and pushed; raw list/detail compatibility, one-request/no
  fan-out bounds, nullable and truncation evidence, failure mapping, source
  timestamps, security boundaries, and protected human-only boundaries were
  checked with no deferred blocker.

Review Launch Readiness:

- next launch ordinal: `Sol #1`;
- reviewer: `sol_milestone_reviewer` at `high` reasoning;
- accounting before launch: `2 authorized / 0 consumed / 2 remaining`;
- if Sol #1 returns `PASS`, freeze this exact Candidate without Sol #2; if it
  returns `CORRECTIVE_REQUIRED`, use the one remaining sequential launch only
  after a new corrected Candidate and exact-SHA CI.

Human Authorization State:

`UNATTENDED_TIER2_AUTHORIZED`

This authorizes only the recorded PR-7F milestone and two sequential
`sol_milestone_reviewer` launches under the portable profile. It does not
authorize a different Cycle or Sol #3.

Next Action:

Launch the recorded Sol #1 `sol_milestone_reviewer` comprehensive review
against Base `d53d800c5497cacd156792b1139ab7f2a696cdbe` and Candidate
`433e80cf1da7a5994513053c3391487d1c911a3e`. Persist the verdict and budget
usage before taking the tier-specific next action.

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

Historical corrective source:

The six post-Candidate PR-7F files were preserved in user Git stash commit
`8df0121` and were incorporated into the clean Candidate above without
modifying or consuming that preserved source. Their stable binary patch
fingerprint is:

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
