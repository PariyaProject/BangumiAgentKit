# Run #95 R01 relation text projection profile — source contract

**Status:** selection evidence for a new offline Agent/MCP matrix profile. No live API request or MCP acceptance call is part of this source audit.

## Why this profile is bounded

R01 `get_subject_relations` has a valid matrix gap, but its earlier v1 one-shot on PR #191 is terminal `INCONCLUSIVE`, with no report and no retry permission. That profile must not be invoked again. This profile has a new registry ID, Epoch, argument profile, synthetic subject, fixture, and report path. It can add at most the Agent/MCP matrix cell for this tool; R01 remains `PARTIAL`.

The official Bangumi v0 OpenAPI defines `GET /v0/subjects/{subject_id}/subjects` with only the `subject_id` path parameter and an array response. It defines no pagination parameter or total count for this operation. This is why the profile makes no whole-graph completeness claim. The source used for this audit is pinned to [`open-api/v0.yaml` at commit `65d29cff2331e08c0110d30d515f7f1b6488f845`](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml).

## What the profile checks

The new profile calls only `bangumi.get_subject_relations` once with fixed input `{ "subjectId": 991408, "includeEvidence": true }`. Its exact local fixture accepts one anonymous GET for that subject and returns 30 deterministic synthetic direct relation rows. It rejects any other method, URL, query, request body, authorization header, or duplicate request.

The result presenter caps MCP text at 3,600 UTF-8 bytes. For relation results it starts with at most 24 rows and shrinks the displayed row count until the serialized text fits. It returns the full result separately as `structuredContent`. The acceptance answer must distinguish source rows observed and returned from rows shown in the text projection, use the presenter’s exact included/omitted counters, identify the first displayed relation, and state that text omission does not remove rows from `structuredContent`. The answer checker verifies those claims against the actual tool output and all 30 synthetic structured rows; it does not assume a fixed displayed-row count.

## Limits and isolation

- The 30 rows are synthetic and do not describe real Bangumi relations.
- The check is only Agent/MCP matrix evidence. It does not establish completeness, reverse edges, transitive edges, canonical relation order, or official watch order.
- No tool catalog or public schema change is selected. The fixture runs offline and does not call Bangumi, read an account, attempt OAuth, read community data, write data, or test QQ/TIM.
- A successful report requires the exact Harness Candidate, current base, exact-head seven-check CI, Candidate check, and same-identity GPT-6 Luna Max review before the permanent one-shot claim. Terminal results are never retried.
