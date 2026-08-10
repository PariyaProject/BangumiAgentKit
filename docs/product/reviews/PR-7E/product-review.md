# PR-7E Product and Renderer Review

Reviewer: `sol_product_reviewer` (`019fe9d6-2285-72c1-8656-0fa12bdc5b72`, Russell)

Reviewed: 2026-08-10

Implementation Candidate SHA: `d53d800c5497cacd156792b1139ab7f2a696cdbe`

Exact-head CI: [run 31354128241](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31354128241)

## Verdict

PASS

No P0 or P1 Product or Renderer Freeze blocker was found.

## Product and Agent QA evidence

- Official `/calendar` parity was preserved while the intelligence result adds bounded
  sampling, weekday mapping, bilingual identity, score, rank, type, collection count,
  missing-field counts, explicit date/time limitations, and truthful source evidence.
- One-request behavior, 429/503/network failures, source ceilings, weekday conflicts,
  duplicate/missing weekday coverage, and unavailable semantics are machine-readable and
  human-readable.
- The semantic tool documents `1=Monday` through `7=Sunday`, first-air-date semantics,
  unknown timezone, and bounded-result behavior. Chinese/Japanese title and weekday
  fallback behavior remains discoverable.
- The 640px and 960px live artifacts showed readable bilingual titles, wrapped long CJK
  names without clipping, visible ranks and collection counts, clear partial/unavailable
  states, and useful hierarchy. Current artifacts were:
  `/tmp/bangumi-pr7e-calendar-corrected-v2-640.png` (640x4060) and
  `/tmp/bangumi-pr7e-calendar-corrected-v2-960.png` (960x3422).

## Visual QA evidence

- The actual renderer matrix exercised narrow, dense, empty, long-CJK, and unavailable
  states at both 640px and 960px, plus an isolated Standalone `render calendar` path.
- No P0/P1 information-loss, clipping, or state-copy issue was found.

## CI and validation evidence

- [Exact-head CI run 31354128241](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31354128241)
  succeeded across all six jobs.
- Independent focused validation passed 84 tests across six relevant files; the full local
  candidate matrix also passed the repository gates recorded in the code review.

## Non-blocking recommendations

- When a bounded result is truncated, future descriptions could direct Agents to
  `bangumi.get_calendar` for exhaustive enumeration.
- Strengthen future visual regression assertions beyond PNG validity and dimensions, and
  consider slightly larger secondary metadata at 640px.

These recommendations do not block the freeze. No protected human-only boundary was
crossed.
