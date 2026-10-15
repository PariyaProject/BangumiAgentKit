# Run #95 P06: fresh person-profile renderer public observation

Checked 2026-10-16 JST on BangumiAgentKit Base `9375f1a221d1febc6a2058b8ab9b6abd27fbd129`. This is a newly selected, anonymous, single-tool public ToolRegistry scope. It does not repeat PR #173's fixed eight-tool probe.

## Exact observation

- Scope: `run95-fresh-render-person-profile-13684-v1`.
- Tool: `bangumi.render_person_profile`.
- Input: `personId=13684`, `maxSubjects=1`, `maxCharacters=1`, `maxCredits=1`, `includeChronology=false`.
- Command: `pnpm smoke:public:person-profile:fresh`.
- The corrected replacement ToolRegistry call made four anonymous HTTP requests in total: three Bangumi API requests and one renderer asset request. Both API and asset redirect hops are counted under the same four-request ceiling. The sanitized result summary was `state=value`, `keys=[artifact]`; all scope, combined-request, and summary assertions passed.
- Report: `docs/live-probes/public-tools-2026-10-15-154413213-10706.json`; its SHA-256 is recorded in the frontier ledger. The report binds the current catalog SHA-256 `2e8e47b37a4ebcc2511ff3fe8727abd9496edc4f5bebf4cd0ea798b4936b0c92` and the byte-for-byte executed probe source preserved at `scripts/smoke-fresh-render-person-profile-public-retry-accounted-v1.ts`, SHA-256 `428ecc9da51b757ca15bf1cec91eef685e2d5e618f1598493afc0cf890f1bd91`. The active probe source was updated after the observation to describe retries accurately; the archived source preserves the exact executed bytes.
- Review correction: the first report wording said “no retries,” but that fixed scope did not disable `HttpClient`'s automatic read-only retries. The report now states that API retry attempts are permitted and every attempt is counted by the shared four-request budget. This is a post-observation clarification only; it does not change the observed 3 API + 1 asset counts, and no live probe was repeated. An offline regression exercises a 503 followed by success and confirms both API attempts pass through the shared counter.
- The initial report `docs/live-probes/public-tools-2026-10-15-151849327-87132.json` recorded three API fetches but did not count renderer assets, so its total request count is unknown and it is explicitly excluded from acceptance credit. Its exact source bytes are preserved at `scripts/smoke-fresh-render-person-profile-public-unbounded-v1.ts`.

## Acceptance boundary

This adds only direct public API matrix evidence for `render_person_profile`. The report stores no person relation rows, names, or image bytes. It does not establish a person’s exact latest 20 works, ongoing or finished status, upstream relation completeness, visual quality, or Agent/MCP behavior. P06 remains `UNASSESSED`; no scenario or Agent/MCP credit is added. PR #173 remains parked and unchanged, and its excluded 37-request report is not reused.
