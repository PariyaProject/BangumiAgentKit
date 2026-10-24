# Run #95 C07 v4 local renderer-bundle attestation refresh

Date: 2026-10-23 (UTC)

The selected C07 two-cohort v4 Epoch is still awaiting its first Candidate commit. The exact current build was measured twice before visual generation; this is local WIP evidence, not a committed Candidate or an authorization to make the one-shot claim.

- `pnpm build` completed successfully twice on unchanged source.
- Both `computeMcpBundleSha256(process.cwd())` measurements returned `ac3d5e33473df21961278bb6dd6f7db1bbfea07078626fa83e69995b5af7f42f`.
- The prior tracked G26 attestation was `f6716824a29ec0c2ca7c8daa5bab201d7b1aa511b827f0aa59861dbc042f18c2`; `docs/product/g26-mcp-bundle-attestation.json` now records the reproducible digest above.
- The attestation and this note are outside `apps/mcp/dist` and `packages/*/dist`, so they do not change the measured bundle.

This refresh grants no matrix credit and starts no profile. The profile remains unclaimed. Before any claim, the first meaningful Epoch commit must be followed by exact seven-check CI, Harness `candidate:check`, matching bundle evidence, and same-identity GPT-6 Luna Max review PASS. OAuth/account/community/write/QQ/TIM remain passive; C07 v1/v2/v3 stay terminal/no-retry.


## Follow-up after SubjectCard caption refinement — 2026-10-23

At 2026-10-23T14:29Z, the image-bearing SubjectCard refinement changed the compiled renderer bundle. Two measurements returned `d0b81eaf0f9f01fc3c088b563c095f1d0f79714db31827a915c234a136854be2`; the G26 attestation matched. At that point C07 v4's 60 outputs were byte-identical to the previously inspected matrix. This was the current attestation then, not the final renderer state for this Epoch.

At 2026-10-23T14:47Z, the C07 comparison-card layout changed to remove repeated subject metrics and make A/B/delta values easier to scan at 320–640px. The earlier directory remains preserved; the current matrix was regenerated under `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261023-v2/`. Bundle SHA-256 `8fb10dbfd60a7645e86185647476f67198a460160e8f903c09604aebd2c726ac`; generation-source SHA-256 `e37a2b66e56bc36adbb9f33866684684981acbd23d8d81f6249d386a49f7fe22`; tracked manifest SHA-256 `ce1ed4e7ad3e12c9993c9a719843db3d22c56fd80d35c5fe70f171d6b55cf225`. All 60 images were individually reviewed; the strict validator returns true. C07 v4 remains unclaimed and uncredited.


## Corrective narrow comparison pass — 2026-10-23T15:30Z

The assigned GPT-6 Luna Max review found that the partial visual generator retained complete-state deltas. It also identified three Harness integration omissions. The corrections changed the compiled Renderer bundle and supersede the v2 visual receipt.

- Rebuilt with `pnpm build`. Two `computeMcpBundleSha256(process.cwd())` measurements returned `ae58ae99a26e407368ed4bb045d83bd1c57c5a346c32df1c0ff1f96d44a0c00a`; the tracked G26 attestation now records this digest.
- The narrow metric layout now uses two A/B columns at 320/360px and a separate full-width B−A row. Partial metrics are guarded by state in the Renderer and have `delta: undefined` in the fixture generator.
- Generated 60 images under `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261023-v3/`. All 42 changed files were individually opened and inspected; 18 unchanged complete-state images match the inspected v2 PNGs byte-for-byte. The updated manifest hash is `e33b93e610cc05827c788511fd0cc84448edc03b77b97e00b1f6161d2057a22b`, source digest `b142f0e7c63ceaec76b7bb893909a2c124e8d1178df3a8f2fb8662f3b888a00a`; strict validation returned `true`.
- The matrix has no clipping or overlap. Partial outputs show B as unknown and B−A as `不可计算`, with no stale numeric deltas. C07 stays UNASSESSED; the v4 claim remains unclaimed and receives no matrix credit in this local pass.


## Full local verification — 2026-10-23T15:40Z

`pnpm lint`, `pnpm harness:test` (885/885), `pnpm test:render` (32 files; 168 passed, 2 skipped), `pnpm acceptance:check` (311 tests), `pnpm harness frontier:check` (122 records / 97 actionable), `pnpm harness guard:legacy-paths --base origin/master --product-epoch`, and `git diff --check` all pass. The local profile remains UNCLAIMED; this does not replace exact-Candidate GitHub CI, Harness candidate readiness, or the assigned Luna Max review.
