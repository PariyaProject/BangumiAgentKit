# PR-7D Product and Renderer Review

Reviewer: `sol_product_reviewer` (`019fe92e-974d-7740-9863-4bb39ea1e3f8`, Maxwell)

Reviewed: 2026-08-10

Implementation Candidate SHA: `84e32b3366c62346e14d154bb740fb5c480e96f9`

Exact-head CI: [run 31345745611](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31345745611)

## Verdict

PASS

No P0 or P1 Product Freeze blocker was found.

## Product and Agent QA evidence

- Live person `10868` matched Bangumi's current role page: 217 anime, 85 game, 12
  music, and 5 live-action relations; 156 main, 144 supporting, 17 guest, and 2
  narration relations. AgentKit additionally derived 321 unique subjects and 178 unique
  characters with formula/evidence metadata.
- Live subject `218707` returned complete coverage with 157 production rows and 7 cast
  rows. Director, script/series composition, music, original work, and CVs remained
  correctly separated.
- `bangumi.get_person_profile` and `bangumi.get_subject_staff` are bounded and clearly
  described. Low-cap calls returned independent partial coverage, while recency,
  workload windows, trends, and collaboration counts stayed explicitly
  `not_computable`.
- The sentinel freshness value became `lastModifiedState: unknown`; no stale or conflict
  state was fabricated.

## Visual QA evidence

The real 640px PersonProfile render was 640x2213 and 271,545 bytes. It showed the correct
avatar, Chinese primary/Japanese secondary identity, localized career and gender labels,
readable CJK typography, wrapped long titles, clear hierarchy, and no asset warnings.

## CI and validation evidence

- [Exact-head CI run 31345745611](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31345745611)
  succeeded across all six jobs.
- Independent local validation passed: typecheck, 158 unit/render tests, 28 semantic
  tests, and 48 discovery/Standalone tests as inspected by the reviewer. The full local
  candidate gate additionally passed 16 standalone, 22 contract, and 31 SQLite
  integration tests, lint, and OpenAPI verification.
- Public 404/429/503 failure codes and bounded partial states remained machine-readable.

## Non-blocking recommendations

- Move a partial/sample badge closer to the top KPIs; replace “未读取” with wording that
  more clearly distinguishes not returned from not included in statistics.
- Localize renderer media labels such as `anime/music/game/real` while retaining raw
  codes.
- Recent works and collaborator counts remain intentionally deferred because this cycle
  is official-v0-only and does not have the required date/snapshot source contract.

These recommendations do not block the freeze. No protected human-only boundary was
crossed.
