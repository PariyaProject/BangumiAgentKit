# Run #82 bounded MCP result view — current-master selection and implementation audit

- Audit date: 2026-10-04
- Base master: 03c83e86661ca53bcf86673003c6eb20e3e26b81
- Frontier policy: harness-v3.2-frontier-closure-v1
- Frontier hash at selection: eaffada8eee20d5765fe0d3b4f9b398e4118a8867d2fb928421f6f41d3fb1866
- Inventory at selection: 121 records, 99 actionable.
- Run #82 is ACTIVE; PR #84 is merged. PR #83 remains PARKED_FOR_HUMAN. This is a bounded selection delta, not a frontier-exhaustion claim.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

PR #84 improved the G04 / OP-001 mobile PersonActivityCard and retained PARTIAL status. G01's localized experimental-source and bounded-result caveats are already covered by earlier merged work. Community discussion remains out of scope because the current source contract does not authorize a third-party community feature. PR #83 remains parked on its existing branch and is not replaced or modified by this Epoch.

### 2. Capability maturity and complete user journeys

G04 asks for bounded recent voice-actor observations. G07 and G17 ask for the character/actor and staff evidence returned by a bounded subject overview. These services already calculate the values and explicit section coverage. All four relevant frontier records remain PARTIAL because current-source answer validation and client acceptance are not complete.

### 3. Agent UX, discoverability, and orchestration

Two isolated Antigravity CLI 1.2.14 public calls on the exact 496f66b source and catalog hash 26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e completed their exact target tools with exact arguments. The get_person_activity answer met the configured one-item upper bound, but tool_info.output was absent; resultReadbackAvailable=false and personActivityResultVerified=false. The get_subject_overview tool call completed with exact single-row caps, but tool_info.output was also absent and its result/answer check failed closed. These calls establish an MCP text-readback gap, not a failed Bangumi service call and not successful result-level Agent acceptance.

### 4. Renderer and Standalone information quality

PR #84 already corrected the selected person-activity mobile-card issue. Existing SubjectOverview Renderer evidence remains separate. This Epoch changes only the text representation at the MCP call handler; it does not change Renderer or Standalone output.

### 5. Correctness, evidence, degraded states, and resource bounds

ToolRegistry results contain identity, state, summary, coverage, raw labels, warnings, limitations, evidence, and bounded rows. The MCP handler previously placed the entire pretty-printed JSON result into a single text block without a text-size bound. The selected change keeps state and coverage explicit, distinguishes text-view omissions from service truncation, and preserves the original complete result in structuredContent. Missing CLI output is never converted to a success claim or a zero result.

### 6. Architecture, maintenance, and testability

The MCP handler has one in-process seam for formatting its response. A pure presenter now applies a deterministic 3600 UTF-8-byte text bound only when the full text result for bangumi.get_person_activity or bangumi.get_subject_overview exceeds that limit. The existing full JSON text path stays in place for small results and unrelated tools. MCP clients receive the unchanged full result as structuredContent when the compact path is used.

## Scope salvage and selection

Selected IMPLEMENTATION_READY: provide a compact answer-relevant text view for the two high-volume public semantic results while retaining the complete original structured result. The view preserves identities, states, summary counts, coverage, time windows, raw role and origin evidence, and explicit text-view omission counts. It does not change source requests, calculations, tool inputs, catalog schemas, or the parked PR #83 lifecycle.

Why not review earlier? The complete service results were already available, but the MCP text handler emitted large pretty-printed result objects. The two fixed current-source canaries completed their tools yet could not expose the result text to the bounded CLI report; reducing tool arguments to one row did not restore readback.

Why not extend further? Other tools and renderer artifacts have separate result shapes and need their own evidence. This Epoch changes only two known high-volume public reads, and does not change authentication, private data, writes, persistence, community sources, or QQ/TIM behavior.

## Implementation and validation

- Added apps/mcp/src/result-presenter.ts and routed successful tool results through it from apps/mcp/src/server.ts.
- Oversized person-activity and subject-overview text is compact JSON under 3600 UTF-8 bytes. It keeps partial/degraded states, coverage, relevant summary/rows, raw labels, and counts for source evidence or rows omitted only from the text view. The full original object is returned in structuredContent.
- Added tests/integration/mcp-result-presenter.test.ts, including in-process MCP Client readback and oversized partial fixtures. The tests confirm byte bounds, raw labels, omission counts, and exact full structuredContent preservation.
- Local validation passed: MCP package build; focused presenter and MCP runtime tests (2 files / 5 tests); typecheck; lint; unit/Renderer (74 files /473 tests); acceptance:check (96 direct, 65 public partial, 93 Agent/MCP, 33 auth pending, QQ/TIM 0/96); frontier:check (121 records /99 actionable); legacy-path guard; Prettier; and git diff --check.
- The earlier exact-candidate `get_person_activity` canary on 1974dc7 returned a 3190-byte MCP text result and a passing answer check, but its sanitized report parser found no flat coverage counters. It is diagnostic only; c4e8733 restored the established flat coverage field names.
- Compatibility review against the current-source subject-overview report parser found that it consumes `staff.items` and validates each bounded `staff.groups` entry through `memberIds`, with `count` equal to the number of IDs included in text. The projection now emits those fields, keeps the original service group count separately as `sourceCount`, and preserves the full result in `structuredContent`. Regression assertions cover the item/group links and source count. The code correction passed `pnpm --filter @bangumi-agent-kit/app-mcp build`, `pnpm vitest run tests/integration/mcp-result-presenter.test.ts` (4/4), `pnpm typecheck`, `pnpm lint`, and `git diff --check`.
- On exact source commit d6334c0 (full SHA `d6334c05d46372c9fe202043e0bc96c2b31fbe32`), CLI 1.2.14, and catalog hash `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`, the bounded `get_person_activity` probe's first attempt returned visible 3301-byte result text and passed its argument, result, and answer checks, but the CLI terminal status was `ERROR`; that attempt is not accepted and is preserved separately. A safe diagnostic retry returned `SUCCESS`: one exact target call, matched argument fields, visible result readback, parsed flat coverage (`115` observed relations, `1` selected, `114` dropped at the configured limit), and answer check passed. The returned result was partial with zero eligible/returned rows, which the answer described within the configured bound.
- On that same exact source/catalog/CLI, `get_subject_overview` for subject 218707 returned a successful exact target call and 3305-byte result text. Argument and answer checks passed; the report parser verified one cast row, one staff row with valid group/member ID links, one relation row, and partial/truncated coverage for each section. No answer prose or raw stream was stored in the report.
- On Candidate 33d9ee8, the exact `get_person_activity` result and coverage checks passed; its first answer omitted the person name, while a retry passed all checks. The exact `get_subject_overview` result, identity links, and named-value checks passed, but its answer was flagged for an unsupported completeness claim. These first-attempt reports are preserved separately and are not acceptance credit. The compact output already carried section states and truncation counts, but lacked one concise text-scope statement.
- The presenter now includes `mcpTextProjection.textViewScope` on normal and minimum fallback projections for both tools: only included rows are displayed, partial/truncated coverage is not a complete source list, and omission is not evidence of absence. Regression assertions verify the note remains present while the UTF-8 byte bound and full structured result are preserved. Focused validation passed: app-mcp build, presenter suite (4/4), typecheck, lint, and `git diff --check`; the final Candidate still needs both exact-source canaries.
- These two successful exact-source reports do not change the 93/96 Agent/MCP acceptance count or frontier status: G04, OP-001, G07, and G17 remain PARTIAL. The final Candidate must rerun both probes against its exact source SHA.
- No authenticated/account requests, writes, community requests, QQ/TIM activity, or client screenshots occurred.

## Final corrective for comparison text omitted

- The exact-Candidate Sol review found that `comparePreviousWindow=true` could lose the full comparison object when its repeated period coverage and summaries kept the text above 3600 UTF-8 bytes. This removed the recent/previous states, windows, delta, and peak from the minimum fallback.
- The presenter now projects a stable comparison core in both regular and minimum text views: comparison and period states/windows, observable period summary counts, delta state and available values, and peak state/metric/month. It caps role/media/exclusion/peak details, summarizes omitted coverage and list fields, and clips long period labels. Unavailable period counts and unavailable/not-computable delta or peak values remain omitted instead of being presented as zero.
- The size-reduction loop now lowers the comparison detail budget before reducing top-level month buckets and rows. The minimum fallback keeps the comparison core with no optional role/media/exclusion lists. The complete original result remains untouched in MCP `structuredContent`.
- Added MCP client regressions for a high-volume partial comparison, an observed partial comparison forced through the minimum fallback, and an unavailable comparison forced through the minimum fallback. All assert the 3600-byte ceiling and exact `structuredContent`; partial cases check retained period counts, delta values, and peak month, while unavailable counts remain absent. The focused presenter suite now passes 7/7.
- Local corrective validation passed on the working tree: `pnpm --filter @bangumi-agent-kit/app-mcp build`; `pnpm vitest run tests/integration/mcp-result-presenter.test.ts` (7/7); `pnpm typecheck`; `pnpm lint`; `pnpm test` (74 files / 473 tests); `pnpm test:integration:sqlite` (23 files / 80 passed / 1 skipped); `pnpm build`; `pnpm acceptance:check` (96 direct, 65 public partial, 93 Agent/MCP, 33 auth pending, QQ/TIM 0/96); `pnpm harness frontier:check` (121 records / 99 actionable); `pnpm harness guard:legacy-paths`; Prettier check; and `git diff --check`.
- The earlier fixed-argument CLI canaries on efdbed2 did not set `comparePreviousWindow`; they provide no comparison-mode evidence. Both public canaries must be rerun against the final corrective Candidate SHA. Those probes exercise the two exact-source public tools, not the comparison-specific fixture path.
- No authenticated/account requests, writes, community requests, QQ/TIM activity, or client screenshots occurred during the corrective.
