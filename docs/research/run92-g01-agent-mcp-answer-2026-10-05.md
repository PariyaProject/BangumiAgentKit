# Run 92 — G01 current-source Agent/MCP answer acceptance

## Selection record

- Base: `87f1fc6c0a36adfb8d62a831947ee4a707a4c724`
- Frontier hash at selection: `ff5891cb732b21b989a6e4a40d16d5c04482206456650b1a35dc7392c8201fe6`
- Policy: `harness-v3.2-frontier-closure-v1`
- Selected record: G01, “今年七月番中的后宫动画有哪些？”
- This is a bounded selection audit, not frontier exhaustion.

## Six-lane comparison

1. **Recorded opportunities and deferred work.** OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain `RESEARCH_READY`; their current source-contract evidence does not authorize product community requests. The local Run 78 audit found no safe third-party call variant, so this Epoch makes no community request and does not close either record. OP-004 is already delivered; OP-005 and OP-012 remain partial. Authentication and private-collection work remains externally gated.
2. **Capability journeys.** G01 had earlier direct ToolRegistry evidence of 15 matching rows and an inspected `render_query_subjects` card showing 12 and disclosing 3 more. The one exact-Candidate Agent/MCP call on 2026-10-05 returned a current 14-row visible projection; all 14 titles, dates, IDs and order matched the MCP text. These are time-specific source observations, not a stable total. G15 is also partial but requires a two-subject comparison and broader answer validation. The selected bounded G01 check used one read-only query.
3. **Agent UX and discoverability.** Tool catalog coverage establishes that a tool can be invoked; it does not establish that the Agent returns the rows and scope correctly for G01. This Epoch checks one exact `bangumi.query_subjects` call and validates each answer row against the visible MCP result.
4. **Renderer and Standalone.** `DiscoveryResultsCard` already localizes the experimental-source, estimated-total, bounded candidate/page and 12-row display caveats. Existing mobile-width tests cover 320, 360 and 520 CSS pixels. This Epoch does not repeat renderer work.
5. **Correctness, evidence and resources.** Official v0 subject search is marked experimental and its totals are estimates. The check pins media to anime, the calendar month to July 2026, the exact `后宫` concept input, and the `searchSubjects` operation. Existing discovery regressions cover the exact tag mapping. It requires returned-row identity/date matches and explicit bounded/estimated/non-exhaustive language. Listing every visible row in source order accounts for the visible row count; a separate numeral is optional. If the MCP text projection omits rows, the answer must disclose the exact omission count and that an unshown row is not proof of absence. It does not infer all-site completeness from an exhausted observed page.
6. **Architecture, maintenance and testability.** Existing query, provider, MCP and Renderer seams already support the bounded question. No source expansion or architecture change is needed. A shared QA checker makes the positive-row and caveat contract repeatable and adversarially testable.

## Scope salvage and chosen increment

The useful safe claim is the exact set visible in one current official-v0 result, with each title, ID and air date checked against that result. The Agent must identify the exact tag and July 2026 anime scope, say the search source is experimental and its total is estimated, and avoid a complete-Bangumi claim. G01 stays `PARTIAL` because one bounded search response does not prove exhaustive coverage.

The implementation adds a reusable in-memory answer checker for the actual compact MCP projection and regression tests. The exact-Candidate report is [`run92-g01-agent-mcp-canary-2026-10-05.json`](run92-g01-agent-mcp-canary-2026-10-05.json). The initial v1 checker rejected only because it required a separate count phrase; v2 accepts the complete 14/14 exact row listing as accounting for the visible count. This reassessment uses sanitized counters only; no second public call was made. The CLI event stream did not expose a separate `structuredContent` field. The report stores only counts and booleans, not the prompt, answer, item names, item IDs, or raw MCP result.

## Explicit exclusions

- QQ/TIM delivery, login preflight, and authenticated account data are separate acceptance surfaces.
- No direct ToolRegistry or Renderer call is repeated.
- No community HTML, private `/p1` API, cookie, user token, background poll, or cache is added.
- No complete-catalog claim or frontier closure is made.
- PR #83 remains parked for human review and is not modified.

## Review boundary

Do not review after the checker alone: the exact-Candidate Agent answer and its sanitized evidence are part of the same G01 acceptance capability. Do not extend into QQ/TIM, authentication, source authorization, or another discovery scenario; those require different evidence and review context.
