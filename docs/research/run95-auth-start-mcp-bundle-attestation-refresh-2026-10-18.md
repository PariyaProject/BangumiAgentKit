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

The first runner attempt stopped before Harness created a profile claim, before `codex exec`, and before an MCP call. Harness readback remained `UNCLAIMED`; that preclaim stop did not consume the one-shot.

After the refreshed Candidate passed exact-head CI, Harness Candidate readiness, and same-identity review, the single profile call ran on 2026-10-18T12:48:05.829Z. Harness recorded terminal `INCONCLUSIVE` for claim `profile-run-95-pr-227-42ff713890f7-1792327644743`, bound to Candidate `42ff713890f71310022ccca9d922dfddb20f0307`, Base `90eef4b132690a6ea12ac77ac66190d143d27874`, and bundle `1252c04e0aeb38ba0afb746b4d5c79c7368617ae3f8d9307012d7c49a7a281a9`. `retryAllowed=false`; claim and terminal labels are present; no report file was written.

The runner's sanitized result was `AUTH_START_AGENT_MCP_ASSERTION_FAILED`: Codex exited 0 and the event stream parsed, but the event stream had 1 MCP event and 3 Codex error items while the server summary recorded 0 tool calls and `NOT_CALLED`. Other counts were 0 non-MCP tool events, 0 shell calls, 0 denied calls, and 0 HTTP requests. Answer semantics passed, but exact arguments, one-call, synthetic-URL, server-summary, and clean-event-stream checks failed. This note includes no raw prompt, answer, URL, OAuth state, account data, or event stream. The outcome earns no auth_start Agent/MCP matrix credit and must never be retried.

The profile result does not assess G26, establish OAuth consent or account access, or prove QQ/TIM delivery or real-client rendering. OP-009 stays `PARTIAL`; the profile only tested a synthetic offline auth_start path.
