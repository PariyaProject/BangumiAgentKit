# Run #95 — G15 terminal disposition after PR #94

## Verified implementation state

- PR #94, `g15-subject-comparison-agent-answer`, is merged at
  `4c0e08bd488484f4443aefbea36a4219ef1ad2f4`.
- Its final corrective Candidate D is
  `eccbe37e1878118f709a60863dbcebd6d0e0598f`; it is the PR head and is on
  current master. Exact-head CI run `37270020917` passed all seven required
  jobs.
- The four G15 corrective implementation changes are already integrated.
  Candidate D also records the failed Candidate C answer check. It does not
  turn that check into accepted answer evidence.

## Verified answer disposition

- Candidate A's checker-v1 result is superseded and is not final answer
  acceptance.
- The single Candidate C current-source read returned a partial result. Checker
  v2 matched three of four metric rows and found one mismatch, so answer
  acceptance failed. The sanitized report is
  `docs/research/run92-g15-subject-comparison-agent-candidate-c-2026-10-05.json`.
- The raw prompt, answer, and MCP result were not retained. The report records
  that no retry or additional public call occurred. Do not repeat either G15
  Agent/MCP read or attempt to reconstruct the missing answer from memory.
- G15 remains `PARTIAL` and uncredited for Agent/MCP answer acceptance. A
  corrected implementation does not erase the failed result, and one partial
  current snapshot does not establish source exhaustiveness or history.

## Run #95 direction

The old frontier action saying Candidate D still needed to pass a corrective
gate before integration is obsolete. Continue Run #95 on another safe, unspent
frontier. This reconciliation makes no API/MCP call and does not change the
public matrix, OAuth/account, community, HTML, QQ, or TIM state.
