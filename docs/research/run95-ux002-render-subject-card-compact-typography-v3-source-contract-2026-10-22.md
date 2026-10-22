# Run #95 UX-002 Compact Typography Renderer Profile v3

Date: 2026-10-22 (UTC)
Epoch: `run95-ux002-render-card-compact-typography-agent-mcp-v3-20261022`
Frontier: OP-008, subject overview presentation.

## Selection and prior-profile boundary

The user approved the compact typography direction after reviewing three previews. The renderer already defaults to scale `0.75`, supports per-render scale and body/display font stacks, and can load trusted operator-provided font files. The exact implementation Candidate `ed45febb787301d44080756fa6edc2792897fe53` has a separate synthetic visual receipt for 1,770 PNGs and 59 contact sheets; that visual receipt does not count as Agent/MCP evidence or prove production font delivery or QQ/TIM display.

Profile `render-subject-card-compact-typography-agent-mcp-v2` is terminal on merged PR #250: Harness status is `INCONCLUSIVE`, one call, no report, and `retryAllowed=false`. Its original claim, labels, input, and historical source-contract text remain unchanged. Never rerun or reconcile v2, reuse subjectId 991902, or create a substitute report.

The v3 profile is a new create-once contract after PR #253 merged the shared Codex event-field normalizer. It has a different profile ID, Epoch ID, argument profile, synthetic input, network mode, claim label, and report path. It adds no credit unless its own exact-Candidate report passes validation.

## Fixed synthetic request

- Profile: `render-subject-card-compact-typography-agent-mcp-v3`.
- One call: `bangumi.render_subject_card` with `{"subjectId":991903,"includeCollection":false}`.
- One allowed request: `GET https://api.bgm.tv/v0/subjects/991903`. The local MCP server intercepts it and returns a fixed synthetic Subject. No external API request or image URL is allowed.
- Fixture title: `夜明けの記録 / Daybreak Notes`; Chinese title: `紧凑字阶复核：晨光与远岸`. The content is synthetic and contains no real subject or user information.
- Renderer uses its default `0.75` font-size scale. The output is an ephemeral PNG artifact; the report stores only dimensions, byte length, and SHA-256, never image bytes, prompt, answer, or fixture rows.

## Claim gates and outcome limits

Before the only v3 claim: exact current Candidate and Base, seven successful exact-SHA CI checks, passing Harness `candidate:check`, same-identity GPT-6 Luna Max review PASS, current bundle attestation, and fresh Harness `UNCLAIMED` status are required. The profile must expose only the one registered tool, reject any extra call, request, authorization header, collection route, or asset resolution, and retain the zero-non-MCP/shell gates. Any v3 inconclusive result is terminal and cannot be retried.

This profile can add only the `render_subject_card` Agent/MCP matrix row if the sanitized report and Harness disposition pass. It does not add visual QA, scenario-answer completeness, production-font installation, account/OAuth, community, QQ, or TIM evidence. Those remain separately governed.

No profile claim or MCP call has occurred for v3 as of this selection record.
