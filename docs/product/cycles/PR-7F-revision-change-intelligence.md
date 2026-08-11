# PR-7F Revision / Change History Intelligence

Status: `PAUSED_REVIEW_BUDGET_EXHAUSTED — SOL #1 NO VERDICT`

Base: PR-7E implementation frozen SHA
`d53d800c5497cacd156792b1139ab7f2a696cdbe`

## Objective

Complete one bounded, read-only, official revision/change-history intelligence
milestone for subjects, episodes, characters, and persons. Preserve useful edit
facts, source timestamps, evidence, coverage, and honest degraded states without
claiming a complete continuously captured history.

## User Problem

The repository has official v0 revision list/detail operations, but their raw
transport-shaped output does not directly answer why an entity changed, what
recent official revision records were observed, how much history the bounded
page covers, or whether missing data makes the result partial.

## Representative Questions

- “这个条目的标题或简介为什么变了？”
- “最近有哪些官方修订记录？”
- “这条修订记录具体改了什么？”

## Existing Implementation State

Last committed implementation Candidate:

`433e80cf1da7a5994513053c3391487d1c911a3e`

Exact remote CI for the current Candidate:

GitHub Actions run `31463062377` — SUCCESS across all six mandatory jobs.

The cancelled manually dispatched `master` run `31462981828` is unrelated and
is not used as evidence. Run `31463062377` was manually dispatched against the
exact Candidate ref because the normal push trigger did not create a run.

Completed work already includes the bounded semantic result, official entity
routing, coverage and evidence states, tool exposure, Standalone integration,
Renderer output, tests, read-only official QA, and representative 640px/960px
visual QA.

The six post-Candidate corrective files were preserved in user stash commit
`8df0121` and are incorporated into the current Candidate without modifying or
consuming that preserved source. Stable binary patch fingerprint:

`ac421b1afb521d85ef9c3162f2ca192ccd07379ad9f3607b6386ea743abf57f7`

Current Candidate SHA:
`433e80cf1da7a5994513053c3391487d1c911a3e`

Historical pre-migration review attempts: one code reviewer and one product
reviewer launch both failed at the platform usage limit with no verdict. They
are not PASS and do not consume the newly authorized portable `TIER_2` budget.

## Scope

- support one bounded entity-scoped official revision list request for subject,
  episode, character, or person;
- preserve revision ID, raw revision type, official summary, official creation
  time, and creator fields when available;
- expose observed/returned/total coverage, pagination, missing/truncated fields,
  source evidence, warnings, and `complete`/`partial`/`unavailable` states;
- make unsupported growth, popularity, continuity, and complete-lifetime claims
  explicitly not-computable;
- retain `bangumi.list_revisions` for raw pagination and
  `bangumi.get_revision` for explicit detail;
- provide useful compact Agent-facing and human-facing revision intelligence and
  Renderer output.

## Explicit Non-Scope

- snapshot database, scheduled ingestion, or historical trend calculation;
- HTML/Structured Web fallback or community-source activation;
- authentication, OAuth, credentials, personal edit expansion, or writes;
- claiming a bounded page is complete lifetime history when the source cannot
  prove it;
- unbounded detail hydration or request fan-out;
- PR-7G or any unrelated Product Cycle;
- release, package, tag, or destructive migration work.

## Data / Source Dependencies

- official Bangumi v0 revision list routes for subjects, episodes, characters,
  and persons;
- existing official revision detail operation for explicit selected records;
- injected repository HTTP/client abstractions and their existing public error
  mapping;
- no credentials, cookies, HTML parsing, community fallback, or new persistent
  data store.

## Evidence and Failure Contract

The result must distinguish records observed in the returned page from the
total advertised by the source, preserve unknown or nullable fields as unknown,
record the exact official operation and attempted/retrieved timestamps, and
represent public not-found, rate-limit, network/upstream, and schema failures
truthfully. Bounded, missing, inconsistent, or truncated data must never become
false completeness.

## Frozen Foundation Constraints

- preserve existing public list/detail revision tools and schemas;
- do not reopen authentication, authorization, SSRF, credential, write, source
  activation, cache, or database foundations;
- do not break frozen contracts without a separately authorized compatibility
  path;
- keep official-source work bounded and read-only;
- do not interpret arbitrary revision content as trusted HTML.

## Agent UX

- clear entity type/id input, limit `1–20`, and non-negative bounded offset;
- explain that `createdAt` is official revision-source time, not broadcast time
  or evidence of continuous capture;
- expose machine-readable capability, coverage, warning, limitation, and source
  evidence before verbose record data;
- make partial, unknown, not-computable, and unavailable states discoverable
  without low-level orchestration.

## Renderer QA

Render a compact revision timeline/change-history card with entity identity,
observed versus total counts, bounded/partial state, source time, wrapped CJK
summaries, explicit unknowns, field truncation evidence, and unavailable output.

Before readiness, inspect representative 640px and 960px output for complete,
partial, empty, long-CJK, nullable/missing, truncated, and unavailable states.
Do not imply field-level diffs unless supplied by the source.

## Tests

- unit tests for mapping, nullable/unknown fields, entity routing, bounded
  limit/offset, total-versus-returned coverage, field truncation, unsupported
  entities, and public 404/429/network/upstream/schema failures;
- semantic tests for injected transport, tool descriptions, capability states,
  evidence, and not-computable historical claims;
- contract and MCP schema tests preserving list/detail compatibility and route
  semantics;
- Standalone tests for raw list/detail commands and bounded intelligence output;
- Renderer tests for representative widths and complete, partial, empty,
  long/missing/truncated, unavailable, and raw-HTML-safe states;
- affected typecheck, lint, OpenAPI verification, and broader regression suites.

## User QA

Use the bounded capability against representative read-only official revision
data and verify that it answers the three user questions without exaggerating
history or completeness. No credentials or writes are permitted.

## Agent QA

Verify that an external Agent can discover the semantic tool, select the right
entity, understand coverage and source time, distinguish raw list/detail paths,
and handle partial, unknown, not-computable, and unavailable results correctly.

## Resource Bounds

- one official list request per intelligence result;
- limit clamped to a maximum of 20 and offset bounded/non-negative;
- no automatic detail hydration fan-out;
- bounded summaries, timestamps, creator fields, opaque data, and rendered
  output;
- existing SSRF-constrained asset handling and Renderer timeout/output limits
  remain in force;
- no new shared cache, snapshot store, credentials, cookies, or migration.

## Review Contract

- Review Tier: `TIER_2`
- Generic subagent budget: `0` authorized / `0` consumed
- Total Sol budget: `2` authorized / `1` consumed / `1` remaining
- Review execution: `SEQUENTIAL_ONLY`
- Automatic Sol #3: `PROHIBITED`
- Standing reviewer: `sol_milestone_reviewer`
- Sol reasoning: `high`
- Portable profile: `docs/agent/goals/UNATTENDED_TIER2.md`

Many commits, implementation stages, test failures, test fixes, and internal
refactors are Luna work, not Sol triggers. Sol #1 is allowed only after the
complete PR-7F milestone passes the Review Readiness Gate. If Sol #1 passes,
Freeze without spending Sol #2. If it returns `CORRECTIVE_REQUIRED`, Luna fixes
all P0/P1 findings, creates and validates a new exact Candidate, then may spend
Sol #2. Any other Sol #2 result stops; Sol #3 is prohibited.

## Review Readiness Record

The Review Readiness Gate is complete for Candidate
`433e80cf1da7a5994513053c3391487d1c911a3e`:

- local validation passed across affected unit/render tests, typecheck, lint,
  contract, semantic, provider, discovery, SQLite integration, build,
  standalone, and OpenAPI verification;
- bounded read-only official API User QA covered both list and selected detail
  revision questions without credentials or writes;
- Agent QA verified Standalone discovery, bounded inputs, evidence semantics,
  raw list/detail paths, and truthful not-computable trend semantics;
- Renderer QA inspected complete, partial, empty, long-CJK, nullable/missing,
  truncated-field, and unavailable fixtures at 640px and 960px;
- Luna preflight found stable scope, clean implementation state, preserved raw
  compatibility, one-request/no-fan-out resource bounds, truthful nullable and
  truncation evidence, mapped failure states, and no deferred P0/P1 or
  protected human-only blocker;
- mandatory exact-SHA CI run `31463062377` passed all six jobs.

Sol #1 was launched: reviewer agent
`019fef66-d5dd-7901-9a92-7b4a04039c31` (`Locke`), standing reviewer
`sol_milestone_reviewer`, `high` reasoning. The reviewer must inspect the actual
Base..Candidate diff and return one of the recorded verdicts. A `PASS` freezes
this Candidate without Sol #2; a `CORRECTIVE_REQUIRED` permits one sequential
Sol #2 only after Luna creates a new validated Candidate.

## Review Stop Record

Sol #1 returned no verdict. The wait operation returned `timed_out: true` with
no reviewer status or review message; the still-running reviewer agent was
closed after the timeout. No PASS, `CORRECTIVE_REQUIRED`, or
`HUMAN_REVIEW_REQUIRED` finding is available, and the Candidate is not frozen.

The selected `UNATTENDED_TIER2` profile mandates stopping after any timeout or
no-verdict outcome and does not authorize a retry or another reviewer. The
nominal accounting is therefore `2 authorized / 1 consumed / 1 remaining`, but
the remaining launch is not spendable in this stopped execution. No Sol #2,
corrective implementation, or next Product Cycle may begin in this Goal.

## Acceptance Criteria

1. Revision facts useful for “what changed?” are preserved with truthful source
   semantics.
2. Bounded coverage, missing/truncated fields, failures, and not-computable
   history claims are machine-readable and human-readable.
3. Existing raw list/detail revision tools remain backward compatible.
4. Resource limits and no-fan-out behavior are real and tested.
5. Local validation, exact-SHA remote CI, User QA, Agent QA, and representative
   Renderer QA pass for the final Candidate.
6. The recorded `TIER_2` review sequence is satisfied by a comprehensive
   `sol_milestone_reviewer` PASS on the exact final Candidate.
7. No unresolved P0/P1 blocker or protected human-only boundary remains.
8. Freeze ends the Goal without selecting or starting another Product Cycle.

## Review Readiness Gate

Before Sol #1, complete the gate defined by the canonical Budget-First and
Review Policy documents: stable scope, clean exact Candidate SHA, green local
validation, exact-SHA mandatory CI, completed User/Agent/Renderer QA, Luna
consolidated self-review, truthful evidence, and persisted budget accounting.

## Stopping Condition

- set `FROZEN_GOAL_COMPLETE` only after all acceptance and tier-specific Freeze
  requirements pass for the exact final Candidate; or
- stop when the total two-launch Sol budget is exhausted without PASS; or
- stop when a protected human-only decision, infrastructure/permission blocker,
  unrelated dirty-work blocker, or another portable-profile stop condition is
  reached.

Never start PR-7G or another Cycle inside this Goal.

## Exact Next Goal Command

```text
/goal Read docs/agent/goals/UNATTENDED_TIER2.md and execute the current
active milestone exactly as defined there. Continue until
FROZEN_GOAL_COMPLETE or a documented stop condition.
```
