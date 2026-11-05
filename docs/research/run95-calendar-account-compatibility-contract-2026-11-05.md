# Closed twelve-input account source compatibility

This contract covers the two renderer-source changes in the compact calendar
increment. It preserves the twelve bounded historical A2–A7 observations while
requiring a fresh compiled-MCP compatibility witness. It creates no execution
profile, account observation or client credit. The original receipts, producers,
spent claims and historical failure journals remain immutable.

The current285-file runtime inventory differs from the executed A7 basis
`bfe1229d03edac0c7e218f442b2d746254cb4c4c` only in CalendarCard and render-service.
Lock, catalog, account logic, SQL, assets and package/runtime/build scripts are
unchanged; only root `acceptance:check` may evolve. Optional absent root inputs
must remain absent. Git modes/blobs, disk bytes and dynamic directories are bound.

## Executed graph

Use the retained native image
`sha256:9c0784bff3ef39fa5c30639f07e3b86b4be634c2cecf854679e9920f9517014a`.
Compile the full typechecked renderer project, first with virtual reads of the
two historical sources, then with the current sources. The first output must
match the parent image byte for byte, and the second must match current build
output. Transpile-only output or manual JavaScript rewriting is insufficient.
Mount only those two new JavaScript files read-only at their exact native module
paths. Both controller and server check the mounted file bytes; server module
hooks additionally check the actual loaded source and observe both modules.
The original image is preserved. This is isolated QA, not production deployment.

## Input and data boundary

The eleven inputs are reconstructed from the frozen A2–A6 import manifests;
the twelfth comes from the original A7 manifest. No parameter bounds expand.
The episode subject marker resolves only to the sole validated native result of
the first `list_collections` call, whose input already matches A7's selection.
No additional selection request or account is introduced.

Create fresh fake SQLite, principal, binding and encrypted credential state.
Tokens, identities and records are explicitly synthetic. Only official-provider
I/O is substituted; compiled MCP registration, policies, business logic,
ViewModels, private artifact storage, renderer and PNG decoding remain native.
Five private images must decode completely and preserve file permissions,
private cache exclusion and cleanup. The episode read must preserve account
scope, bound subject identity, main episode request type, known returned status
and the one-row partial page; it must not infer full progress.

The provider admits only GET collections, GET episodes and the bounded public
calendar needed by the original inputs. At most64 fixture requests, one row per
response, collection limit at most2, episode limit at most2 for the existing
compound inputs and1 for the explicit A7 call. All other requests fail. It
never uses real DNS, sockets, auth refresh or covers. No real data directory is
mounted. A read-only, network-none, memory/PID/time-bounded container owns `/tmp`.

## Controls and interpretation

One normal twelve-call run is followed by five negative controls: forced `qs`
require, dynamic import, prior preload, controller network access and server
network access. Default network denial precedes product imports on both sides.
The server's fixed fixture-fetch handler is registered once; the global fetch
entry cannot be replaced. The normal run needs zero socket/DNS/network attempts,
zero `qs` loads, verified current module bytes, twelve results, five decoded PNGs,
explicit MCP shutdown and removal of owned workspaces. Each negative must stop
before any tool result and demonstrate its intended guard. Container removal,
parent identity and protected source/evidence bytes are independently reread.

The new reviewed importer must bind the separately sealed witness, all exact
inputs, original references, compiled provenance, producer files, root scripts,
current runtime graph and modes. It may return exactly the original twelve
account references plus this compatibility reference. It must reject unproved
drift, weakened controls, extra inputs, mutation or aliasing. It must not modify
or reinterpret old strict consumers or quietly rehash their receipts.

This establishes compatibility for the closed synthetic data/input graph only.
It is an operator evidence anchor, not cryptographic attestation or proof of all
inputs, fresh credentials, OAuth, full account coverage, public-calendar pixels,
QQ/TIM, user aesthetics or stability. The changed calendar's client cells remain
pending until genuinely new output is observed after reviewed deployment.

`--prepare-only` verifies source/compilation/material availability without MCP
execution and cannot be imported as a native PASS. Full execution requires a
clean committed producer and a fresh output path. Failed outputs are preserved;
they cannot earn compatibility credit.
