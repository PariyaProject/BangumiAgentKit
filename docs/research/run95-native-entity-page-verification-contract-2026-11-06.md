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
Any future live host must also impose a conservative inter-request delay and
an overall finite model/job deadline. Redirect refusal gives a fetch-level
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
The current19 Node tests use the actual compiled full ToolRegistry, real
public policy resolution and native page path with an in-memory storage and
account/OAuth/write services that refuse access. They cover exact two-call
requests; empty, sparse, invalid-row and count-conflict states; altered or
implicit inputs; concurrency/order/extra fetches; source failure; and forged
completeness/provenance. No private database, live provider or account is used.
Snapshots explicitly retain `liveEvidence:false`. These tests establish the
new observation boundary only and earn no real API or Agent/MCP cell.

## Remaining work before any real operation

The existing generic profile registry and sequence queue support multiple
tools and up to eight calls, but the current one-tool server admits only
auth-none catalog entries plus an existing exact renderer exception. These
two tools have optional catalog auth and resolve to public only for an
explicit username. A new host must validate this exact input-dependent public
case, provide only a public client, and reject account/optional-auth access;
it must not relabel the entire catalog or widen the old renderer exception.

The Harness's existing claim readiness check also pins historical workloads
to Luna/max. Preserve those contracts exactly. Add only an exact registered
new native-page Sol6.1/xhigh contract with its own one-shot latch, source/bundle,
selection/catalog/argument hashes, exact Candidate/Base/seven-check CI and
actual same-reviewer PASS. The ordinary reviewer and new workload use the
current Sol xhigh decision. No new profile is registered or consumed by this
preparation kernel. Never rename/retry a spent old list/calendar/A1–A9 case.

Before one invocation, complete synthetic MCP/native lifecycle diagnostics,
sanitized model-event/answer validation, signed report and terminal-latch
reconciliation, source-bound evidence import, consolidated adversarial
preflight, exact CI and comprehensive independent review. A successful
synthetic provider alone closes neither public nor model cells. Real API,
model/MCP, account and physical clients must remain distinct. Provider-internal
HTTP count and invoice hard ceilings must be reported as unknown unless
actually enforced and observed. Do not activate production services, account,
OAuth, community, QQ/TIM or locked render packs in this increment.
