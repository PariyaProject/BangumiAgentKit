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

Default implementation strategy:

- GPT-5.6 Luna `max` as the standing primary model in one thread;
- Luna `xhigh` only when `max` is unavailable; never a lower Luna effort;
- no automatic implementation or exploration subagents;
- Sol reviewers used only at a recorded milestone gate;
- no automatic reviewer retry;
- no automatic continuation into another Product Cycle.

---

## Goal Contract

Goal scope:

PR-7F Revision / Change History Intelligence only.

Explicit non-scope:

- PR-7G or any later Product Cycle;
- snapshots or historical trend claims;
- OAuth, authorization, or write expansion;
- HTML or Structured Web activation;
- unrelated opportunity-log work.

Verifiable stopping condition:

- PR-7F is frozen on an exact independently reviewed Candidate SHA; or
- a corrected Candidate needs new review authorization; or
- review/platform budget is unavailable; or
- a protected human decision is reached.

Goal continuation rule:

Freezing PR-7F completes this Goal. Selecting PR-7G requires a new explicit user
request. The former multi-Cycle “2 of up to 3” outer Goal is retired.

Codex Goal runtime:

No active Codex Goal is currently running. Do not create or resume one without
an explicit user request.

---

## Execution Budget

Primary thread:

Single-thread GPT-5.6 Luna `max` implementation. Luna `xhigh` is the minimum
fallback if `max` is unavailable. Cost controls apply to agent launches and Sol
gates, not to Luna reasoning depth.

Generic subagents under the new harness:

- authorized: 0
- consumed: 0
- remaining: 0

Known PR-7F Sol review launches:

- authorized automatic milestone budget: 2
- `sol_code_reviewer`: 1 launch, no verdict because the platform usage limit was hit
- `sol_product_reviewer`: 1 launch, no verdict because the platform usage limit was hit
- consumed: 2
- automatic remaining: 0

Each failed launch consumes budget. Do not retry either reviewer automatically.
Any additional review launch requires explicit user authorization and a newly
recorded budget.

---

## Last Frozen Product Cycle

Cycle:

PR-7E Calendar / Schedule Intelligence

Status:

FROZEN

Implementation Frozen SHA:

`d53d800c5497cacd156792b1139ab7f2a696cdbe`

Freeze Review:

PASSED — exact-head CI 31354128241; both independent reviewers PASS

Governance Record SHA:

`7e67a2d5a1ab841a980ec35700732060b64142ca`

---

## Current Cycle

Cycle:

PR-7F Revision / Change History Intelligence

State:

`PAUSED_REVIEW_BUDGET_EXHAUSTED`

Implementation phase:

The last committed Candidate was implemented and validated, reviewer launches
failed without verdicts, and post-Candidate corrective work is present but not
yet committed as a new Candidate.

Active Workplan:

`docs/product/cycles/PR-7F-revision-change-intelligence.md`

Current objective:

Implement a bounded official revision/change-history intelligence result using
the existing read-only revisions source, preserving observed timestamps,
summaries, coverage, evidence, and unavailable states without claiming
unsupported historical trends or changing auth, write, snapshot, HTML, or
source-activation boundaries.

---

## Candidate and Validation State

Last committed Candidate SHA:

`e8fbf1e6012c2bbdf59d9b170d0a898d096c2922`

Current Candidate SHA:

None. The working tree contains post-Candidate changes and is not a Freeze
Candidate.

Remote CI for the last Candidate:

PR-7F exact Candidate CI 31356297264: SUCCESS across all six jobs.

Independent verdicts:

- `sol_code_reviewer`: no verdict; launch failed at platform usage limit
- `sol_product_reviewer`: no verdict; launch failed at platform usage limit

PR-7F is not frozen. Failed launches must never be converted into PASS.

---

## Human Review Queue

Open protected-decision items: 0

Human review authorization currently required:

- any additional Sol reviewer launch for PR-7F;
- creation or start of a Product Cycle after PR-7F.

---

## Next Action

Do not launch a reviewer or subagent.

When the user explicitly resumes PR-7F implementation:

1. use one primary thread to inspect and finish the existing post-Candidate changes;
2. run affected local validation and required QA;
3. commit a clean new Candidate and run exact-SHA mandatory CI;
4. set the state to `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`;
5. stop and report the review cost decision to the user.

Do not enable HTML/Structured Web, introduce a snapshot store, expand auth or
writes, retry the failed reviewers, or start the next Product Cycle.

---

## Goal Status

`PAUSED_REVIEW_BUDGET_EXHAUSTED`

Reason:

The recorded automatic Sol budget was consumed by two failed reviewer launches.
The project is preserved at PR-7F and will not continue autonomously.
