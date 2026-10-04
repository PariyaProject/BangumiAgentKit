# Run 89: bounded subject-cast Agent/MCP answer

- Epoch: `subject-cast-mcp-bounded-answer`
- Discovery base: `937488cd88623a3aa201a4838bdfe4a4791a557e`
- Frontier policy: `harness-v3.2-frontier-closure-v1`
- Frontier hash at selection: `4cd83b92ad0ea14aa195ee81dfd6cb83cc6715196d8e784c3b3102ee1bcbffb2`
- Selected frontier: G06

## Scope and scope salvage

G06 asks for the main characters and CVs of 少女终末旅行. The safe bounded question is: “Which character/actor links and raw relation labels appear in this response, and what does the response not establish?” One official-v0 `get_subject_cast` call for subject 218707 can establish only the rows it returns. It cannot establish endpoint-wide completeness, a universal main/support taxonomy, or the absence of an unshown character or actor.

This Epoch adds a compact MCP text view for oversized `bangumi.get_subject_cast` results. It keeps source row identity, exact relation labels, returned actor identities, and explicit coverage/omission counts under 3,600 UTF-8 bytes while preserving the full `structuredContent`. The current-source CLI answer check requires exact row-separated relation/character/actor associations and an omission-not-absence statement.

The one exact-candidate public Agent call completed on 2026-10-04 against Candidate A `fc59f8c05cae0a03f751bc26c221dbe34147d1d3`, catalog SHA `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`, and CLI 1.2.14. The only completed Bangumi call was `get_subject_cast` with subject 218707 and limit 100. It returned 7 rows, of which 4 rows were included in a 1,373-byte text projection and 3 were explicitly omitted. The natural-language answer matched all 4 visible character/actor pairs and raw relation labels; the bounded-coverage and omission-not-absence checks passed, with no unsupported completeness/absence claim or Markdown. The sanitized report is [`run89-g06-cast-agent-canary-2026-10-05.json`](run89-g06-cast-agent-canary-2026-10-05.json).

The Antigravity CLI event stream exposes the MCP text content but not a separate `structuredContent` field. Therefore this report does not claim a live full-object readback. The exact-candidate integration regression independently verifies that the MCP response's `structuredContent` remains equality-wise identical to its full 100-row input fixture; the live Agent check validates the visible text projection. This distinction is recorded in the sanitized report. No second public call was made.

## Six-lane discovery delta

1. **Recorded opportunities and deferred work.** G06 remains PARTIAL. PR #90 recently advanced the separate staff path for G07/G17 and OP-005; this Epoch focuses only on `get_subject_cast`. OP-003 / `SOURCE-COMMUNITY-STRUCTURED-WEB` has a same-day source-contract finding of no safe third-party variant: the public v0 contract does not expose community topics/comments, while observed `/p1` endpoints belong to the website's private authenticated API. No community request or HTML fallback is authorized. `SOURCE-OFFICIAL-STATS-HISTORY` is already DELIVERED.
2. **Capability maturity and user journeys.** The earlier G06 report records one official-v0 sample of 7 character rows and 7 actor links and a readable CastCard. It does not establish a current text-only Agent answer; the old forced call requested limit 5 and retained neither actual tool arguments/results nor answer prose. G08's statistics answer, G15's comparison, and G09/G20's relation paths remain separate questions; G20 overlaps the already-bounded G09 graph.
3. **Agent UX and discoverability.** The generated matrix's 96/96 Agent/MCP tool count proves tool-path coverage, not that an Agent can correctly answer the G06 question. The one current-candidate canary opened only `bangumi.get_subject_cast`, used the compact text result, and checked every visible answer row against the exact relation/character/actor triples in that result. The CLI stream does not expose `structuredContent` as a separate field; the MCP integration regression verifies it remains unchanged.
4. **Renderer and Standalone.** Existing G06 CastCard evidence reports seven rows readable at 720 px, and recent subject-credit work already verified bounded renderer coverage. This change does not alter Renderer or Standalone and does not repeat the Artifact probe. QQ/TIM remains a separate client gate and stays passive.
5. **Correctness, evidence, and resource bounds.** `get_subject_cast` can return up to 100 characters with nested character summaries/images and actor career/image metadata. `presentMcpToolResult` previously had no dedicated cast branch, so oversized results fell back to full JSON. A synthetic partial 100-row fixture measured 398,109 UTF-8 bytes before the fix. The projection preserves `observed`, `returned`, `truncated`, `schemaDriftRows`, and `invalidActorIdRows`; it marks text omissions and does not infer missing roles.
6. **Architecture, maintenance, and testability.** The existing seams are sufficient: `CharacterService` → `getSubjectCast` → `presentMcpToolResult`, with a reusable cast-row projector. A focused MCP integration fixture verifies the public MCP result, byte bound, source relation/identity mapping, and unchanged structured content. The answer checker is a small explicit line grammar rather than fuzzy name co-occurrence.

## Alternatives and boundaries

- **G08 stats:** current-answer evidence can improve, but the candidate audit found the more concrete unsatisfied product bug in oversized cast tool output.
- **G15 comparison:** current-source scenario evidence remains useful, but no text-bound regression or new architecture gap was identified.
- **G09/G20 series relations:** G09 already has a bounded official-v0 graph and explicit noncanonical-order limits; G20 reuses that domain and does not justify combining relation semantics into this cast Epoch.
- **Community discussion:** the current source-contract evidence does not authorize private API or HTML collection; the narrower live-page hypothesis remains unsafe.
- **Authentication and account tools:** remain externally blocked pending owner-configured OAuth credentials; no account state is needed for G06.

## Validation and status boundary

The high-volume MCP fixture first failed at 398,109 bytes, then passed with the compact projection. Focused presenter integration and cast-answer checker tests passed before the public call; the exact-candidate public CLI call then completed once, with one target tool call, 1,373-byte text, 4/4 visible row matches, and all scope-disclosure checks passing. Candidate A's exact CI completed successfully. The separate `structuredContent` event field was not available from the CLI stream, so preservation evidence remains the MCP integration equality assertion rather than a claimed live full-object readback.

G06 remains PARTIAL after this Epoch: one bounded response cannot prove the full cast source, no universal role taxonomy is inferred, and QQ/TIM/account acceptance remain separate. The sanitized report retains only counts, flags, source/checker hashes, and fixed tool metadata; it does not retain the prompt, answer prose, raw relation labels, character names, or person names.
