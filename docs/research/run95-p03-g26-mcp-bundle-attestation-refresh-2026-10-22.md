# Run #95 P03 v4 exact-Candidate G26 bundle attestation refresh

Date: 2026-10-22 (Asia/Tokyo)

Bundle measurement Candidate: `e30509ffd6b6e9a5b3bc4f74ed51ad1eb3dee81c`

Base: `447e5e24b862f14282dedab07d5813bf68b0c541`

## Trigger and one-shot state

After the exact-Candidate seven-check CI and same-identity GPT-6 Luna Max
round-1 PASS, the P03 v4 runner stopped closed during local preflight. The
Harness profile remains `UNCLAIMED`; there is no disposition, claim label or terminal
label, report, or Codex/MCP invocation. The runner failed before its
claim-and-invoke section, so this did not consume the profile call. It grants no
Agent/MCP credit.

The first preflight build used a temporary clone whose `node_modules` was a
symlink to the primary checkout's incomplete dependency tree. That exact
symlink was removed from the temporary clone only; the primary checkout's
dependency directory was preserved. Dependencies were then installed in the
temporary clone from the frozen lockfile.

## Reproducible build evidence

Environment: Node `v24.14.0`, pnpm `9.0.0`.

Two `pnpm --silent build` runs on the unchanged Candidate exited successfully.
After each build, `computeMcpBundleSha256` returned the same digest:

`d7fcae785c151687e674dd29cb721cb11df011ab1dba5e49111847e01a1732db`

The prior tracked G26 attestation was
`f84d2f4ddec2822eaefe94e9b7be421ca78f22aa88724f855811c79cea86685b`, which
did not match the reproducible runtime bundle. The prior attestation refresh
measured Candidate `68a0e6842a072472984e5c5d54b2a297994adbda`; since then the
current Base includes runtime source changes in
`apps/mcp/codex-one-tool-mcp-server.mjs` and
`packages/renderer/src/templates/SubjectStatsCard.tsx` (the renderer change is
in PR #260). This refresh updates only the tracked bundle digest and the P03
frontier/research records; those documentation files are outside the hashed
runtime inputs `apps/mcp/dist` and `packages/*/dist`.

## Acceptance boundary and next gates

The updated attestation records only the reproducible build output. It does
not establish a profile result or add matrix credit. The profile remains
`UNCLAIMED`, P03 remains `PARTIAL`, and no account, OAuth, community, write,
QQ, or TIM path was used. Because the attestation refresh creates a new
Candidate descendant, that Candidate must pass exact-head seven-check CI,
Harness `candidate:check`, and same-identity GPT-6 Luna Max review before the
single v4 call. After an accepted report, refresh the report-bound Candidate
and obtain its required exact review before Harness merge. Preserve the current
Run #95 allowance; do not extend it.
