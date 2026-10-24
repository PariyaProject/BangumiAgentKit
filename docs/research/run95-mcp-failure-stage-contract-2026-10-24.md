# Bounded Agent/MCP failure-stage contract

## Problem and evidence boundary

An offline rendering attempt can fail before a server summary or PNG exists.
The prior C07 runner attempted image persistence before checking the execution
and summary. A missing artifact then threw into the generic after-claim catch,
masking the earlier category. An empty-stream/missing-summary replay reproduces
that path without invoking a model, MCP operation or acceptance profile.

This establishes a diagnostic defect. It does **not** recover the cause of the
historical C07 v4 attempt, prove that its tool executed, create a report or grant
matrix credit. Spent claims remain terminal. Diagnostic replay is not a new
version of a failed acceptance profile.

## Process-local observations and durable facts

The shared `scripts/lib/agent-mcp-execution.mjs` seam handles bounded process
facts and failure precedence. C07 and R04 keep their own exact tool arguments,
summary validators, acknowledgements and signed-report contracts.

| Stage                    | Failure category                                                                      | Later work withheld       |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------- |
| Process                  | spawn, timeout, output limit, nonzero exit or unknown observation                     | artifact and report work  |
| Events                   | malformed, incomplete or unexpected protocol events                                   | artifact and report work  |
| Tool                     | wrong server/call/arguments, contradictory result aliases or unsafe tool/error events | artifact and report work  |
| Summary                  | absent or invalid closed-fixture summary                                              | artifact and report work  |
| Answer and bundle        | wrong acknowledgement or unverifiable exact bundle                                    | artifact and report work  |
| Artifact                 | bounded image capture fails after valid earlier observations                          | report construction       |
| Report                   | report construction, signature/readback validation fails                              | accepted terminal report  |
| Terminal acknowledgement | recording/readback cannot confirm the report                                          | unverified success claims |

Full events, arguments, answers and server summaries remain process-local where
existing validators need them. The terminal envelope retains only schema version,
a closed reason code, allowlisted booleans and bounded nonnegative integer/null
counters. It contains no stderr text, exception message, path, prompt, answer,
tool payload or private content. Unknown counters stay null. Values above the
10,000,000 diagnostic ceiling are capped with an explicit clamping flag; they
must not be interpreted as exact observations. Unknown process invocation state
is explicit rather than invented as a known spawn failure.

The existing Harness terminal-result path persists this envelope only with an
initial `INCONCLUSIVE` result. Subsequent additions or replacements fail closed.
This changes neither the permanent terminal label nor query authority, successful
report fields, frozen profile registry, arguments, model/effort or fixture counts.
Historical dispositions are not rewritten to invent missing diagnostics.

## Non-consuming verification

`tests/harness/agent-mcp-execution-replay.test.mjs` drives the actual C07/R04
in-process seams. A positive C07 snake-case result and positive R04 camel-case
result reach real report signing and validation. Negative cases cover process
failures, missing/invalid summaries, malformed/incomplete events, contradictory
aliases, foreign calls/arguments, wrong acknowledgement, unverifiable bundle and
image-copy exceptions. Earlier failure cases assert that capture is never called.

Shared signer fixtures feed the same writer tests and replay tests. These
fixtures use synthetic claims and external observations; they never create a
real claim or start Codex. The Harness CLI simulation separately proves terminal
diagnostic persistence, refusal of replacement/unsafe fields and no-retry
integration. These tests do not promote either scenario or the acceptance table.

## CLI inspection limits

The installed CLI help exposes the runner's flags, and a non-exec `features list`
inspection accepts the constructed feature/config keys. That inspection does not
prove strict exec startup, model availability or MCP connectivity. The
[official CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
describes `features list` as an effective-feature inspection and `--strict-config`
as rejecting unrecognized configuration fields. The
[official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents the exact MCP allowlist, approval mode and required-server settings.
No settings were enabled/disabled or persisted by this research.

## Related technical park recovery

A no-report technical failure must preserve its original source, terminal claim,
review history and budget while a fresh Candidate uses current Base/CI/review.
It must not be represented as a new query or a general override of a Human
boundary. The observed PR #267 case has an unchanged historical terminal claim
and a later report-validator fix; Candidate evidence must carry the **complete**
prior disposition unchanged. An immutability rejection alone does not establish
that Candidate refresh is impossible.

A governed recovery route must verify same PR/branch, exact historical evidence,
terminal latches, no accepted/orphan report and absence of active/reserved work.
Genuine Human/protected findings remain ineligible. Resumption cannot grant PASS,
query or merge authority. Any no-credit scope amendment must be explicit and
reviewed. Canonical mechanics belong in `docs/agent/HARNESS.md`; this contract
itself neither resumes the parked PR nor implements such an override.
