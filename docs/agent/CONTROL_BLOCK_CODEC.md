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
capacity. Both formats have a 4 MiB uncompressed state bound. The explicit
same-Issue continuation extension below preserves that bound across the full
hydrated Run. No tracked runtime fallback or additional Run is created.

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
history, increase limits, create a replacement Run, introduce an unreviewed
archive or switch to an older Harness to evade a future failure. Another
capacity migration requires explicit reviewed engineering. After repacking,
use this integrated Harness for all subsequent mutations so new appends do not
recreate the nested representation.

## Same-Issue continuation segments

This reviewed protocol extends the finite whole-body storage. It does not
change Run authority, append events, grant execution permission or reset any
budget. Epoch storage and Python's P01/S03 Epoch trust checks are unchanged.
It creates no new Issue, Run, Product Epoch or maintainer request.

After integrating this maintenance with two independent review axes and exact
CI, use the current Harness for **all** subsequent Run reads and writes. An old
Harness cannot interpret the complete segmented history. Never fall back to
its apparently valid recent tail. Keep a local public-control snapshot, use
one writer, and prepare without mutations first:

    pnpm harness continuation:show --run 95 --goal-state active
    pnpm harness continuation:archive --run 95 --expected-sequence 87 \
      --expected-state-sha256 <run_state_sha256-from-show> --plan

The observed app Goal state belongs in `continuation:show`; the example assumes
it is active. `--plan` is a valueless flag. Its read-only result also returns
`expected_inventory_sha256`, binding the inspected comments. Execute with that
original plan digest in addition to the same fresh sequence/full state digest:

    pnpm harness continuation:archive --run 95 --expected-sequence 87 \
      --expected-state-sha256 <run_state_sha256-from-show> \
      --expected-inventory-sha256 <expected_inventory_sha256-from-plan>

The digest includes all unknown fields and existing segment metadata.

The migration moves the earliest unarchived 16–64 events to one machine-only
gzip comment on the **same Run Issue**, keeping at least 16 recent events in
the body. A bounded fitting prefix is chosen before any POST. The original
sequence, timestamp, data and hash chain are untouched. Every other field,
claim, review, budget, directive and active Epoch is preserved. Legacy inner
archives are expanded with their existing checks; unknown archive fields cause
refusal rather than deletion. Unknown journal fields survive; reserved-field
collisions, closed/terminal Runs and stale state/sequence refuse.

On wire, `continuation.archived_prefix` has schema
`bangumi-continuation-segments/v1`, repository, Issue and up to 64 references.
Each reference binds comment id/author, exact body SHA-256, transaction,
uncompressed payload bytes, event-array SHA-256/count, first sequence/hash,
previous hash and last hash. The comment has an exact continuation-segment
marker/fence and existing bounded gzip envelope. Its decoded payload has
schema `bangumi-continuation-segment/v1`, repository, Issue, transaction and
the exact event array. Gzip-only content avoids rendering old event text as
mentions or requests. Digests detect changes; they are not signatures or new
review authority.

The view-bound CLI resolves each pinned comment, verifies its Issue URL,
author/id, framing, codec, bytes/digests and contiguous full chain, then returns
the complete `continuation.events` plus reserved in-memory `storage` metadata.
All policy readers operate on that full array. Writers verify the immutable
prefix against the pinned event digest and persist only its references and
recent tail. Pure JavaScript parsing requires an explicit trusted context and
resolver; unresolved references refuse. Python currently reads only Epochs;
it explicitly rejects segmented Run input in both plain and gzip formats.
Missing/edited/foreign/duplicate/cyclic/malformed references never authorize
tail-only continuation. The full hydrated Run remains bounded to 4 MiB,
segments to 64 events and 65,536 body bytes, and every Issue/PATCH retains the
65,536-byte whole-body guard. Comment GETs have bounded response buffers and
20-second timeouts. This is finite capacity; future exhaustion requires reviewed
engineering again.

Before POST, the command inventories at most 32 pages of 100 comments with a
shared 16 MiB response bound; oversized, malformed or unavailable inventory
refuses. A plan hashes every comment's id, author, Issue URL and exact body
digest in stable id order. Apply requires that original inventory digest.
The only permitted addition is its unique exact verified orphan: removing
that comment must reproduce the inspected baseline. Any edited/replaced/new
comment, even an orphan whose marker was entirely removed, refuses before
another POST. An unreferenced nonmatching segment marker also prevents a new
plan from silently treating an edited segment as an unrelated old comment.
The transaction and complete body are deterministic for the exact
input state and prefix. A unique identical verified orphan is reused, never
posted twice; ambiguous or foreign matches refuse. State/Issue metadata are
reread before comment creation and again before body PATCH. The new comment
is independently read back and verified before the body can reference it.
After PATCH, the complete hydrated state and open/nonterminal metadata must
match exactly. Comments without body references have no execution authority.

On a lost POST/PATCH response, concurrent change or failed readback, stop and
inspect; never automatically retry or delete comments. Read `continuation:show`
and inspect the same Issue's comment inventory. If PATCH already succeeded,
the old expected digest refuses and the live full history is authoritative.
If the old body remains and one exact orphan exists, an explicitly reconciled
invocation with the original state and inventory digests reuses it. Do not
discard an uncertain attempt's original inventory digest or automatically
refresh the plan to accept changed comments. Preserve an unresolved or edited
orphan for investigation; do not treat it as a reason to create another Run or
replay a Product/account operation.

Offline tests cover complete history equality, unknown fields and old formats,
directive83 plus append88, budgets/claims, near-full actual mocked CLI,
Python refusal/Epoch parity, corrupt/foreign/missing data, duplicate references,
expansion limits, closed/concurrent metadata, uncertain POST/PATCH, orphan reuse
and readback failure. No real control migration is implied by these tests.
