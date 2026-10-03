# Run 75 current-master frontier delta after PR #76

- Audit time: `2026-10-03T17:33:51Z`
- Audited master: `e606ac2431a930384d85c78715e5abfcde9ce3dd`
- Canonical frontier SHA-256: `e8aa9d170ed538ca75307d5fc1d95f71eb58cdc68f8ca7ef4d1af3cc6501433b`
- Policy: `harness-v3.2-frontier-closure-v1`
- Run: #75, `AUTONOMOUS_EVOLUTION`
- Inventory: 121 records; 22 DELIVERED, 30 PARTIAL, 2 RESEARCH_READY, 67 UNASSESSED; 99 actionable.

This delta follows the merge of G09's bounded scenario assessment. It is a selection audit, not frontier exhaustion. PR #76 advanced G09 from UNASSESSED to PARTIAL with current public-v0 evidence. Product review PASS retained P2 advisory `PR76-P2-COVERAGE-STATUS-LABEL-001`: the Renderer label “覆盖完整” can be read as complete franchise coverage without qualifying its declared traversal bounds. This advisory remains a separate G09 follow-up; it does not change G09 evidence or status.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- G04/OP-001 remain PARTIAL after PR #74; partial month/role values are now labeled as observations, with incomplete-distribution cases unavailable.
- OP-002 remains PARTIAL; G09's one series sample does not resolve franchise-wide canonical ordering.
- OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY because their source contract is incomplete. No HTML/community source is selected.
- OP-005 and the staff-collaboration opportunity require distinct staff/person semantics; they are not dependencies for a public cast answer.
- G09 is now PARTIAL, with the P2 status-label advisory retained. Do not fold that change into G06 because it is a different Renderer capability.

### 2. Capability maturity and complete user journeys

- G01's `next_action` still asks to localize experimental-source, estimated-total and pagination caveats, but merged tests and Renderer already cover them. Do not repeat.
- G02/G03/G14 have bounded current query evidence but the experimental search totals do not prove Bangumi-wide completeness.
- G04 and G05 implement bounded calendar-window observations/comparisons; neither proves full workload or historical trends. G05's catalog wording mismatch is a separate documentation task.
- G06, “少女终末旅行完整主要角色/CV。”, remains PARTIAL. Historical exact-source ToolRegistry evidence on the unchanged cast implementation returned 7/7 rows with 7 actor links, but was captured on the Run #69 candidate. The strict current-candidate Cast Agent/MCP and Artifact evidence was not retained after a local disk-space incident; role/main-support meaning and source completeness remain unproven.
- G07 has historical bounded staff evidence (100 rows across 22 raw labels) but answer-level role/person assertions and current strict Artifact evidence remain open. It is a separate staff-semantics objective.
- G06 has a safe positive-only scope: report the observed character/actor pairs and source relation labels; never imply that an observed response proves an exhaustive list or a universal main/support taxonomy.

### 3. Agent UX, discoverability, and orchestration

- The generic current acceptance matrix remains 96/96 Agent/MCP. This is not G06-specific natural-language answer evidence.
- The existing Antigravity/MCP probe can expose exactly one public tool, bind the public subject id, and record sanitized tool events. A fresh G06 `get_subject_cast` call can validate current tool routing/arguments, but it will not validate natural-language prose or QQ/TIM.

### 4. Renderer and Standalone information quality

- Run #69 added responsive SubjectCard/CastCard layouts at phone widths and reports 7 returned cast rows; the cast/actor links were rechecked against official-v0.
- Exact current-candidate CastCard Artifact readback and view-width evidence are still missing from the retained reports. A one-tool `render_cast_card` probe plus a service-emittable 360/720 CSS-pixel regression is a coherent G06 acceptance increment.
- The G09 “覆盖完整” label advisory remains separate and should be considered in a later G09-focused increment.

### 5. Correctness, evidence, degraded states, and resource bounds

- `get_subject_cast` preserves each character relation and actor list and reports `observed`, `returned`, `truncated`, schema-drift and invalid-actor-id counts. The previous exact-source sample showed 7/7 and valid actor links, but did not establish endpoint-wide completeness or a source pagination contract.
- The selected acceptance must preserve raw roles and coverage, include actor identity checks, and use bounded ToolRegistry/MCP reads. Missing actors or unknown roles must not be turned into fabricated CVs or negative completeness claims.
- No account state, private collection, write, OAuth, QQ or TIM interaction is necessary.

### 6. Architecture, maintenance, and testability

- Existing seams are sufficient: `CharacterService` → `getSubjectCast` → `buildCastCardViewModel` → `CastCard` / `render_cast_card`. Use them as-is; no provider, role taxonomy or graph abstraction is justified by this sample.
- A scenario-specific service-emittable test can connect the observed G06 envelope to actor identity, raw relation, coverage and Renderer caveats without production algorithm changes.

## Selection and scope salvage

Selected `IMPLEMENTATION_READY`: G06, narrowed to a current bounded character/actor observation and current-candidate Cast Agent/MCP + Artifact Renderer acceptance. Use exact public subject 218707 and preserve source-provided relation labels, actor IDs/links, returned/observed counts and truncation. The scenario remains PARTIAL because neither one response nor the official-v0 relation contract establishes an exhaustive main-character/CV set.

### Explicit non-scope

- A claim that the list is exhaustive or that every source role can be mapped into universal main/support categories: source evidence is bounded; preserve raw labels and report observed coverage.
- Staff-role classification and person-credit answer validation (G07/G17/OP-005): separate capability semantics.
- Real OAuth/account access, writes or destructive actions: `PB-AUTH-TRUST`.
- QQ/TIM client delivery, login, or screenshot claims: separate BGK-009 client acceptance; keep login passive.
- Community/HTML sources, broad crawling, or untrusted-content injection: `PB-BROAD-WEB` and the still-open community source contract.
- G09 status-wording advisory `PR76-P2-COVERAGE-STATUS-LABEL-001`: same general truthfulness concern but a distinct Relations template and scenario.

**Why not review earlier?** Run #69 had public source and mobile fixture results, but the retained record does not include the strict current-candidate cast Renderer/MCP proof and the strict report was lost during local disk exhaustion. A fresh bounded call plus scenario-specific regression connects the shipped CastService and CastCard to the current source without overstating completeness.

**Why not extend further?** Staff roles, G09 relation ordering, account collections and experimental search each use separate semantics or source contracts. Natural-language answer validation and real QQ/TIM are independent acceptance gates. Combining them would make the review cover unrelated capability and client boundaries.

No account, OAuth, credential, QQ/TIM, NapCat, write, or private-data action occurred during this audit. The direct and Renderer MCP calls, if run, are limited to public subject 218707 and one selected read/render tool each.

## Validation plan

- Reuse the locked standard-full source profile and current public subject 218707 for one `get_subject_cast` Agent/MCP call and one `render_cast_card` call; save only sanitized report fields and record the configured subject 218707 and exact selected tool; verify direct ToolRegistry input/coverage separately, noting that sanitized CLI event payloads omit actual MCP arguments/results; verify native Artifact readback.
- Add a service-emittable G06 regression that checks raw relation labels, character and actor identities, observed/returned/truncated coverage, and readable Renderer output at 360 and 720 CSS px.
- Run focused test, full Renderer, typecheck/lint, acceptance, tool-e2e, frontier check, adversarial preflight, exact Candidate CI, then one two-axis review. G06 remains PARTIAL and BGK-009 remains 96/288.

## G06 acceptance evidence on the selected source

- Current-source Antigravity/MCP `get_subject_cast` probe: one forced public read completed (`targetToolOutcome=TARGET_TOOL_COMPLETED`), CLI process exit 0, 65 valid stream events, zero invalid lines. Both the probe and catalog hash bind to `e606ac2431a930384d85c78715e5abfcde9ce3dd` / `118afc18439cb13dc9faec92e3cb560d54bbed058e4facb6369bec19ec224b60`. The sanitized report stores the configured subject ID 218707, not actual call arguments or the cast result rows; the fixed prompt requested limit=5. Do not treat this call as data-completeness evidence.
- Current-source Antigravity/MCP `render_cast_card` probe: one render call completed; native Artifact reference and readback verified, 720×1956 PNG, 203055 bytes, Renderer image revision e606ac2431a930384d85c78715e5abfcde9ce3dd. The temporary image was visually inspected and all seven displayed character/actor rows were readable without clipping. Image bytes remain outside Git.
- `BANGUMI_SUBJECT_CREDIT_LIVE=1 SUBJECT_CREDIT_ACCEPTANCE_DIR=<temporary> pnpm vitest run tests/integration/live-subject-credit.acceptance.test.ts` on exact source e606ac2431a930384d85c78715e5abfcde9ce3dd — 1/1 passed. Direct `get_subject_cast` used `{subjectId:218707, limit:100}` and returned 7 rows / 7 valid actor links, role labels 2 主角 and 5 配角, observed=returned=7, truncated=false. Its current CastCard Artifact measured 720×1960 and was visually inspected. The existing test also calls staff and subject-overview tools; those outputs do not change G07 or overview acceptance.
- Added `tests/render/subject-cast-g06.test.ts`; the focused run passed 1/1. It exercises `CharacterService` → `getSubjectCast` → CastCard ViewModel/Renderer from a service-emittable seven-row fixture, preserving raw main/support labels, actor IDs and bounded counts at 360/720 CSS px.
- `pnpm test:render` — 30 files / 129 tests passed. `pnpm typecheck`, `pnpm lint`, `pnpm acceptance:check` (37 validators; 96/96 direct execute, 65/65 public, 96/96 Agent/MCP; auth denial 22/22; account 33 pending, QQ/TIM 0/96), and `pnpm vitest run tests/integration/tool-e2e-acceptance.test.ts` (13/13) passed.
- `pnpm harness frontier:check` — valid, 121 records / 99 actionable, ledger hash `1a46f06e0c84d383eca77568ec7c0b2c0c59e22162701781083b761bbfe2da65`; G06 remains PARTIAL. `git diff --check` passed.
- The unchanged base `docs/research/user-scenario-catalog.md` already fails the repository's whole-file Prettier check; the G06 table-row update preserves the existing Markdown style. Newly added test, JSON report and audit report pass their formatting check.

No account, OAuth, credentials, writes, QQ/TIM, NapCat, or private collection data were used. This evidence does not validate natural-language answer prose, source-wide cast completeness, or client display.
