# One successful account read from the spent partial A2 batch

This A2 receipt admits only the successful compiled
`bangumi.list_collections {subjectType:"anime",status:"doing",limit:1,offset:0}`
selection from the actual 2026-10-27 A2 execution. The overall batch **failed**:
two tool attempts, one accepted success, two API GETs, no cover GET and no
validated PNG. Its fixed claim remains `FAILED_OR_UNCERTAIN`, permanently spent.
The failed `render_collection_progress` gains no account or render credit.
The precise render cause remains UNKNOWN. No later diagnostic fix reconstructs
that cause or authorizes another attempt.

## Why one successful call survives a failed batch

The original operator entry is fixed by Pariya commit
`70aec3e43de403c118a603081ada323c88949f71` and the public plan's source hashes.
It increments selection success only after the mapped list payload passes its
bounded shape checks. It attempts render only after exactly one selected row.
Therefore the original terminal observation of two attempts and one success
establishes the accepted selection before the failed render/PNG path. This is
interpretation of the pinned control flow and original scalar receipt, not a
new provider observation or a reconstruction of deleted private output.

The existing trusted binding, encrypted credential and current key were used;
there was no OAuth refresh, model call, account write or QQ/TIM message. The
original jobs and same NapCat process/AstrBot container were restored. A1 stays
COMPLETE and is never replayed. New selection authority came from the user's
instruction to choose from the bound collections; importing evidence adds no
execution permission.

## Fixed import and compatibility

[import.json](../live-probes/run95-a2-partial-account-read-2026-10-27/import.json)
is an explicit reviewed operator-evidence trust anchor. It pins the original
sanitized result, plan, postconditions and actual closed claim bytes, plus
BGK2ec source inventory and operator source provenance. The files contain only
bounded facts, hashes and source references. No account identifier, token,
configuration, private row, message, private URL or PNG is retained. The manifest is
not a cryptographic execution attestation, runner signature or fresh API call.
Reviewers assess the fixed facts and source interpretation; arbitrary new
reports, names or self-selected digests earn no credit.

`real_account_a2_evidence.py` accepts only this fixed manifest digest and its
byte-pinned files. It explicitly requires the executed BGK2ec revision as an
ancestor, then reuses the frozen A1 import's bounded file reader and source
comparison primitives. Those also retain A1 ancestry; they never supply A2
execution authority or copy the older credit mapping. Original A1 consumer and
all eight bundle files remain unchanged.

The 62 selected catalog/MCP/auth/collection/transport/storage/runtime-export
and dependency files must match both current tracked blobs and disk bytes.
Tracked and on-disk SQLite migration membership is exact, so new migrations
remove current credit. Caller catalog must match the validated catalog.
Unrelated commits may preserve this one bounded success; relevant drift removes
it rather than carrying the observation forward implicitly. The import never
reads runtime state, credentials or provider APIs.

The generator and independent checker union explicitly fixed receipt
consumers. Historical e081 A1 still has two valid observations but remains
incompatible with upgraded dependencies and contributes no current-source
cells. A2 maps **one account cell**; immediately after its import the aggregate
was **1/33,32 pending**. The later [A3 overview/private-PNG import](real-account-a3-overview-evidence.md)
adds two separate compatible tools, making the aggregate **3/33,30 pending**. A2 adds
no profile, private-render, write, Agent/MCP, public-API, QQ/TIM or complete OAuth
acceptance. Other matrix planes and locked design baselines remain unchanged.

## Verification and remaining work

The new offline Python suite checks actual current-source admission, original
failed total/claim retention, every receipt byte pin, manifest tool/path/digest
expansion, private fields, changed inputs/counts/mode/cleanup, all62 tracked and
disk source pins, runtime exports, added tracked/untracked migrations, catalog
and ancestry drift, missing/symlink/directory/FIFO/oversized evidence. Matrix
integration independently checks exactly one A2 account success and reference
isolation from every other plane. Neither test path calls the account.

Keep OP-009 PARTIAL. After the distinct A3 import, other30 account tools, the
private progress render, real
QQ/TIM and complete OAuth acceptance remain unverified. Preserve the actual
failed A2 and original A1 claims; continue distinct remaining acceptance work.
The separate public-thumbnail grammar and readonly SQLite metadata hypotheses
are not proven causes of the real render failure and must not justify replay.
