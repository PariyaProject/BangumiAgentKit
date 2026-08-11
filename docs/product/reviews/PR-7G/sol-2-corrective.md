# PR-7G Sol #2 Review Record

Review tier: `TIER_2`

Reviewer: `sol_milestone_reviewer` agent `019ff04c-276c-7aa0-8728-311142ababed`
(`Aquinas`)

Launch accounting: milestone `2/2`; outer Goal `2/4`.

Reviewed Candidate:
`08e1c4bc14269b110c24b4694819b652284aae46`

Reviewed base: `23f960ce3a8a8ac3841b791061a648037a53ab19`.

Exact Candidate CI: [GitHub Actions run
31480599124](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31480599124),
all six mandatory jobs green.

Verdict: `CORRECTIVE_REQUIRED`.

No P0 finding and no protected human boundary were found. Sol #2 confirmed the
Candidate ancestry, exact CI, local validation, visual artifacts, and bounded
official-v0 request ceiling. The following P1 findings remain:

1. Conflicting direct `前传` and `续集` labels are accepted as an orderable
   node and the prequel priority silently wins. Contradictory evidence must be
   represented as a conflict/partial state and excluded from ordered steps
   unless a truthful deterministic rule is established.
2. Traversal pays for depth but only direct root candidates enter the order;
   deeper anime nodes are always `depth_evidence_only`, while Renderer output
   drops directed `fromId`/path context. Preserve directional paths and include
   safely composable bounded prequel/sequel chains without allowing reverse or
   cross-franchise edges to override root-relative semantics.
3. The public `media` and `maxNodes` contracts are not aligned with behavior.
   `media` is only echoed in coverage, `related` can exceed the documented
   node bound, and a capped anime can disappear without identifiable bounded
   evidence. Define distinct media semantics, align the cap contract, and keep
   every exclusion reason identifiable.
4. The 64-edge evidence cap is silent. When it clips observed edges, coverage
   must report the cap and become partial; add a regression fixture over the
   edge limit.

Non-blocking P2 notes: avoid resolving hidden related images, make
not-computable warning classification semantic rather than index-based, and
correct the readiness packet's renderer test count from 45 to 46.

Freeze recommendation: do not Freeze or integrate this Candidate. The
milestone's two-launch review budget is exhausted, so the direction is parked
as `PARKED_REVIEW_LIMIT`; no third Sol launch is authorized. The outer
`AUTONOMOUS_EVOLUTION_TIER2` Goal remains active and may return to discovery
for an independent safe milestone while this direction stays parked.
