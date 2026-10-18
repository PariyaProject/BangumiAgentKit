# Run #95 auth_start exact-Candidate MCP bundle attestation refresh

- **Recorded:** 2026-10-18 21:31 JST
- **Run:** Harness #95
- **Epoch:** `run95-auth-start-offline-agent-mcp-20261018`
- **PR:** #227
- **Source Candidate:** `8da93552cf2c751d99e7883d0c2c3613efb37468`
- **Base:** `90eef4b132690a6ea12ac77ac66190d143d27874`

## Why the attestation needed a refresh

The offline `bangumi.auth_start` runner checks the built MCP runtime bundle against `docs/product/g26-mcp-bundle-attestation.json` before creating its permanent profile claim. Its first preflight stopped before a claim because the built bundle digest was `1252c04e0aeb38ba0afb746b4d5c79c7368617ae3f8d9307012d7c49a7a281a9`, while the tracked attestation still contained `f97ac3b6ef35982c92578d76b1cb9c6a8c2ca799f859ab4ed98033b9731a07f6`.

Two consecutive `pnpm build` runs on the exact Source Candidate produced the same bundle SHA-256:

```text
1252c04e0aeb38ba0afb746b4d5c79c7368617ae3f8d9307012d7c49a7a281a9
```

The previous attestation was recorded by commit `05dcc85ced38d13581f418c125ad45c097a8e3d0`. Since then, current `master` changed bundled runtime source in:

- `apps/mcp/codex-one-tool-mcp-server.mjs`
- `packages/auth/src/auth-status-message.ts`
- `packages/auth/src/index.ts`
- `packages/auth/src/oauth-service.ts`
- `packages/renderer/src/components/CoverImage.tsx`
- `packages/renderer/src/components/TitleBlock.tsx`
- `packages/renderer/src/templates/CollectionIntelligenceCard.tsx`
- `packages/renderer/src/templates/CollectionProgressCard.tsx`
- `packages/renderer/src/templates/TemplateRegistry.tsx`
- `packages/renderer/src/view-model-builders/index.ts`
- `packages/tools/src/definitions/auth-tools.ts`
- `packages/tools/src/definitions/render-presentation-tools.ts`

The attestation update records build provenance only. The attestation and this report are outside the hashed bundle paths (`apps/mcp/dist` and `packages/*/dist`). The auth_start offline MCP server is also outside those build outputs.

## One-shot disposition and limits

The runner stopped before Harness created a profile claim, before `codex exec`, and before an MCP call. Harness readback remained `UNCLAIMED`, with no claim or terminal label and no disposition. The create-once report was absent. This was not an inconclusive profile result and did not consume the one-shot.

The refresh does not grant auth_start matrix credit, assess G26, or imply OAuth consent, account access, QQ/TIM delivery, or real-client rendering. The profile may proceed only after this refreshed Candidate passes exact-head CI, Harness Candidate readiness, and the same-identity GPT-6 Luna Max review.
