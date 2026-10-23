# Run #95 C07 v4 local renderer-bundle attestation refresh

Date: 2026-10-23 (UTC)

The selected C07 two-cohort v4 Epoch is still awaiting its first Candidate commit. The exact current build was measured twice before visual generation; this is local WIP evidence, not a committed Candidate or an authorization to make the one-shot claim.

- `pnpm build` completed successfully twice on unchanged source.
- Both `computeMcpBundleSha256(process.cwd())` measurements returned `ac3d5e33473df21961278bb6dd6f7db1bbfea07078626fa83e69995b5af7f42f`.
- The prior tracked G26 attestation was `f6716824a29ec0c2ca7c8daa5bab201d7b1aa511b827f0aa59861dbc042f18c2`; `docs/product/g26-mcp-bundle-attestation.json` now records the reproducible digest above.
- The attestation and this note are outside `apps/mcp/dist` and `packages/*/dist`, so they do not change the measured bundle.

This refresh grants no matrix credit and starts no profile. The profile remains unclaimed. Before any claim, the first meaningful Epoch commit must be followed by exact seven-check CI, Harness `candidate:check`, matching bundle evidence, and same-identity GPT-6 Luna Max review PASS. OAuth/account/community/write/QQ/TIM remain passive; C07 v1/v2/v3 stay terminal/no-retry.


## Follow-up after SubjectCard caption refinement — 2026-10-23

The image-bearing SubjectCard refinement changed the compiled renderer bundle. Two measurements returned `d0b81eaf0f9f01fc3c088b563c095f1d0f79714db31827a915c234a136854be2`; the G26 attestation now matches. C07 v4's 60 outputs were regenerated against this bundle and all PNG hashes are identical to the previously inspected matrix. The refreshed manifest binds bundle `d0b81eaf0f9f01fc3c088b563c095f1d0f79714db31827a915c234a136854be2`, source `96b61c4f1d05152fa0369537d0b9ed66bb6833a1ae530ec8fa0b8be457926744`, and manifest `b53ec986d7cd4c396dd7a17ebd99a7093f27b845fb2399a02ff19899fda8f727`. The runner evidence validator returns true. The one-shot profile remains unclaimed; no C07 matrix credit is recorded.
