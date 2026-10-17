# Run #95 G01 query_subjects offline Agent/MCP matrix contract

## Scope

This profile checks exactly one `bangumi.query_subjects` Agent/MCP invocation and may credit only that tool's Agent/MCP matrix cell. It is a new synthetic profile with the fixed keyword `run95 synthetic query subjects matrix offline 20261017` and one synthetic subject ID `990930`. It does not reuse the consumed G01 canary, the consumed title query `葬送的芙莉莲`, or the existing render-only fixture and its subject ID `990920`.

The report is matrix-only. G01's July 2026 harem question remains `PARTIAL`; this profile does not answer that question, establish catalog completeness, assess renderer quality, or add public API evidence. The user-confirmed public API target stays 65/65.

## Local-only request fixture

The profile calls the query tool once with media `anime`, result mode `top`, limit 1, relevance sort, no explanation, and `nsfw=false`. The tool's only allowed fetch is the exact anonymous `POST https://api.bgm.tv/v0/search/subjects?limit=20&offset=0` with the fixed synthetic keyword, `sort=match`, and filter `{type:[2], nsfw:false}`. An in-process fetch fixture returns one synthetic row. It allows only the exact standard `Accept`, `Content-Type`, and default `User-Agent` header values; every other or altered header (including authorization, cookie, proxy authorization, and API-key headers), credential mode, duplicate search, detail hydration, method, route, query string, origin, or unexpected request is denied. The sanitized fixture snapshot records only an aggregate `rejectedHeaderCount`, never header names or values. The fixture is the only `HttpClient` fetch implementation for this profile; it never calls native fetch.

The profile exposes only the `query_subjects` MCP tool. Codex is configured with web, browser, computer, apps, plugins, multi-agent, and shell access disabled. The runner requires one completed MCP event with the exact registered arguments, a successful result, no other tool activity, the expected sanitized server summary, and a clean unchanged Candidate bundle. It responds with a fixed acknowledgement rather than source rows.

## Evidence and boundaries

The signed report retains only exact Candidate/Base/CI/reviewer/claim bindings, descriptor and bundle hashes, bounded query counters, booleans, and an Ed25519 runner receipt. It omits the prompt, answer text, synthetic keyword, source row, subject title or ID, response body, raw event stream, credentials, and fixture payload. The report validator checks the current profile registry entry, exact tool catalog descriptor, selection-note hash, local fixture counters, signature, current Harness disposition, and exact Candidate history.

No real Bangumi request, authentication/account/community/private HTML/write path, QQ pipeline, or TIM client is used. A successful report adds one Agent/MCP matrix cell only; it does not change G01's scenario status or the public API matrix. If the one-shot claim is created, every outcome is final and must not be retried.
