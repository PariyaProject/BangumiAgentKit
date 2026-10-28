# Consolidating continuation storage after A6

The already completed A6 series-tools batch is permanently spent. Its exact
result was recorded as Run95 checkpoint80. Starting the receipt-import Epoch
then failed CONTROL_BODY_TOO_LARGE before any write or branch selection:
proposed wholebody102942bytes exceeds65536. Fresh readback retained RunACTIVE,
no active/pendingEpoch, sequence80 and its original event digest. No account,
service, renderer or Product-review action is repeated during this maintenance.

The legacy continuation journal's inner gzip/base64 archive was compressed
again by the whole-control envelope. Once that envelope exceeded its cap, the
existing encoder correctly fell back to plain JSON and the body guard refused
PATCH. Higher gzip level was insufficient; an experimental global string table
was worse. Both were read-only probes and are absent from the implementation.

This maintenance uses the journal's already-supported schema1 event array,
compressing it once in the unchanged whole-control codec. It adds an explicit
`continuation:repack` command with expected full Run digest, sequence,
prewrite reread, complete readback and no-write idempotence. Old archives remain
readable. Unknown journal fields survive; unknown legacy archive fields refuse
migration. No event/hash/intent/budget/claim/other Run field or Epoch changes.
New checkpoint appends retain the array, preserving all failure and pause guards.
No new codec, dependency, external archive, replacement Run or larger bound.

The [read-only proof](run95-continuation-storage-2026-10-28.json) binds the actual
public snapshot: wholebody64031→61647bytes and simulated original A6 selection
63831bytes. All80events and other fields match exactly; JavaScript and Python
roundtrips match. This is finite recovered space, not an unlimited-capacity
promise. Raw control state remains local; the report stores only counts and
hashes. No real control mutation has occurred. Exact-head CI and independent
maintenance review must precede the first supported repack and readback.

A regression first failed on the original nested writer, then passed with the
array representation. Tests cover legacy archives, unknown fields, unchanged
hashes/claims/budgets, wrong or stale sequence/state, closed Run, concurrent
write, ambiguous readback, idempotence, retained pause/strategy gates and the
unchanged incompressible-body limit. Full Harness and acceptance validation
must pass before integration; no matrix credit is earned by this maintenance.

Initial validation completed:977Harness tests PASS,37focusedcontinuation/codec tests PASS and7targetedmockedCLI tests PASS; focused ESLint and diffchecks PASS. Acceptance/matrix and typechecks are still running at this preparation snapshot. Independent maintenance review will bind the exact committed source; this document is not a verdict or control-mutation authority.
