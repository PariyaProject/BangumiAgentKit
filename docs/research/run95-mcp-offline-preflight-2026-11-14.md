# Offline verification before a model claim

The PR 299 result exposed two independent gaps. Strict Codex startup rejected
the quoted dotted tool overrides during a later metadata check. Its first
failure also could not be registered because the local inspector emitted
`shellToolCalls`, while Harness accepts `shellCalls`. The original CLI failure
reason remains unknown. The run and its source evidence are recorded in the
[PR 299 result](run95-native-relation-safety-model-result-2026-11-12.md).

For a future separately reviewed workload, use the same ordered list of CLI
configuration overrides for `inspectCodexMcpStartup` and the final CLI
invocation. `codexMcpToolLimitsOverride` emits one inline TOML table, preserving
each full tool name as a literal key. The metadata helper returns the digest of
the ordered list, the CLI version on success, and a closed result code. A
missing CLI, invalid metadata, unsupported flag, timeout or output overflow
returns unavailable. Treat rejected or unavailable metadata as insufficient
evidence for a future claim. Preserve the existing requirements for isolated
execution, the exact exposed tools and independent source evidence.

Run the exact historical override regression with an installed Codex CLI:

```sh
node scripts/acceptance/verify-codex-mcp-startup-preflight.mjs
```

The command uses an owned temporary working directory and a deliberately
unusable gate path. It calls only `app-server --print-startup-config
--strict-config`, which does not start the server. With CLI 0.167.0-alpha.4.1,
the old list is rejected and the inline table is accepted. The output contains
only the closed result, digest and version. The metadata action validates the
overrides in its own app-server context. The app-server command does not accept
exec's `--ignore-user-config` flag, so this check cannot prove the effective
exec startup environment, provider access or tool calls. An offline fake CLI
test exercises the same argument list, redaction, invalid output bounds and
unavailable cases without relying on the installed alpha in CI.

After a failed future process, first publish its branded observation outside
the execution directory. Pass the observation and publication outcome to
`terminalMcpObservation`, which uses the existing Harness normalizer. Unknown
counts remain null. A complete stream still needs the workload's semantic
verdict, so an observation never admits a positive result. The offline test
passes the normalized result through the actual Harness result command with a
simulated control plane. It reproduces the rejected counter name and verifies
that the private diagnostic survives cleanup and that the corrected terminal
registration preserves both simulated markers and disables retry.

This verification creates no profile or claim. The older execution programs,
reports and matrix remain pinned to their original evidence.
