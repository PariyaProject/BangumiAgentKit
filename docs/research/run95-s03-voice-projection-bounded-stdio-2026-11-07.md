# Series voice-credit evidence under the MCP text limit

The native MCP server returned `INTERNAL_ERROR` on a valid response with two
distinct works and two credits. Its final watch-order text fallback still
carried the full nested voice coverage and reached the 3600-byte UTF-8 limit
before returning either text or structured content.

The fix keeps existing projections that fit. The final voice reduction keeps
the person and work IDs, a sample role per shown work, source status and
positive-only scope. It records the omitted coverage and retains the entire
result in `structuredContent`. The presenter regression with long Chinese
labels fails on the old source and passes on the fix.

At `0685626f31085bccb99cde064c8c082c4d8a22bd`, the original server, registry
and generated transport ran in separate stdio child processes against four
exact synthetic GETs per case. The positive case kept two distinct works in
3159 bytes. Two credits on one work gave `not_established` in 3591 bytes.
Both cases kept the full structured result and made zero live requests.
The sanitized fixture proof has SHA-256
`7e8ed9528cef89484e2c77a2e136d0fea8bf322873ba5ab2a22b3f1e570d4213`.

Only the compiled MCP presenter changed among 209 emitted JavaScript files.
All 136 emitted modules from the five historical account proof projects still
match the sealed proof byte-for-byte. The
[compatibility receipt](../live-probes/run95-series-presenter-account-compatibility-2026-11-07.json)
applies the exact whole-source check to this one-file successor and retains
the original twelve account observations. It adds zero account, public,
model or client credit.

The spent native-page build attestation remains bound to its original
signed report. A separate isolated fixture verifies that its execution gate
still rejects changed compiled presenter bytes before the live CI query.

S03 remains partial. This is a synthetic wire-level result for the bounded
voice branch, and the original S03 and R04 one-shot dispositions remain
terminal. The fixture does not establish a complete career or series graph.
