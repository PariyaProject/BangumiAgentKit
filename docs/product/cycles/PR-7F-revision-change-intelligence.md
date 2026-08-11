# PR-7F Revision / Change History Intelligence

Status: PAUSED_REVIEW_BUDGET_EXHAUSTED

Base: PR-7E implementation frozen SHA `d53d800c5497cacd156792b1139ab7f2a696cdbe`

## Execution evidence

Last committed Implementation Candidate SHA:
`e8fbf1e6012c2bbdf59d9b170d0a898d096c2922`

Current Candidate SHA: none. Post-Candidate changes remain in the working tree
and have not been committed or presented as a new Candidate.

Exact remote CI: GitHub Actions run `31356297264` — SUCCESS across all six jobs.

Local validation passed: `pnpm test` (177 tests), `pnpm test:semantic` (31),
`pnpm test:provider` (33), `pnpm test:discovery` (48), `pnpm test:contract` (22),
`pnpm test:integration:sqlite` (33), `pnpm test:standalone` (18), focused MCP schema /
renderer / service / Standalone tests (83), `pnpm typecheck`, `pnpm lint`, and
`pnpm openapi:verify`.

Read-only official QA against `GET /v0/revisions/subjects` for subject `218707` returned
10 records with `total=21`, so the result was `partial` with exact official-v0 provenance;
no credentials or writes were used. Representative rendered artifacts were inspected at
640px and 960px (`/tmp/bangumi-pr7f-revision-640.png` and
`/tmp/bangumi-pr7f-revision-960.png`).

Required `sol_code_reviewer` and `sol_product_reviewer` verdicts are still pending: both
reviewer launches hit the platform usage limit before returning a report. This is not a
freeze and must not be converted into PASS by the implementation agent. Each failed launch
consumed one call under the new budget ledger; neither may be retried automatically.

## Goal and execution harness

Goal scope: PR-7F only.

Stopping condition: PR-7F freezes on an exact independently reviewed Candidate SHA, or the
Cycle stops when a corrected Candidate needs review authorization, review budget is
unavailable, or a protected decision is reached.

Primary-thread strategy: one GPT-5.6 Luna `max` implementation thread; Luna `xhigh` only
if `max` is unavailable; no automatic implementation, exploration, or QA subagents.

Generic subagent budget: 0 authorized / 0 consumed.

Automatic Sol review budget:

- `sol_code_reviewer`: 1 authorized / 1 consumed / no verdict;
- `sol_product_reviewer`: 1 authorized / 1 consumed / no verdict;
- remaining automatic Sol launches: 0.

Next execution checkpoint: after explicit user authorization to resume implementation,
finish and validate the current post-Candidate work in one primary thread, commit a clean
Candidate, run exact-SHA CI, mark `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`, and stop.

Freezing PR-7F completes the Goal. Do not select or begin another Product Cycle.

## Cycle title

Revision / Change History Intelligence — bounded official edit facts without snapshot claims

## Opportunity selection

The repository already has official v0 revision operations, a domain model, a service, and
read-only tools, but their output is a shallow transport-shaped page. A bounded semantic
result can answer why an entity changed and what official edit records were observed without
introducing a snapshot store or pretending that a current page proves a historical trend.

Representative user questions:

- “这个条目的标题或简介为什么变了？”
- “最近有哪些官方修订记录？”
- “这条修订记录具体改了什么？”

## Scope

Build a read-only revision-intelligence result on top of the existing official v0 revision
operations without removing or breaking `bangumi.list_revisions` or `bangumi.get_revision`:

- support one bounded entity-scoped revision list request for subject, episode, character,
  or person;
- preserve revision ID, raw revision type, official summary, and official creation time;
- expose observed/returned/total coverage, pagination semantics, missing fields, source
  evidence, and `complete`/`partial`/`unavailable` states;
- make unsupported date-window growth, popularity, or “all historical changes” claims
  explicitly not-computable when the bounded page cannot prove them;
- provide a compact human-facing revision timeline/detail renderer or equivalent useful
  Standalone output while retaining raw detail through the existing tool path.

## Explicit non-scope

- no snapshot database, scheduled ingestion, or historical trend calculation;
- no HTML/Structured Web fallback and no community source activation;
- no authentication, personal edit attribution expansion, OAuth, or write actions;
- no claim that a bounded page is the complete lifetime revision history when `total` exceeds
  the requested page or the source omits fields;
- no unbounded hydration of each revision detail from a list page.

## Evidence and failure contract

The result must distinguish the official revisions page observed from the total advertised
by that endpoint, preserve unknown summary/created-at fields as unknown, identify the exact
official operation and retrieval timestamp, and preserve public 404/429/503/schema errors.
If a bounded page is truncated, coverage is `partial` and historical-growth capability is
`not_computable`; it must not silently become an empty or complete result.

## Agent UX

- use a clear entity type/id input with an explicit 1–20 result cap and non-negative offset;
- describe the four supported entity types and explain that `createdAt` is source time, not
  proof of a complete or continuously captured history;
- keep `bangumi.list_revisions` available for raw pagination and `bangumi.get_revision` for
  one selected detail record;
- expose machine-readable `capabilityStates`, `coverage`, `warnings`, `limitations`, and
  evidence before verbose revision data.

## Renderer opportunity

Render a compact `RevisionTimeline`/`ChangeHistoryCard` with entity identity, observed vs
total counts, bounded/partial state, source time, wrapped CJK summaries, explicit unknowns,
and an unavailable state. Do not render raw arbitrary `data` as trusted HTML or imply a
field-level diff unless the source supplies one.

## Tests and QA

- unit tests for mapping, unknown fields, entity routing, bounded limit/offset behavior,
  total-vs-returned coverage, unsupported entities, and 404/429/503/schema failures;
- semantic tests for injected transport, tool descriptions, capability states, and
  `not_computable` historical claims;
- contract tests preserving existing list/detail tool schemas and OpenAPI routing;
- Standalone tests for raw list/detail commands and the new bounded summary route;
- renderer tests for narrow 640px and 960px partial, complete, empty, long-CJK, and
  unavailable states, including wrapped summaries and no raw-HTML injection;
- live read-only QA against an official revision endpoint when a stable public entity is
  available, with no writes or credentials.

## Resource and security limits

- one official list request per bounded intelligence result;
- `limit` is clamped to a maximum of 20 and `offset` remains non-negative;
- no detail hydration fan-out from the list result; a detail request is explicit and separate;
- summaries and opaque data are bounded before rendering, with no raw HTML interpretation;
- existing SSRF-constrained asset resolution and renderer output/timeout limits remain in
  force;
- no credentials, cookies, database migration, snapshot store, or public/shared cache
  expansion.

## Acceptance criteria

1. Revision facts useful for “what changed?” are preserved with truthful source semantics.
2. Bounded page coverage, missing fields, failures, and not-computable history claims are
   machine-readable and human-readable.
3. Existing list/detail revision tools remain backward compatible.
4. Local gates, exact-SHA remote CI, Agent QA, and representative visual QA pass.
5. Both independent Freeze reviewers return PASS for the exact final Candidate before
   PR-7F is frozen; any fresh reviewer budget is explicitly authorized and recorded.
6. Freeze ends the Goal without automatically selecting or starting another Product Cycle.
