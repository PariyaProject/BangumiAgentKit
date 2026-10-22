# Run #95 G01 v2 G26 bundle attestation refresh

Date: 2026-10-23 (Asia/Tokyo)

Bundle measurement Candidate: `4fbd7b91fc134993d98b3ad1e777d68ac78d367b`

Base: `d2af8f969de8c13cf187f83340cc4f8304838a17`

## Trigger and one-shot state

After exact-Candidate seven-check CI and same-identity GPT-6 Luna Max PASS,
the G01 v2 runner stopped during local preflight before creating the permanent
profile claim. Live Harness status remains `UNCLAIMED`; there is no profile
disposition, claim or terminal label, report, or Codex/MCP invocation. This
preflight failure earns no matrix credit.

## Reproducible build evidence

Environment: Node `v24.14.0`, pnpm `9.0.0`.

Two `pnpm build` runs on the unchanged Candidate exited successfully. After
each build, `computeMcpBundleSha256` returned the same digest:

`501f00ac6eb388afa4c331a914761f47e2c86f744c9f4f79455490d3d3ae45d6`

The tracked G26 attestation was
`d7fcae785c151687e674dd29cb721cb11df011ab1dba5e49111847e01a1732db`, which
did not match the reproducible build output. The attestation covers the
generated MCP and package `dist` trees; the generated outputs were stable
across both builds. The tracked digest now records the reproduced value.

## Acceptance boundary and next gates

This refresh records only the reproducible bundle hash. It does not establish
a G01 profile result or add matrix credit. The profile remains `UNCLAIMED`.
Because the attestation refresh creates a new Candidate descendant, that
Candidate must pass exact-head seven-check CI, Harness `candidate:check`, and
same-identity GPT-6 Luna Max review before the single G01 v2 call. No account,
OAuth, community, write, QQ, or TIM path was used.
