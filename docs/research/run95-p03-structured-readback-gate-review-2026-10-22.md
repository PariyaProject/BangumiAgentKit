# Run #95 P03 structured readback gate review

Date: 2026-10-22 UTC

Base: `master` `002b93237394ebce74dce106f24cefb0e5ee1d43`

Scope: P03 acceptance-runner gate only; no profile invocation or public API request.

## Verified terminal state

The live Harness profile-status command was read for the three registered P03 profiles:

- v1 / PR #167: one call, `INCONCLUSIVE`, no report, retry prohibited.
- v2 / PR #237: one call, status readback `AMBIGUOUS_TERMINAL_LATCH`, permanent terminal label says `INCONCLUSIVE no-report`, retry prohibited.
- v3 / PR #256: one call, `INCONCLUSIVE`, no report, retry prohibited.

Do not retry, recreate, or credit any of these profiles. P03 remains `PARTIAL` and uncredited.

For v3, the retained sanitized diagnostics say the event stream and turn completed; the exact registered call/tool event, bounded text projection, server summary, and answer checks passed. The only failed assertion was that a fresh profile's JSONL result had a `structuredContent` property. The raw event and value were not retained. The failure source is therefore unknown; this report does not attribute the field to Codex CLI, the MCP SDK, event merging, or the server.

## Source and synthetic regression

The fresh P03 server branch returns one bounded JSON text projection and no explicit `structuredContent`. The shared Codex JSONL normalizer preserves an optional structured field, but the original v3 event is unavailable.

A local synthetic JSONL regression passed through `parseCodexJsonl` and `summarizeCodexEvents`. Before the gate correction, a valid text projection with a canonically identical structured duplicate was rejected solely because the property existed. The corrected predicate permits only a missing field, a `null` placeholder, or an exact canonical duplicate when text projection validation passes. Different values, extra fields, and a failed text projection remain rejected. Legacy P03 profiles still require a truthy structured readback.

This proves the local predicate behavior only. It does not establish what the lost v3 event contained and does not make v3 retryable.

## Scope and validation boundary

The candidate only changes this fail-closed runner predicate, its synthetic regression, and the P03 frontier guidance. It adds no one-shot claim, no live source evidence, no Agent/MCP matrix credit, and no scenario completeness claim. No account, OAuth, community, write, QQ, or TIM path was used.

Pre-commit validation on this candidate passed: focused P03 tests 8/8; frontier-data tests 25/25; full Harness tests 794/794; Python acceptance evidence tests 294/294; lint; typecheck; and `pnpm harness frontier:check --run 95` (122 records / 97 actionable, ledger hash `bb29321a87b67b3e79bd3d985e0adca716e54789f0453965638dff34899b5b9b`). The aggregate `pnpm acceptance:check` is deferred to the committed, clean candidate because G06/R04 report bindings include unrelated dirty paths; it must confirm 82/96 before review readiness. Until then this correction carries no matrix credit.
