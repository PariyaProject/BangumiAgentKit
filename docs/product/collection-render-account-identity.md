# Personal collection render identity

`render_collection_progress` and `render_subject_card(includeCollection=true)`
read one account snapshot: the client and account username captured when the
registry authenticates the request. They use that same client for the subject
and collection reads and pass the captured username to the generated
`GET /v0/users/{username}/collections/{subject_id}` method. The generated client
continues to encode the path segment. There is no implicit `me` or `-` alias;
an account actually named `me` is valid when it is the captured account.

The registry remains the owner of authentication/capability policy. These
tools consume its trusted `executionSession` without resolving the binding
again. A binding switch after request authentication does not replace that
request's client or username with a later account. This is a request snapshot,
not a promise that it tracks the active account at response time.

Direct internal execution without `executionSession` resolves one bound
session through `requireAuthenticatedClient(principalId, ['read:collection'])`.
A provided but incomplete session is rejected rather than upgraded through
another binding lookup. A client, non-empty principal and non-empty string
username without surrounding whitespace are required before any subject or
collection request. The username is consumed unchanged; no nickname, ID or
alias is guessed. Missing identity raises `AUTH_REQUIRED` before rendering or
artifact storage. The internal session is trusted input, not a new model-facing account
parameter or independent credential/account-pair verification mechanism.

Existing presentation behavior is preserved:

- Public subject cards without `includeCollection` use the existing optional
  or anonymous client and make no collection request.
- Once identity is valid, an unavailable optional collection still degrades
  to the public subject card. Required progress without a collection remains
  `NOT_FOUND`.
- Personal collection data still uses `artifactPrincipalKey || principalId`
  and principal-scoped storage with render caching disabled. This does not add
  account-specific revocation of previously saved artifacts.
- This change adds no API route, schema, OAuth/token/scope/refresh policy,
  write capability, profile or design option. Normal successful execution has
  two logical GETs; existing transport retries and credential-refresh behavior
  are unchanged, so that is not a universal wire-request bound.

The motivating source audit and compiled negative examples are recorded in
[Pariya's account-identity audit](https://github.com/PariyaProject/PariyaAgent/blob/59b09fb6f4c996864b6f6cb19429a38ae28c8a9c/docs/research/run95-collection-progress-source-audit-2026-10-25.md).
Regression coverage lives in
`tests/unit/personal-collection-render-session.test.ts`. It uses actual
Registry/MemoryStorage/TokenBroker/generated-client/domain-service paths with
synthetic credentials and an injected HTTP transport. Binding switches,
different account records and a public collection belonging to a user named
`me` expose both repeated-resolution and wrong-username failures. ViewModel,
artifact scope and cache behavior are checked with mocked rendering/storage.
These are source/behavior regressions, not PNG, real OAuth/account,
Agent/MCP-profile, QQ/TIM or aesthetic acceptance.

After reviewed integration, a new source-pinned QA image and bounded compiled
proof are still needed before a currently consented account/client acceptance
step. Existing profile terminal dispositions and locked designs remain intact;
this correction alone earns no acceptance-matrix row or scenario completion.
