# Scoped account evidence across the qs security patch

The qs6.16.0→6.16.1 dependency patch fixes GHSA-6pq8-jhm2-2vcw. The official
tarballs and all20installed published files were verified. The complete delta
includes parsing, strict merging, coercion, encoding and browser bundle changes;
it is not a stringify-only patch. Ten malformed comma-array cases fail on the
old dependency; all12cases, including normal controls, pass on6.16.1. The lock
changes only that version and its official integrity; the official npm audit
reports zero known vulnerabilities at verification time.

The original A1–A6 consumers and receipts (53files) remain byte-identical. Their
strict source predicates correctly reject the new lock. A separate
[sealed compatibility anchor](../live-probes/run95-qs55-stdio-compatibility-2026-10-28/import.json)
retains only the existing11A2–A6 scoped account observations. Every retained
matrix cell cites **both its old execution receipt and the new compatibility
anchor**. No real account operation was replayed or newly credited.

The native QA uses a fresh fake encrypted binding/SQLite database and the actual
compiled MCP stdio server child. It executes the exact11old input objects,
including five native ViewModel/render/Artifact/Sharp-PNG paths. Controller and
server hooks start before imports, reject qs module resolution/loading, inspect
preloaded/final caches and finalize observations. Forced require, dynamic import
and preload-before-hooks in the actual server are three failing negative
controls. All pass as detection tests. Provider reads are fixtures only;
the read-only container has network=none and zero real-data mounts. Native
PNG files/workspaces and the owned container are removed. Server SIGTERM
finalization is an explicit test shutdown, not production shutdown validation.

The QA image is an overlay of retained imagecbd0/compiledsource2ec. An independent
inventory compares all8667runtime files/links: only the official qs payload and
three resolution links change. The image label records the actual patch basis
c463fe62 and separately the old compiled parent. It is never relabelled2ec to
bypass live host guards. The original image and production remain unchanged.
All285current runtime source files, modes, catalog, discovered SQL/assets and
root metadata are pinned, with only the sealed lock/qs override difference.
Seven producer programs are pinned in HEAD and on disk. Missing/modified
receipts, roles, producers, source bytes/modes, dependencies or dynamic files
remove compatibility credit. The anchor is a reviewed operator trust anchor,
not a runner signature or cryptographic attestation, and grants no general
future dependency compatibility.

This is source compatibility for those bounded stdio observations. It preserves
A2's unknown render failure, original partial samples and A6's non-anime/zero
relation limits. Historical A1, get_my_profile and render_collection_progress
remain excluded. It proves no fresh account execution, complete collection,
HTTP/browser/all-input equivalence, full OAuth, write/client, aesthetic or
stability acceptance. Account coverage remains11/33,22pending; OP009PARTIAL
and the original96-tool Goal remain incomplete. Production promotion requires
its separate reviewed operational scope and preservation of all six spent claims.

The offline reproducer is `scripts/acceptance/run-qs55-isolated-proof.py`; it
requires the retained parent and a locally supplied integrity-verified official
tarball, uses no external network, and creates only an owned fake QA container.
Initial QA preparation exposed the missing child Playwright path, then an
incomplete fixture allowlist (backlog calendar and episode_type). Fixing those
test inputs produced zero denied requests with all11native calls. Docker's
image-config ID is distinct from a registry manifest digest; the reproducer
pins/checks the local parent ID before/after building. OverlayFS EXDEV on a
directory rename is handled by copy/remove with exact inventory comparison.
These preparation failures neither used real data nor spent account claims.
