# Run #95 P06 `render_person_profile` offline Agent/MCP source contract — v2

Date: 2026-10-18

Profile: `p06-render-person-profile-offline-agent-mcp-v2`; Epoch: `run95-p06-render-person-profile-visual-matrix-v2-20261018`

## Why this is a new profile

P06 v1 is permanently terminal with no report and cannot be retried. This v2 profile uses a different profile ID, Epoch ID, network mode, argument profile, synthetic person ID, related synthetic IDs, report path, and evidence kind. It is a new one-shot claim, not a replay or repair of v1. The P06 scenario remains `UNASSESSED`.

## Fixed operation

The profile allows exactly one Agent/MCP call:

```json
{
  "personId": 990602,
  "maxSubjects": 1,
  "maxCharacters": 1,
  "maxCredits": 1,
  "includeChronology": false
}
```

The offline fixture returns exactly three local GET responses: the synthetic person 990602, one synthetic subject 990604, and one synthetic character 990605. It rejects duplicates, query strings, non-GET methods, unexpected paths or origins, request bodies, and authorization headers. The asset resolver makes no network requests; non-empty image URLs are rejected. No account, OAuth, live Bangumi response, community content, write operation, QQ/TIM action, or persistent artifact is part of this profile.

## Renderer QA and evidence boundary

The source contract is paired with [the v2 visual QA report](run95-p06-person-profile-offline-renderer-visual-qa-v2-2026-10-18.md), which records individual inspection of five synthetic PNGs at 320/360/520/640/960 widths and the responsive/localization defects corrected in this Epoch. Those image checks do not count as the Agent/MCP row and do not prove real-person or scenario behavior.

If the exact reviewed Candidate passes all required CI checks and a same-identity GPT-6 Luna Max review, the one-shot runner may claim this v2 profile exactly once. The signed sanitized report is limited to the `render_person_profile` Agent/MCP matrix row. It stores hashes and bounded artifact metadata only, not prompts, answers, raw fixture rows, tool results, credentials, or image bytes. A successful report must preserve the P06 frontier status as `UNASSESSED`.
