# Whole control-block codec validation — 2026-10-25

This is dated maintenance evidence, not execution authority or a Product
review verdict. The original Run Issue and Epoch PR remain authoritative.
No raw control state, credentials, private payloads or images are included.

On the `f5885197b7bf58534a36419c5787c67b54fd515e` baseline, recording the
already-merged [Pariya PR12](https://github.com/PariyaProject/PariyaAgent/pull/12)
result through the supported checkpoint command exceeded the 65,536-byte body
guard before PATCH. Further shortening left only two bytes of margin. Existing
continuation events were already compressed; deleting history or resetting
the Run was rejected as a solution.

Fresh read-only GitHub snapshots of [Run95](https://github.com/PariyaProject/BangumiAgentKit/issues/95)
and [Epoch267](https://github.com/PariyaProject/BangumiAgentKit/pull/267) were
decoded, re-encoded and independently decoded through JavaScript and Python.
Every field was equal; existing legacy normalization changed no fields.
The 23-event prefix ended at SHA-256
`6762bdf6f9ce831cb3e24a0b5c9cbe0c0d0183ba5f916847ac6f0a28798f8241`.

| Read-only input | Compact state bytes | Encoded full body bytes | State SHA-256                                                      |
| --------------- | ------------------: | ----------------------: | ------------------------------------------------------------------ |
| Run95           |               65158 |                   31206 | `bd3fa574320ef755c22e0441cce75bf71e1353f92154963bfc3c08d8dcb38ae6` |
| Epoch267        |               11707 |                   17308 | `99432754a9ab8c124cadbccb65a7a1b0a5f5b9af4a68ff204ff1b88df0b72ee5` |

A meaningful PR12 checkpoint was appended **in memory only** at a fixed test
timestamp. Its legacy full body was 66,014 bytes; the new body was 31,854 bytes,
leaving 33,682 bytes. The old event prefix and every original non-continuation
field, including claims, budgets and review history, were equal. The Epoch
was not changed. Gzip sizes can vary with event text/time; this is a bounded
observation, not a fixed capacity promise.

The codec tests also retain incompressible oversize evidence so the existing
body guard can refuse it. Negative fixtures cover digest/size/marker/base64,
gzip corruption/truncation, invalid UTF-8, nesting, schema policy and expansion
beyond the output bound. P01/S03 synthetic signed-report predicates still
accept matching archived authority and reject corrupted authority or an
incorrect exact review/candidate. These fixtures do not run any Product claim.

Initial validation: `pnpm harness:test` passed 957 tests; `pnpm acceptance:check` passed
316 Python tests and both generated-matrix checks; `pnpm lint` and
`pnpm typecheck` passed. The focused near-full mock CLI test invokes checkpoint
and continuation commands, confirms all old fields and the Epoch survive,
and rejects a stale sequence without another mutation. GitHub exact-head CI
and review evidence belong to the maintenance PR rather than this report.
Independent Spec review then found Python's permissive nonstandard JSON
constants. A regression reproduced acceptance of `NaN` against the initial
candidate. Both outer and decompressed Python parses now reject `NaN`,
`Infinity` and `-Infinity`; all 19 focused cross-language codec tests passed.
The read-only proof performed zero GitHub writes, Product claims, account,
OAuth, model or client calls. First real mutation requires reviewed integration
and supported-command readback per the [codec contract](../agent/CONTROL_BLOCK_CODEC.md).
