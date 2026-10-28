# Run95 continuation capacity: maintenance contract

This is a storage engineering contract, not live Run state or migration
authority. Resume from the actual app Goal and GitHub Run/Epoch. Baseline source:
`bfe1229d03edac0c7e218f442b2d746254cb4c4c`. The dated recovery observations are
in PariyaAgent's `docs/research/run95-control-capacity87-recovery-2026-10-28.md`.

## Problem and rejected approaches

At diagnosis, Run95 had 87 complete events and a 65,475-byte body. Recording
already completed runtime work failed before PATCH. The journal was already
expanded, so repack was a no-op. Gzip level changes recovered only 188 bytes;
a simple string table also failed to provide enough capacity. No Run/comment
write, Product action or old account/maintenance retry follows from that
failed append. Raising limits, trimming/summarizing events, replacing the Run,
using an old Harness or resetting review history are prohibited.

## Required observable behavior

1. Preserve every original event's sequence, timestamp, type/data, hash and
   previous hash, and every other Run field, unknown journal field, directive,
   review, budget, claim and active Epoch. Keep the original Run and Goal.
2. Extend storage explicitly, sealing only an old prefix in machine-only
   gzip comments on the same Run Issue. The body pins exact comment identity,
   repository/Issue, author, bytes/digests/count and hash-chain boundaries.
   Comments without body references grant no execution authority. Do not send
   maintainer requests or render old event text as mentions.
3. Hydrate and verify the entire original journal before any directive, risk,
   budget or execution decision. Missing, edited, foreign, duplicate, cyclic,
   malformed, mixed-format or oversized data must refuse, never fall back to
   the recent tail. Pure parsing without a trusted resolver must refuse.
   Route all CLI Run reads through the same view-bound resolver. Python's
   existing Epoch acceptance checks stay unchanged; unsupported segmented Run
   input must explicitly refuse in both old plain/gzip formats.
4. Preserve old plain JSON, whole-state gzip and legacy journal gzip readers.
   Unknown legacy archive metadata refuses rather than disappearing. Preserve
   4 MiB for the complete hydrated Run and 65,536 bytes for the whole Issue
   body. Bound segment count/events, comment response buffers/timeouts and
   inventory size; do not introduce a tracked runtime log or new dependency.
5. Expose an explicit migration with expected sequence/full parsed state hash,
   read-only plan, OPEN/nonterminal metadata checks, single-writer pre-write
   rereads, independent comment readback and full post-PATCH readback. Choose
   the prefix and prove body fit before POST. Failed/uncertain writes stop;
   no automatic retry, deletion or rollback. A deterministic unique orphan
   can be explicitly reconciled and reused; ambiguous or foreign matches
   refuse. Completed-but-uncertain PATCH refuses the stale input digest.
6. Prove full logical equality, budgets/claims/latest continue, append after
   cold-prefix hydration, old formats, near-full actual mocked CLI and abuse/
   concurrency/uncertain-write paths. Independent Standards and Spec reviewers
   must actually inspect the fixed Candidate, and exact seven-check CI must
   pass before integration and any real storage migration.
7. After one supported migration, append the already completed runtime result
   once with its observed sequence. Do not redeploy product containers or
   replay spent account/maintenance batches. Then continue the prepared new
   native episode-collection acceptance contract; this maintenance earns no
   account/client/aesthetic acceptance credit.

Implementation/wire/recovery details belong in
[`CONTROL_BLOCK_CODEC.md`](../agent/CONTROL_BLOCK_CODEC.md#same-issue-continuation-segments).
The reviewed change must not modify protected execution profiles, one-shot
claims, old receipts/compatibility evidence, locked renderer designs or product
runtime/dependencies. This standalone maintenance reserves no Product Epoch
or review allowance while the original Run body is full.
