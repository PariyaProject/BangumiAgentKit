# Run #95 P02 v2: G26 bundle attestation refresh

Date: 2026-10-19 (Asia/Tokyo)

## Trigger

On PR #237 Candidate `1d4eff03ee59d3586f843518862120519a96233c` against Base
`0fe34e5f287cded3264ba182ccc37ef881480f01`, the P02 v2 runner stopped in its
pre-claim build guard with `Built P02 MCP bundle does not match the exact-
Candidate attestation.` The profile remained `UNCLAIMED`; no permanent claim,
Codex MCP tool call, report, or Agent/MCP matrix credit was created. The
profile was not retried.

The Candidate changes `apps/mcp/codex-one-tool-mcp-server.mjs` to support the
registered P02 v2 offline network mode. That source change alters the compiled
MCP bundle, while the tracked G26 attestation still described the previous
master build.

## Hash verification

Two builds of the exact Candidate produced the same MCP bundle SHA-256:

`3afe88786b6433e5f51f5eb5d8bbaabc034b3f17b3b0051fd309486b5c939e7f`

Before this refresh, `docs/product/g26-mcp-bundle-attestation.json` contained
`e730a5296b1b3697ea44735cffa79728242f54183df7fc1c6d84ffaa09e9b3fb`. The
tracked value is updated to the reproducible Candidate digest. The attestation
is deliberately checked after building and before acquiring the one-shot
claim.

## Review and acceptance boundary

The previous PASS and exact CI run `39227549765` apply to Candidate
`1d4eff03ee59d3586f843518862120519a96233c`; this attestation/report refresh is
a new descendant Candidate and requires fresh exact-SHA CI and same-identity
review before the P02 v2 call can run. Review allowance was extended from 6 to
7 with an audit reason under the existing Run #95 Product allowance; consumed
history remains unchanged.

This report records local synthetic build evidence only. It does not claim a
P02 Agent/MCP result or live API, account/OAuth, community, QQ, or TIM evidence.
After the refreshed Candidate receives exact-Candidate PASS, the registered
P02 v2 profile may be invoked once. A terminal profile disposition is never
retried.
