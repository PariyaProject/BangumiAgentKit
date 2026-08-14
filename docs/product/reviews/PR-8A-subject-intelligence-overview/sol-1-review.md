# PR-8A — Sol #1 Milestone Review

Status: `COMPLETED_CORRECTIVE_REQUIRED`

## Runtime identity

- Reviewer: `sol_milestone_reviewer`
- Agent ID: `019ffe30-5db9-7950-b4b0-eeb4e5238067`
- Launch ordinal: `Sol #1 of 2`
- Milestone budget at launch: `2 authorized / 1 consumed / 1 remaining`
- Outer budget at launch: `4 authorized / 1 consumed / 3 remaining`
- Review Candidate: `aeb2b34d127e49dbe09f81ce80b0b53873ff1a3c`
- Completion observed: `2026-08-14T03:04:55Z`
- Verdict: `CORRECTIVE_REQUIRED`
- Severity: `P0 0 / P1 4 / P2 3 / P3 0`

The reviewer inspected the actual Base..Candidate snapshot and confirmed that
later commits only contain governance metadata. The Candidate was not frozen.

## P1 findings

### P1-1 — Nested actor output is not resource-bounded

`packages/tools/src/subject-overview.ts` caps character rows but maps every
actor for every character. The upstream schema does not bound the nested
`actors` array. The reviewer probed `maxCast: 1` with one character containing
1,000 actors and observed all 1,000 actors in the semantic result.

Acceptance: impose and document a deterministic per-character or total
actor-reference cap, expose truncation/coverage truthfully, and add an
oversized nested-actor negative test.

### P1-2 — Successful section evidence has pre-dispatch timestamps

The implementation captures `retrievedAt` after only the root subject request,
before the four section operations are dispatched, then reuses that timestamp
for cast, staff, and relations. This asserts retrieval before those operations
occurred.

Acceptance: record each operation's attempt before dispatch and retrieval only
after successful completion, or propagate authoritative provider/transport
timestamps. Add a delayed-section ordering test.

### P1-3 — Stats failure states and accounting are inconsistent

Provider states such as `auth_required` and `permission_denied` are not
explicitly mapped. Every state except `unavailable` is counted as a successful
source request. Unavailable stats may have no stats evidence, and an
`upstream_error` evidence object can have neither `attemptedAt` nor
`retrievedAt`.

Acceptance: exhaustively map provider states; count success only when the
source operation actually succeeds; emit `attemptedAt` evidence for every
attempted failure; never emit `retrievedAt` without retrieval. Add negative
tests for unavailable, upstream error, authentication/permission failure,
not-computable, and provider absence.

### P1-4 — Required visual-state QA is incomplete

The Cycle Plan requires complete, partial, unavailable/not-found,
missing-image, long-CJK, and dense fixtures at both 640px and 960px. The
existing evidence only covers one partial/no-image dense fixture at both
widths; unavailable is checked only as HTML and the PNG test only uses the
narrow width.

Acceptance: render and inspect realistic complete, partial,
unavailable/not-found, missing-image, long-CJK, and dense cases at both widths,
with evidence identifying the corrected Candidate.

## P2 findings

- Staff groups are keyed by normalized `relation`, not the retained raw label;
  either group by raw labels or disclose normalization.
- The card silently drops warnings after four and limitations after three
  without indicating hidden entries.
- Review metadata still showed zero Sol launches consumed even though policy
  counts the launch when it starts; the ledger must record `1 / 2` milestone and
  `1 / 4` outer consumption.

## Verified evidence

- Mandatory CI run
  [31764720966](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31764720966)
  passed all six jobs on the reviewed Candidate.
- Targeted rerun passed 3 files / 20 tests covering semantic overview,
  renderer, and Standalone.
- `git diff --check` passed and the worktree was clean at review time.
- Changes are additive and preserve existing tool/template shapes. No
  protected security, credential, write, source-expansion, migration, or
  release boundary was crossed.
- The journey has strong user and Agent value; the inspected partial-state
  card had good hierarchy, density, CJK wrapping, and chat readability.

## Required next state

Do not freeze `aeb2b34`. Correct all four P1 findings and the safe P2 findings,
create a new exact Candidate, rerun affected/full validation and the complete
visual matrix, obtain green exact-SHA CI, then use the remaining comprehensive
Sol #2 gate. Sol #3 is prohibited.
