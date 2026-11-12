# Native G03 date/PNG model attempt: inconclusive

The sole `native-g03-date-png-model-v1` attempt is terminal `INCONCLUSIVE`.
It produced no signed acceptance report and earns no new matrix credit.
Do not invoke this workload again or create a renamed retry.

## Reviewed execution

- Source Candidate: `b29687446c4558960b60398d5055bc92d0cddcbd`.
- Base: `610604a25da474ffe8fcfd83411c2b181d59caeb`.
- Exact [CI43153671337](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/43153671337)
  passed all seven mandatory jobs, including 1039 Harness and 17 native checks.
- [PR296](https://github.com/PariyaProject/BangumiAgentKit/pull/296) R1:
  `/root/g03_model_product_review`, actual GPT-6.1 Sol `xhigh`, PASS without
  findings. Independent checks included a forced process timeout after
  Chromium launch with no remaining owned browser process.
- One guarded runner invocation configured GPT-6.1 Sol `xhigh`. Its permanent
  claim and terminal latches are present. `retryAllowed=false` and
  `reportWritten=false` were independently read back after process exit.

The selected [contract](run95-native-g03-date-png-model-contract-2026-11-12.md)
required two exact native MCP calls, correct date/scope/artifact readback and
verified PNG bytes. The earlier verifier and its synthetic checks remain
valid within their original scope; they do not replace missing model evidence.

## Actual retained observations

```json
{
  "schemaVersion": 1,
  "reasonCode": "AGENT_MCP_TOOL_RESULT_INVALID",
  "checks": {
    "answerValid": false,
    "codexExecutionSucceeded": true,
    "eventStreamParsed": true,
    "exactCallSequence": false,
    "exactToolEvents": false,
    "serverSummaryValid": false,
    "structuredReadback": false
  },
  "counters": {
    "codexErrorItems": 0,
    "codexMcpToolEvents": 1,
    "codexStderrBytes": 307,
    "codexStdoutBytes": 1524,
    "httpRequests": 0,
    "nonMcpToolEvents": 0
  }
}
```

The Codex process exited successfully and its JSONL parser accepted the
stream, but only one MCP event was observed. The required two-call sequence,
server summary, structured readback and final answer were not established.
The runner rejected the attempt and Harness acknowledged its first terminal
result. The canonical signed report is absent; the checkout was clean after
runner cleanup. No program was changed after the claim.

The `httpRequests: 0` diagnostic is a runner-level counter, not a retained
native source observation. It cannot establish how many local fixture
responses were consumed. Native phase, exact arguments/result/error, artifact
facts and actual browser cleanup were not retained for this failed attempt.
The configured source boundary denies live Bangumi/account/client access;
this failure supplies no new source, account or client evidence.

## Diagnostic limitation and next work

The frozen runner intentionally discarded raw model stdout/stderr and removed
its private native summary. Consequently the precise cause of the single
MCP event is unknown: no claim is made that it was argument drift, a tool
failure, startup, cancellation or rendering. The retained digest-free bounded
failure checks above are insufficient to distinguish these cases.

Do not investigate this uncertainty by spending another model job. Before
selecting any genuinely different future workload, improve failure observation
with synthetic replay: retain bounded allowlisted event/argument-shape/error
and native-phase facts, test publication and redaction through each failure
stage, and show that no replay or extra dispatch is authorized. Preserve these
executed source bytes and both consumed latches. A new name or Candidate SHA
alone is not a changed hypothesis.

Only this result document and the conservative G03 frontier follow-up are
added after the reviewed execution. Fresh exact CI and the same reviewer are
required before integration. G03 stays PARTIAL and the original matrix remains
direct96/public65/Agent86/account12-of33/auth-denial22/QQ0/TIM0. No visual/user
approval, public completeness, account, client or stability claim is added.
