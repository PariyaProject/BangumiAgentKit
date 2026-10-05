# Run 92 — G15 bounded subject-comparison Agent/MCP acceptance

- Selection base: `b769efcc6394fcb703d0cc1f3c98d251c4767a8c`
- Frontier hash at selection: `19fc1a9333489fbb26e53d5a2ab0012b040a6559b2100ab2d091e3f5d5f3938c`
- Selected frontier: G15, PARTIAL
- Selected Epoch: `g15-subject-comparison-agent-answer`

## Six-lane discovery

1. **Recorded opportunities and deferred work.** G15 and OP-012 remain PARTIAL. Their existing fixture/browser evidence covers the two-subject comparison card, including 320, 360, and 520 CSS px. OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY with no safe third-party request contract; no community or HTML source is used. Statistics history and personal-account paths remain separate.
2. **Capability maturity and user journeys.** The user question compares the rating, reported episodes, and collection completion rate for the base TV entries _Frieren_ and _The Apothecary Diaries_. The official Bangumi pages identify subject 400602 as 葬送的芙莉莲 TV (28 reported episodes) and subject 420628 as 药屋少女的呢喃 TV (24 reported episodes): [400602](https://bgm.tv/subject/400602) and [420628](https://bgm.tv/subject/420628). These identities pin the query; a Candidate-bound read still has to confirm the current returned identities and values.
3. **Agent UX and orchestration.** `bangumi.get_subject_comparison` already accepts exactly two known IDs and returns official-v0 identity/statistics, input-ordered metric deltas, formula state, and bounded relationship coverage in one read. Existing 96/96 tool-call coverage does not establish that an Agent uses the exact IDs or reports these values and caveats correctly. The selected Epoch adds one exact-source answer check.
4. **Renderer and Standalone.** Existing G15 comparison fixtures retain the score, episode, completion-rate, formula caveat, and partial/conflict/unavailable states; the browser fixture audit covers the mobile widths above. This Epoch changes neither the Renderer nor Standalone output.
5. **Correctness, evidence, and resources.** Collection completion is `collect / (wish + collect + doing + on_hold + dropped)`, marked empirically verified and not an official API contract. It describes the observed distribution of current collection states, not a user’s personal watch progress. Metric differences are second subject minus first. Missing and conflicting values remain unknown/conflict and do not become zero. Cast/staff overlap is bounded and omitted overlap names cannot establish absence. One exact Candidate Agent call is planned after Candidate/CI gates; no public call has run in this selection/implementation phase.
6. **Architecture, maintenance, and testability.** The existing MCP result presenter is the right seam. It returned full pretty JSON for oversized comparison results because there was no comparison-specific compact projection. The selected change adds a 3,600 UTF-8 byte bounded view, a strict reusable answer checker, and regressions for the Agent/MCP text and unchanged structured result. No provider, account, storage, HTML, or write authority is added.

## Selected scope and boundary

The single current-source read will use `bangumi.get_subject_comparison` with only `subjectIds: [400602, 420628]`. The answer must identify each returned ID/name, report the available score and reported episode metrics plus the observed completion-rate metric and B−A deltas, preserve each returned state, and explain the source, formula, snapshot, and coverage limits. No conclusion about quality, recommendation, historical movement, personal progress, or full-source coverage is accepted.

G15 stays PARTIAL after this Epoch because a single current observation cannot establish a durable or exhaustive source result, and real QQ/TIM display remains separate. No authenticated or user-facing client action is in scope. No QQ/TIM action or public Bangumi call has occurred during discovery or initial engineering.
