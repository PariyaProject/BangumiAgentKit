# Native entity page observation contract

This is the successor acceptance scope for the two list contracts delivered
by PR291, integrated at `c8313ac51442b6d78811d0b30d49fc3c80a3896e`.
It does not reopen that implementation or its completed compatibility proofs.
Run95 remains the existing Outer Run. Original public65, Agent96, account33,
QQ96 and TIM96 targets remain unchanged.

## User question and evidence gap

Can an anonymous Agent read one page of a public user's collected people and
characters, describe the native page and its limitations, and stop? The new
source contract sends `limit` and `offset` to the source, validates their
echoes, and exposes native window continuation. Older local-truncation
observations do not establish this behavior. Current applicable public
coverage is63/65 and Agent coverage84/96; only these two changed contracts are
in scope here. Account coverage stays12/33 and real QQ/TIM remains0.

## Fixed source and call sequence

`scripts/lib/native-entity-page-verification.mjs` defines the immutable inputs:

1. `bangumi.list_person_collections`, explicit public target, `maxItems:1`,
   `offset:0`.
2. After a validated first result, `bangumi.list_character_collections` with
   the same fixed target and bounds.

No configured public probe target was present in the preparation environment.
The fixed target is instead the public example in the pinned official OpenAPI
`openapi/upstream/v0.yaml`, `components.schemas.User.example.username`. This is
an explicit test sample, independent of the operator's account or credentials.
The first-party [API schema](https://github.com/bangumi/api/blob/master/open-api/api.yml)
also documents this public user example. Selection requires no profile lookup,
account database, OAuth or collection discovery request. It does not imply the
target has a nonempty collection or consented to any account-level access.
No target, names, item IDs, collection timestamps or untrusted text enter the
retained result projection.

The two permitted URLs are the exact corresponding official-v0 collection
routes with `?limit=1&offset=0`. Only GET, Accept/User-Agent headers and an
active abort signal are allowed. The adapter normalizes requests, forces
`credentials:omit` and `redirect:error`, and refuses Request-object inheritance,
extra query parameters, methods, bodies, headers, other origins/routes, extra
fetches and implicit target arguments before provider I/O. There is at most
one fetch per tool and two in the sequence; no retry, fallback, detail lookup,
automatic continuation, covers or other asset resolution.

The actual product ToolRegistry and native page client retain the reviewed
256KiB response cap and10s whole native-call deadline. Native transport
failure, invalid echo, source-body failure, invalid semantic projection,
concurrent/extra call or denied request permanently fails this observation
instance. It cannot proceed to the other page after ambiguity or failure.
The kernel enforces at least1s between request starts, inside the native
deadline, and forwards host cancellation through its own abort controller.
Any future live host must also impose an overall finite model/job deadline.
Redirect refusal gives a fetch-level
HTTP ceiling; DNS/TLS/provider internal network activity is not counted as a
separate observed API request.

## Honest results

The result projection validates public source provenance, the exact native
contract, request/echo bounds, coverage counts, hydration gaps, continuation,
ordering and retrieval metadata before removing identity and row content.
Empty collections and empty hydrated pages remain distinct. Missing or invalid
hydrated rows cannot shorten the native continuation window. A count/list
conflict leaves total and continuation unknown; it must not become a zero,
known-empty collection, complete list or stable snapshot. Zero rows are a
legitimate deployed observation when the source envelope and semantics match.
Do not retry a valid empty result to obtain a more attractive sample.

## Implementation and current validation

The observation kernel has no executable entry point, native-fetch default,
model invocation or authority to acquire a claim. Its input boundary is shared
by future direct and MCP hosts; ordinary tests inject a synthetic fetch adapter.
The current21 kernel tests use the actual compiled full ToolRegistry, real
public policy resolution and native page path with an in-memory storage and
account/OAuth/write services that refuse access. They cover exact two-call
requests; empty, sparse, invalid-row and count-conflict states; altered or
implicit inputs; concurrency/order/extra fetches; source failure; and forged
completeness/provenance. No private database, live provider or account is used.
Snapshots explicitly retain `liveEvidence:false`. These tests establish the
new observation boundary only and earn no real API or Agent/MCP cell.

`scripts/acceptance/native-entity-page-mcp.mjs` adds a construction-only MCP
host using the same kernel and a public-only runtime. It instantiates no real
OAuth/token provider, persistent storage or renderer. Two further MCP tests
validate the actual catalog/policy through the SDK and a real child stdio
handshake, tools/list and tools/call sequence. The child performs exactly two
synthetic GETs; independent exit/receipt checks confirm zero forbidden service
access and denial of an extra call. Total focused coverage is23 tests. Neither
host construction nor these native transport tests invoke a real model or
Bangumi API. The host has no executable main or native-fetch default; it does
not supply the missing claim, execution or terminal-report authority.

These built-runtime tests live under `tests/integration` and run explicitly in
the host-integration CI job after dependency installation and workspace build.
The separate Harness job intentionally installs and builds nothing. A new
dependency-free boundary regression checks placement and ordering. The first
PR292 CI run exposed the original incorrect Harness-suite placement; the
boundary regression was observed RED before moving the tests and wiring the
correct job. No dependency-free gate was skipped or weakened.

## Isolation and authorization before any real operation

The existing generic profile registry and sequence queue support multiple
tools and up to eight calls, but the current one-tool server admits only
auth-none catalog entries plus an existing exact renderer exception. These
two tools have optional catalog auth and resolve to public only for an
explicit username. The construction-only host now validates this exact
input-dependent public case, provides only a public client, and refuses
account/optional-auth access. The future executable launch path must retain
this boundary; do not relabel the catalog or widen the old renderer exception.

The Harness's claim readiness check preserves historical workloads
at Luna/max. The only new exception is an exact registered
native-page Sol6.1/xhigh contract with its own one-shot latch, source/bundle,
selection/catalog/argument hashes, exact Candidate/Base/seven-check CI and
actual same-reviewer PASS. The ordinary reviewer and new workload use the
current Sol xhigh decision. The exact new profile is now registered; no claim has been consumed.
The kernel itself never grants invocation authority. Never rename/retry a spent old list/calendar/A1–A9 case.

The23 kernel/MCP checks, including native stdio, are complete. The model
launcher, signed report, recovery and external evidence consumer described
below are implemented with synthetic diagnostics. Before one invocation,
complete consolidated adversarial preflight, exact CI and comprehensive
independent review. A successful
synthetic provider alone closes neither public nor model cells. Real API,
model/MCP, account and physical clients must remain distinct. Provider-internal
HTTP count and invoice hard ceilings must be reported as unknown unless
actually enforced and observed. Do not activate production services, account,
OAuth, community, QQ/TIM or locked render packs in this increment.

## Model launcher and signed report implementation

The new closed profile is `native-entity-page-public-model-v1`, using only
Sol6.1/xhigh and these exact two calls. All55 existing profile definitions and
their historical Luna/max pins are preserved. The shared Harness adds only
this exact profile exception, exact seven-check CI identity and a dedicated
signed-report validator. No other optional-auth tool is admitted.

The new launcher/stdio entry checks exact source, current Base, clean worktree,
compiled bundle attestation, seven completed CI checks, actual Product PASS
and fresh permanent-claim readback. A private create-once server-start latch
prevents MCP restart from resetting the source-call allowance. The model
process group has a360s timeout and8MiB stdout cap; its MCP child has a420s
independent deadline. Raw stderr is discarded, structured diagnostics retain
bounded stages/counters, and the ephemeral work directory is cleaned. This
is not a provider-internal request, inference-runtime or invoice hard cap.

The compiled fingerprint is in the new dedicated
`docs/product/native-entity-page-mcp-bundle-attestation.json`, included in the
signed source context. The historical G26 attestation remains unchanged.
Reusing it was rejected in preflight because its historical fingerprint
differs from the current built runtime. The new fingerprint is checked against
a forced workspace build locally and in the built-runtime CI job, before any
real claim can be consumed.

The report signs a closed envelope with the claim's Ed25519 key and binds its
source/catalog/selection/program hashes, exact tool descriptors, CI and
reviewer, sanitized native page observations and parsed model-event/answer
hashes. Its producer is the native-public executable, never a synthetic
provider. The kernel's `liveEvidence:false` remains intentional: the kernel
alone grants no live credit; actual producer/claim/signature and external
control-plane admission are additionally required. Unknown provider-internal
HTTP count and invoice ceilings remain null. No identities, rows or raw model
transcripts are retained in the report.

The recovery path performs no model or source request. It preserves a valid
report when an acknowledgement is unknown, honors a competing terminal latch,
and permits a stale claim to become inconclusive only after that exact stale
classification. A lost acknowledgement cannot create another query.

Ten focused signed-report/model-lifecycle tests plus two actual mocked
Harness claim/terminal transactions pass, including signed-report dispatch
through the real Harness implementation. These include valid signatures over
invalid semantics, extra fields, source changes, wrong models/keys/CI, unknown
acknowledgements, stale/competing outcomes and process limits. Mock control is
explicitly forbidden in the native runtime. They create no real claim or model
job and do not change matrix counters. The original23 native tests are not
rerun as a source-compatibility probe.

Read-only local CLI preflight verifies execution flags and all10 disabled
features on the installed0.166.0-alpha.6 CLI without starting a session, model
or MCP server. `features list` does not accept the exec-only configuration
flags; this is not represented as a full exec dry run. Official references
are the [execution flags](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
The preflight also checks cached login presence without displaying its output,
and runs again before claiming. It neither tests model availability with an
inference call nor refreshes authorization.

## External admission and matrix integration

`native_entity_page_evidence.py` admits only the two fixed public/API and
Agent/MCP cells. It requires the actual terminal `REPORT_WRITTEN` disposition,
both permanent labels, exact report hash and derived receipt, original
source/Base/reviewer PASS and the original CI run's seven successful jobs.
The Node validator verifies the Ed25519 envelope and current relevant program,
selection and own descriptor bytes against the immutable source commit.
Later unrelated catalog entries or subsequent merged work do not erase this
scoped proof. An evidence-only integration commit may add only the report,
matrix, frontier and named result document; other changes require new review.

Both the matrix generator and its independent reference checker use this
admission path. Seven Python checks exercise real signatures/Git fixtures and
the actual Node verifier with synthetic external control, including later
unrelated work, invalid terminal/CI/review metadata and both accepted columns.
The table-checker regression was observed failing before its missing adapter
was added. Account, authentication-denial, QQ and TIM columns reject the same
report. Built-runtime checks prove the exact new bundle fingerprint and cold
entry import safety, unsafe gate
paths/modes/symlinks and refusal of mocked control before any source request.

Absent an admitted real report, counters remain public63/65, Agent84/96,
account12/33 and QQ0/TIM0. These tests do not consume an actual profile claim.
Complete source validation, consolidated preflight and exact CI before formal
review; real execution follows only the actual exact-source PASS. Preserve
the completed kernel, native source witnesses, designs and all spent profiles.
