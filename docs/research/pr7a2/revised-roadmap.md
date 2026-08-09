# Revised PR-7 roadmap

## 重新排序

| 阶段           | 目标                                                 | 依赖                                              | 退出条件                                                            |
| -------------- | ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| PR-7A2（本轮） | Source-of-truth、S1/S2/S3/S5/S6/S7 map、103 coverage | research only                                     | 19 docs、证据/风险/errata ready                                     |
| PR-7B          | Provider/evidence foundation                         | S1/S2 operation contracts、source envelope        | official providers、field-level provenance、negative fallback tests |
| PR-7C          | Unified discovery/query planner                      | S1 search/browse、S7 concept/filter model         | exact/ambiguous/partial query result，no legacy deleted search      |
| PR-7D          | Subject/person/staff/cast graph                      | S1 relations/persons/characters、S7 normalization | cast/staff/person workload raw graph + deterministic formulas       |
| PR-7E          | Calendar + personal schedule                         | S2 Calendar + S1 episodes/auth collections        | Calendar classification、timezone、auth/private renderer states     |
| PR-7F          | Snapshot/freshness/change detection                  | S6 schema、scheduler、rate/terms review           | 7-day trends only with compatible snapshots；not-computable path    |
| PR-7G          | Gated structured website provider                    | S3 contract probe、terms/privacy review           | feature flag、GET allowlist、circuit breaker、schema drift tests    |
| PR-7H          | Isolated HTML provider                               | S5 allowlist、DOM fixtures、stats parser review   | stats/community fallback only；parser change stops safely           |
| PR-7I          | Renderer 2.0                                         | shared evidence/state model                       | all 12 views express partial/stale/auth/conflict/unavailable        |
| PR-7J          | Community intelligence                               | S3/S5 + S6 + policy review                        | counts/links first；body text/summaries remain opt-in               |

## Why structured web precedes HTML

Official frontend S3 currently supplies typed JSON for many page capabilities and is cheaper to validate than DOM parsing, but it is private/internal and therefore gated. HTML remains necessary for some stats and old-page evidence, yet its coupling, legal and operational risk argue for an isolated later phase. This is a sequencing decision, not a claim that S3 is permanently stable.

## Non-goals retained

No built-in LLM, no production runtime redesign in PR-7A2, no automatic community crawling, no auth bypass, no history inference without snapshots, no v0.1 tag decision from this research alone.

## Acceptance model

Each future phase must demonstrate:

1. The source class and public/private contract are named.
2. Query/filter/auth scope is serialized and returned.
3. Missing, stale, partial, conflict and not-computable states are tested.
4. Source links, retrieval time, parser/schema version and coverage are retained.
5. Provider failure is isolated and does not silently change semantic meaning.
