# Run #95 offline `auth_start` Agent/MCP matrix contract

## Scope

This is one synthetic Agent/MCP matrix check for `bangumi.auth_start`. It is
not real OAuth consent, an account binding, callback acceptance, user-data
access, public API evidence, or QQ/TIM client evidence. OP-009 remains
`PARTIAL`.

## Source behavior and fixture boundary

`bangumi.auth_start` calls `OAuthService.createAuthorizationUrl`. That method
validates the configured client ID, client secret, and redirect URI; creates a
single-use state record in its supplied `Storage`; and constructs an
authorization URL. It does not invoke the provider HTTP client. The offline
server supplies a `MemoryStorage`, synthetic principal context, synthetic
client credentials, a loopback callback, and an `https://oauth.invalid/`
authorization host. It removes inherited Bangumi/OAuth/database variables
before constructing dependencies, and its HTTP client fails closed while
counting any attempted request.

The registered call is exactly one `bangumi.auth_start` with
`{"capabilities":["read:collection"]}`. This value is a local capability tag;
the OAuth provider does not receive a `scope` parameter. The fixture validates
the URL and state in memory, records only booleans/counts/parameter names, and
creates no Bangumi account, credential, or binding. It does not open a browser.

## Answer and report

The Agent must state in concise Chinese that it generated a synthetic offline
test link, did not open it, did not complete consent, and did not access account
data. It must not repeat the URL or state, or imply that the local capability
tag grants a provider permission.

The one-shot claim is permitted only after the exact active Run #95 Epoch,
Candidate, synchronized Base, seven exact-head CI checks, same-identity GPT-6
Luna Max PASS, current MCP bundle, and unclaimed profile are verified. A signed
create-once report binds those gates and stores sanitized hashes, counts,
parameter names, and boolean results only. It stores no URL, OAuth state,
client ID, principal ID, prompt, raw answer, account identifier, token, or
artifact bytes. A valid Harness `REPORT_WRITTEN` disposition credits only the
`bangumi.auth_start` Agent/MCP matrix cell; an `INCONCLUSIVE` claim is terminal
and cannot be retried.

## Validation boundary

Tests exercise only the local synthetic fixture. Expected assertions include
exact one-tool/one-call behavior, one temporary state, no provider scope, zero
HTTP requests, zero account/credential/binding writes, correct bounded Chinese
answer semantics, report privacy, signature integrity, exact Candidate binding,
and permanent no-retry behavior. This profile does not update the real OAuth,
account, QQ, TIM, callback, or scenario acceptance counts.
