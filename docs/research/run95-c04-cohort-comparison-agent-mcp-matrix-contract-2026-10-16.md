# Run #95 C04 cohort comparison Agent/MCP matrix contract

Checked on synchronized master `ae95eee55236fbabc705716c91ce21b1256abc24` before implementation. This is a bounded, anonymous public-read Agent/MCP matrix check for `bangumi.compare_subject_cohorts` and `bangumi.render_subject_cohort_comparison`. It does not change A01 or C04 scenario status.

## Fixed call sequence

One registered profile contains exactly these calls, in order. The runner starts two separate ephemeral Codex runs, and each MCP server instance exposes only the one tool selected for that run:

1. `bangumi.compare_subject_cohorts`
2. `bangumi.render_subject_cohort_comparison`

Both receive the same fixed arguments: two cohorts for `2025-winter` and `2025-spring`, each constrained to `media=anime`, `metaTags=["原创"]`, and `resultMode=all`, with `maxSubjects=1` per cohort. The profile stores only these fixed query definitions; it does not store source rows, subject names, IDs, answer text, or image bytes.

The schema in `packages/tools/src/definitions/discovery-tools.ts` requires cohort queries to use `resultMode=all` and allows one or two cohorts. `compareSubjectCohorts` in `packages/discovery/src/cohort.ts` queries each cohort and hydrates only the bounded returned subjects. `render_subject_cohort_comparison` in `packages/tools/src/definitions/render-presentation-tools.ts` runs the same comparison again and renders a local card; the renderer description says it does not read network assets. The second tool call therefore repeats the fixed public query work as required to exercise the renderer tool itself.

## Network and data boundary

Each MCP server must expose only its one exact registered anonymous read tool and deny any argument mismatch or repeat. Its request wrapper allows only anonymous `POST /v0/search/subjects` and `GET /v0/subjects/{subject_id}` requests to `https://api.bgm.tv`, blocks query-string credentials, Authorization/Cookie/API-key headers, user-info URLs, redirects, HTML, private `/p1`, community, and every other route. Each run has a 16-request cap, so the two sequential runs allow at most32 HTTP requests in total. The second run starts only after the first run and its sanitized server summary pass validation.

The report may retain the two tool names, input/profile hashes, per-run count, event/result booleans, combined request counters, bounded coverage states/counts, and ephemeral artifact metadata. It must not retain raw result rows, labels, titles, subject/person IDs, prompt/answer text, request bodies, or image bytes. If either run or tool errors, a call is wrong, coverage metadata is malformed, or the combined request budget is exceeded, the single profile becomes terminal `INCONCLUSIVE` with no report, no matrix credit, and no retry.

## Acceptance limit

A valid signed report can credit at most the Agent/MCP matrix cells for the two named tools. A01 stays `UNASSESSED`; C04 remains at its existing capability status without new scenario evidence; C07's earlier terminal claim is preserved. The public API target remains65/65. No OAuth, account, community, QQ, or TIM path is used.
