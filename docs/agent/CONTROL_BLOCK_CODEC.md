# Lossless Harness control blocks

GitHub Run Issue and Epoch PR bodies remain the only execution authority.
Their existing markers and JSON fences do not change. The shared JavaScript
writer and JavaScript/Python readers support two storage representations:

- Existing compact logical JSON, unchanged for states below 32 KiB.
- For larger states, a smaller gzip/base64 envelope with exactly `schema`,
  `codec`, `marker`, `bytes`, `sha256`, and `data`. The schema is
  `bangumi-harness-control/gzip-v1`, codec is `gzip+base64`, marker binds the
  Run or Epoch block, and bytes/digest describe the complete uncompressed
  UTF-8 JSON. This digest detects corruption; it is not a signature or proof
  of review authority.

No history, claim, budget, verdict, unknown field or continuation event is
removed or summarized. The logical schema remains `bangumi-harness/v3`.
Existing additive legacy normalization still occurs in the Harness caller;
the codec itself does not normalize state. The P01 and S03 Python acceptance
readers decode the same format before applying their existing trust checks.
Candidate, Base, CI, reviewer identity and immutable report gates are unchanged.

The writer selects the envelope only when it is smaller than plain JSON and
at most 65,536 UTF-8 bytes. The existing 65,536-byte **whole-body** guard still
counts markers, visible text and encoded state before PATCH. Incompressible
oversize evidence therefore still fails visibly; compression is not unlimited
capacity. Both formats have a 4 MiB uncompressed state bound. No external
archive, tracked runtime fallback or additional Run is created.

Readers require exact envelope keys, codec/marker, canonical base64, bounded
gzip expansion, declared byte length, lowercase SHA-256, valid UTF-8 and one
non-nested JSON object. They reject corrupt or truncated data, malformed
envelopes and expansion beyond 4 MiB. Concatenated gzip members and trailing
zero padding share the same total output bound in both languages. Caller
validation remains responsible for the logical schema and policy.

## Upgrade and recovery

Integrate the maintenance change through normal review and exact-head CI
before the first real write. Then use the upgraded Harness on the recorded
maintenance branch/master for **every** Run/Epoch read and mutation. Old
Harness versions cannot read the envelope; do not switch back to bypass
guards. Read-only commands do not migrate state. The next supported mutation
encodes state automatically, with the existing sequence/pre-write reread and
post-write readback requirements. Use one writer; GitHub PATCH is not CAS.

Before the first write, preserve a local public-control snapshot for
comparison. After readback, decode through the supported status/continuation
commands, verify the prior event prefix and all old non-continuation fields,
and verify the active Epoch is unchanged. If readback fails or the sequence
is ambiguous, inspect first; never replay blindly. Do not manually replace
the Issue, trim history or delete the archive. Future capacity exhaustion
requires another explicit reviewed migration.

Tests cover old plain JSON, large Run/Epoch roundtrips, cross-language
Unicode/gzip parity, malformed archives, bounded expansion, P01/S03 trust
checks and a near-full legacy Run updated through the actual mocked CLI.
The dated [read-only validation](../research/run95-control-block-codec-2026-10-25.md)
records the original capacity failure without storing raw runtime state.

## Consolidating legacy continuation compression

The 2026-10-28 maintenance keeps both existing wire formats and all readers.
The continuation journal already supports `schema: 1, events: [...]`. New
appends retain that array inside the bounded whole-control envelope instead of
creating an inner gzip/base64 archive. The codec itself still does not normalize
logical state. Old inner archives remain readable, with their original event
chain, count and digest checks. No dependency, trust policy or body limit changes.

After reviewed integration, an existing Run can explicitly repack its journal:

    pnpm harness continuation:repack --run 95 --expected-sequence 80 \
      --expected-state-sha256 <canonicalHash-of-current-parsed-Run>

Use `canonicalHash` from `scripts/lib/frontier-ledger.mjs` on the complete
`parseControlBlock(body, RUN_MARKER)` result from the freshly read Issue body;
never hash the encoded envelope or omit fields. Preserve that public snapshot
locally first. The expected sequence and full state digest are mandatory. The
command rereads before PATCH and verifies the complete readback afterwards.
GitHub PATCH is not atomic CAS: use one writer and inspect any uncertain result
before retrying. An already expanded journal is a no-write success with a fresh
matching state digest; an old digest is rejected.

Only the journal's archive representation is replaced by its exact verified
event array. Every event, sequence, timestamp, hash, directive and failure signal
is unchanged, as are all other Run fields and the active Epoch. Unknown journal
fields survive. Unknown fields inside the legacy archive cause refusal rather
than silent deletion. Missing history cannot be used to opt a legacy Run into
continuation controls. Closed/terminal Runs, sequence/state drift, concurrent
changes and failed readback are explicit errors. Repacking grants no execution,
review, claim or pause/resume authority and may run while a human pause remains.

The existing whole-state 4 MiB expansion bound and 65,536-byte complete-body
pre-PATCH guard still apply; incompressible history remains a visible failure.
This consolidation reclaims finite space, not unlimited capacity. Do not trim
history, increase limits, create a replacement Run, introduce an external
archive or switch to an older Harness to evade a future failure. Another
capacity migration requires explicit reviewed engineering. After repacking,
use this integrated Harness for all subsequent mutations so new appends do not
recreate the nested representation.
