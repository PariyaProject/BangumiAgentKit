# PR-7D Freeze Record

Cycle: PR-7D Person / Seiyuu / Staff Intelligence

Base SHA: `9ae07d5a8ad5517da5dc9c33a999e174e71a86c9`

Implementation Frozen SHA: `84e32b3366c62346e14d154bb740fb5c480e96f9`

Governance Record SHA: `25c9eec507620c2d30a4b7482518666aad87c042`

## Freeze gate

- `sol_code_reviewer`: PASS
- `sol_product_reviewer`: PASS
- Mandatory exact-head CI: [run 31345745611](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31345745611),
  successful across `sqlite-default`, `host-integration`, `standalone-release-smoke`,
  `postgres-compat`, `provider-foundation`, and `discovery-foundation`.
- Local implementation gates: typecheck; 158 unit/render tests; 16 standalone tests;
  22 contract tests; 31 SQLite integration tests; lint; OpenAPI verification; focused
  PR-7D tests 42/42.
- Candidate tree was clean at review time.
- No unresolved P0/P1 blocker and no protected human-only decision was implemented.

## Frozen capabilities

- Bounded official-v0 person profiles with identity, Chinese display names, aliases,
  infobox data, career labels, parsed identity fields, stable-ID counts, evidence, and
  explicit unknown freshness.
- Separate production-staff and cast views with raw relationship labels, independent
  caps, partial coverage, and canonical unique member IDs.
- Backward-compatible existing person reads, Standalone routes, semantic tool schemas,
  and bounded PersonProfile rendering at narrow widths.
- Human-readable bilingual identity, career, gender, and bounded biography summaries;
  full semantic summaries remain available upstream of the renderer.

## Known limitations

- Official-v0 relationship payloads do not support recent-work ordering, date-window
  workload, historical trends, or collaboration counts; these remain explicitly
  not-computable.
- Partial cards could surface sample qualification closer to the KPI row, and media
  labels could be more localized. These are non-blocking polish items.

## Deferred opportunities

- Date-backed VoiceActorWorkload and historical snapshots.
- Current/recent person work ordering and collaboration graphs.
- A future calendar/schedule intelligence cycle, selected as PR-7E after this freeze.

## Human-review queue

No human-review item was created. The cycle used only read-oriented official sources and
did not change authentication, authorization, SSRF, credentials, write authority, or
release behavior.
