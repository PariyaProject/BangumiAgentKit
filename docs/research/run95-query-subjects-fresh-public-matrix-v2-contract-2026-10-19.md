# Run #95 fresh `query_subjects` Agent/MCP matrix v2 contract

Date: 2026-10-19 JST. Epoch: `run95-query-subjects-fresh-public-matrix-v2-20261019`.

## Purpose and acceptance boundary

This contract supports one new, bounded, anonymous Agent/MCP matrix observation
for `bangumi.query_subjects`. Its exact registered input is
`{"keyword":"天空之城","media":"anime","resultMode":"top","limit":1,"sort":"relevance","explain":"compact","nsfw":false}`.
The registry and source guard reject changes to the fixed input, and the profile
assertion rejects an input already registered by another `query_subjects`
profile.

This can add only the current Agent/MCP matrix cell for `bangumi.query_subjects`
after an accepted signed report. It does not close G14, establish ranking or
catalog completeness, cover `render_query_subjects`, or add renderer, OAuth,
account, QQ, or TIM evidence. G14 remains `PARTIAL` because this bounded search
cannot prove the full scenario's ranking or completeness requirements.

The current generated Agent/MCP baseline is 81/96. Two cells previously shown
as credited no longer pass live evidence validation: G06 cast v2 has Harness
state `AMBIGUOUS_TERMINAL_LATCH`, and the R04 render v2 report's registered
profile hash does not match the current profile. Keep both reports as history,
but do not count or rerun them. This reconciliation is separate from the v2
query claim and from UX-001 visual/client acceptance.

## v1 disposition and classifier evidence

The earlier `query-subjects-fresh-public-matrix-v1` claim is terminal
`INCONCLUSIVE`: it wrote no report, earned no matrix credit, and has
`retryAllowed: false`. Never invoke v1 again. Its temporary event stream was
deleted by the runner, so the exact error text cannot be recovered.

A separate local diagnostic used stable Codex CLI 0.163.0 and a synthetic MCP
stub. It made no Bangumi request and no Harness claim. One stub MCP call and the
turn completed, alongside three Codex error items classified in memory as
web-search-related and disabled. Only bounded category/count metadata was
retained; raw messages were discarded. This is consistent with the v1 failure,
but does not prove that the deleted v1 messages were identical.

The shared classifier accepts the two existing exact disabled/unavailable
messages and now also accepts a short error only when its message explicitly
identifies the web-search tool and says it is disabled. Messages over 512
characters, negated “not disabled” statements, generic errors, unrelated
disabled tools, and network failures remain unexpected. The v2 runner accepts
at most three error items only when every one matches that narrow class; it
still requires a complete event stream,
completed turn, exactly one registered MCP call, no non-MCP or shell events,
the exact acknowledgement, and a valid bounded server summary.

## Anonymous request and privacy bounds

The dedicated profile exposes one read-only tool and permits only anonymous
HTTPS `POST https://api.bgm.tv/v0/search/subjects` requests. The JSON body must
contain the fixed keyword, anime type filter, match sorting, and `nsfw: false`;
each page is limited to 20 items and the request budget is at most eight pages.
Credentials are forced to `omit`, redirects are rejected, and all other hosts,
routes, methods, bodies, credential-bearing headers, and over-budget requests
fail closed.

The one-shot uses GPT-6 Luna Max and permits one exact MCP tool call. It forbids
shell and web tools, account or OAuth access, community reads, writes, QQ, and
TIM. The temporary event stream is hashed and removed. A successful report
stores bounded result counts, coverage state, request counters, source hashes,
and a signed receipt; it does not store the prompt, answer text, subject names
or IDs, account data, credentials, or community data. The accepted response is
exactly `QUERY_SUBJECTS_PUBLIC_MATRIX_V2_OK`.

## Execution gates and limits

The runner requires the exact current Candidate and Base, all seven required CI
checks on that Candidate, a ready active Epoch, and a passing same-identity
GPT-6 Luna Max review for that Candidate/Base. It rechecks the gates
immediately before and after the one-shot. A terminal disposition is never
retryable. The profile is not eligible for invocation until implementation,
tests, exact-Candidate CI, Harness Candidate, and review gates have passed.

No v2 Bangumi request has been made while authoring this contract. A matrix
credit can be recorded only after the guarded one-call runtime and Harness
`REPORT_WRITTEN` readback both succeed.
