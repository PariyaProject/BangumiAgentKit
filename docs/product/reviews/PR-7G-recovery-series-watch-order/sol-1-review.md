# PR-7G Recovery — Sol #1 Review

- Reviewer: `sol_milestone_reviewer`
- Agent ID: `019ff168-57d1-7332-bddb-7cd1ae01a286`
- Launch ordinal: `Sol #1 of 2`
- Launch time: `2026-08-11T15:19:45Z`
- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Candidate reviewed: `c9de0a46a1445650c6b2699f7c0cd35adf5daef5`
- Verdict: `CORRECTIVE_REQUIRED`
- P0 findings: `0`
- P1 findings: `3`
- P2 findings: `2`

The reviewer inspected `Base..Candidate`; later governance-only commits were
not treated as implementation changes. No protected human-boundary issue was
found. Sol #2 remains reserved for the corrected Candidate, and Sol #3 is
prohibited.

## P1-1 — preserve all safe direct seeds for deeper traversal

`packages/bangumi-core/src/services/series-service.ts` schedules a subject ID
once and seeds traversal from the first sorted direct relation row. If a direct
subject has both an after-root label such as `外传` and a valid `续集` label,
the first seed can be the side-story path. Its sequel child then has a mixed
`side_story → sequel` path and is excluded even though the homogeneous
`sequel → sequel` path is valid.

Acceptance: retain all relevant safe direct seeds or derive traversal from the
authoritative safe path; preserve alternate evidence; add duplicate-label
regressions proving valid all-sequel descendants remain ordered without
exceeding the traversal budget.

## P1-2 — make renderer display and asset caps authoritative

`packages/renderer/src/render-service.ts` accepts up to 24 related rows and 64
edges, while `SeriesRelationsCard.tsx` displays only 16 of each. At the valid
24/64 boundary the renderer silently hides evidence, keeps `complete`, emits
no omission warning, and still resolves hidden related images.

Acceptance: use one authoritative display cap, or normalize returned counts,
truncation flags/reasons, warnings, state, and omitted counts before asset
resolution. Add a regression for valid maximum 24-related/64-edge input.

## P1-3 — make renderer QA artifacts complete and internally consistent

The readiness packet claimed complete, partial, and not-computable artifacts at
both widths, but the generated set lacked complete and not-computable 960px
artifacts. The partial fixture also claimed six returned rows while containing
two, with `relatedEvidenceTruncated=true` despite a limit of 16.

Acceptance: generate and link service-consistent complete, partial/conflict/cap,
and not-computable fixtures at 640px and 960px; verify long CJK, missing
images, maximum valid evidence, and honest omission messaging; correct the
readiness claims.

## P2 findings

- Clarify the public `media: anime` description because non-anime rows remain
  in `edges` and exclusions while only `related` is filtered.
- Add focused root-relation failure coverage and establish its structured
  unavailable/error behavior.

## Verified evidence

- Exact-Candidate GitHub Actions run `31505310143` passed all six required jobs.
- Local focused review suite: 27/27 tests; full unit/render suite: 35 files,
  201/201 tests.
- `git diff --check` passed; the working tree was clean at review time.
- Catalog contained 49 tools; both new tools were no-auth, read-only, and
  schema-bounded. Existing SSRF, zero-network, write/auth, and request
  ceilings remained intact.

## Corrective review transition

`TIER_2`: `2 authorized / 1 consumed / 1 remaining`. Luna must create a new
clean Candidate and obtain exact-SHA CI before launching Sol #2 against that
new Candidate. Sol #3 remains prohibited.
