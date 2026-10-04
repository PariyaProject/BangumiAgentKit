# Run 82 current-master frontier audit and selection

- Audited master: `496f66b2578c0148842aeb648ad341c5d8b91ec6`
- Audit time: 2026-10-04T01:39Z
- Discovery policy: `harness-v3.2-frontier-closure-v1`
- Canonical frontier hash: `b5f0d778f8b94a5bcc6aa94b47ae8efa4078c007927fe939424e1e753fa29162`
- Inventory: 121 records; 22 DELIVERED, 30 PARTIAL, 2 RESEARCH_READY, 67 UNASSESSED; 99 actionable.
- Current 96-tool evidence after Run #82 probe regeneration: 96/96 direct execute, 65/65 applicable public probes (partial evidence), 95/96 Agent/MCP, 33 auth/account pending, QQ/TIM 0/96. The current-source person-activity and renderer calls count; the SubjectOverview call failed closed because result readback was absent.

This is a bounded selection audit, not a frontier-exhaustion claim. The ledger
has 99 actionable records. Run #78's final Product review budget was exhausted
after PR #81 merged, so Run #82 began with fresh budgets and no active Epoch.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- OP-001 Voice Actor Workload remains bounded/partial; current relations and
  selected subject details do not prove a full career total or historical
  workload.
- OP-005 Subject Staff Intelligence and OP-008 Subject Intelligence Overview
  have existing official-v0 capabilities, but the scenario ledger still keeps
  G07/G17/G08 partial where current-source answer and client evidence is absent.
- OP-003 Community Discussion Spike and
  `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY; the Run #78 source
  contract found no safe variant for the reviewed public community source.
  No HTML/community path is selected here.
- Collection and personalization opportunities require account data or real
  authorization for useful end-to-end evidence. The OAuth client ID and secret
  are absent from the local mode-0600 environment; those paths remain external
  gates.

### 2. Capability maturity and complete user journeys

- G04, G07, and G17 are PARTIAL and map directly to the three stale
  catalog-bound Agent/MCP reports: `get_person_activity`,
  `get_subject_overview`, and `render_subject_overview`.
- Current public ToolRegistry evidence already covers the same three tools,
  but does not establish that an Agent selects them correctly or describes
  their bounded results truthfully.
- G06/G08/G09 have separate cast, statistics, and relation requirements. This
  Epoch will not promote them based on a generic overview call.

### 3. Agent UX, discoverability, and orchestration

- At selection, the acceptance table counted 93/96 Agent/MCP tools; the three
  rows were bound to a prior tool-catalog contract. Current-source regeneration
  now counts two of those tools, leaving SubjectOverview as the sole pending
  Agent/MCP row (95/96).
- The current generated catalog SHA-256 is
  `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`.
- PR #81 aligned `get_subject_overview` and `render_subject_overview`
  descriptions with the bounded raw-role contract. The current tool
  descriptions require answer-level checks for `get_person_activity` and both
  overview tools; old model calls do not satisfy those checks.

### 4. Renderer and Standalone information quality

- PR #81 now qualifies complete overview sections as `本次范围内完整` and
  explains that staff rows retain Bangumi's raw relation labels. The Run #82
  current-source renderer call returned and read back its ArtifactRef; the
  generated 720x5366 public card was inspected locally. No QQ or TIM display
  acceptance is claimed.

### 5. Correctness, evidence, degraded states, and resource bounds

- `pnpm harness frontier:check` validates 121 records / 99 actionable at the
  audited base. Frontier records G04/G07/G17 remain PARTIAL until current
  model evidence is added, and will remain PARTIAL afterward because source
  exhaustiveness and real clients are separate questions.
- The final three probes are fixed to public read/render tools and bounded
  parameters. Reports must preserve the actual tool name, successful call
  state, answer validation flags, and exact catalog hash while omitting answer
  prose, raw arguments, credentials, private data, and image bytes.
- The isolated CLI omitted `tool_info.output` for both bounded read probes.
  Person activity still passed the exact call, argument, and one-row answer
  checks with `resultReadbackAvailable=false`; it does not establish the
  returned count independently, and G04 remains PARTIAL. SubjectOverview
  failed closed with `ANSWER_OR_TOOL_RESULT_UNAVAILABLE`; it does not establish
  returned identity or raw role labels. Keep G07/G17 PARTIAL. Do not rerun
  either read probe until a concrete telemetry or output-size change exists.
- The local BangumiAgentKit `.env.local` has no OAuth client ID or secret. No
  OAuth URL or account request is needed for this Epoch.

### 6. Architecture, maintenance, and testability

- The two cross-cutting architecture, maintenance, and testability records
  are DELIVERED. Run #81 also added a duplicate-source-reference guard and its
  regression; no new data-service abstraction is justified here.
- PariyaAgent's isolated Agent/MCP probe now has a fixed-argument
  `get_person_activity` verifier. It checks the named public person, returned
  12-month boundaries, actual `uniqueSubjects` count when readback exists,
  bounded coverage, and unsupported career/workload claims while retaining
  only boolean flags and coverage counts. With the explicit no-result fallback,
  `python3 -m unittest tests.test_probe_bangumi_tool -v` passed 37/37 and
  `python3 -m py_compile scripts/probe-bangumi-tool.py tests/test_probe_bangumi_tool.py`
  passed. The uncommitted user-owned files remain unstaged. Their SHA-256 at
  probe time was `e05fc534e7511a577de554d646b22c896ef771257ed29c27e32e646d4c81bf67`
  for the probe and `5adc5b40d23914d293c44a2171267415356efd77d518b8b42cd88a35bdae6d16`
  for its tests.

## Selection and scope salvage

Selected `IMPLEMENTATION_READY`: regenerate exact-current-source Agent/MCP
evidence for the three stale public tools. The bounded calls are complete, but
the readback gap prevents full acceptance for SubjectOverview. G04/G07/G17
evidence references are advanced while preserving PARTIAL status. The G04
answer verifier and its result-readback limitation are documented in the
sanitized report; the local probe/test hashes are recorded above, and no
PariyaAgent user-owned file was staged or committed.

### Why this work was not reviewed earlier

The prior accepted reports were generated against earlier tool descriptions.
PR #81 changed the two SubjectOverview descriptions, and the current matrix
correctly left those reports unchecked. The activity report is also stale
against the exact current catalog contract. Re-running the three fixed public
calls on the merged source is required before the table can return to 96/96.

### Why the scope does not extend further

This Epoch does not run the other 93 already-current Agent/MCP reports again.
It does not infer all Bangumi fields from one tool call, test authenticated
collections, perform writes, scrape HTML/community content, scan QR codes,
observe QQ login, send messages, or claim QQ/TIM client delivery. Those paths
have separate source, authorization, or client evidence requirements.

### Probe boundaries

- Source revision: `496f66b2578c0148842aeb648ad341c5d8b91ec6`.
- Tool catalog SHA-256:
  `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`.
- Person activity: one fixed public person and one `get_person_activity`
  call (`maxRelations=1`, `maxSubjectDetails=1`, `maxRows=1`), with answer
  validation that distinguishes the one-row bound from a complete career
  total. When CLI telemetry omits the result, the report records that limit and
  does not claim the returned count was independently read back.
- Subject overview: public subject 218707 and one `get_subject_overview`
  call (`maxCast=1`, `maxStaff=1`, `maxRelations=1`). The exact call and
  bounded arguments completed, but absent telemetry output caused its
  identity/raw-label/scope scenario to fail closed.
- Overview image: the same public subject and one `render_subject_overview`
  call, with native Artifact readback and local visual inspection.
- No OAuth/account data, write tools, QQ/TIM actions, raw answers, or image
  bytes enter the committed reports.

## Exact current-source outcomes

All three sanitized reports bind to source revision
`496f66b2578c0148842aeb648ad341c5d8b91ec6` and catalog SHA-256
`26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`.

| Tool                              | Report                                                                                                    | Outcome                                                                                                                         | Report SHA-256                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `bangumi.get_person_activity`     | `docs/live-probes/pariya-agent-full-public-qa-e2e-run82-get-person-activity-2026-10-04.json`              | Exact call/args and bounded answer checks passed; native MCP output was omitted, so returned count was not read back.           | `7008acecbf7bbea38cd9a5ac55744e9383da296312dee160c37a080fcc88b818` |
| `bangumi.get_subject_overview`    | `docs/live-probes/pariya-agent-full-public-qa-e2e-run82-get-subject-overview-218707-2026-10-04.json`      | Exact call/args completed; missing output made the scenario fail closed.                                                        | `4625bdf5935b4b3c1dbc2940323d256b8f079cd1cf38a95fe2a001b980a7b355` |
| `bangumi.render_subject_overview` | `docs/live-probes/pariya-agent-full-renderer-qa-e2e-run82-render-subject-overview-218707-2026-10-04.json` | Exact call, ArtifactRef, native readback, answer checks, and local visual inspection passed; PNG was 720x5366 and 807384 bytes. | `db5698e9e4bd243f36ccfaa64d9ca5fb68fa845999f92e1d84197d3616ca9741` |

### Non-passing telemetry diagnostic

Two debug reruns for `get_subject_overview` are recorded separately in
`docs/research/run82-subject-overview-cli-telemetry-diagnostic-2026-10-04.json`
and do not count toward acceptance. CLI 1.2.8 and QA-only CLI 1.2.14 both
observed zero MCP output bytes, plus two `view_file` calls with 21-byte
completed outputs each. The diagnostic intentionally omitted their paths and
contents, so it cannot establish what those auxiliary reads accessed. The
SubjectOverview result remains unverified; investigate the CLI's native
file-tool scope and telemetry before another read-probe attempt.
