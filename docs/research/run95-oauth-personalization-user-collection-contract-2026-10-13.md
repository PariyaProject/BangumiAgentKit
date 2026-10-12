# Run #95 OAuth, personalized replies, and user-owned data boundary

Checked 2026-10-13 against Bangumi's public OAuth documentation, the current
public v0 OpenAPI schema, the repository's pinned schema and 96-tool catalog,
and local synthetic tests. This report separates synthetic product evidence
from real-account evidence.

## What was validated locally

| Journey | Evidence | Limit |
| --- | --- | --- |
| OAuth start/callback/status | `tests/unit/auth.test.ts` exercises the authorization-code callback with a fake token endpoint and `/v0/me`. It checks the state-linked principal, encrypted token storage, local requested-capability labels, no unsupported `scope` query parameter, and truthful `scopeEvidence=unknown` for a null provider scope. Other auth tests cover one-use hashed state, missing-credential fail-closed behavior, safe callback errors, bound-account status, and multi-account isolation. | No real Bangumi app credentials, consent, callback, token, or account was used. A fixture callback is not real OAuth acceptance. |
| Personalized collection answer | The GPT-6 Luna Max Agent/MCP fixture calls only `bangumi.get_collection_intelligence` for a synthetic bound account. The current sanitized report records one successful tool call, 20 observed rows of a source-reported 30, `partial` coverage, and the leading synthetic tag count (7). The checker requires a positive top-tag assertion bound to its exact count, exact denominators, synthetic disclosure without real-user provenance, partial-coverage disclosure, a non-inference caveat without unsupported preference/recommendation claims, and no full-collection claim. See `run95-l04-collection-intelligence-agent-mcp-synthetic-final-2026-10-13-v8.json`. Five same-day replies remain as sanitized INCONCLUSIVE reports; two earlier replies are interim passes under prior checker versions. No raw answer text was saved. | This proves an answer grounded in a synthetic result only. It does not prove a reply based on the user's real collection or external client display. The collection read remains account-bound and bounded. |
| User-owned collection update | `tests/unit/writes.test.ts` executes `bangumi.update_collection` for a synthetic principal/account, checks the exact `POST /v0/users/-/collections/{subject_id}` payload and bearer, verifies the canonical collection `GET` readback and audit event. A second case verifies that a successful POST followed by failed canonical refresh returns `updated_but_refresh_failed`, not a verified final state. | Fake HTTP only. No real collection was changed. A live write still needs an explicitly selected owned entry, exact field/value authorization, and a separate live readback. |
| Cross-principal isolation | `tests/unit/collection-intelligence.test.ts` verifies that another principal cannot invoke a private collection read and that rejection occurs before any HTTP request. Existing multi-account tests also reject switching to an account not bound to the principal. | Local storage and fake dependencies only. |
| Reported provider scopes | Capability and index tests model explicit provider-reported scopes: `read:collection` is a local capability label, not an official provider scope; a reported collection write requires `write:collection`; index writes require `write:indices`. Missing write scope denies before the request. Unknown scope evidence remains delegated to the upstream API. | Scope tests do not establish which scopes a live authorization grants. Bangumi's OAuth guide says the authorization `scope` parameter is not implemented and its example token response returns `scope: null`. |

The final offline regression run on 2026-10-13 passed 19 files / 97 tests:
OAuth service/client and callback, one-use state and expiry, encrypted-token
rotation and refresh concurrency, account/principal isolation, scope policy,
auth-before-write, account-bound auditing, bounded collection intelligence,
the generated-answer checker, exact collection update/readback, direct MCP
account tools, and the no-account/auth-boundary contract. The full local gates
also passed: Harness 163/163, acceptance 99/99, typecheck, lint, build, OpenAPI
validation, and the 121-record frontier ledger check. These are local,
synthetic or no-account checks; they do not change BGK-004 or BGK-005 real
account status.

The earlier 2026-10-12 and pre-correction 2026-10-13 reports are retained as
history but are not credited. Review found count-attribution and whole-number
boundary errors, missed preference/recommendation assertions, unrelated
negation hiding a later full-collection claim, and a synthetic disclosure that
could be contradicted by claiming real-user provenance. New adversarial tests
cover those cases, coordinated caveats, and truthful synthetic disclosure.
Five 2026-10-13 model replies failed sanitized answer checks; their reports
record only which checks failed, not raw answer text. Two interim replies
passed under earlier checker versions. The current checker additionally
requires a positive top-tag assertion to bind to the exact count and rejects
unranked counts or a nearby count belonging to another tag. The latest reply
passes the current checker. Its report stores only sanitized tool/coverage
counters and Boolean checks, not the answer, rows, account identifier, or
credentials.

## What “update my information” can mean here

The current public v0 contract and tool catalog support user-owned collection
changes such as status, rating, tags and comment; episode progress; favorites;
and index/directory operations. Destructive removals and bulk changes retain
their confirmation policy. `get_my_profile` reads the token-bound profile, but
the public v0 schema contains no profile-metadata mutation operation for fields
such as nickname, avatar, or signature. This Epoch does not use private `/p1`
routes and does not promise profile editing.

The local tool's `read:collection` label still means that the tool requires a
bound authenticated account. It is not sent as an OAuth scope and is not
evidence of provider consent. Official v0 marks the collection read as
`OptionalHTTPBearer` and documents that private collections need an access
token; collection mutation declares `write:collection`; index mutation
declares `write:indices`.

## Real-account acceptance remains open

A presence-only inspection of the selected BangumiAgentKit `.env.local` on
2026-10-13 found mode `0600`, empty client ID and client secret, and a configured
redirect URI. Values were not printed. No authorization URL was generated; no
login, consent, callback, token inspection, private collection read, real
personalized reply, or live write was performed.

Accordingly, `BGK-004` remains `BLOCKED_EXTERNAL` at 0/1 real OAuth flows and
`BGK-005` remains `BLOCKED_EXTERNAL` at 0/33 real account/tool rows. The next
real read-only pass requires the owner to configure the OAuth app locally and
complete official consent. A live mutation remains a distinct step requiring a
specific owned entry and exact change authorization. No secret should be sent
in chat or committed.

## Primary sources

- [Bangumi OAuth authorization guide](https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md) — authorization-code flow, unimplemented `scope` request parameter, and example null token scope.
- [Bangumi server public v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) — `/v0/me`, read-only `/v0/users/{username}`, private collection read, current-user collection writes, episode progress, and index write scopes.
- Repository-pinned source: `openapi/upstream/v0.yaml` and `docs/tool-catalog.json`.

No live OAuth or account acceptance is claimed by this report.
