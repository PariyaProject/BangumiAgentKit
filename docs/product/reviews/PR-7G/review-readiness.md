# PR-7G Review Readiness

Cycle: `PR-7G Series Relations & Watch-Order Intelligence`

Review tier: `TIER_2`

Base branch: `master`

Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`

Feature branch: `codex/pr-7g-series-watch-order`

Pull request: [#2](https://github.com/PariyaProject/BangumiAgentKit/pull/2)

Implementation Candidate SHA:
`3459689e69c8c14774d31a967b2161ed1e686a9d`

Governance record before reviewer launch:
`de9c2264173937c506eaec93cd88515d5e99d897`

The metadata head also passed [GitHub Actions run
31476551304](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31476551304)
across all six mandatory jobs; this does not replace the exact Candidate CI
evidence above.

The implementation Candidate is the exact production/test/docs tree reviewed
by the local validation and remote CI below. Any later commit in this branch
is governance metadata only unless a corrective review explicitly creates a
new Candidate.

## Exact-Candidate CI

[GitHub Actions run 31476188502](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31476188502)
passed all six mandatory jobs for the exact Candidate SHA:

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

## Local validation

The Candidate passed:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 185 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 32 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 48 tests
- `pnpm test:render` — 45 tests
- `pnpm test:standalone` — 19 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm openapi:verify` — pinned-spec validation, generation, formatting, and
  exact generated-output diff all passed

Focused PR-7G coverage includes the core service, semantic input/output and
policy metadata, renderer at 640px and 960px, long CJK names, missing images,
partial detail failures, mixed media, unknown labels, depth/cap truncation, and
Standalone semantic/render dispatch.

## User, Agent, and visual QA

- User QA: manually exercised the intended question contract against live
  official-v0 relation payloads for subject `68812` and a mixed-media subject;
  verified that the output is a bounded recommendation with raw labels,
  exclusions, coverage, and no canonical-order claim.
- Agent QA: inspected the actual Candidate diff, OpenAPI contract, transport
  request paths, resource bound (`2 + 2N` before transport retries), tests, tool
  catalog, and protected-boundary non-scope. No auth, credential, write,
  migration, HTML/Structured Web, snapshot, or release path was added.
- Visual QA: rendered representative partial/long-CJK fixtures at 640px and
  960px and inspected the PNGs. Hierarchy, step numbering, mobile wrapping,
  exclusion counts, warning color, evidence, limitation, and footer remain
  legible without image assets.

## Review launch authorization

No Sol reviewer has been launched for PR-7G. The recorded sequence authorizes:

1. one comprehensive `sol_milestone_reviewer` launch at the Candidate above;
2. one and only one further comprehensive launch if Sol #1 returns
   `CORRECTIVE_REQUIRED` and Luna creates a corrected Candidate;
3. no automatic third launch.
