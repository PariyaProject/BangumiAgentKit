# Bounded real-account A1 evidence

The account-auth matrix now has a receipt path for the two real reads completed
on 2026-10-26: `bangumi.get_my_profile {}` and
`bangumi.list_collections {subjectType:"anime",status:"doing",limit:2,offset:0}`.
Both compiled MCP calls succeeded, made two API requests in total, and observed
two collection rows. The existing current-user/bearer guard and host entry
enforced that scope. This is bounded-path evidence, not every input combination.

The human approved the one existing-binding read batch, then separately approved
one current-instance OAuth binding and continuation of A1. The existing runtime
had no binding. After browser consent, the compiled OAuth service persisted one
binding and encrypted credential with the original runtime key; one code exchange
and one identity request preceded the separate two-request A1 batch. No model,
QQ/TIM message, collection/rating write, refresh or private image was used.
The A1 durable claim is COMPLETE and must never be replayed.

## Imported evidence and its trust boundary

[import.json](../live-probes/run95-a1-bound-reads-2026-10-26/import.json) describes
the original byte-identical sanitized receipts, their SHA-256 digests, executed
Pariya/BGK revisions, exact public plan, and the two permitted tool/input shapes.
The linked Run95 checkpoint 39 was recorded after the actual operation and
independent claim/metadata/service checks. The receipts contain bounded facts,
not tokens, account identifiers, callback URLs, private rows, screenshots or
rendered media. The local operator's raw journals and runtime state are not
read by the acceptance generator.

The reviewed import digest is an explicit **operator-evidence trust anchor**.
It is not a new runner signature, provider attestation or fresh execution.
Importing it cannot cryptographically recreate the original observations.
Reviewers must assess the provenance and fixed facts. Future receipts require
their own reviewed scope; a report name or self-selected digest earns nothing.

`scripts/acceptance/real_account_a1_evidence.py` reads only this fixed import and
its fixed byte-pinned files. Missing, changed, oversized, symlinked or nonregular
inputs fail closed. Synthetic mode, failed/unknown counts, changed scope,
unconfirmed durable claim, changed binding/cleanup proof or extra private fields
all change the original receipt bytes and are rejected. The partial nine-step
OAuth report stays `DEFERRED_EXTERNAL`; no MCP `auth_start`, `auth_status`,
account-list, account-switch or write/destructive tool was executed here.

## Compatibility and matrix mapping

The executed BGK revision must remain an ancestor of HEAD. A fixed source-file
inventory binds the actual catalog, selected MCP identity/entry/registry,
account/token, SQLite schema/storage, generated request client, transport and
data-mapping code. Current tracked blobs **and** on-disk bytes must match that
inventory. This conservative rule may remove credit after a relevant edit;
review the changed contract rather than carrying old proof forward implicitly.
Unrelated commits do not invalidate the observation. The caller's catalog must
also equal the validated catalog on disk.

The generator maps the accepted receipt only to the account-auth cells for
these two names. Its summary is **2/33, 31 pending**. The table checker separately
requires those exact cells and references to agree with the receipt consumer;
manual checkmarks or references cannot substitute for evidence. Other columns
and the other 94 tool rows retain their original evidence. Public 65/65 bounded,
Agent/MCP 86/96, QQ/TIM 0/96 each, terminal profiles and locked renderer baselines
are unchanged. OP-009 remains PARTIAL.

## Verification and next work

`python3 scripts/test_real_account_a1_evidence.py` exercises the actual import and
source tree plus isolated tamper, synthetic, incomplete, path, file-type,
catalog/source drift and matrix-plane isolation cases. `pnpm acceptance:check`
includes this suite, the existing evidence tests, generated-table comparison and
independent table checker. Tests never access runtime credentials, execute MCP
or call an account/provider. They do not authorize another A1 invocation.

The stale local callback setting encountered during authorization was reconciled
to the provider's existing registration without changing the app or credentials.
Services/plists and the same NapCat process were restored; the callback listener
and A1 container were removed. The earlier component backup predates this binding
and is not evidence that the new credential can be restored from that archive.
Further account tools, private renders, writes and real clients remain separately
scoped. Preserve this evidence and continue those remaining tasks without
replaying the completed batch.
