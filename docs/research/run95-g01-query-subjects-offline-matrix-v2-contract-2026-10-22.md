# Run #95 G01 query-subjects offline matrix v2 selection contract

This source-bound contract records the selected Run #95 Epoch
`run95-g01-query-subjects-offline-agent-mcp-matrix-v2-20261022`. It permits at most
one fresh synthetic `bangumi.query_subjects` Agent/MCP matrix observation. It does not
answer the July 2026 G01 harem question or establish Bangumi-wide search completeness.

## Selection and source baseline

- Harness selection: [Run #95](https://github.com/PariyaProject/BangumiAgentKit/issues/95),
  selected against master `d2af8f969de8c13cf187f83340cc4f8304838a17`.
- Selection state: `SELECTED`; no Candidate, PR, review, CI run, or profile claim exists
  for this Epoch yet.
- The profile is matrix-only and may update only the `bangumi.query_subjects`
  Agent/MCP cell. G01 remains `PARTIAL`; public API acceptance remains 65/65.
- The profile is distinct from all consumed query-subjects profiles. It has its own
  registry entry, exact arguments, report, evidence path, network mode, server, claim
  latch, terminal latch, and acknowledgement.
- V2 registry SHA-256: `d8764d229285a60540c880d0492a576c0b66c91c5952746c01c9a65eda146914`;
  fixed-argument SHA-256: `748a3be043edfbfd27c2bdaae156fb3dbba9fbd8fe8a041be110354f70f1a1fc`.

## Prior v1 terminal result and root cause

PR [#211](https://github.com/PariyaProject/BangumiAgentKit/pull/211) introduced the v1
offline matrix implementation. Its one permitted profile claim is permanently
`INCONCLUSIVE`, `reportWritten=false`, and `retryAllowed=false`:

- Claim: `profile-run-95-pr-211-cd9652179d01-1792246263993`.
- Candidate: `cd9652179d013f0fad797c5e1e27bf79b8cced12`; Base:
  `776ed09c54e279c9cf2f5d11100edd7b85f7ffad`.
- Exact Candidate CI run `39038969172` passed all seven required checks, and the
  same-identity GPT-6 Luna Max review passed.
- Harness failure code: `G01_QUERY_SUBJECTS_AGENT_MCP_ASSERTION_FAILED`. The one exact
  call, acknowledgement, server summary, completed turn, and Candidate/bundle checks
  passed; `exactToolEvents` failed. Three Codex error items were counted, but the
  terminal diagnostic retained no messages and did not classify them. No v1 report was
  written and no matrix credit was earned.
- The duplicate latches recorded against PRs #214 and #232 are ambiguous terminal
  records for the same v1 profile. They do not create retry authority or alter the
  canonical PR #211 disposition.

Merged PR [#262](https://github.com/PariyaProject/BangumiAgentKit/pull/262) corrected
the deterministic event mismatch in both query-subjects runners. The old runner read
the wrong event fields; the shared predicate now requires the normalized completed
tool-call shape (`name`, `arguments`, and `state: DONE`) emitted by
`summarizeCodexEvents`. PR #262 explicitly preserved the consumed v1/v2 claims as
terminal and granted no new matrix credit. This source correction alone does not
authorize a call.

## Exact v2 profile

```json
{
  "profileId": "g01-query-subjects-offline-agent-mcp-matrix-v2",
  "epochId": "run95-g01-query-subjects-offline-agent-mcp-matrix-v2-20261022",
  "tool": "bangumi.query_subjects",
  "argumentProfile": "fixed-g01-synthetic-query-subjects-one-result-v2",
  "arguments": {
    "keyword": "run95 synthetic query subjects matrix offline 20261022 v2",
    "media": "anime",
    "resultMode": "top",
    "limit": 1,
    "sort": "relevance",
    "explain": "none",
    "nsfw": false
  },
  "syntheticSubjectId": 990931,
  "networkMode": "run95-g01-query-subjects-synthetic-offline-v2",
  "serverId": "bgk_g01_query_subjects_offline_v2",
  "claimLabel": "harness-r95-g01-qsub-offline-v2-claimed",
  "terminalLabel": "harness-r95-g01-qsub-offline-v2-terminal",
  "acknowledgement": "G01_QUERY_SUBJECTS_SYNTHETIC_OFFLINE_V2_OK",
  "reportPath": "docs/live-probes/g01-query-subjects-offline-agent-mcp-v2-run95.json"
}
```

The v1 registry, consumed input, claim, report path, and terminal record remain
unchanged. The v2 runner is selectable only with this exact registered profile and Run
#95.

## Runtime and network boundary

- Expose exactly one MCP tool: `bangumi.query_subjects`. Call it exactly once with the
  registered arguments and return exactly the registered acknowledgement.
- Accept only one anonymous POST to the intercepted official v0 search route with the
  exact fixture request body. Return one synthetic row with ID `990931`.
- Deny credentials, altered headers, alternate body/route/origin, duplicate requests,
  detail hydration, and native fetch. Keep real Bangumi requests, account/OAuth,
  community, writes, QQ, and TIM inactive.
- Match the normalized completed Codex event `{name, arguments, state: DONE}` and the
  exact registered tool name and arguments.
- Permit zero to three Codex error items only when every item exactly matches the
  allowlist of known disabled-web-search diagnostics. Paraphrases, aborted or
  unreachable connections, and all other unknown/network-related errors are
  unexpected. A fourth item, call/argument/acknowledgement mismatch, missing
  summary, or stale Candidate is terminal `INCONCLUSIVE` with no report and no retry.
- Persist aggregate counts for total, explicitly blocked disabled-web-search, and
  unexpected Codex errors only. Never persist error messages, prompt, answer, keyword,
  synthetic subject data, source rows, event stream, credentials, or raw fixture data.

## Report, matrix, and merge gates

A signed report must bind the exact profile and one-shot claim, Candidate, current Base,
seven successful exact-SHA CI checks, same-identity Luna Max review, MCP bundle,
registry, fixture counters, and report-only refresh. Validation accepts only the
profile-specific report and receipt schema. A valid report can credit only
`bangumi.query_subjects` Agent/MCP; it cannot change G01 scenario status, public API
evidence, authentication, client rendering, or QQ/TIM acceptance.

Before the single claim: focused regressions, repository acceptance checks, adversarial
preflight, clean exact Candidate, all seven required CI checks, `candidate:check`, and
same-identity Luna Max review must pass. The existing v1 claim and every other spent
claim are never retried. After a valid report, a report-only Candidate refresh may
change only the v2 report and generated acceptance row; exact CI and same-identity
review must pass again before Harness integration. Merge requires a durable terminal
v2 disposition and permanent claim/terminal labels.

## Implementation and evidence sources

- `scripts/acceptance/agent-mcp-profile-registry.json`
- `scripts/lib/g01-query-subjects-offline-matrix-profile.mjs`
- `scripts/lib/g01-query-subjects-offline-matrix-fixture.mjs`
- `scripts/acceptance/run-g01-query-subjects-offline-agent-mcp.mjs`
- `scripts/acceptance/write-g01-query-subjects-offline-agent-mcp-report.mjs`
- `scripts/agent-harness.mjs`
- `scripts/generate-tool-acceptance-tasks.py`
- `scripts/check-tool-acceptance-table.py`
