# Native relation model attempt ended inconclusive

The sole `native-relation-safety-model-v1` attempt on November 14 ended
`INCONCLUSIVE`. The claim and terminal markers are both present, the canonical
signed report is absent, and retry remains disabled. The Agent/MCP matrix remains
86 of 96. [PR 299](https://github.com/PariyaProject/BangumiAgentKit/pull/299)

The attempt used Candidate `6a450d98a1ce8428fc4d57b78f5faaff1f4105f1` and Base
`e98e4b822d7fe7bb031ba35655a897978269e7ff`. All seven mandatory jobs passed.
The same GPT-6.1 Sol `xhigh` reviewer passed R2 after independently verifying
14 focused tests and closing the parent cancellation finding. The runner claimed
the profile and started one CLI process configured for GPT-6.1 Sol `xhigh`.
[Source CI](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/43539120428)

## Observed result

The CLI exited 1 and emitted zero stdout bytes and 158 stderr bytes. No JSONL
events, MCP calls, native summary or answer were observed. The private sanitized
observation was retained before cleanup, with SHA-256
`6effef2f223815dd29eda827503e7b5c28183e74e28caac4c41644908771f096`.
The owned execution directory was absent after the runner exited. Whether the
native server started, how many requests the provider made, and any model-side
activity remain unknown.

The runner rejected its own terminal diagnostic because its inspector emitted
`shellToolCalls` while the Harness allowlist expects `shellCalls`. Replaying the
normalizer with the retained counters reproduced `PROFILE_DIAGNOSTICS_INVALID`.
The error escaped the failure handler and the top-level response became
`RELATION_MODEL_RUNNER_FAILED`. The existing claim was reconciled through the
Harness result command using the retained diagnostics and the canonical field
name. Readback verified `AGENT_MCP_PROCESS_EXIT_NONZERO`, both permanent markers,
`reportWritten=false` and `retryAllowed=false`.

## Configuration check after the attempt

The original CLI stderr text was discarded by design. With CLI
`0.167.0-alpha.4.1`, the metadata-only `app-server --print-startup-config
--strict-config` check independently rejected each quoted, dot-separated tool
name in the exact override list as an unknown configuration field. The same
check passed when those two entries were supplied as a single inline `tools`
TOML table with the original tool names and token limits. This establishes a
configuration defect consistent with the observed exit. The original exit
reason remains unconfirmed. These checks started neither a model nor the MCP
server.

Before a future distinct workload, use strict startup validation for its exact
configuration and exercise failure diagnostics through the Harness normalizer.
The spent profile retains its original execution source and terminal markers.
R01 remains `PARTIAL` and the original R04 required-film question remains
`UNASSESSED`.
