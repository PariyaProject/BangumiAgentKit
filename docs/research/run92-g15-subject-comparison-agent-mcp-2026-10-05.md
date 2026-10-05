# Run 92 — G15 bounded subject-comparison Agent/MCP acceptance

- Selection base: `b769efcc6394fcb703d0cc1f3c98d251c4767a8c`
- Frontier hash at selection: `19fc1a9333489fbb26e53d5a2ab0012b040a6559b2100ab2d091e3f5d5f3938c`
- Selected frontier: G15, PARTIAL
- Selected Epoch: `g15-subject-comparison-agent-answer`

## Six-lane discovery

1. **Recorded opportunities and deferred work.** G15 and OP-012 remain PARTIAL. Their existing fixture/browser evidence covers the two-subject comparison card, including 320, 360, and 520 CSS px. OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY with no safe third-party request contract; no community or HTML source is used. Statistics history and personal-account paths remain separate.
2. **Capability maturity and user journeys.** The user question compares the rating, reported episodes, and collection completion rate for the base TV entries _Frieren_ and _The Apothecary Diaries_. The official Bangumi pages identify subject 400602 as 葬送的芙莉莲 TV (28 reported episodes) and subject 420628 as 药屋少女的呢喃 TV (24 reported episodes): [400602](https://bgm.tv/subject/400602) and [420628](https://bgm.tv/subject/420628). These identities pinned the query; the Candidate-bound read later matched both returned identity rows and all four available metric rows, as recorded below.
3. **Agent UX and orchestration.** `bangumi.get_subject_comparison` already accepts exactly two known IDs and returns official-v0 identity/statistics, input-ordered metric deltas, formula state, and bounded relationship coverage in one read. Existing 96/96 tool-call coverage does not establish that an Agent uses the exact IDs or reports these values and caveats correctly. The selected Epoch adds one exact-source answer check.
4. **Renderer and Standalone.** Existing G15 comparison fixtures retain the score, episode, completion-rate, formula caveat, and partial/conflict/unavailable states; the browser fixture audit covers the mobile widths above. This Epoch changes neither the Renderer nor Standalone output.
5. **Correctness, evidence, and resources.** Collection completion is `collect / (wish + collect + doing + on_hold + dropped)`, marked empirically verified and not an official API contract. It describes the observed distribution of current collection states, not a user’s personal watch progress. Metric differences are second subject minus first. Missing and conflicting values remain unknown/conflict and do not become zero. Cast/staff overlap is bounded and omitted overlap names cannot establish absence. The exact-Candidate Agent/MCP read was performed after Candidate and CI gates; its sanitized evidence is recorded below.
6. **Architecture, maintenance, and testability.** The existing MCP result presenter is the right seam. It returned full pretty JSON for oversized comparison results because there was no comparison-specific compact projection. The selected change adds a 3,600 UTF-8 byte bounded view, a strict reusable answer checker, and regressions for the Agent/MCP text and unchanged structured result. No provider, account, storage, HTML, or write authority is added.

## Selected scope and boundary

The single current-source read used `bangumi.get_subject_comparison` with only `subjectIds: [400602, 420628]`. The answer had to identify each returned ID/name, report the available score and reported episode metrics plus the observed completion-rate metric and B−A deltas, preserve each returned state, and explain the source, formula, snapshot, and coverage limits. No conclusion about quality, recommendation, historical movement, personal progress, or full-source coverage is accepted.

G15 stays PARTIAL after this Epoch because the current result is partial and a single observation cannot establish a durable or exhaustive source result. Real QQ/TIM display remains separate. No authenticated or user-facing client action is in scope. No QQ/TIM action occurred during discovery or this Epoch.

## Exact-Candidate Agent/MCP canary

- Candidate: `79458fe4801257a284072cb308b1700e6a657522`, based on `b769efcc6394fcb703d0cc1f3c98d251c4767a8c`; exact-SHA CI run `37261202887` passed all seven required checks, and Harness accepted Candidate A before the read.
- The isolated Agent image carries the exact Candidate revision and ran Antigravity CLI `1.2.14` against the `standard-full` catalog. Exactly one `bangumi.get_subject_comparison` call completed with the requested ordered subject IDs; no other tool completed.
- The MCP text projection was read from the Agent event stream at 3,476 UTF-8 bytes, below the 3,600-byte bound. The checker matched both returned identity rows and all four available metric rows, preserved metric states and B−A ordering, and passed the source, snapshot, formula, personal-progress, bounded-overlap, and omission caveat checks. The returned comparison state was `partial`.
- The Agent event stream did not expose a separate `structuredContent` field. Equality-wise preservation of the full structured result is covered by the passing MCP transport regression. The sanitized report stores only Candidate/catalog/image identifiers, tool and subject IDs, byte counts, and checker booleans/counters; it contains no prompt, answer prose, or metric values: [`run92-g15-subject-comparison-agent-canary-2026-10-05.json`](run92-g15-subject-comparison-agent-canary-2026-10-05.json).
- This was one current public read only. No authentication, personal account, QQ, or TIM operation was used. Do not repeat the public call; keep G15 PARTIAL until separate source-coverage and client stages have their own evidence.
