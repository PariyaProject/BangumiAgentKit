# Run #95 PR #238 — G23 source-probe bundle attestation refresh

Recorded: 2026-10-19 10:29:33 UTC.

## Preflight and finding

After the same-identity Luna Max review passed for Candidate `f077f9bac9c0d7299874b29915e161ffc388ca28` against Base `c8b1783a5cbb4aa8fcc5a4f6ed75462d8246189d`, the required exact-source G23 renderer probe was prepared but not invoked. The MCP server preflight requires the exact built bundle digest to equal the tracked G26 runtime attestation.

Two consecutive `pnpm build` runs (`tsc -b --force`) on the same clean Candidate produced the same result from `computeMcpBundleSha256`: `8397e9ab0137490288c45485a0fd376ff85d1d9ea71205486b6bceb610a8929a`. The tracked attestation still contained `3afe88786b6433e5f51f5eb5d8bbaabc034b3f17b3b0051fd309486b5c939e7f`, so the preflight correctly refused the call. No Codex execution, MCP tool call, Bangumi request, claim, or report was created by this preflight.

## Refresh and next gates

The tracked `docs/product/g26-mcp-bundle-attestation.json` now records `8397e9ab0137490288c45485a0fd376ff85d1d9ea71205486b6bceb610a8929a`. This binds the exact reproducible current-Candidate MCP/workspace build. The attestation file and report are outside the bundle hash input. This metadata refresh does not assert G26 acceptance and adds no Agent/MCP matrix credit.

The attestation update changes the Candidate after its review PASS. This active Run #95 Epoch therefore requires a fresh Candidate/Base check, exact-Candidate seven-job CI, Harness `candidate:check`, and same-identity GPT-6 Luna Max review before the G23 invocation. After those gates pass, perform the anonymous read-only `bangumi.render_subject_stats_intelligence` call exactly once with `subjectId=218707`. The call remains uninvoked; do not retry if it terminalizes inconclusively.
