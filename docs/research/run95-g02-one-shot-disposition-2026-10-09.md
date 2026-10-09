# Run #95 G02 one-shot disposition — INCONCLUSIVE

## Authorized Candidate

- Active PR: #118
- Candidate: `d06704768cc258858d7310ff5c8edaee51ef7ee0`
- Base: `487fdfb7cad553441d6df57d1bf7c3883e2a54d0`
- Exact-SHA CI: run `37874114949`, 7/7 SUCCESS
- Luna Max review: round 2 PASS on the exact Candidate and Base
- MCP bundle SHA-256: `66678da54a670dd07960abd57607b48188431355a21ddfde6080870d4f9844c5`

## Sanitized execution result

The create-once runner created its local-only Run #95 G02 claim at `2026-10-09T02:28:22.966Z`. One isolated `bangumi.query_subjects` MCP event completed with Codex exit code 0, a complete parsed event stream, the expected one-tool server, one allowed call, zero denied calls, server result `SUCCESS`, and zero shell calls. The Codex session also contained 3 non-MCP tool events, violating the runner's zero-non-MCP-tool acceptance gate.

The runner therefore marked the claim `INCONCLUSIVE` at `2026-10-09T02:29:12.052Z` and stopped before answer checks and before invoking `bangumi.render_query_subjects`. `answerChecks` and `resultCounters` are null. No raw answer, source payload, title, artifact bytes, credential, or private data was persisted.

## Disposition

The G02 one-shot is spent. Do not retry the query, renderer, or runner, and do not turn the successful server event into accepted Agent/MCP coverage: the overall isolated run failed its gate and no canonical G02 report was written. Both `docs/live-probes/pariya-agent-codex-luna-e2e-G02-query.json` and `docs/live-probes/pariya-agent-codex-luna-e2e-G02-render.json` are absent. Keep G02 `PARTIAL`; this attempt does not validate the answer, renderer, or global search coverage. OAuth/account/community, QQ, and TIM were not used.

The claim remains in the BangumiAgentKit scratch clone's `.git/pariya-agent-state/` directory as local recovery state and is not part of this report's product history.
