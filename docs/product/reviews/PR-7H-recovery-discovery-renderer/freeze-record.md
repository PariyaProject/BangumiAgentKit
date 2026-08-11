# PR-7H Recovery Freeze Record

Cycle: PR-7H Recovery — Evidence-Bearing Subject Discovery Presentation

Recovery Base SHA: `be89a2699ed7ccc85fc2e23718319bc57e1e16b6`

Implementation Frozen SHA: `de09c0ec3b0eab3325168ec7177b835dd25e9651`

Governance Record SHA: `f81333bb1ca3da936c8d91286d5bc84d4f760fd9`

Feature Branch: `codex/recovery-pr-7h-discovery-renderer`

Pull Request: [#4](https://github.com/PariyaProject/BangumiAgentKit/pull/4)

## Freeze gate

- TIER_2 Sol budget: `2 authorized / 2 consumed / 0 remaining`.
- Sol #1 `sol_milestone_reviewer`: `CORRECTIVE_REQUIRED`, 0 P0 and 2 P1;
  findings are recorded in `milestone-review.md` and closed in the frozen
  Candidate.
- Sol #2 `sol_milestone_reviewer`: `PASS`, 0 P0 and 0 P1; report:
  `sol-2-review.md`.
- Exact Candidate CI: [run 31496325070](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31496325070),
  successful on the exact frozen SHA across `provider-foundation`,
  `sqlite-default`, `host-integration`, `postgres-compat`,
  `standalone-release-smoke`, and `discovery-foundation`.
- Local gates passed against the corrected Candidate: build, typecheck, lint,
  full tests (33 files / 188 tests), contract (22), semantic (31), provider
  (33), discovery (9 files / 51 tests), renderer (6 files / 51 tests), SQLite
  integration (12 files / 33 tests), standalone (3 files / 18 tests), and
  OpenAPI verification.
- `git diff --check` passed and the Candidate worktree was clean.
- User/Agent QA, focused negative/end-to-end tests, and realistic degraded
  renderer QA passed at 640px and 960px. The original 14 visual outputs and
  four actual-engine degraded outputs are recorded under:
  `/Users/wuzhao/.codex/visualizations/2026/08/11/019ff0d1-278d-78f0-a85c-4e7d82a5d9f6/pr7h-recovery-qa/`.
- No unresolved P0/P1 blocker and no protected human-only decision remains.

## Frozen capabilities

- Evidence-bearing `discovery-results` ViewModel/card with truthful
  observed/matched/returned/rendered counts, total-kind semantics, bounded
  criteria, plan classifications, evidence count/source operations, coverage
  reasons, warnings, limitations, unknown fields, and degraded states.
- Trusted 12-item/12-image renderer cap for builder and caller-created
  discovery ViewModels, with explicit hidden/rendered accounting.
- `bangumi.render_query_subjects` Agent path reusing the bounded discovery
  schema and `DiscoveryEngine`/`ProviderRegistry` seam, with compact default,
  explicit `explain: none`, `auth: none`, `risk: read`, artifact output, and
  fail-closed registry behavior.
- Evidence provenance distinguishes planned operations from actual evidence
  source operations, including genuine unsupported/unavailable results.

## Security and scope boundary

No authentication, authorization, credential, cookie, write authority,
persistence, migration, release, Structured Web/HTML source, provider policy,
SSRF boundary, or PR-7G behavior changed.

## Known limitations and deferred recommendations

- Schema-valid month-only input is not yet displayed as a query facet.
- The renderer cap constant is duplicated between the trusted service and
  card defense-in-depth boundary.
- Future visual manifests could record Candidate SHA, generation command,
  fixture provenance, and hashes.

## Integration state

- Integration Policy: `AUTO_MERGE_AFTER_FREEZE`
- Target Base: `master`
- Recorded Base SHA: `be89a2699ed7ccc85fc2e23718319bc57e1e16b6`
- Integration state: `MERGED_GOAL_COMPLETE`
- Merge Commit SHA: `5e08fa6bc30b1a1a821806d8ffa0fda59bf1ad3f`
- Final Integration Record SHA: `PENDING_FINAL_INTEGRATION_RECORD`
- Target `master` after merge: `5e08fa6bc30b1a1a821806d8ffa0fda59bf1ad3f`
- Recovery feature branch was retired locally and remotely after frozen-SHA
  ancestry verification.
- Historical PR #3 was commented and closed as `SUPERSEDED`; its branch and
  history remain preserved as read-only provenance.

The frozen production implementation is exact SHA `de09c0e…`; subsequent
changes may only be governance metadata or the authorized master-side
integration lifecycle.
