# Run #95 OAuth, personalized replies, and user-owned data boundary

Checked 2026-10-13 against Bangumi's public OAuth documentation, the current
public v0 OpenAPI schema, the repository's pinned schema and 96-tool catalog,
and local synthetic tests. This report separates synthetic product evidence
from real-account evidence.

## What was validated locally

| Journey                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Limit                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth start/callback/status    | `tests/unit/auth.test.ts` exercises the authorization-code callback with a fake token endpoint and `/v0/me`. It checks the state-linked principal, encrypted token storage, local requested-capability labels, no unsupported `scope` query parameter, and truthful `scopeEvidence=unknown` for a null provider scope. Other auth tests cover one-use hashed state, missing-credential fail-closed behavior, safe callback errors, bound-account status, and multi-account isolation.                                                                                                                                                                                                                          | No real Bangumi app credentials, consent, callback, token, or account was used. A fixture callback is not real OAuth acceptance.                                                                                           |
| Personalized collection answer | The GPT-6 Luna Max Agent/MCP fixture calls only `bangumi.get_collection_intelligence` for a synthetic bound account. The current sanitized natural-answer report records one successful tool call and one fake bearer-backed collection request, partial coverage, randomized synthetic tag/count/source-total facts, and all 12 answer checks passing. Each run randomizes the tag, its frequency, and the source total; the prompt does not contain those answers and tells the model to use the returned coverage rather than infer the observed count from the request limit. See `run95-l04-collection-intelligence-agent-mcp-synthetic-2026-10-13-natural-v3.json`. No raw answer or row data was saved. | This proves only an answer grounded in an unpredictable synthetic result. It does not prove a reply based on the user's real collection or external client display. The collection read remains account-bound and bounded. |
| User-owned collection update   | `tests/unit/writes.test.ts` executes `bangumi.update_collection` for a synthetic principal/account, checks the exact `POST /v0/users/-/collections/{subject_id}` payload and bearer, verifies the canonical collection `GET` readback and audit event. A second case verifies that a successful POST followed by failed canonical refresh returns `updated_but_refresh_failed`, not a verified final state.                                                                                                                                                                                                                                                                                                    | Fake HTTP only. No real collection was changed. A live write still needs an explicitly selected owned entry, exact field/value authorization, and a separate live readback.                                                |
| Cross-principal isolation      | `tests/unit/collection-intelligence.test.ts` verifies that another principal cannot invoke a private collection read and that rejection occurs before any HTTP request. Existing multi-account tests also reject switching to an account not bound to the principal.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Local storage and fake dependencies only.                                                                                                                                                                                  |
| Reported provider scopes       | Capability and index tests model explicit provider-reported scopes: `read:collection` is a local capability label, not an official provider scope; a reported collection write requires `write:collection`; index writes require `write:indices`. Missing write scope denies before the request. Unknown scope evidence remains delegated to the upstream API.                                                                                                                                                                                                                                                                                                                                                 | Scope tests do not establish which scopes a live authorization grants. Bangumi's OAuth guide says the authorization `scope` parameter is not implemented and its example token response returns `scope: null`.             |

The final focused offline regression run on 2026-10-13 passed 22 files / 117 tests:
OAuth service/client and callback, one-use state and expiry, encrypted-token
rotation and refresh concurrency, account/principal isolation, scope policy,
auth-before-write, account-bound auditing, bounded collection intelligence,
the generated-answer checker, exact collection update/readback, direct MCP
account tools, prompt-answer-leak regression, and the no-account/auth-boundary
contract. The focused run is synthetic/local only; it does not change BGK-004
or BGK-005 real-account status. The remaining local gates passed: `pnpm
harness:test` 163/163; `pnpm acceptance:check` 99/99 with catalog/direct 96,
public evidence 56/65, public N/A 31, auth denial 21, real-auth pending 33,
Agent/MCP 83/96, and QQ/TIM 0/96; typecheck, lint, and build; OAuth report
validation; OpenAPI validation (46 paths / 55 operations); and frontier check
(121 records / 99 actionable, ledger hash
`677c46f9e3d5c682d0a23a75363312537d0c7057421af2ac4ba58e146acab6f0`). These
are local, synthetic, or no-account checks; none changes the real-account
status.

The earlier 2026-10-12 and pre-correction 2026-10-13 reports are retained as
history but are not credited. In particular, v8 was not an independent answer
test: its prompt supplied the complete expected answer, including tag, count,
denominators, and caveat. It has been superseded and must not count as model
grounding evidence. The first two uncoached natural-answer runs are also
retained as sanitized INCONCLUSIVE reports. The current natural-v3 prompt does
not seed expected values; its synthetic fixture randomizes tag, top-tag count,
and source total while holding the bounded request size fixed. The passing
report confirms one MCP call, one fake token-bound source request, a partial
result, and all 12 current answer checks, without saving raw answer or rows.

The current checker binds a positive top-tag claim to its exact count, anchors
ranking continuations to the expected tag, requires positive exact denominator
phrases, catches common preference/recommendation language, splits contrastive
clauses including `而`, rejects denied synthetic disclosure and unsupported
real-user provenance, and rejects full-collection claims. The new tests cover
the four round-3 findings plus the prompt leakage and the naturally worded
“not your real collection” caveat. No report contains the answer text, source
rows, account identifier, or credentials.

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
