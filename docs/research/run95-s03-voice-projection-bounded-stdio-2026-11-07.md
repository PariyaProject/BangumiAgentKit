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

## Two direct credited works at the final text limit

The first Product review of `621e7e65` found one remaining overflow. Two
directly related anime with an uncredited anchor can carry two longer
relation labels in the final projection. The service recognizes the
trimmed label and preserves its original form as evidence. Escaped and
multibyte text can push the serialized result over the byte limit even
after character clipping. The real server returned `INTERNAL_ERROR`
without `structuredContent`.

The correction in `2668b99d29f626306ef3b3988d4f12b111ad0d8b` keeps all prior
projections that fit. If the compact voice projection still exceeds the
limit, the final tier omits detailed diagnostic counters and marks their
omission. It keeps the same voice evidence, main watch-order and coverage
fields, source status, and qualified conclusion. The full result stays in
`structuredContent`.

| Native stdio input | Text bytes | Fixture GETs |
| --- | ---: | ---: |
| Original two-work evidence | 3159 | 4 |
| Original two roles on one work | 3591 | 4 |
| Two direct credited works, long emoji labels and tab-padded relations | 2969 | 5 |
| Two direct credited works, JSON-escaped labels and ideographic spaces | 3204 | 5 |

All four responses returned the full structure. The last two preserve both
work IDs and one observed credit per work. They used zero live requests and
added zero acceptance credit. The presenter integration regression failed
before the correction and passed afterward. Its 39 cases passed together.

The compatibility receipt now binds the exact corrected presenter. The
209-module comparison against the base still changes only the compiled MCP
presenter. All 136 modules of the prior sealed account graph match.
