# Run #95 P06: fresh person-profile renderer public observation

Checked 2026-10-16 JST on BangumiAgentKit Base `9375f1a221d1febc6a2058b8ab9b6abd27fbd129`. This is a newly selected, anonymous, single-tool public ToolRegistry scope. It does not repeat PR #173's fixed eight-tool probe.

## Exact observation

- Scope: `run95-fresh-render-person-profile-13684-v1`.
- Tool: `bangumi.render_person_profile`.
- Input: `personId=13684`, `maxSubjects=1`, `maxCharacters=1`, `maxCredits=1`, `includeChronology=false`.
- Command: `pnpm smoke:public:person-profile:fresh`.
- The ToolRegistry call made three anonymous HTTP requests, below the fixed four-request ceiling. The sanitized result summary was `state=value`, `keys=[artifact]`; all scope, request, and summary assertions passed.
- Report: `docs/live-probes/public-tools-2026-10-15-151849327-87132.json`; SHA-256 `8e15739c8187b96a542bbec5d356da5382b8f845d9f79894a9bb6e99d16dbd14`. The report binds the current catalog SHA-256 `2e8e47b37a4ebcc2511ff3fe8727abd9496edc4f5bebf4cd0ea798b4936b0c92` and the dedicated probe source SHA-256 `471826d6331f6f473cdb8326c3c557544be1f1b60a0fa13b92525e3c087ef862`.

## Acceptance boundary

This adds only direct public API matrix evidence for `render_person_profile`. The report stores no person relation rows, names, or image bytes. It does not establish a person’s exact latest 20 works, ongoing or finished status, upstream relation completeness, visual quality, or Agent/MCP behavior. P06 remains `UNASSESSED`; no scenario or Agent/MCP credit is added. PR #173 remains parked and unchanged, and its excluded 37-request report is not reused.
