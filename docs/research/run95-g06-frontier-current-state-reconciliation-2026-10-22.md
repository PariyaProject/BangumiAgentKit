# G06 frontier current-state reconciliation — 2026-10-22

This reconciliation removes a stale pre-merge acceptance snapshot from G06's next action and adds a focused regression for that guidance. It adds no matrix credit and does not reopen any claim.

## Verified evidence

- PR [#221](https://github.com/PariyaProject/BangumiAgentKit/pull/221) merged the G06 v2 synthetic matrix report at `26c9285e6501a7d2c44cf40e0dda236a737a25b8`. That report is eligible only for `get_subject_cast` Agent/MCP matrix coverage; it does not establish a full cast/CV answer.
- PR [#244](https://github.com/PariyaProject/BangumiAgentKit/pull/244) merged at `8605f4bb61cf0f3f0664665b56ae4f816c3200ac` and bound the catalog hash to `sourceRevision` and the current target entry.
- The verified master snapshot at the start of this Epoch is `054d8dd1256d8e0749008dddc176213d55fc130b`, the exact candidate from merged PR [#257](https://github.com/PariyaProject/BangumiAgentKit/pull/257). Its acceptance record is 82/96 Agent/MCP, 65/65 public, 22/22 no-account denials, and 0/96 QQ/TIM.
- G06 remains `PARTIAL`. Its fixed v1 profile and real-cast scenario are terminal no-report/no-retry. Neither was invoked in this reconciliation.

## Correction

The old next action described 80/96 as current and described PR #244's source binding as future work. The frontier record now states the verified matrix snapshot and the already-merged source binding, while preserving the G06 terminal boundaries and incomplete-scenario status. The existing frontier data test now guards against reintroducing this specific stale wording.

No API, profile, OAuth/account, community, QQ, or TIM action was performed.

## Validation

- `node --test tests/harness/frontier-ledger-data.test.mjs`: 25/25 PASS.
- `pnpm harness frontier:check --run 95`: `FRONTIER_LEDGER_VALID`, 122 records / 97 actionable, ledger hash `e8f7bcacfe2a4c85e1b1777d8237898370d7bc720d0b3f8cd9a4ac977c09373f`.
- `git diff --check`: PASS.
