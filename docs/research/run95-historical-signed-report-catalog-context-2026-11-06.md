# Historical signed report catalog context

Changing the native person/character list contracts changes the global catalog
hash. Four previously executed, unchanged tools must still verify signatures
against the catalog actually used for those executions. Verifying them against
today's whole catalog wrongly invalidated their historical observations.

The bounded successor reader supports exactly four existing signed reports:
P01 director activity, P03 v4 person profile, P06 v3 profile rendering and
subject-card typography v5. `signed-report-source-contexts.json` pins each exact
report, source revision, validator import closure, original catalog, selected
profile registry and selection document. An additive hash-addressed catalog
snapshot preserves the exact original bytes for the existing per-tool test
reader; it grants no authority to changed entries. It is not an execution profile.

Callers retain the current real Harness status, terminal labels, exact report
SHA, receipt public key, Candidate/Base/CI, source/path and implementation
checks. Only after those gates pass may the historical reader run. It also
requires the entire current own-tool catalog entry and selected profile to
match their original versions exactly. Unrelated entries may change; changed
native list contracts cannot inherit their old report credit. Report, claim,
receipt, writer and runner bytes are preserved. No Harness control command or
old runner is executed from a snapshot.

The reader loads only hash-pinned regular Git blobs from the exact source
revision, with replacement objects, inherited Git overrides and lazy fetching
disabled. Per-file and total byte limits apply. It creates one temporary
verification context without Git metadata, real HOME, DATA or credentials.
The unchanged read-only validator entrypoint verifies the original report and
receipt signatures there. No writer entrypoint is invoked. Source files remain
read-only and the context is removed on both success and failure.

The Node process permits reads only inside that context and denies filesystem
writes, children, workers and native addons. A preload denies the tested Node
network surfaces and global fetch before original imports. Actual permission
checks cover outside reads, writes, subprocesses and network calls. Node 22.13+
and 24 support the required `--permission` interface; unsupported versions
refuse verification, without an unprotected fallback. macOS temporary paths
are resolved before defining the permission boundary, preserving the same
restriction through `/var` aliases.

Tests reject changed own metadata/schema/auth/risk, duplicate catalog entries,
report/source/catalog identity changes, alias paths, claim state/public-key/
report binding drift, selected-profile/selection drift, each source-closure
hash change and unsupported Node flags. Positive tests use the four original
signed byte sequences and test claims; those fixtures carry no runtime
execution authority. Current real terminal disposition checks remain outside
the context and are required for matrix admission.

The resulting development matrix admits 63 public tools, 84 Agent/MCP tools and
12 scoped account observations. The two changed native list contracts need
new contract-specific public/model evidence in a subsequent governed phase.
Their older execution remains historical. This does not reduce the original
all-96 objective, replay spent profiles or claim real client acceptance.
