# PR-7H Sol #1 Review

Reviewer: `sol_milestone_reviewer` — `Russell`

Agent ID: `019ff073-7b21-79b3-ae85-6e10676edb96`

Verdict: `CORRECTIVE_REQUIRED`

Review scope: Base `23f960ce3a8a8ac3841b791061a648037a53ab19` through exact
implementation Candidate `8dd069a0e700161d5a484af378b0ec9eb10e395c`.

## P1 findings

1. The card used `coverage.matched - renderedItems` as its card-hidden count.
   The discovery engine distinguishes `matched` from output-capped `returned`,
   so a top-10 query with 50 matches and 10 returned items could claim that 40
   complete structured rows were merely hidden. Corrective behavior must use
   `result.items.length - renderedItems.length` for card-hidden rows and present
   `matched - returned` separately as observed-but-not-returned candidates,
   without claiming their full facts are available.

2. Schema-valid maximum criteria could create an impractically tall card. The
   shared schema allows 50 tags, meta-tags, and exclusions with 120 characters
   each, while the builder joined and the template rendered all values. The
   corrective must add deterministic per-group/value/character display
   ceilings, disclose omitted criteria counts, and clamp the exported builder
   item override to the documented 12-item maximum.

3. Required Renderer state-matrix visual QA was incomplete. The Candidate only
   rendered the partial fixture at both widths; unsupported and unavailable
   cases had static-HTML assertions but no PNG evidence, and the supplied
   artifacts did not cover complete, empty, unavailable, long-CJK, or maximum
   criteria cases. The corrected Candidate must generate and inspect the full
   complete/partial/unsupported/unavailable/empty/long-CJK/max-input matrix at
   640px and 960px with reproducible artifact provenance.

## P2 findings

- `coverage.reason` was retained but only rendered when hydration activity was
  present; output-cap and non-hydration budget reasons need equivalent display.
- The card exposed raw internal tokens such as `searchSubjects`, `exact`, `in`,
  `range`, `desc`, and warning codes while much supporting text was 10px.
  Controlled human labels and stronger secondary typography would improve
  CJK/chat usability.

## Verified evidence

- Base is the Candidate merge base and Base..Candidate is exactly one
  implementation commit.
- Current `HEAD` advanced to `e428cd9` during review; post-Candidate commits
  modified governance documentation only.
- PR-7H was recorded as TIER_2 with milestone Sol `2 / 1` and outer Sol `4 / 3`.
- [Exact Candidate CI run 31483703874](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31483703874)
  passed all six mandatory jobs.
- Reviewer reruns were green: typecheck, lint, 183 unit/renderer tests, 50
  discovery tests, 46 renderer tests, focused 7 tests, and OpenAPI/catalog
  verification.
- No protected human-only boundary was crossed.

## Corrective authorization

Luna may correct all findings within the existing PR-7H milestone budget. This
is Sol #1 of at most two; the final PR-7H Sol #2 launch requires a new clean
Candidate, fresh local validation, and exact-SHA remote CI. Sol #3 is
prohibited.
