# PR-7G Sol #1 Review Record

Review tier: `TIER_2`

Reviewer: `sol_milestone_reviewer` agent `019ff01d-dfae-7d80-9d24-5cff183ecd8a`
(`Poincare`)

Launch accounting: milestone `1/2`; outer Goal `1/4`.

Reviewed implementation Candidate:
`3459689e69c8c14774d31a967b2161ed1e686a9d`

Verdict: `CORRECTIVE_REQUIRED`

The reviewer found no P0 issue and confirmed the recorded base, exact-Candidate
CI, branch ancestry, policy/tool metadata, Standalone paths, and the existing
resource and protected-boundary constraints. The Candidate is not frozen because
the following P1 findings affect semantic correctness, resource behavior,
coverage truthfulness, and renderer evidence:

1. Traversal currently merges labels by subject ID and follows every anime edge.
   Reverse or deeper labels can therefore change a direct recommendation, and
   `其他`/unknown/non-watch bridges can cross franchise boundaries. Preserve
   directed edge/path context; only stable watch-relation edges may expand;
   deeper or reverse evidence must not override direct root-relative placement.
   Clear recap placement must also remain consistent with the root.
2. `media: all` currently lets non-anime IDs consume the node cap and hydrates
   excluded books/music/etc. Keep the anime recommendation identical between
   `anime` and `all`; retain non-anime relation evidence without detail
   hydration or anime-cap consumption, and test exact request paths/counts.
3. Evidence and coverage are incomplete. Every attempted relation/detail path,
   or an equivalent bounded fetched-entity set, must be represented. Depth
   truncation must describe genuinely unvisited eligible coverage rather than
   visited back-edges, and the core suite needs duplicate, tie, root/read
   failures, mixed media, recap, reverse-edge, and cross-franchise fixtures.
4. The renderer does not display `related` evidence and excluded samples omit
   raw labels/reasons. Add bounded readable relation evidence and verify 640px
   and 960px output for long CJK, missing images, partial, and not-computable
   states.

Correction state: `CORRECTIVE_REQUIRED`.

Next action: implement the four P1 corrections, create a new exact Candidate,
refresh local and visual QA plus mandatory remote CI, then request the one
remaining authorized Sol #2 review. No third launch is authorized.
