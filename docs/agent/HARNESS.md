# BangumiAgentKit Harness V3

This is the **only canonical detailed execution-governance policy** for active
BangumiAgentKit work. Other governance and Goal files may select a mode or link
here; they must not redefine these mechanics.

Product direction is separate and lives in
[`PRODUCT_CHARTER.md`](PRODUCT_CHARTER.md).

## 1. Control-plane architecture

Harness V3 separates three planes.

### Product plane — Git

Git tracks source code, tests, meaningful product documentation, and stable
product knowledge. Normal Agent runtime state is not product history.

Normal Product Epoch branches must not modify the legacy runtime paths:

- `docs/product/loop-status.md`
- `docs/product/cycles/**`
- `docs/product/reviews/**`

The deterministic `pnpm harness guard:legacy-paths` check enforces this for V3
Product PRs. `pnpm harness candidate:check` invokes the same guard before review.

### Epoch control plane — one GitHub PR

One Product Review Epoch is controlled by one GitHub Pull Request. Its editable
body owns the Epoch objective, representative questions, Work Packages,
non-scope, Scope Closure, acceptance criteria, validation, current state, Base
and Candidate SHAs, review budget/reservations/consumption, CI, findings, and
park/pass/merge state.

### Outer control plane — one GitHub Issue

One Autonomous Self-Evolution outer run is controlled by one GitHub Issue. Its
editable body owns the run id/profile/state, outer review budget, active Epoch
PR, parked Epoch PRs, latest merged Epoch, and next action.

Machine state is stored in one marked JSON block in each body and edited in
place. Significant terminal events may receive one concise comment when it adds
audit value. Heartbeat and polling comments are prohibited.

GitHub is the durable runtime source. If authentication, API access, or required
permissions are unavailable, stop as `CONTROL_PLANE_UNAVAILABLE`. Never fall
back to tracked loop status, Cycle plans, Review files, temporary ledgers, or
other Git commits. An untracked local cache may help performance but is never
authoritative.

## 2. Standing execution policy

- Primary implementation/research agent: GPT-5.6 Luna at `max` reasoning.
- Availability fallback: Luna `xhigh`; never lower.
- Generic implementation/research subagents: `0` unless explicitly authorized
  for a specific use or required by an applicable skill.
- Default reviewer: one comprehensive Sol milestone reviewer at `high`.
- Sol `xhigh` requires explicit exceptional authorization.
- Reviews are sequential. Specialized reviewers are never automatically paired.
- Git worktrees are prohibited.

Cost is controlled by fewer launches and better batching, not weaker Luna
reasoning.

## 3. Goal modes

`AUTONOMOUS_EVOLUTION` creates or resumes one Outer Run Issue, resumes its active
Epoch PR when present, otherwise performs bounded opportunity discovery,
selects one coherent Epoch, and proceeds until a governed stop.

`EXECUTE_EPOCH` executes one explicitly selected Epoch PR and never selects the
next Epoch automatically.

The profile selects the mode. It does not redefine lifecycle rules.

## 4. Product Review Epoch

The optimization target is **the largest coherent and reviewable product
increment** that completes one related user/Agent capability or tightly coupled
architectural/product slice.

The phrase “smallest coherent vertical slice” is explicitly rejected as an
Epoch objective. An initial end-to-end slice may be one Work Package, not an
automatic review boundary. An Epoch may contain multiple Work Packages, many
meaningful commits, and several hours of Luna Max work.

Do not trigger review because of commit count, file count, line count, elapsed
time, stage completion, one passing test, individual fixes, incremental
refactors, or a Work Package becoming locally stable. Do not combine unrelated
objectives merely to delay review.

### Work Packages

A Work Package is a meaningful engineering segment inside the same Epoch. Its
completion is a logical `LUNA_STABLE` event only. It does not trigger a runtime
Git commit, control-plane heartbeat, PR update, CI run, Candidate, push, or
review. Commit only durable engineering/product work at natural boundaries.

### Scope Closure

Before Candidate readiness, Luna must record two truthful answers in the Epoch
PR:

**Why Not Review Earlier?**

- What closely related high-value Work Packages remain?
- Do they improve the same user/Agent capability?
- Do they reuse the same semantics, data, product, and Renderer context?
- Would reviewing now duplicate likely future review work?

If closely related high-value work remains and coherence is preserved, continue
Luna engineering. The readiness command rejects a micro-Epoch while
`related_work_remaining` is true.

**Why Not Extend Further?**

- Does the next work serve a different user objective or domain?
- Does it require independent architecture or source policy?
- Would it materially enlarge reviewer cognitive load?
- Would it reduce semantic or product coherence?

When extension begins to harm coherence or reviewability, the boundary has been
reached. No numeric minimum or maximum substitutes for these answers.

## 5. Startup and commit hygiene

Start an authorized Product Epoch from a clean, current `master`, using one
ordinary dedicated branch and one PR. Work Packages do not get branches or PRs.

Before the first meaningful branch commit, an autonomous run may durably record
the selected Epoch in its Outer Run Issue. Then:

```text
create branch
-> implement first real Work Package
-> meaningful engineering commit
-> push
-> open Draft PR
-> establish the PR control body
```

Do not create an empty/status/docs plan commit merely to open a PR.

Normal Product commits represent durable `feat`, `fix`, `test`, `refactor`, or
meaningful product-documentation work. The following runtime transitions never
create commits: plan activation, validation, readiness, CI green, Candidate
recording, review reservation/start/wait/verdict, pass/freeze, park, merge,
cleanup, and outer ledger updates.

Never automatically commit, stash, reset, rewrite, or relocate unrelated user
work. Preserve it untouched. If a required branch operation cannot proceed
safely, record the blocker and stop.

## 6. Validation funnel and adversarial preflight

Luna validates continuously with the cheapest relevant checks, then widens the
funnel as the Epoch stabilizes: focused tests, integration/contract tests,
User QA, Agent QA, Renderer/visual QA when applicable, and the mandatory
repository suite.

Before spending Sol, Luna performs one consolidated adversarial falsification
pass asking: **What would an independent reviewer most likely reject?**

Challenge, where applicable:

- nested bounds, fan-out, concurrency, memory, and timeouts;
- degraded, failure, missing, partial, stale, conflict, and unavailable states;
- source evidence, provenance, coverage, and retrieval timestamps;
- derived formula/method versions and limitations;
- public/frozen contracts versus actual implementation;
- SSRF, security, network, and asset-resolver paths;
- zero-network Renderer assumptions;
- fixture realism and synthetic ViewModels versus real service evidence;
- long, missing, dense, and high-cardinality visual states;
- cross-Work-Package integration;
- regression of frozen capabilities.

The preflight creates no standalone report commit. Luna finds, fixes, validates,
and repeats inside the same engineering history. The PR control block records
only that the consolidated preflight completed and its validation summary.

## 7. Candidate and CI invariants

The normal V3 invariant is:

```text
Candidate SHA == feature branch HEAD == PR head SHA
```

After Candidate establishment, runtime or governance Git commits are forbidden.
Runtime results live in GitHub. Any meaningful repository change invalidates the
Candidate and requires a new Candidate, validation, and exact-SHA CI.

Before review:

1. run the legacy-runtime-path guard;
2. complete Scope Closure and adversarial preflight;
3. validate locally;
4. fetch the target base;
5. if the base advanced, synchronize it safely into the branch, resolve and
   validate, then establish a fresh Candidate;
6. prove Candidate, branch HEAD, and PR head equality;
7. obtain all mandatory remote CI success on that exact SHA.

Never spend Sol against a knowingly stale base or a different CI SHA.

The Candidate evidence input must explicitly name the current fetched Base SHA
and exact branch-HEAD Candidate SHA. A stale control-plane Base may be advanced
only when the current base is already an ancestor of HEAD and this fresh
evidence covers that exact base/Candidate combination. Candidate readiness
marks the Draft PR ready for review. Mandatory checks must report `SUCCESS`;
`SKIPPED`, `NEUTRAL`, pending, or missing checks do not satisfy exact-SHA CI.

## 8. Review budget and reservation

A normal reviewed Product Epoch records:

- `expected: 1`
- `max: 2`
- `consumed: 0`
- `reserved: 0`

An Autonomous outer run records:

- `max: 4`
- `consumed: 0`
- `reserved: 0`

The automatic ceilings are executable hard caps: Epoch `max` can never exceed
`2` and Outer `max` can never exceed `4`, including caller options and edited
GitHub control blocks. A user may lower a budget but cannot raise either cap
inside the run.

Before a reviewer launch, create one paired reservation id for exactly one Epoch
slot and one Outer slot in the GitHub control planes. Another launch is
prohibited while either side of that reservation exists. Because GitHub cannot
transactionally edit an Issue and PR together, interruption after only one body
edit is a partial reservation, never permission to launch. Reconcile either a
paired or partial reservation before any future launch. When runtime truth
cannot prove no launch occurred, count one slot as consumed in both ledgers.
When the reviewer actually starts, convert both reserved slots to consumed.

Each reviewer start consumes one slot even if it later fails or terminates.
Waiting/polling the same reviewer consumes no slot.

Normal sequence:

```text
Luna engineering
-> Scope Closure
-> adversarial preflight
-> exact Candidate
-> exact-SHA CI
-> Sol #1
```

`PASS` proceeds to automatic integration. `CORRECTIVE_REQUIRED` sends all
consolidated P0/P1 findings back to Luna. Luna fixes them, establishes a new
Candidate, repeats validation/CI, and may spend Sol #2. If Sol #2 still reports
blocking P0/P1, park as `PARKED_REVIEW_LIMIT`. Sol #3 is never automatic.

## 9. Reviewer runtime

One comprehensive reviewer covers correctness, architecture, security, frozen
contracts, tests, evidence/coverage, resource bounds, user value, Agent UX, and
Renderer when applicable. It inspects the repository and evidence, not merely
the implementation report.

A launched reviewer has a durable id. A wait timeout while that same reviewer
remains active is ephemeral telemetry. Any number of same-reviewer timeouts
produce:

- zero Git mutations;
- zero PR/Issue heartbeat edits or comments;
- zero CI reruns;
- zero extra launches;
- zero budget changes.

Continue waiting on the same id. A reviewer hard failure or missing runtime
truth is recorded truthfully; reconcile any outstanding reservation before
another launch.

Reviewer verdicts are:

- `PASS`: no unresolved P0/P1 for the exact Candidate;
- `CORRECTIVE_REQUIRED`: consolidated actionable P0/P1 findings;
- `HUMAN_REVIEW_REQUIRED`: a protected or irreducibly human decision.

Review findings and verdicts live in the PR body or a concise PR comment, never
in a tracked review file.

## 10. Parking and circuit breaker

Parked work remains on the **same PR and same branch**. Do not automatically
create Recovery, Finalization, Replacement, or Recovery-of-Recovery chains. A
later explicit authorization normally resumes the same PR. A replacement
requires an exceptional recorded reason and explicit human authorization.

`PARKED_FOR_HUMAN` isolates a protected direction. In autonomous mode, other
independent safe work may continue when the repository is safe.

`PARKED_REVIEW_LIMIT` with unresolved engineering P0/P1 triggers
`QUALITY_CIRCUIT_BREAKER` for the outer run by default. Record it in the Run
Issue and stop. Do not spend remaining outer Sol budget on another Epoch while
the review/preflight process is demonstrably degraded.

Only an Outer Run in `ACTIVE` state with no active or pending Epoch may start a
new Epoch. Circuit-breaker, stopped, completed, and integration-blocked states
reject Epoch creation mechanically.

## 11. Default integration and base freshness

Normal V3 Product Epochs use `AUTO_MERGE_AFTER_PASS`; an Epoch does not need to
redeclare it. Explicit `STOP_AT_PASS` or `HUMAN_REQUIRED` may override it.

Immediately after `PASS`:

1. fetch the target base;
2. verify the Candidate invariant and exact-SHA CI;
3. verify the PASS belongs to the exact Candidate and reviewed Base SHA;
4. compare current target-base SHA with the reviewed Base SHA.

If unchanged, merge the PR using the repository's normal merge strategy,
verify the PR is `MERGED`, verify the Candidate is an ancestor of the pushed
base, delete the remote feature branch, delete the local feature branch when
safe, checkout `master`, and synchronize `master` with `origin/master`.

If the base advanced after PASS, the old PASS does not authorize the new
combination. Synchronize the base into the feature branch safely, validate,
establish a new Candidate, and re-review only when both Epoch and outer budget
remain. Otherwise park on the same PR. Never claim old CI or review evidence
covers the changed combination.

When permission, protection, conflict, freshness, ancestry, or another real
gate prevents integration, update the PR control state to
`INTEGRATION_BLOCKED` and stop. Do not claim merge success or create a Git
runtime commit.

If GitHub reports the PR merged but subsequent ancestry verification,
synchronization, or branch cleanup fails, record both the actual merged PR/SHA
and `INTEGRATION_BLOCKED` in the PR and Run Issue before stopping. Never leave
the control plane at `REVIEW_PASSED` after a real merge.

Successful integration updates the Outer Run Issue with the latest merged PR,
clears the active PR, and either continues discovery (`AUTONOMOUS_EVOLUTION`)
or stops successfully (`EXECUTE_EPOCH`).

## 12. Human-only boundaries

Human approval is required before implementing:

- authentication trust or principal/authorization model changes;
- weaker write confirmation, SSRF, or other security boundaries;
- token, cookie, or credential exposure/handling expansion;
- destructive/write authority expansion;
- broad Structured Web/HTML enablement or aggressive crawling;
- major irreversible semantic database migrations;
- breaking frozen public contracts without a safe compatibility path;
- paid external services, license/legal-policy changes;
- release, package, or tag publication.

Do not implement a protected decision while waiting. Record
`PARKED_FOR_HUMAN` on the same PR. The Product Charter's Foundation Change
Proposal explains product intent; this rule controls execution authority.

## 13. Failure and truthful stops

Canonical governed stops include:

- `CONTROL_PLANE_UNAVAILABLE`
- `PARKED_FOR_HUMAN`
- `PARKED_REVIEW_LIMIT`
- `QUALITY_CIRCUIT_BREAKER`
- `INTEGRATION_BLOCKED`
- explicit user stop/change
- unsafe repository state
- exhausted outer budget
- no valuable independent safe opportunity in autonomous discovery.

Never convert a stop into a Git status commit. Persist runtime truth only in the
Issue/PR when the control plane is available. If it is unavailable, report the
stop locally and do not fabricate durability.

## 14. Runtime schemas

The CLI owns the exact schema and marked-block serialization. Conceptually an
Outer Run block contains:

```json
{
  "schema": "bangumi-harness/v3",
  "kind": "outer-run",
  "run_id": "run-...",
  "profile": "AUTONOMOUS_EVOLUTION",
  "state": "...",
  "outer_sol": { "max": 4, "consumed": 0, "reserved": 0 },
  "active_epoch_pr": null,
  "parked_epoch_prs": [],
  "last_merged_epoch_pr": null,
  "next_action": "..."
}
```

An Epoch PR block contains:

```json
{
  "schema": "bangumi-harness/v3",
  "kind": "epoch",
  "epoch_id": "epoch-...",
  "state": "...",
  "base_sha": "...",
  "candidate_sha": null,
  "review": { "expected": 1, "max": 2, "consumed": 0, "reserved": 0 },
  "integration": "AUTO_MERGE_AFTER_PASS"
}
```

The human-readable PR body supplies Product Objective, Representative User
Questions, Included Work Packages, Explicit Non-Scope, Acceptance Criteria,
Validation, Why Not Review Earlier?, and Why Not Extend Further?.

## 15. Harness CLI

The deterministic entry point is `pnpm harness <command>`. Run `pnpm harness
help` for exact arguments.

- `status`: reconstruct runtime truth from Git, the Run Issue, and Epoch PR.
- `run:start`: create one Outer Run Issue.
- `epoch:start`: record a selected Epoch in the Run Issue before branch work.
- `epoch:open-pr`: open the single Draft PR after a meaningful commit.
- `guard:legacy-paths`: reject V3 Product changes to legacy runtime paths.
- `candidate:check`: enforce path, Scope Closure, preflight, Candidate, base,
  and exact-SHA CI invariants.
- `review:reserve`: reserve Epoch and outer review slots.
- `review:started`: convert a reservation to consumed and record reviewer id.
- `review:result`: record a verdict and apply park/circuit-breaker semantics.
- `review:wait`: validate same-reviewer identity and make no durable write.
- `epoch:park`: park the same PR/branch truthfully.
- `epoch:merge`: enforce PASS/freshness/CI/Candidate gates, merge, verify, clean
  branches, synchronize master, and update the Run Issue.
- `run:stop`: record a governed outer stop.

Harness unit/simulation tests and the CI guard are mandatory readiness evidence
for changes to this control plane.
