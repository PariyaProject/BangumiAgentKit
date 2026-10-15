# Run #95 — G04 terminal one-shot disposition

## Verified Harness state

- PR #136's `run95-g04-person-activity-codex-current-evidence` Epoch is merged
  at `06c1915e64e466dc3543b46d58801eb767e9a161`. Its durable G04 claim ended
  `INCONCLUSIVE`, without a report, and with retry prohibited.
- Run #95's current Harness control block reconciles that claim as
  `LEGACY_TERMINAL_RECONCILED`. It records `queryInvoked=false`,
  `reportWritten=false`, and `retryAllowed=false`.
- PR #139's `run95-g04-person-activity-global-one-shot-latch` Epoch is merged at
  `51126320202c653d48e7d62461575a10988b1dbb`. The permanent repository label
  `harness-r95-g04-person-activity-claimed` exists. Never remove or recreate it.
- `docs/live-probes/g04-person-activity-run95.json` is absent. No accepted
  Run #95 Agent/MCP report or capability credit exists.

## Acceptance boundary

The terminal claim remains spent even though the Harness record says
`queryInvoked=false`; that value does not restore eligibility. Do not invoke or
claim the fixed profile again, or reconstruct the absent report. G04 remains
`PARTIAL` and uncredited.

The older Run #86 evidence is separate: it selected one of 115 observed person
relation rows, with zero eligible and zero returned rows. That bounded
observation does not establish a full-window count, complete career history,
actual workload, or historical snapshots. No Run #95 query, claim, or latch
mutation occurred during this reconciliation.

## Run #95 direction

The frontier's former instruction to run the fixed profile after review is
obsolete. Continue Run #95 on another safe, unspent frontier. This
reconciliation does not change the public matrix, OAuth/account, community,
HTML, QQ, or TIM state.
