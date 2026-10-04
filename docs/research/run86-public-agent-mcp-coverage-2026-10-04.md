# Run #86 public Agent/MCP acceptance coverage

- Epoch: `current-public-agent-mcp-coverage`
- Base master: `db7d2d0d92c81f1876333debf74bfeea5aed5e19`
- Frontier policy: `harness-v3.2-frontier-closure-v1`
- Frontier hash at selection: `be122565eb5950903cd0dfa35639de6a0b136341b899f9b7832d680b9ff6f3d6`
- Catalog SHA-256: `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`

## Six-lane selection delta

1. **Recorded opportunities and deferred work.** PR #85 merged the bounded person-activity and subject-overview MCP text fix. PR #83 remains parked for human review. Community-source expansion remains out of scope.
2. **Capability maturity and user journeys.** At selection, the generated per-tool acceptance table had 93/96 Agent/MCP rows. The only unchecked public read/render tools were `bangumi.get_person_activity`, `bangumi.get_subject_overview`, and `bangumi.render_subject_overview`; G04, G07, and G17 remain PARTIAL. After adding the three reports below, the generated table reaches 96/96.
3. **Agent UX and discoverability.** The exact-source CLI 1.2.14 reports for the first two tools on `5101d1bf10920b8bb3f6e1a556cff453193e9e50` already pass their argument, visible-result, and answer checks. Their compact outputs were 3451 and 3455 UTF-8 bytes. The reports are reused, not rerun.
4. **Renderer and standalone experience.** The tracked subject-overview renderer report uses source `1056e0c16e8365cd8c71737ff9f2d1536e289fa5` and catalog `bd345ea3f4d2d3e85b1ba5229877ab3589d56b1d9e17987773fca93c2da45312`; it does not prove the current tool contract. One fresh current-source renderer-profile call is required.
5. **Correctness, evidence, degraded states, and resource bounds.** All three result paths must stay explicit about partial/truncated coverage. A bounded sample is not a complete Bangumi list. Renderer answer acceptance additionally requires a verified PNG, an explicit partial staff-coverage phrase, and no unsupported completeness claim.
6. **Architecture, maintenance, and testability.** The existing catalog-bound Agent/MCP report generator and `tests/integration/tool-e2e-acceptance.test.ts` provide the evidence-validation seam. The Epoch extends that test for the current subject-overview renderer report and leaves source calculations and tool schemas unchanged.

## Current-source evidence

- `pariya-agent-full-public-qa-e2e-get-person-activity-2026-10-04.json` reuses the successful CLI 1.2.14 report on source `5101d1bf10920b8bb3f6e1a556cff453193e9e50`: one exact target call, visible result readback, passed answer check, 3451 bytes. The result remains PARTIAL with 115 relation rows observed, 1 selected, 114 dropped, and 0 eligible/returned rows.
- `pariya-agent-full-public-qa-e2e-get-subject-overview-2026-10-04.json` reuses the successful CLI 1.2.14 report on the same source: one exact target call, visible result readback, passed answer check, 3455 bytes. Cast, staff, and relation sections are partial/truncated at their configured one-row limits. A prior same-source attempt failed the completeness answer check, so only the successful retry receives credit.
- `pariya-agent-full-renderer-qa-e2e-render-subject-overview-2026-10-04.json` records one current-source CLI 1.2.14 call against `db7d2d0d92c81f1876333debf74bfeea5aed5e19`. The exact target completed; the 720x5366 PNG was created and read back; the answer check disclosed partial staff coverage and reported no unsupported completeness claim or Markdown formatting.
- All three reports use the current catalog SHA above and contain no prompt/answer prose or credentials. No QQ/TIM action or authenticated request occurred.

## Acceptance boundary

The three rows gain current Agent/MCP evidence, but G04/G07/G17 remain PARTIAL. `pnpm acceptance:check` passes with 96/96 direct, 65 public partial, 96/96 Agent/MCP, 33 auth/account pending, and QQ/TIM 0/96. The focused `tests/integration/tool-e2e-acceptance.test.ts` suite passes 13/13; `pnpm test` passes 74 files / 473 tests; `pnpm typecheck` and `pnpm lint` pass. The refreshed frontier hash is `58fc81a3d1522d14104251be127551c07d69244e7f051dba36063452f721f2d2` with 121 records and 99 actionable; all G04/G07/G17 statuses remain PARTIAL. The generated acceptance Markdown is validated by `pnpm acceptance:check`; Prettier is checked on the integration test, frontier JSON, and this audit report.

These public canaries establish bounded current-source Agent/MCP readback and answer quality; they do not establish exhaustive source coverage, historical workload, real-account behavior, or QQ/TIM delivery. The 65 public API rows remain partial, 33 auth/account paths remain pending, and QQ/TIM remains 0/96.
