# Run #95 fresh query_subjects preflight: MCP bundle attestation refresh

Date: 2026-10-19 (Asia/Tokyo)

## Observed failure

On reviewed Candidate `8bdb3c259cce54a6793b2e95889da22b89ff9b3c` against Base `10d124d9b7ed6f54b529525446516c23d9bd9332`, the exact-Candidate CI run `39171896844` passed 7/7 and the same-identity GPT-6 Luna Max review passed. The one-shot runner then stopped in its local pre-claim build guard with `Fresh query_subjects bundle does not match the exact-Candidate attestation.`

The profile remained `UNCLAIMED`: no claim or terminal label was written, no report was created, and the official Bangumi endpoint was not called. The runner was not retried.

## Root cause and correction

The tracked `docs/product/g26-mcp-bundle-attestation.json` still contained `197bc34e49580b7d57a3a473c211043f027cb72881849d553ef386592287d746`. A clean build of the current master source produced `e730a5296b1b3697ea44735cffa79728242f54183df7fc1c6d84ffaa09e9b3fb`; a second clean build produced the same hash. The previous master merge had changed compiled renderer outputs, so its stored G26 bundle attestation no longer described the current MCP/workspace bundle.

The attestation now records the reproducible `e730a5296b1b3697ea44735cffa79728242f54183df7fc1c6d84ffaa09e9b3fb` digest. The hash was recomputed from a clean build and verified equal to the tracked value. This refresh is being added to PR #232 as a post-PASS Candidate refresh; it must pass exact-Candidate CI and same-identity review before the runner is invoked again.

## Acceptance boundary

No matrix credit was earned, G14 remains PARTIAL, and the query profile remains terminally unclaimed. The profile still has exactly one possible anonymous `bangumi.query_subjects` Agent/MCP matrix cell. OAuth/account, community, renderer, QQ, TIM, and other client evidence remain outside this Epoch.
