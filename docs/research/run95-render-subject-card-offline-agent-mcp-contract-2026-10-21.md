# Run #95 `render_subject_card` offline Agent/MCP profile

Date: 2026-10-21
Frontier: OP-008, subject overview presentation.
Acceptance scope: one current-source Agent/MCP matrix cell only.

## Selection rationale

The current Agent/MCP table has no current-source profile report for `bangumi.render_subject_card`. The existing historical renderer evidence predates the current source and does not bind a current Candidate, Base, CI run, or GPT-6 Luna Max review. This bounded profile fills only that Agent/MCP evidence gap; it does not close OP-008 or claim public API, authorization, QQ, or TIM acceptance.

The source tool is registered as optional-auth and read-only in `packages/tools/src/definitions/render-presentation-tools.ts`. With `includeCollection=false`, it reads a public Subject and does not request the caller's collection. The profile pins that exact argument, configures a public-only client provider, and rejects any account-client request. It uses Subject ID `990901` solely as a fixed synthetic fixture key; the network guard intercepts the request before any network I/O.

## Fixed invocation and boundaries

- Tool: `bangumi.render_subject_card`.
- Arguments: `{"subjectId":990901,"includeCollection":false}`.
- One allowed request: `GET https://api.bgm.tv/v0/subjects/990901`, answered by a local fixed JSON fixture. Duplicate requests, other URLs/methods, authorization headers, and collection routes fail closed.
- The synthetic Subject has empty image URLs. The asset resolver rejects every attempted resolution and must record zero calls.
- The returned PNG is summarized to the MCP caller by dimensions, byte length, digest, and PNG validity; the artifact bytes and raw Subject payload are not included in the Codex transcript or durable report.
- The renderer runs at the `chat` target (360 CSS pixels, device scale factor 2). The separate preflight capture records the actual 720 px output and is marked as not bound to the reviewed Candidate until a clean exact-Candidate capture exists.

## Evidence rules

Only an exact successful Codex CLI MCP call by GPT-6 Luna Max, with one completed MCP tool event, the fixed arguments, zero shell/non-MCP calls, the exact fixture/asset counters, a valid PNG artifact summary, an exact acknowledgement, and a signed sanitized report can earn this matrix cell. The report must bind the Harness claim, source Candidate, current master Base, exact-Candidate seven-check CI, reviewer identity, MCP bundle digest, profile registry digest, and selection-evidence digest. Any failure after a claim is terminal and must be recorded as inconclusive without replay.

OAuth, account data, collection state, community content, live Bangumi traffic, QQ, and TIM remain outside this profile. The profile does not count as public API evidence, a user journey, visual acceptance of every template, or overall OP-008 completion.
