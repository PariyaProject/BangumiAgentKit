# Real-model contract: conflicting relation evidence and safe viewing steps

This contract reuses the native semantic/wire verification delivered by PR298.
The user question is whether an Agent can preserve contradictory direct labels,
exclude a book source and unknown-direction anime from viewing steps, and explain
the limited authority of a derived recommendation. The [prior comparison](run95-native-relation-safety-prior-contracts-2026-11-12.json)
preserves the nine spent contracts, accepted render observation and legacy scope.
Different IDs, more nodes or another title do not justify replaying those jobs.

## Exact workload

Profile native-relation-safety-model-v1, Epoch
run95-native-relation-safety-model-20261112, uses GPT-6.1 Sol xhigh for one
Codex CLI job. Server bgk_native_relation_safety exposes only the delivered two
native calls, once each in order:

    bangumi.get_subject_relations
      {"subjectId":9632001,"includeEvidence":true}
    bangumi.get_series_watch_order
      {"subjectId":9632001,"depth":1,"maxNodes":8,"media":"all"}

The unchanged factory performs five closed synthetic GET responses, zero live
Bangumi fetches. It uses the actual generated provider, read services, Registry,
MCP descriptors and presenter. The model receives the question, fixed call
inputs and answer schema; it does not receive expected target IDs or an answer.
Native source/semantic proof is [already delivered](run95-native-relation-safety-verification-2026-11-12.md)
and is not rebuilt by this workload.

The finite answer must retain all five raw direct rows, including the duplicate
target with contradictory labels; both actual ordered steps with position and
placement; all three observed exclusions with exact IDs/reasons; exact returned
coverage; unknown source completeness and the bounded, noncanonical scope.
Only the normal complete structured results establish the omitted details.
Compact text can omit the root step and exclusion samples and explicitly counts
them; omission does not establish absence.

## CLI isolation and readiness

The workload runs in its owned private temporary directory with
skip-git-repo-check, ignore-user-config, ephemeral execution, no persisted
history and project_doc_max_bytes=0. Its developer instruction describes only
this bounded semantic task. Parent thread/session/Goal environment IDs are
removed. The MCP child retains the exact source checkout as its working root.
This keeps project continuation instructions out of the model workload.

Shell, web, apps, plugins, Goals, auxiliary agents, memories and skill discovery
are disabled or skipped. The configured MCP allowlist has exactly the two
public read tools and explicit approval for that finite server, using the
existing access-config helper. Output limits are configured for the full small
structured results. No account, OAuth, community, write, asset or client tool is
exposed.

Official OpenAI documentation describes the
[MCP configuration controls](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and [JSONL/schema output](https://learn.chatgpt.com/docs/non-interactive-mode).
Local read-only checks observed CLI0.167.0-alpha.3.2, required exec flags,
disabled/enabled feature values, existing CLI authentication, and the exact
server command, arguments, directory, two-tool allowlist and deadlines through
mcp get. No model or native source is started by these checks. The bundled
catalog contains the pinned model; that alone does not prove live account access.

The installed alpha's print-startup-config route reports unavailable.
features list with the complete configuration and mcp get provide the observed
metadata checks. They are not a complete runtime startup oracle: notably,
feature listing did not reject a deliberately malformed per-tool output budget.
The actual job still uses strict-config, and its effective calls/results must
pass independent verification. No undocumented readiness or provider-price
guarantee is inferred from help output.

## Claim, source and process boundaries

Dispatch requires clean exact Candidate, unchanged Base, seven exact successful
CI jobs, actual reviewer PASS, current bundle attestation and immutable execution
programs. Parent and child independently check the active control plane and
claim. A repository-global create-only label and exact public-key/source
readback precede invocation; a create-only child-start latch precedes child
control reads. Ambiguity grants no execution authority. The profile and all old
latches remain consumed after the first attempt, including failed startup.

The parent owns one process group, with a 360-second deadline and an 8 MiB
stdout cap. Stderr is counted and discarded. SIGINT and SIGTERM cancel the
attempt, stop its process group and wait for the child to close. A signal before
the claim prevents the claim. Once claimed, cancellation before publication
prevents a positive report while the runner retains its diagnostic, reconciles
the attempt and cleans up. The first observed process failure is preserved if termination
conditions coincide. The child has a 420-second deadline, and each native call
retains its 20-second bound.
Internal provider HTTP counts and an invoice hard cap remain unobserved.

The SDK bridge forwards normal results, independently hashes wire semantics and
closes the native runtime before the final successful reply. The parent checks
the closed native snapshot, five fixture responses, exact two completed MCP
events/server/names/arguments, matching result digests, actual source-derived
answer and complete event stream. Unknown item kinds, extra tools, contradictory
wire aliases and malformed error flags cannot earn credit.

## Retained diagnostics and failure

The delivered offline observer/private publisher is reused. Only the exact new
native summary schema, bounded reported counters/phases and closed error codes
are added. The observation remains observation-only: model/source/artifact/
cleanup verification and acceptance/retry authority are all false.

Before claiming, a private publication probe writes and syncs a branded
observation, then deletes only its own probe directories. The actual attempt
publishes its bounded sanitized observation outside its execution cleanup root,
create-only, with current-owner0700 directory and0600 regular file. It does so
before cleanup or terminal acknowledgement. No raw answers, argument values,
messages, result bodies, unknown error text or stderr are retained.

The first publication is never overwritten or replayed. A publication failure
is explicit and prevents a positive report. Missing, invalid or unreadable
native summaries remain unknown. The immutable observation covers the process
facts available at publication; later report/ack failures are separate returned
and control-plane outcomes, not retroactively rewritten into that observation.

On success, the execution directory is removed before signing/reporting; the
public report retains only the diagnostic digest and observed cleanup status.
Private diagnostic paths stay local. Cleanup failure cannot replace a known
terminal result with a false no-invocation result. Reconciliation reads existing
claims/reports and records their first outcome; it never invokes the model.

## Admission and integration

The Ed25519-signed sanitized report binds claim/key, original Candidate/Base/CI/
reviewer, exact profile/arguments/catalog, source programs, native snapshot and
event/result/answer/diagnostic digests. The Python consumer requires live
terminal and both permanent labels, source PASS, exact seven successful jobs,
signature/source validity, ancestry and a closed report-only refresh.

Only get_subject_relations and get_series_watch_order Agent/MCP cells are
eligible. A missing or rejected report earns nothing. Public65, account12,
QQ/TIM, render quality and original full-franchise/required-film questions retain
their independent evidence boundaries. R01 remains PARTIAL and R04 UNASSESSED.

The new Epoch cannot merge with an unclaimed/in-flight disposition. After the
actual first result, report refresh allows only the canonical report, generated
matrix, frontier evidence and the named result document. Execution programs and
oracles remain frozen. Fresh exact CI and the same reviewer apply to any new
Candidate before ordinary Harness integration. No old profile, native kernel,
renderer or prior diagnostic project is reopened.
